begin;

create table if not exists public.farmer_inventory_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 160),
 brand text not null default '' check (length(brand)<=160),
 category text not null default 'other' check(category in ('seed','fertilizer','chemical','other')),
 base_unit text not null check(base_unit in ('kg','L','adet','m')),
 stock_quantity numeric(20,6) not null default 0 check(stock_quantity between 0 and 1000000000000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,user_id)
);
create unique index if not exists farmer_inventory_item_identity on public.farmer_inventory_items
 (user_id,lower(btrim(name)),lower(btrim(brand)),base_unit);
create table if not exists public.farmer_inventory_purchases (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 item_id uuid not null,
 supplier text not null check(length(btrim(supplier)) between 1 and 200),
 purchase_date date not null default current_date,
 purchased_quantity numeric(18,6) not null check(purchased_quantity>0 and purchased_quantity<=1000000000),
 purchased_unit text not null check(purchased_unit in ('kg','ton','g','L','ml','adet','m','m³','torba','şişe')),
 package_quantity numeric(18,6), package_unit text,
 quantity numeric(20,6) not null check(quantity>0 and quantity<=1000000000000),
 total_cost numeric(18,2) not null check(total_cost between 0 and 1000000000000),
 notes text check(length(notes)<=1000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(item_id,user_id) references public.farmer_inventory_items(id,user_id)
);
alter table public.farmer_operations add column if not exists inventory_item_id uuid;
alter table public.farmer_operations add column if not exists inventory_quantity numeric(20,6);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='farmer_operation_inventory_owner' and conrelid='public.farmer_operations'::regclass) then
  alter table public.farmer_operations add constraint farmer_operation_inventory_owner foreign key(inventory_item_id,user_id) references public.farmer_inventory_items(id,user_id);
 end if;
end $$;
create index if not exists farmer_inventory_purchases_owner on public.farmer_inventory_purchases(user_id,purchase_date);
create index if not exists farmer_inventory_operations_item on public.farmer_operations(inventory_item_id) where inventory_item_id is not null;

alter table public.farmer_inventory_items enable row level security;
alter table public.farmer_inventory_items force row level security;
alter table public.farmer_inventory_purchases enable row level security;
alter table public.farmer_inventory_purchases force row level security;
drop policy if exists inventory_items_owner on public.farmer_inventory_items;
create policy inventory_items_owner on public.farmer_inventory_items for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists inventory_purchases_owner on public.farmer_inventory_purchases;
create policy inventory_purchases_owner on public.farmer_inventory_purchases for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.farmer_inventory_items,public.farmer_inventory_purchases from public,anon,authenticated;
grant select on public.farmer_inventory_items to authenticated;
grant insert(user_id,name,brand,category,base_unit) on public.farmer_inventory_items to authenticated;
grant update(name,brand,category,updated_at) on public.farmer_inventory_items to authenticated;
grant select,insert,update,delete on public.farmer_inventory_purchases to authenticated;

create or replace function public.agroverix_inventory_base(p_unit text) returns text
language sql immutable set search_path='' as $$
 select case p_unit when 'kg' then 'kg' when 'g' then 'kg' when 'ton' then 'kg'
 when 'L' then 'L' when 'ml' then 'L' when 'm³' then 'L' when 'adet' then 'adet' when 'm' then 'm' else null end;
$$;
create or replace function public.agroverix_inventory_factor(p_unit text) returns numeric
language sql immutable set search_path='' as $$
 select case p_unit when 'g' then 0.001 when 'ml' then 0.001 when 'ton' then 1000 when 'm³' then 1000
 when 'kg' then 1 when 'L' then 1 when 'adet' then 1 when 'm' then 1 else null end::numeric;
$$;
revoke all on function public.agroverix_inventory_base(text),public.agroverix_inventory_factor(text) from public,anon;
grant execute on function public.agroverix_inventory_base(text),public.agroverix_inventory_factor(text) to authenticated;

-- Only database triggers can change the balance. The conditional update is atomic,
-- including simultaneous usages from more than one phone or browser tab.
create or replace function public.agroverix_inventory_adjust(p_item uuid,p_owner uuid,p_delta numeric)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_item is null or p_delta=0 then return; end if;
 update public.farmer_inventory_items set stock_quantity=stock_quantity+p_delta,updated_at=now()
 where id=p_item and user_id=p_owner and stock_quantity+p_delta>=0;
 if not found then
  -- A parent may already be absent during an authorised account cascade.
  if not exists(select 1 from public.farmer_inventory_items where id=p_item) then return; end if;
  raise exception 'Yetersiz stok. Alışveriş miktarını ve tarlada kullanılan miktarı kontrol et.' using errcode='P0001';
 end if;
end $$;
revoke all on function public.agroverix_inventory_adjust(uuid,uuid,numeric) from public,anon,authenticated;

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
revoke all on function public.agroverix_purchase_stock_trigger() from public,anon,authenticated;
drop trigger if exists inventory_purchase_stock on public.farmer_inventory_purchases;
create trigger inventory_purchase_stock before insert or update or delete on public.farmer_inventory_purchases for each row execute function public.agroverix_purchase_stock_trigger();

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
  if new.operation_type in('tillage','planting','hoeing','machine_spraying','machine_fertilizing','labor','pruning','harvest','machine_other') then raise exception 'Makine ve işçilik stoktan düşülmez.';end if;
  if public.agroverix_inventory_base(new.quantity_unit) is distinct from v_base then raise exception 'Kullanım birimi stok ürünüyle uyumlu değil.';end if;
  v_qty:=round(new.quantity*public.agroverix_inventory_factor(new.quantity_unit),6);
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
revoke all on function public.agroverix_operation_stock_trigger() from public,anon,authenticated;
drop trigger if exists inventory_operation_stock on public.farmer_operations;
create trigger inventory_operation_stock before insert or update or delete on public.farmer_operations for each row execute function public.agroverix_operation_stock_trigger();

-- One transaction creates/reuses the product and saves the receipt. RLS remains active.
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
  on conflict(user_id,lower(btrim(name)),lower(btrim(brand)),base_unit) do update set updated_at=now()
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
revoke all on function public.agroverix_save_inventory_purchase(jsonb) from public,anon;
grant execute on function public.agroverix_save_inventory_purchase(jsonb) to authenticated;
-- Realtime uses the same owner RLS policies; no broader data access is granted.
do $$ declare v_table text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach v_table in array array['farmer_inventory_items','farmer_inventory_purchases','farmer_operations'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
    execute format('alter publication supabase_realtime add table public.%I',v_table);
   end if;
  end loop;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
