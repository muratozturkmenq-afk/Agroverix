begin;
alter table public.farmer_inventory_purchases add column if not exists paid_total numeric(18,2) not null default 0;
alter table public.farmer_inventory_purchases add column if not exists client_request_id uuid;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='inventory_purchase_payment_balance' and conrelid='public.farmer_inventory_purchases'::regclass) then
  alter table public.farmer_inventory_purchases add constraint inventory_purchase_payment_balance check(paid_total>=0 and paid_total<=total_cost);
 end if;
 if not exists(select 1 from pg_constraint where conname='inventory_purchase_owner_identity' and conrelid='public.farmer_inventory_purchases'::regclass) then
  alter table public.farmer_inventory_purchases add constraint inventory_purchase_owner_identity unique(id,user_id);
 end if;
end $$;
create unique index if not exists inventory_purchase_request on public.farmer_inventory_purchases(user_id,client_request_id);
create table if not exists public.farmer_inventory_payments(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 purchase_id uuid not null,
 payment_date date not null,
 amount numeric(18,2) not null check(amount>0 and amount<=1000000000000),
 notes text check(length(notes)<=500),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(purchase_id,user_id) references public.farmer_inventory_purchases(id,user_id)
);
create index if not exists inventory_payments_owner on public.farmer_inventory_payments(user_id,purchase_id,payment_date);
alter table public.farmer_inventory_payments enable row level security;
alter table public.farmer_inventory_payments force row level security;
drop policy if exists inventory_payments_owner on public.farmer_inventory_payments;
create policy inventory_payments_owner on public.farmer_inventory_payments for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.farmer_inventory_payments from public,anon,authenticated;
grant select on public.farmer_inventory_payments to authenticated;
-- paid_total is changed only by the payment trigger. Existing stock permissions remain.
revoke insert,update on public.farmer_inventory_purchases from public,anon,authenticated;
grant insert(id,user_id,item_id,supplier,purchase_date,purchased_quantity,purchased_unit,package_quantity,package_unit,quantity,total_cost,notes,created_at,updated_at,client_request_id) on public.farmer_inventory_purchases to authenticated;
grant update(item_id,supplier,purchase_date,purchased_quantity,purchased_unit,package_quantity,package_unit,quantity,total_cost,notes,updated_at,client_request_id) on public.farmer_inventory_purchases to authenticated;

create or replace function public.agroverix_purchase_payment_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.paid_total>0 and exists(select 1 from auth.users where id=old.user_id) then
   raise exception 'Bu alışverişte ödeme kayıtları var. Önce ilgili ödemeleri kontrol et.';
  end if;
  return old;
 end if;
 if new.total_cost<new.paid_total then raise exception 'Alışveriş bedeli kaydedilmiş ödemelerden az olamaz.';end if;
 return new;
end $$;
revoke all on function public.agroverix_purchase_payment_guard() from public,anon,authenticated;
drop trigger if exists inventory_purchase_payment_guard on public.farmer_inventory_purchases;
create trigger inventory_purchase_payment_guard before update or delete on public.farmer_inventory_purchases for each row execute function public.agroverix_purchase_payment_guard();

create or replace function public.agroverix_inventory_payment_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid;v_purchase uuid;v_date date;v_delta numeric;v_total numeric;v_paid numeric;
begin
 if tg_op='DELETE' then v_owner:=old.user_id;v_purchase:=old.purchase_id;v_delta:=-old.amount;
 else
  v_owner:=new.user_id;v_purchase:=new.purchase_id;
  if tg_op='UPDATE' then
   if new.id<>old.id or new.user_id<>old.user_id or new.purchase_id<>old.purchase_id then raise exception 'Ödemenin bağlı olduğu alışveriş veya kayıt sahibi değiştirilemez.';end if;
   v_delta:=new.amount-old.amount;
  else v_delta:=new.amount;end if;
  if new.amount is null or new.amount<=0 then raise exception 'Ödeme tutarı sıfırdan büyük olmalı.';end if;
  new.updated_at:=now();
 end if;
 if auth.uid() is not null and auth.uid()<>v_owner then raise exception 'Bu ödeme hesabına ait değil.';end if;
 select purchase_date,total_cost,paid_total into v_date,v_total,v_paid from public.farmer_inventory_purchases where id=v_purchase and user_id=v_owner for update;
 if not found then
  if tg_op='DELETE' then return old;end if;
  raise exception 'Alışveriş kaydı bulunamadı.';
 end if;
 if v_paid+v_delta>v_total then raise exception 'Ödeme tutarı kalan borcu aşıyor. Kalan borç: % TL.',v_total-v_paid;end if;
 if v_paid+v_delta<0 then raise exception 'Ödeme bakiyesi geçersiz.';end if;
 update public.farmer_inventory_purchases set paid_total=paid_total+v_delta,updated_at=now() where id=v_purchase and user_id=v_owner;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.agroverix_inventory_payment_trigger() from public,anon,authenticated;
