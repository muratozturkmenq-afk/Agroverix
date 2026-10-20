begin;
alter table public.farmer_operations add column if not exists cost_source text not null default 'manual';
alter table public.farmer_operations add column if not exists inventory_unit_cost numeric;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='operation_cost_source' and conrelid='public.farmer_operations'::regclass) then
  alter table public.farmer_operations add constraint operation_cost_source check(cost_source in ('manual','inventory_average'));
 end if;
 if not exists(select 1 from pg_constraint where conname='operation_inventory_unit_cost' and conrelid='public.farmer_operations'::regclass) then
  alter table public.farmer_operations add constraint operation_inventory_unit_cost check(inventory_unit_cost is null or inventory_unit_cost between 0 and 100000000000000000000);
 end if;
end $$;

-- Runs before inventory_operation_stock. Lock both items in the same order as
-- the stock trigger so an edit that moves a usage cannot reverse lock order.
create or replace function public.agroverix_operation_auto_cost() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_old uuid;v_base text;v_quantity numeric;v_price numeric;v_bought numeric;v_cost numeric;
begin
 if new.cost_source is distinct from 'inventory_average' then new.inventory_unit_cost:=null;return new;end if;
 if auth.uid() is not null and auth.uid()<>new.user_id then raise exception 'Bu masraf hesabına ait değil.';end if;
 if new.inventory_item_id is null or new.cost_basis is distinct from 'field_total' then raise exception 'Otomatik maliyet için stok ürünü ve tarla toplam miktarı gerekli.';end if;
 if new.operation_type in('tillage','planting','hoeing','machine_spraying','machine_fertilizing','labor','pruning','harvest','machine_other') then raise exception 'Makine ve işçilik maliyetini elle gir.';end if;
 if tg_op='UPDATE' then v_old:=old.inventory_item_id;end if;
 perform 1 from public.farmer_inventory_items where id in(v_old,new.inventory_item_id) order by id for update;
 select base_unit into v_base from public.farmer_inventory_items where id=new.inventory_item_id and user_id=new.user_id;
 if not found then raise exception 'Stok ürünü bulunamadı.';end if;
 if public.agroverix_inventory_base(new.quantity_unit) is distinct from v_base then raise exception 'Kullanım birimi stok ürünüyle uyumlu değil.';end if;
 v_quantity:=round(new.quantity*public.agroverix_inventory_factor(new.quantity_unit),6);
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
revoke all on function public.agroverix_operation_auto_cost() from public,anon,authenticated;
drop trigger if exists inventory_operation_cost on public.farmer_operations;
create trigger inventory_operation_cost before insert or update on public.farmer_operations for each row execute function public.agroverix_operation_auto_cost();
create or replace function public.agroverix_operation_costing_ready() returns boolean language sql security invoker set search_path='' as $$ select true; $$;
revoke all on function public.agroverix_operation_costing_ready() from public,anon;
grant execute on function public.agroverix_operation_costing_ready() to authenticated;
notify pgrst,'reload schema';
commit;
