begin;
set local lock_timeout='5s';
alter table public.farmer_inventory_items drop constraint farmer_inventory_items_category_check;
alter table public.farmer_inventory_items add constraint farmer_inventory_items_category_check check(category in ('seed','fertilizer','chemical','fuel','maintenance','electricity','water','transport','analysis','machinery','labor','other_service','other'));
alter table public.farmer_inventory_items drop constraint farmer_inventory_items_base_unit_check;
alter table public.farmer_inventory_items add constraint farmer_inventory_items_base_unit_check check(base_unit in ('kg','L','adet','m','saat'));
alter table public.farmer_inventory_purchases drop constraint farmer_inventory_purchases_purchased_unit_check;
alter table public.farmer_inventory_purchases add constraint farmer_inventory_purchases_purchased_unit_check check(purchased_unit in ('kg','ton','g','L','ml','adet','m','m³','torba','şişe','saat'));
drop index public.farmer_inventory_item_identity;
create unique index farmer_inventory_item_identity on public.farmer_inventory_items (user_id,lower(btrim(name)),lower(btrim(brand)),base_unit,category);
alter table public.farmer_operations add column if not exists inventory_package_quantity numeric(18,6);
alter table public.farmer_operations add column if not exists inventory_package_unit text;
alter table public.farmer_operations add constraint operation_package_contents check(inventory_package_quantity is null or inventory_package_quantity between 0.000001 and 1000000000);
alter table public.farmer_operations drop constraint farmer_operations_type_v2;
alter table public.farmer_operations add constraint farmer_operations_type_v2 check(operation_type in ('soil_analysis','tillage','seed','planting','fertilizing','irrigation','spraying','weeding','harvest','other','hoeing','machine_spraying','machine_fertilizing','labor','pruning','machine_other','fuel','maintenance','electricity','transport'));

create or replace function public.agroverix_inventory_base(p_unit text) returns text language sql immutable set search_path='' as $$
 select case p_unit when 'kg' then 'kg' when 'g' then 'kg' when 'ton' then 'kg' when 'L' then 'L' when 'ml' then 'L' when 'm³' then 'L' when 'adet' then 'adet' when 'm' then 'm' when 'saat' then 'saat' else null end;
$$;
create or replace function public.agroverix_inventory_factor(p_unit text) returns numeric language sql immutable set search_path='' as $$
 select case p_unit when 'g' then 0.001 when 'ml' then 0.001 when 'ton' then 1000 when 'm³' then 1000 when 'kg' then 1 when 'L' then 1 when 'adet' then 1 when 'm' then 1 when 'saat' then 1 else null end::numeric;
$$;
create or replace function public.agroverix_operation_quantity(p_quantity numeric,p_unit text,p_package_quantity numeric,p_package_unit text) returns numeric
language plpgsql immutable set search_path='' as $$
declare v_quantity numeric;
begin
 if p_unit in('torba','şişe') then
  if p_package_quantity is null or p_package_quantity<=0 or p_package_quantity>1000000000 then raise exception 'Ambalaj içeriğini gir.';end if;
  v_quantity:=p_quantity*p_package_quantity*public.agroverix_inventory_factor(p_package_unit);
 else v_quantity:=p_quantity*public.agroverix_inventory_factor(p_unit);end if;
 if v_quantity is null or v_quantity<=0 or v_quantity>1000000000000 then raise exception 'Kullanılan miktar veya birimi geçersiz.';end if;
 return round(v_quantity,6);
end $$;
revoke all on function public.agroverix_operation_quantity(numeric,text,numeric,text) from public,anon;
grant execute on function public.agroverix_operation_quantity(numeric,text,numeric,text) to authenticated;