drop trigger if exists inventory_payment_balance on public.farmer_inventory_payments;
create trigger inventory_payment_balance before insert or update or delete on public.farmer_inventory_payments for each row execute function public.agroverix_inventory_payment_trigger();

create or replace function public.agroverix_save_inventory_payment(p_payment jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_id uuid:=coalesce(nullif(p_payment->>'id','')::uuid,gen_random_uuid());v_existing uuid;v_purchase uuid:=(p_payment->>'purchase_id')::uuid;
begin
 if v_owner is null then raise exception 'Önce hesabına giriş yap.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||v_id::text,0));
 select purchase_id into v_existing from public.farmer_inventory_payments where id=v_id and user_id=v_owner;
 if found then
  if v_existing<>v_purchase then raise exception 'Ödemenin bağlı olduğu alışveriş değiştirilemez.';end if;
  update public.farmer_inventory_payments set payment_date=(p_payment->>'payment_date')::date,amount=(p_payment->>'amount')::numeric,notes=nullif(btrim(p_payment->>'notes'),'') where id=v_id and user_id=v_owner;
 else
  if not exists(select 1 from public.farmer_inventory_purchases where id=v_purchase and user_id=v_owner) then raise exception 'Alışveriş kaydı bulunamadı.';end if;
  insert into public.farmer_inventory_payments(id,user_id,purchase_id,payment_date,amount,notes) values(v_id,v_owner,v_purchase,(p_payment->>'payment_date')::date,(p_payment->>'amount')::numeric,nullif(btrim(p_payment->>'notes'),''));
 end if;
 return v_id;
end $$;
create or replace function public.agroverix_delete_inventory_payment(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null then raise exception 'Önce hesabına giriş yap.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||p_id::text,0));
 delete from public.farmer_inventory_payments where id=p_id and user_id=v_owner;
 if not found then raise exception 'Ödeme kaydı bulunamadı.';end if;
end $$;
revoke all on function public.agroverix_save_inventory_payment(jsonb),public.agroverix_delete_inventory_payment(uuid) from public,anon;
grant execute on function public.agroverix_save_inventory_payment(jsonb),public.agroverix_delete_inventory_payment(uuid) to authenticated;

-- Purchase and an optional first payment are saved in one transaction.
-- A request id prevents a retry after a lost response from duplicating a purchase.
create or replace function public.agroverix_save_purchase_and_payment(p_purchase jsonb,p_payment jsonb,p_request_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid:=auth.uid();v_id uuid;
begin
 if v_owner is null then raise exception 'Önce hesabına giriş yap.';end if;
 if nullif(p_purchase->>'id','') is not null then
  if p_payment is not null then raise exception 'Sonraki ödemeleri Ödeme Ekle bölümünden kaydet.';end if;
  return public.agroverix_save_inventory_purchase(p_purchase);
 end if;
 if p_request_id is null then raise exception 'Kayıt isteği eksik. Sayfayı yenile.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||p_request_id::text,0));
 select id into v_id from public.farmer_inventory_purchases where user_id=v_owner and client_request_id=p_request_id;
 if found then return v_id;end if;
 v_id:=public.agroverix_save_inventory_purchase(p_purchase);
 update public.farmer_inventory_purchases set client_request_id=p_request_id where id=v_id and user_id=v_owner;
 if p_payment is not null then
  perform public.agroverix_save_inventory_payment(p_payment||jsonb_build_object('id',p_request_id,'purchase_id',v_id));
 end if;
 return v_id;
end $$;
revoke all on function public.agroverix_save_purchase_and_payment(jsonb,jsonb,uuid) from public,anon;
grant execute on function public.agroverix_save_purchase_and_payment(jsonb,jsonb,uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='farmer_inventory_payments') then
  alter publication supabase_realtime add table public.farmer_inventory_payments;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
