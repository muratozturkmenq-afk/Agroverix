begin;
set local lock_timeout='5s';

create table public.farmer_harvest_sales(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 farm_id uuid not null,
 season_year integer not null,
 sale_date date not null check(sale_date between date '2000-01-01' and date '2200-12-31'),
 buyer text not null check(length(btrim(buyer)) between 1 and 200),
 buyer_key text generated always as (lower(btrim(buyer))) stored,
 vehicle text not null default '' check(length(vehicle)<=80),
 quantity_kg numeric(18,6) not null check(quantity_kg>0 and quantity_kg<=1000000000),
 unit_price numeric(18,6) not null check(unit_price>=0 and unit_price<=1000000000),
 total_amount numeric(24,2) generated always as (round(quantity_kg*unit_price,2)) stored,
 notes text not null default '' check(length(notes)<=1000),
 is_void boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(farm_id,season_year) references public.farmer_seasons(farm_id,season_year) on delete cascade
);
create table public.farmer_harvest_receipts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 buyer text not null check(length(btrim(buyer)) between 1 and 200),
 buyer_key text generated always as (lower(btrim(buyer))) stored,
 receipt_date date not null check(receipt_date between date '2000-01-01' and date '2200-12-31'),
 amount numeric(24,2) not null check(amount>0 and amount<=1000000000000000000),
 notes text not null default '' check(length(notes)<=1000),
 is_void boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.farmer_harvest_sales enable row level security;
alter table public.farmer_harvest_receipts enable row level security;
create policy harvest_sales_owner on public.farmer_harvest_sales for select to authenticated using(user_id=(select auth.uid()));
create policy harvest_receipts_owner on public.farmer_harvest_receipts for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.farmer_harvest_sales,public.farmer_harvest_receipts from public,anon,authenticated;
grant select on public.farmer_harvest_sales,public.farmer_harvest_receipts to authenticated;
create index harvest_sales_owner_season on public.farmer_harvest_sales(user_id,farm_id,season_year,sale_date);
create index harvest_sales_buyer on public.farmer_harvest_sales(user_id,buyer_key,sale_date);
create index harvest_receipts_buyer on public.farmer_harvest_receipts(user_id,buyer_key,receipt_date);

-- Keep manually entered actual harvest intact; derived sales totals take precedence only while sales exist.
alter table public.farmer_seasons add column harvest_sale_count integer not null default 0 check(harvest_sale_count>=0);
alter table public.farmer_seasons add column harvest_sale_kg numeric not null default 0 check(harvest_sale_kg>=0);
alter table public.farmer_seasons add column harvest_sale_total numeric not null default 0 check(harvest_sale_total>=0);

create function public.agroverix_sync_harvest_season() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_farm uuid;old_year integer;new_farm uuid;new_year integer;r record;
begin
 if tg_op<>'INSERT' then old_farm:=old.farm_id;old_year:=old.season_year;end if;
 if tg_op<>'DELETE' then new_farm:=new.farm_id;new_year:=new.season_year;end if;
 for r in select s.farm_id,s.season_year from public.farmer_seasons s
  where (s.farm_id=old_farm and s.season_year=old_year) or (s.farm_id=new_farm and s.season_year=new_year)
  order by s.farm_id,s.season_year for update
 loop
  update public.farmer_seasons s set
   harvest_sale_count=(select count(*) from public.farmer_harvest_sales h where h.farm_id=r.farm_id and h.season_year=r.season_year and not h.is_void),
   harvest_sale_kg=(select coalesce(sum(h.quantity_kg),0) from public.farmer_harvest_sales h where h.farm_id=r.farm_id and h.season_year=r.season_year and not h.is_void),
   harvest_sale_total=(select coalesce(sum(h.total_amount),0) from public.farmer_harvest_sales h where h.farm_id=r.farm_id and h.season_year=r.season_year and not h.is_void),
   updated_at=now() where s.farm_id=r.farm_id and s.season_year=r.season_year;
 end loop;
 return null;
end $$;
revoke all on function public.agroverix_sync_harvest_season() from public,anon,authenticated;
create trigger sync_harvest_season after insert or update or delete on public.farmer_harvest_sales for each row execute function public.agroverix_sync_harvest_season();