create or replace function public.agroverix_save_inventory_purchase(p_purchase jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid:=auth.uid();v_item uuid;v_id uuid;v_base text;v_unit text;
begin
 if v_owner is null then raise exception 'Önce hesabına giriş yap.';end if;
 v_item:=nullif(p_purchase->>'item_id','')::uuid;v_id:=nullif(p_purchase->>'id','')::uuid;
 v_unit:=p_purchase->>'purchased_unit';
 if v_unit in('torba','şişe') then v_unit:=p_purchase->>'package_unit';end if;
 v_base:=public.agroverix_inventory_base(v_unit);
 if v_base is null then raise exception 'Geçerli bir alışveriş birimi seç.';end if;
 if v_item is null then
  insert into public.farmer_inventory_items(user_id,name,brand,category,base_unit)
  values(v_owner,btrim(p_purchase->>'name'),btrim(coalesce(p_purchase->>'brand','')),coalesce(p_purchase->>'category','other'),v_base)
  on conflict(user_id,lower(btrim(name)),lower(btrim(brand)),base_unit,category) do update set updated_at=now()
  returning id into v_item;
 end if;
 if v_id is null then
  insert into public.farmer_inventory_purchases(user_id,item_id,supplier,purchase_date,purchased_quantity,purchased_unit,package_quantity,package_unit,quantity,total_cost,notes)
  values(v_owner,v_item,btrim(p_purchase->>'supplier'),(p_purchase->>'purchase_date')::date,(p_purchase->>'purchased_quantity')::numeric,p_purchase->>'purchased_unit',nullif(p_purchase->>'package_quantity','')::numeric,nullif(p_purchase->>'package_unit',''),1,(p_purchase->>'total_cost')::numeric,nullif(btrim(p_purchase->>'notes'),'')) returning id into v_id;
 else
  update public.farmer_inventory_purchases set item_id=v_item,supplier=btrim(p_purchase->>'supplier'),purchase_date=(p_purchase->>'purchase_date')::date,purchased_quantity=(p_purchase->>'purchased_quantity')::numeric,purchased_unit=p_purchase->>'purchased_unit',package_quantity=nullif(p_purchase->>'package_quantity','')::numeric,package_unit=nullif(p_purchase->>'package_unit',''),total_cost=(p_purchase->>'total_cost')::numeric,notes=nullif(btrim(p_purchase->>'notes'),'') where id=v_id and user_id=v_owner;
  if not found then raise exception 'Alışveriş kaydı bulunamadı.';end if;
 end if;
 return v_id;
end $$;
create or replace function public.agroverix_purchase_stock_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_old uuid; v_new uuid; v_base text; v_qty numeric; v_unit text; v_pack numeric;
begin
 if tg_op<>'INSERT' then v_old:=old.item_id;v_owner:=old.user_id; end if;
 if tg_op<>'DELETE' then
  v_new:=new.item_id;v_owner:=new.user_id;
  if tg_op='UPDATE' and (new.user_id<>old.user_id or new.id<>old.id) then raise exception 'Kayıt sahibi değiştirilemez.';end if;
 end if;
 if auth.uid() is not null and auth.uid()<>v_owner then raise exception 'Bu kayıt hesabına ait değil.';end if;
 if tg_op='UPDATE' and row(new.item_id,new.purchased_quantity,new.purchased_unit,new.package_quantity,new.package_unit) is not distinct from row(old.item_id,old.purchased_quantity,old.purchased_unit,old.package_quantity,old.package_unit) then
  new.quantity:=old.quantity;new.updated_at:=now();return new;
 end if;
 perform 1 from public.farmer_inventory_items where id in(v_old,v_new) order by id for update;
 if tg_op<>'DELETE' then
  select base_unit into v_base from public.farmer_inventory_items where id=v_new and user_id=v_owner;
  if not found then raise exception 'Stok ürünü bulunamadı.';end if;
  v_unit:=new.purchased_unit;v_pack:=1;
  if v_unit in('torba','şişe') then
   if new.package_quantity is null or not(new.package_quantity>0 and new.package_quantity<=1000000000) then raise exception 'Bir torba veya şişenin içeriğini gir.';end if;
   v_unit:=new.package_unit;v_pack:=new.package_quantity;
  else new.package_quantity:=null;new.package_unit:=null;end if;
  if public.agroverix_inventory_base(v_unit) is distinct from v_base then raise exception 'Alışveriş birimi stok ürünüyle uyumlu değil.';end if;
  v_qty:=round(new.purchased_quantity*v_pack*public.agroverix_inventory_factor(v_unit),6);
  if not(v_qty>0 and v_qty<=1000000000000) then raise exception 'Alışveriş miktarı geçersiz.';end if;
  new.quantity:=v_qty;new.updated_at:=now();
 end if;
 if tg_op='UPDATE' and v_old=v_new then perform public.agroverix_inventory_adjust(v_new,v_owner,new.quantity-old.quantity);
 else
  if tg_op<>'INSERT' then perform public.agroverix_inventory_adjust(v_old,v_owner,-old.quantity);end if;
  if tg_op<>'DELETE' then perform public.agroverix_inventory_adjust(v_new,v_owner,new.quantity);end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create or replace function public.agroverix_operation_stock_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid;v_old uuid;v_new uuid;v_oldqty numeric:=0;v_qty numeric:=0;v_base text;
begin
 if tg_op<>'INSERT' then v_old:=old.inventory_item_id;v_oldqty:=coalesce(old.inventory_quantity,0);v_owner:=old.user_id;end if;
 if tg_op<>'DELETE' then
  v_new:=new.inventory_item_id;v_owner:=new.user_id;
  if (v_old is not null or v_new is not null) and tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Kayıt sahibi değiştirilemez.';end if;
 end if;
 if v_old is null and v_new is null then
  if tg_op='DELETE' then return old;end if;
  new.inventory_quantity:=null;return new;
 end if;
 if auth.uid() is not null and auth.uid()<>v_owner then raise exception 'Bu stok hesabına ait değil.';end if;
 perform 1 from public.farmer_inventory_items where id in(v_old,v_new) order by id for update;
 if v_new is not null then
  select base_unit into v_base from public.farmer_inventory_items where id=v_new and user_id=v_owner;
  if not found then raise exception 'Stok ürünü bulunamadı.';end if;
  if new.cost_basis is distinct from 'field_total' then raise exception 'Bu eski kaydı düzenleyip miktarı tarla toplamı olarak kaydet.';end if;
  if public.agroverix_inventory_base(case when new.quantity_unit in('torba','şişe') then new.inventory_package_unit else new.quantity_unit end) is distinct from v_base then raise exception 'Kullanım birimi stok ürünüyle uyumlu değil.';end if;
  v_qty:=public.agroverix_operation_quantity(new.quantity,new.quantity_unit,new.inventory_package_quantity,new.inventory_package_unit);
  if v_qty is null or not(v_qty>0 and v_qty<=1000000000000) then raise exception 'Kullanılan miktar geçersiz.';end if;
 end if;
 if tg_op='UPDATE' and v_old=v_new then perform public.agroverix_inventory_adjust(v_new,v_owner,v_oldqty-v_qty);
 else
  if v_old is not null then perform public.agroverix_inventory_adjust(v_old,v_owner,v_oldqty);end if;
  if v_new is not null then perform public.agroverix_inventory_adjust(v_new,v_owner,-v_qty);end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 new.inventory_quantity:=case when v_new is null then null else v_qty end;return new;
end $$;
create or replace function public.agroverix_operation_auto_cost() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_old uuid;v_base text;v_quantity numeric;v_price numeric;v_bought numeric;v_cost numeric;
begin
 if new.cost_source is distinct from 'inventory_average' then new.inventory_unit_cost:=null;return new;end if;
 if auth.uid() is not null and auth.uid()<>new.user_id then raise exception 'Bu masraf hesabına ait değil.';end if;
 if new.inventory_item_id is null or new.cost_basis is distinct from 'field_total' then raise exception 'Otomatik maliyet için stok ürünü ve tarla toplam miktarı gerekli.';end if;
 if tg_op='UPDATE' then v_old:=old.inventory_item_id;end if;
 perform 1 from public.farmer_inventory_items where id in(v_old,new.inventory_item_id) order by id for update;
 select base_unit into v_base from public.farmer_inventory_items where id=new.inventory_item_id and user_id=new.user_id;
 if not found then raise exception 'Stok ürünü bulunamadı.';end if;
 if public.agroverix_inventory_base(case when new.quantity_unit in('torba','şişe') then new.inventory_package_unit else new.quantity_unit end) is distinct from v_base then raise exception 'Kullanım birimi stok ürünüyle uyumlu değil.';end if;
 v_quantity:=public.agroverix_operation_quantity(new.quantity,new.quantity_unit,new.inventory_package_quantity,new.inventory_package_unit);
 if v_quantity is null or v_quantity<=0 then raise exception 'Kullanılan toplam miktar sıfırdan büyük olmalı.';end if;
 if tg_op='UPDATE' then
  if old.cost_source='inventory_average' and old.inventory_item_id=new.inventory_item_id and old.operation_date=new.operation_date and old.inventory_unit_cost is not null then
   v_price:=old.inventory_unit_cost;
  end if;
 end if;
 if v_price is null then
  select sum(quantity),sum(total_cost) into v_bought,v_cost from public.farmer_inventory_purchases
   where user_id=new.user_id and item_id=new.inventory_item_id and purchase_date<=new.operation_date;
  if v_bought is null or v_bought<=0 then raise exception 'İşlem tarihine kadar bu ürünün alışveriş kaydı yok. Önce alışverişi ekle veya maliyeti elle gir.';end if;
  v_price:=v_cost/v_bought;
 end if;
 v_cost:=round(v_quantity*v_price,2);
 if v_cost<0 or v_cost>9999999999.99 then raise exception 'Hesaplanan maliyet izin verilen aralığı aşıyor.';end if;
 new.inventory_unit_cost:=v_price;new.total_cost:=v_cost;
 return new;
end $$;

create table public.farmer_dealer_payments(
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 supplier text not null check(length(btrim(supplier)) between 1 and 200),
 payment_date date not null,
 amount numeric(18,2) not null check(amount>0 and amount<=1000000000000),
 notes text check(length(notes)<=500),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,user_id)
);
alter table public.farmer_inventory_payments add column payment_group_id uuid;
alter table public.farmer_inventory_payments add constraint payment_group_owner foreign key(payment_group_id,user_id) references public.farmer_dealer_payments(id,user_id) on delete cascade;
create index inventory_payment_group on public.farmer_inventory_payments(payment_group_id) where payment_group_id is not null;
alter table public.farmer_dealer_payments enable row level security;
alter table public.farmer_dealer_payments force row level security;
create policy dealer_payments_owner on public.farmer_dealer_payments for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.farmer_dealer_payments from public,anon,authenticated;
grant select on public.farmer_dealer_payments to authenticated;

