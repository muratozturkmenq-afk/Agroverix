begin;
-- Alım seçimi eski kayıtlarda boş kalır; mevcut maliyet ve ortak stok değişmez.
alter table public.farmer_operations add column if not exists inventory_purchase_id uuid;
create unique index if not exists farmer_inventory_purchase_lot_owner on public.farmer_inventory_purchases(id,item_id,user_id);
do $$begin
 if not exists(select 1 from pg_constraint where conname='farmer_operation_purchase_owner' and conrelid='public.farmer_operations'::regclass) then
  alter table public.farmer_operations add constraint farmer_operation_purchase_owner foreign key(inventory_purchase_id,inventory_item_id,user_id) references public.farmer_inventory_purchases(id,item_id,user_id);
 end if;
end $$;
create index if not exists farmer_operations_purchase_lot on public.farmer_operations(inventory_purchase_id) where inventory_purchase_id is not null;
grant insert(inventory_purchase_id),update(inventory_purchase_id) on public.farmer_operations to authenticated;

-- Internal only: reserve explicit lot choices, then distribute earlier unassigned
-- uses oldest-first. Both client and database use this same balance rule.
create or replace function public.agroverix_inventory_lot_balances(p_owner uuid,p_item uuid,p_exclude uuid default null)
returns table(purchase_id uuid,remaining numeric)
language sql volatile security definer set search_path='' as $$
 with explicit as (
  select o.inventory_purchase_id,sum(coalesce(o.inventory_quantity,0)) as used
  from public.farmer_operations o where o.user_id=p_owner and o.inventory_item_id=p_item and o.inventory_purchase_id is not null and (p_exclude is null or o.id<>p_exclude) group by o.inventory_purchase_id
 ), legacy as (
  select coalesce(sum(o.inventory_quantity),0) as used from public.farmer_operations o where o.user_id=p_owner and o.inventory_item_id=p_item and o.inventory_purchase_id is null and (p_exclude is null or o.id<>p_exclude)
 ), lots as (
  select p.id,p.purchase_date,p.created_at,greatest(0,p.quantity-coalesce(e.used,0)) as qty
  from public.farmer_inventory_purchases p left join explicit e on e.inventory_purchase_id=p.id where p.user_id=p_owner and p.item_id=p_item
 ), running as (
  select *,coalesce(sum(qty) over(order by purchase_date,created_at,id rows between unbounded preceding and 1 preceding),0) as previous from lots
 )
 select id,greatest(0,qty-greatest(0,legacy.used-previous)) from running cross join legacy;
$$;
revoke all on function public.agroverix_inventory_lot_balances(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.agroverix_operation_lot_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_old uuid;v_exclude uuid;v_lot public.farmer_inventory_purchases%rowtype;v_available numeric;v_qty numeric;
begin
 if tg_op='UPDATE' then v_old:=old.inventory_item_id;v_exclude:=old.id;end if;
 if new.inventory_purchase_id is null then return new;end if;
 if auth.uid() is not null and auth.uid()<>new.user_id then raise exception 'Seçilen stok hesabına ait değil.';end if;
 if new.inventory_item_id is null or new.cost_source is distinct from 'inventory_average' or new.cost_basis is distinct from 'field_total' then raise exception 'Alım seçimi için otomatik maliyetli stok kaydı gerekli.';end if;
 perform 1 from public.farmer_inventory_items where id in(v_old,new.inventory_item_id) order by id for update;
 select * into v_lot from public.farmer_inventory_purchases where id=new.inventory_purchase_id and item_id=new.inventory_item_id and user_id=new.user_id;
 if not found then raise exception 'Seçilen alım kaydı hesabına ait değil veya bulunamadı.';end if;
 if v_lot.purchase_date>new.operation_date then raise exception 'Uygulama tarihi alım tarihinden önce olamaz.';end if;
 v_qty:=public.agroverix_operation_quantity(new.quantity,new.quantity_unit,new.inventory_package_quantity,new.inventory_package_unit);
 select remaining into v_available from public.agroverix_inventory_lot_balances(new.user_id,new.inventory_item_id,v_exclude) where purchase_id=new.inventory_purchase_id;
 if v_available is null or v_qty>v_available then raise exception 'Seçilen alımda yetersiz stok. Başka tarihli alımı seç veya kullanılan miktarı azalt.';end if;
 return new;
end $$;
revoke all on function public.agroverix_operation_lot_guard() from public,anon,authenticated;
drop trigger if exists inventory_operation_a_lot_guard on public.farmer_operations;
create trigger inventory_operation_a_lot_guard before insert or update on public.farmer_operations for each row execute function public.agroverix_operation_lot_guard();

create or replace function public.agroverix_operation_auto_cost() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_old uuid;v_base text;v_quantity numeric;v_price numeric;v_bought numeric;v_cost numeric;v_lot public.farmer_inventory_purchases%rowtype;
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
 if new.inventory_purchase_id is not null then
  select * into v_lot from public.farmer_inventory_purchases where id=new.inventory_purchase_id and user_id=new.user_id and item_id=new.inventory_item_id;
  if not found or v_lot.purchase_date>new.operation_date then raise exception 'Alım tarihi veya seçilen stok kaydı geçersiz.';end if;
  if tg_op='UPDATE' and old.inventory_purchase_id=new.inventory_purchase_id and old.operation_date=new.operation_date and old.inventory_unit_cost is not null then v_price:=old.inventory_unit_cost;else v_price:=v_lot.total_cost/v_lot.quantity;end if;
 end if;
 if tg_op='UPDATE' and new.inventory_purchase_id is null and old.inventory_purchase_id is null then
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

-- A used purchase cannot be moved to another product, deleted or shortened below
-- its explicit uses. Existing aggregate trigger still protects the shared total.
create or replace function public.agroverix_purchase_lot_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_used numeric;v_first date;
begin
 if tg_op='INSERT' then return new;end if;
 select coalesce(sum(inventory_quantity),0),min(operation_date) into v_used,v_first from public.farmer_operations where user_id=old.user_id and inventory_purchase_id=old.id;
 if v_used>0 then
  if tg_op='DELETE' then raise exception 'Bu alım tarlada kullanılmış. Önce ilgili uygulama kayıtlarını kontrol et.';end if;
  if new.item_id<>old.item_id or new.quantity<v_used then raise exception 'Alım miktarı seçilmiş kullanımlardan az olamaz veya ürün değiştirilemez.';end if;
  if new.purchase_date>v_first then raise exception 'Alım tarihi bu stokla yapılan ilk uygulamadan sonra olamaz.';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.agroverix_purchase_lot_guard() from public,anon,authenticated;
drop trigger if exists inventory_purchase_z_lot_guard on public.farmer_inventory_purchases;
create trigger inventory_purchase_z_lot_guard before update or delete on public.farmer_inventory_purchases for each row execute function public.agroverix_purchase_lot_guard();

create or replace function public.agroverix_inventory_lots_ready() returns boolean language sql security invoker set search_path='' as $$select true;$$;
revoke all on function public.agroverix_inventory_lots_ready() from public,anon;
grant execute on function public.agroverix_inventory_lots_ready() to authenticated;
notify pgrst,'reload schema';
commit;
