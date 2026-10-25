begin;
-- Account currency is selected once at registration. Existing accounts remain TRY.
create table if not exists public.farmer_account_settings(
 user_id uuid primary key references auth.users(id) on delete cascade,
 currency text not null default 'TRY' check(currency in ('TRY','EUR')),
 created_at timestamptz not null default now()
);
alter table public.farmer_account_settings enable row level security;
alter table public.farmer_account_settings force row level security;
revoke all on public.farmer_account_settings from public,anon,authenticated;
grant select on public.farmer_account_settings to authenticated;
create policy account_settings_owner_read on public.farmer_account_settings for select to authenticated using(user_id=(select auth.uid()));

alter table public.farmer_profiles add column if not exists country text not null default 'TR';
alter table public.farmer_farms add column if not exists country text not null default 'TR';
alter table public.farmer_profiles add constraint farmer_profile_country_iso check(country ~ '^[A-Z]{2}$');
alter table public.farmer_farms add constraint farmer_farm_country_iso check(country ~ '^[A-Z]{2}$');

create function public.agroverix_capture_signup_region() returns trigger
language plpgsql security definer set search_path='' as $$
declare p jsonb:=new.raw_user_meta_data->'agroverix_profile';code text:=coalesce(p->>'country','TR');
begin
 insert into public.farmer_account_settings(user_id,currency)
 values(new.id,case when p->>'currency'='EUR' then 'EUR' else 'TRY' end) on conflict(user_id) do nothing;
 if code ~ '^[A-Z]{2}$' then update public.farmer_profiles set country=code where user_id=new.id;end if;
 return new;
end $$;
revoke all on function public.agroverix_capture_signup_region() from public,anon,authenticated;
create trigger agroverix_capture_signup_region after insert on auth.users for each row execute function public.agroverix_capture_signup_region();
insert into public.farmer_account_settings(user_id,currency)
 select id,'TRY' from auth.users on conflict(user_id) do nothing;

-- Stamp every financial row server-side. Currency survives profile changes/deletion.
create function public.agroverix_stamp_account_currency() returns trigger
language plpgsql security definer set search_path='' as $$
declare code text;
begin
 if tg_op='UPDATE' then
  if new.user_id is distinct from old.user_id then raise exception 'Record owner cannot be changed';end if;
  if new.currency is distinct from old.currency then raise exception 'Record currency cannot be changed';end if;
 end if;
 select s.currency into code from public.farmer_account_settings s where s.user_id=new.user_id;
 if code is null then raise exception 'Account currency is not configured';end if;
 if tg_op='UPDATE' and old.currency<>code then raise exception 'Account and record currencies do not match';end if;
 new.currency:=code;
 return new;
end $$;
revoke all on function public.agroverix_stamp_account_currency() from public,anon,authenticated;
do $$ declare tbl text;begin
 foreach tbl in array array['farmer_farms','farmer_seasons','farmer_operations','farmer_inventory_items','farmer_inventory_purchases','farmer_inventory_payments','farmer_dealer_payments','farmer_harvest_sales','farmer_harvest_receipts'] loop
  execute format('alter table public.%I add column if not exists currency text not null default %L check(currency in (%L,%L))',tbl,'TRY','TRY','EUR');
  execute format('create trigger aaa_account_currency before insert or update on public.%I for each row execute function public.agroverix_stamp_account_currency()',tbl);
 end loop;
end $$;
comment on column public.farmer_seasons.expected_support is 'Farmer-entered total support in the immutable account currency; NULL unknown, zero none.';
comment on column public.farmer_seasons.actual_support is 'Farmer-entered actual total support in the immutable account currency; NULL unknown, zero none.';