create or replace function public.agroverix_supplier_key(p_supplier text) returns text language sql immutable set search_path='' as $$select lower(translate(btrim(p_supplier),'Iİ','ıi'));$$;
revoke all on function public.agroverix_supplier_key(text) from public,anon;
grant execute on function public.agroverix_supplier_key(text) to authenticated;

create or replace function public.agroverix_payment_group_consistency() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ids uuid[];v_id uuid;v_expected numeric;v_actual numeric;v_supplier text;v_owner uuid;
begin
 if tg_table_name='farmer_dealer_payments' then
  v_ids:=array[case when tg_op='DELETE' then old.id else new.id end];
 elsif tg_op='INSERT' then v_ids:=array[new.payment_group_id];
 elsif tg_op='DELETE' then v_ids:=array[old.payment_group_id];
 else v_ids:=array[old.payment_group_id,new.payment_group_id];end if;
 foreach v_id in array v_ids loop
  if v_id is null then continue;end if;
  select amount,public.agroverix_supplier_key(supplier),user_id into v_expected,v_supplier,v_owner from public.farmer_dealer_payments where id=v_id;
  if not found then continue;end if;
  select coalesce(sum(amount),0) into v_actual from public.farmer_inventory_payments where payment_group_id=v_id and user_id=v_owner;
  if v_actual<>v_expected then raise exception 'Bayi ödemesini Ödeme Girişi bölümünden bütün olarak düzenle.';end if;
  if exists(select 1 from public.farmer_inventory_payments p join public.farmer_inventory_purchases r on r.id=p.purchase_id and r.user_id=p.user_id
    join public.farmer_dealer_payments g on g.id=p.payment_group_id and g.user_id=p.user_id
    where p.payment_group_id=v_id and (public.agroverix_supplier_key(r.supplier)<>v_supplier or p.payment_date<>g.payment_date)) then
   raise exception 'Bayi ödeme kayıtları birbiriyle uyumlu değil.';end if;
 end loop;
 return null;