-- Validate all dated company balances, also after changing/cancelling an older sale.
create function public.agroverix_check_harvest_balance(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if exists(
  with movement as(
   select buyer_key,sale_date as day,total_amount as delta from public.farmer_harvest_sales where user_id=p_user and not is_void
   union all select buyer_key,receipt_date,-amount from public.farmer_harvest_receipts where user_id=p_user and not is_void
  ),daily as(select buyer_key,day,sum(delta) as delta from movement group by buyer_key,day),
  running as(select sum(delta) over(partition by buyer_key order by day rows unbounded preceding) as balance from daily)
  select 1 from running where balance<0
 ) then raise exception 'Tahsilat, o tarihe kadar firmadan olan alacağı aşamaz. Satış veya tahsilat tarihini ve tutarını kontrol et.';end if;
end $$;
revoke all on function public.agroverix_check_harvest_balance(uuid) from public,anon,authenticated;

create function public.agroverix_save_harvest_sale(p_sale jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v_id uuid:=coalesce(nullif(p_sale->>'id','')::uuid,gen_random_uuid());v_farm uuid:=(p_sale->>'farm_id')::uuid;v_year integer:=(p_sale->>'season_year')::integer;
begin
 if u is null then raise exception 'Önce hesabına giriş yap.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2301));
 if not exists(select 1 from public.farmer_seasons s join public.farmer_farms f on f.id=s.farm_id where s.farm_id=v_farm and s.season_year=v_year and s.user_id=u and f.user_id=u) then raise exception 'Tarla ve sezon bulunamadı veya hesabına ait değil.';end if;
 insert into public.farmer_harvest_sales(id,user_id,farm_id,season_year,sale_date,buyer,vehicle,quantity_kg,unit_price,notes,is_void)
 values(v_id,u,v_farm,v_year,(p_sale->>'sale_date')::date,btrim(p_sale->>'buyer'),btrim(coalesce(p_sale->>'vehicle','')),(p_sale->>'quantity_kg')::numeric,(p_sale->>'unit_price')::numeric,btrim(coalesce(p_sale->>'notes','')),coalesce((p_sale->>'is_void')::boolean,false))
 on conflict(id) do update set farm_id=excluded.farm_id,season_year=excluded.season_year,sale_date=excluded.sale_date,buyer=excluded.buyer,vehicle=excluded.vehicle,quantity_kg=excluded.quantity_kg,unit_price=excluded.unit_price,notes=excluded.notes,is_void=excluded.is_void,updated_at=now()
 where farmer_harvest_sales.user_id=u;
 if not found then raise exception 'Satış kaydı hesabına ait değil.';end if;
 perform public.agroverix_check_harvest_balance(u);
 return v_id;
end $$;
create function public.agroverix_save_harvest_receipt(p_receipt jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v_id uuid:=coalesce(nullif(p_receipt->>'id','')::uuid,gen_random_uuid());v_buyer text:=btrim(p_receipt->>'buyer');
begin
 if u is null then raise exception 'Önce hesabına giriş yap.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,2301));
 if not coalesce((p_receipt->>'is_void')::boolean,false) and not exists(select 1 from public.farmer_harvest_sales where user_id=u and buyer_key=lower(v_buyer) and not is_void) then raise exception 'Önce bu firma için satış kaydet.';end if;
 insert into public.farmer_harvest_receipts(id,user_id,buyer,receipt_date,amount,notes,is_void)
 values(v_id,u,v_buyer,(p_receipt->>'receipt_date')::date,(p_receipt->>'amount')::numeric,btrim(coalesce(p_receipt->>'notes','')),coalesce((p_receipt->>'is_void')::boolean,false))
 on conflict(id) do update set buyer=excluded.buyer,receipt_date=excluded.receipt_date,amount=excluded.amount,notes=excluded.notes,is_void=excluded.is_void,updated_at=now()
 where farmer_harvest_receipts.user_id=u;
 if not found then raise exception 'Tahsilat kaydı hesabına ait değil.';end if;
 perform public.agroverix_check_harvest_balance(u);
 return v_id;
end $$;
revoke all on function public.agroverix_save_harvest_sale(jsonb),public.agroverix_save_harvest_receipt(jsonb) from public,anon;
grant execute on function public.agroverix_save_harvest_sale(jsonb),public.agroverix_save_harvest_receipt(jsonb) to authenticated;

create or replace function public.agroverix_admin_report_rows(p_dataset text,p_offset integer default 0,p_limit integer default 500,p_user_id uuid default null)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_agroverix_admin() then raise exception 'Yönetici erişimi gerekli' using errcode='42501';end if;
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'Geçersiz sayfalama';end if;
 if p_dataset not in ('accounts','profiles','farms','seasons','operations','harvest_sales','harvest_receipts') then raise exception 'Geçersiz rapor';end if;
 if p_offset=0 then insert into agroverix_private.report_access_log(admin_id,dataset,selected_user_id) values(auth.uid(),p_dataset,p_user_id);end if;
 if p_dataset='accounts' then
  return query select jsonb_build_object('user_id',u.id,'email',u.email,'phone',coalesce(p.phone,u.phone),'full_name',p.full_name,'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'phone_confirmed',u.phone_confirmed_at is not null and p.phone is not distinct from u.phone,'sms_consent',coalesce(p.sms_consent,false),'sms_consent_at',p.sms_consent_at)
  from auth.users u left join public.farmer_profiles p on p.user_id=u.id where p_user_id is null or u.id=p_user_id order by u.id offset p_offset limit p_limit;
 elsif p_dataset='profiles' then return query select to_jsonb(p) from public.farmer_profiles p where p_user_id is null or p.user_id=p_user_id order by p.user_id offset p_offset limit p_limit;
 elsif p_dataset='farms' then return query select to_jsonb(f) from public.farmer_farms f where p_user_id is null or f.user_id=p_user_id order by f.id offset p_offset limit p_limit;
 elsif p_dataset='seasons' then return query select to_jsonb(s) from public.farmer_seasons s where p_user_id is null or s.user_id=p_user_id order by s.farm_id,s.season_year offset p_offset limit p_limit;
 elsif p_dataset='operations' then return query select to_jsonb(o) from public.farmer_operations o where p_user_id is null or o.user_id=p_user_id order by o.id offset p_offset limit p_limit;
 elsif p_dataset='harvest_sales' then return query select to_jsonb(h) from public.farmer_harvest_sales h where p_user_id is null or h.user_id=p_user_id order by h.id offset p_offset limit p_limit;
 elsif p_dataset='harvest_receipts' then return query select to_jsonb(h) from public.farmer_harvest_receipts h where p_user_id is null or h.user_id=p_user_id order by h.id offset p_offset limit p_limit;
 end if;
end $$;
revoke all on function public.agroverix_admin_report_rows(text,integer,integer,uuid) from public,anon;
grant execute on function public.agroverix_admin_report_rows(text,integer,integer,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