create or replace function public.save_farmer_farm_season(p_farm jsonb,p_season jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_user uuid := auth.uid(); v_year integer := (p_season->>'season_year')::integer;
begin
  if v_user is null then raise exception 'Giriş yapmalısın'; end if;
  if v_year not between 2000 and 2200 then raise exception 'Geçersiz sezon'; end if;
  v_id := nullif(p_farm->>'id','')::uuid;
  if v_id is null then
    insert into public.farmer_farms(user_id,name,crop,area_decare,province,district,village,latitude,longitude,season_year,country)
    values(v_user,trim(p_farm->>'name'),trim(p_season->>'crop'),(p_season->>'area_decare')::numeric,p_farm->>'province',p_farm->>'district',p_farm->>'village',nullif(p_farm->>'latitude','')::float8,nullif(p_farm->>'longitude','')::float8,v_year,coalesce(nullif(p_farm->>'country',''),'TR')) returning id into v_id;
  else
    -- A past season can be corrected without changing the farm's active season.
    update public.farmer_farms set name=trim(p_farm->>'name'),country=case when p_farm ? 'country' then p_farm->>'country' else country end,province=p_farm->>'province',district=p_farm->>'district',village=p_farm->>'village',latitude=nullif(p_farm->>'latitude','')::float8,longitude=nullif(p_farm->>'longitude','')::float8,
    crop=case when v_year >= season_year then trim(p_season->>'crop') else crop end,
    area_decare=case when v_year >= season_year then (p_season->>'area_decare')::numeric else area_decare end,
    season_year=greatest(season_year,v_year),updated_at=now() where id=v_id and user_id=v_user;
    if not found then raise exception 'Tarla bulunamadı'; end if;
  end if;
  insert into public.farmer_seasons(farm_id,season_year,user_id,crop,area_decare,tenure,rent_total,expected_yield,expected_price,actual_yield,actual_price,expected_support,actual_support)
  values(v_id,v_year,v_user,trim(p_season->>'crop'),(p_season->>'area_decare')::numeric,p_season->>'tenure',(p_season->>'rent_total')::numeric,
  (p_season->>'expected_yield')::numeric,(p_season->>'expected_price')::numeric,(p_season->>'actual_yield')::numeric,(p_season->>'actual_price')::numeric,nullif(p_season->>'expected_support','')::numeric,nullif(p_season->>'actual_support','')::numeric)
  on conflict(farm_id,season_year) do update set crop=excluded.crop,area_decare=excluded.area_decare,tenure=excluded.tenure,rent_total=excluded.rent_total,expected_yield=excluded.expected_yield,expected_price=excluded.expected_price,actual_yield=excluded.actual_yield,actual_price=excluded.actual_price,
  expected_support=case when p_season ? 'expected_support' then excluded.expected_support else farmer_seasons.expected_support end,
  actual_support=case when p_season ? 'actual_support' then excluded.actual_support else farmer_seasons.actual_support end,updated_at=now();
  return v_id;
end $$;
revoke all on function public.save_farmer_farm_season(jsonb,jsonb) from public,anon;
grant execute on function public.save_farmer_farm_season(jsonb,jsonb) to authenticated;



create or replace function public.agroverix_admin_report_rows(p_dataset text,p_offset integer default 0,p_limit integer default 500,p_user_id uuid default null)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_agroverix_admin() then raise exception 'Yönetici erişimi gerekli' using errcode='42501';end if;
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'Geçersiz sayfalama';end if;
 if p_dataset not in ('accounts','profiles','farms','seasons','operations','harvest_sales','harvest_receipts') then raise exception 'Geçersiz rapor';end if;
 if p_offset=0 then insert into agroverix_private.report_access_log(admin_id,dataset,selected_user_id) values(auth.uid(),p_dataset,p_user_id);end if;
 if p_dataset='accounts' then
  return query select jsonb_build_object('user_id',u.id,'email',u.email,'currency',coalesce(cs.currency,'TRY'),'phone',coalesce(p.phone,u.phone),'full_name',p.full_name,'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'phone_confirmed',u.phone_confirmed_at is not null and p.phone is not distinct from u.phone,'sms_consent',coalesce(p.sms_consent,false),'sms_consent_at',p.sms_consent_at)
  from auth.users u left join public.farmer_account_settings cs on cs.user_id=u.id left join public.farmer_profiles p on p.user_id=u.id where p_user_id is null or u.id=p_user_id order by u.id offset p_offset limit p_limit;
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