end $$;
revoke all on function public.agroverix_payment_group_consistency() from public,anon,authenticated;
create constraint trigger dealer_payment_consistent after insert or update or delete on public.farmer_dealer_payments deferrable initially deferred for each row execute function public.agroverix_payment_group_consistency();
create constraint trigger dealer_allocation_consistent after insert or update or delete on public.farmer_inventory_payments deferrable initially deferred for each row execute function public.agroverix_payment_group_consistency();

create or replace function public.agroverix_purchase_dealer_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if public.agroverix_supplier_key(new.supplier) is distinct from public.agroverix_supplier_key(old.supplier) and exists(select 1 from public.farmer_inventory_payments where purchase_id=old.id and user_id=old.user_id and payment_group_id is not null) then
  raise exception 'Bu masrafın bayi ödemesi var. Bayi adını değiştirmeden önce ilgili bayi ödemesini düzenle.';end if;
 return new;
end $$;
revoke all on function public.agroverix_purchase_dealer_guard() from public,anon,authenticated;
create trigger inventory_purchase_dealer_guard before update on public.farmer_inventory_purchases for each row execute function public.agroverix_purchase_dealer_guard();

create or replace function public.agroverix_save_dealer_payment(p_payment jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_id uuid:=coalesce(nullif(p_payment->>'id','')::uuid,gen_random_uuid());
 v_supplier text:=btrim(p_payment->>'supplier');v_date date:=(p_payment->>'payment_date')::date;v_amount numeric:=round((p_payment->>'amount')::numeric,2);
 v_notes text:=nullif(btrim(p_payment->>'notes'),'');v_existing public.farmer_dealer_payments%rowtype;v_row record;v_left numeric;v_part numeric;v_debt numeric;
begin
 if v_owner is null then raise exception 'Önce hesabına giriş yap.';end if;
 if v_supplier is null or length(v_supplier) not between 1 and 200 or v_date is null or v_amount is null or v_amount<=0 or v_amount>1000000000000 then raise exception 'Bayi, ödeme tarihi ve tutarını kontrol et.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':dealer-payments',0));
 select * into v_existing from public.farmer_dealer_payments where id=v_id and user_id=v_owner for update;
 if found then
  if v_existing.supplier=v_supplier and v_existing.payment_date=v_date and v_existing.amount=v_amount and v_existing.notes is not distinct from v_notes then return v_id;end if;
  if coalesce((p_payment->>'editing')::boolean,false) is not true then raise exception 'Kayıt isteği kullanılmış. Ödeme formunu yeniden aç.';end if;
  if public.agroverix_supplier_key(v_existing.supplier)<>public.agroverix_supplier_key(v_supplier) then raise exception 'Ödemenin bayisi değiştirilemez.';end if;
 end if;
 -- Lock all affected receipts in one stable order before balance adjustments.
 perform 1 from public.farmer_inventory_purchases r where r.user_id=v_owner and
  (public.agroverix_supplier_key(r.supplier)=public.agroverix_supplier_key(v_supplier) or exists(select 1 from public.farmer_inventory_payments p where p.purchase_id=r.id and p.user_id=v_owner and p.payment_group_id=v_id))
  order by r.id for update;
 delete from public.farmer_inventory_payments where payment_group_id=v_id and user_id=v_owner;
 select coalesce(sum(total_cost-paid_total),0) into v_debt from public.farmer_inventory_purchases
  where user_id=v_owner and public.agroverix_supplier_key(supplier)=public.agroverix_supplier_key(v_supplier) and purchase_date<=v_date;
 if v_amount>v_debt then raise exception 'Ödeme tutarı, ödeme tarihine kadar olan kalan borcu aşıyor. Kalan borç: % TL.',v_debt;end if;
 insert into public.farmer_dealer_payments(id,user_id,supplier,payment_date,amount,notes) values(v_id,v_owner,v_supplier,v_date,v_amount,v_notes)
 on conflict(id) do update set supplier=excluded.supplier,payment_date=excluded.payment_date,amount=excluded.amount,notes=excluded.notes,updated_at=now()
 where public.farmer_dealer_payments.user_id=v_owner;
 if not found then raise exception 'Bu ödeme hesabına ait değil.';end if;
 v_left:=v_amount;
 for v_row in select id,total_cost-paid_total as debt from public.farmer_inventory_purchases
  where user_id=v_owner and public.agroverix_supplier_key(supplier)=public.agroverix_supplier_key(v_supplier) and purchase_date<=v_date and total_cost>paid_total
  order by purchase_date,id
 loop
  exit when v_left<=0;v_part:=least(v_left,v_row.debt);
  insert into public.farmer_inventory_payments(user_id,purchase_id,payment_date,amount,notes,payment_group_id)
   values(v_owner,v_row.id,v_date,v_part,v_notes,v_id);
  v_left:=v_left-v_part;
 end loop;
 if v_left<>0 then raise exception 'Ödeme borca dağıtılamadı. Sayfayı yenileyip tekrar dene.';end if;
 return v_id;
end $$;
create or replace function public.agroverix_delete_dealer_payment(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null then raise exception 'Önce hesabına giriş yap.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':dealer-payments',0));
 perform 1 from public.farmer_dealer_payments where id=p_id and user_id=v_owner for update;
 if not found then raise exception 'Ödeme kaydı bulunamadı.';end if;
 perform 1 from public.farmer_inventory_purchases r where r.user_id=v_owner and exists(select 1 from public.farmer_inventory_payments p where p.purchase_id=r.id and p.user_id=v_owner and p.payment_group_id=p_id) order by r.id for update;
 delete from public.farmer_inventory_payments where payment_group_id=p_id and user_id=v_owner;
 delete from public.farmer_dealer_payments where id=p_id and user_id=v_owner;
end $$;
revoke all on function public.agroverix_save_dealer_payment(jsonb),public.agroverix_delete_dealer_payment(uuid) from public,anon;
grant execute on function public.agroverix_save_dealer_payment(jsonb),public.agroverix_delete_dealer_payment(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
