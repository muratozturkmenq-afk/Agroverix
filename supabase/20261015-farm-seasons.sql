begin;

alter table public.farmer_farms add column if not exists season_year integer not null default extract(year from current_date)::integer;
alter table public.farmer_operations add column if not exists season_year integer;
update public.farmer_operations set season_year = extract(year from operation_date)::integer where season_year is null;
alter table public.farmer_operations alter column season_year set not null;

create table if not exists public.farmer_seasons (
  farm_id uuid not null references public.farmer_farms(id) on delete cascade,
  season_year integer not null check (season_year between 2000 and 2200),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  crop text not null check (length(trim(crop)) > 0),
  area_decare numeric not null check (area_decare > 0 and area_decare <= 1000000),
  tenure text not null default 'owned' check (tenure in ('owned','rented')),
  rent_total numeric not null default 0 check (rent_total >= 0),
  expected_yield numeric check (expected_yield > 0),
  expected_price numeric check (expected_price >= 0),
  actual_yield numeric check (actual_yield >= 0),
  actual_price numeric check (actual_price >= 0),
  updated_at timestamptz not null default now(),
  primary key (farm_id,season_year),
  check (tenure = 'rented' or rent_total = 0),
  check ((actual_yield is null) = (actual_price is null))
);
alter table public.farmer_seasons enable row level security;
drop policy if exists farmer_seasons_owner on public.farmer_seasons;
create policy farmer_seasons_owner on public.farmer_seasons for all to authenticated
using (user_id = auth.uid() and exists (select 1 from public.farmer_farms f where f.id = farm_id and f.user_id = auth.uid()))
with check (user_id = auth.uid() and exists (select 1 from public.farmer_farms f where f.id = farm_id and f.user_id = auth.uid()));
revoke all on public.farmer_seasons from anon;
grant select,insert,update,delete on public.farmer_seasons to authenticated;

insert into public.farmer_seasons(farm_id,season_year,user_id,crop,area_decare)
select id,season_year,user_id,crop,area_decare from public.farmer_farms where area_decare > 0 and length(trim(crop)) > 0
on conflict do nothing;
insert into public.farmer_seasons(farm_id,season_year,user_id,crop,area_decare)
select distinct f.id,o.season_year,f.user_id,f.crop,f.area_decare
from public.farmer_farms f join public.farmer_operations o on o.farm_id=f.id
where f.area_decare > 0 and length(trim(f.crop)) > 0 on conflict do nothing;
create index if not exists farmer_operations_farm_season on public.farmer_operations(farm_id,season_year);

-- Keep old operation types and add machine/labour categories.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.farmer_operations'::regclass and contype='c' and pg_get_constraintdef(oid) like '%operation_type%'
  loop execute format('alter table public.farmer_operations drop constraint %I',c.conname); end loop;
end $$;
alter table public.farmer_operations add constraint farmer_operations_type_v2 check
 (operation_type in ('tillage','seed','planting','fertilizing','irrigation','spraying','weeding','harvest','other','hoeing','machine_spraying','machine_fertilizing','labor','pruning','machine_other'));

create or replace function public.save_farmer_farm_season(p_farm jsonb,p_season jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_user uuid := auth.uid(); v_year integer := (p_season->>'season_year')::integer;
begin
  if v_user is null then raise exception 'Giriş yapmalısın'; end if;
  if v_year not between 2000 and 2200 then raise exception 'Geçersiz sezon'; end if;
  v_id := nullif(p_farm->>'id','')::uuid;
  if v_id is null then
    insert into public.farmer_farms(user_id,name,crop,area_decare,province,district,village,latitude,longitude,season_year)
    values(v_user,trim(p_farm->>'name'),trim(p_season->>'crop'),(p_season->>'area_decare')::numeric,p_farm->>'province',p_farm->>'district',p_farm->>'village',nullif(p_farm->>'latitude','')::float8,nullif(p_farm->>'longitude','')::float8,v_year) returning id into v_id;
  else
    -- A past season can be corrected without changing the farm's active season.
    update public.farmer_farms set name=trim(p_farm->>'name'),province=p_farm->>'province',district=p_farm->>'district',village=p_farm->>'village',latitude=nullif(p_farm->>'latitude','')::float8,longitude=nullif(p_farm->>'longitude','')::float8,
    crop=case when v_year >= season_year then trim(p_season->>'crop') else crop end,
    area_decare=case when v_year >= season_year then (p_season->>'area_decare')::numeric else area_decare end,
    season_year=greatest(season_year,v_year),updated_at=now() where id=v_id and user_id=v_user;
    if not found then raise exception 'Tarla bulunamadı'; end if;
  end if;
  insert into public.farmer_seasons(farm_id,season_year,user_id,crop,area_decare,tenure,rent_total,expected_yield,expected_price,actual_yield,actual_price)
  values(v_id,v_year,v_user,trim(p_season->>'crop'),(p_season->>'area_decare')::numeric,p_season->>'tenure',(p_season->>'rent_total')::numeric,
  (p_season->>'expected_yield')::numeric,(p_season->>'expected_price')::numeric,(p_season->>'actual_yield')::numeric,(p_season->>'actual_price')::numeric)
  on conflict(farm_id,season_year) do update set crop=excluded.crop,area_decare=excluded.area_decare,tenure=excluded.tenure,rent_total=excluded.rent_total,expected_yield=excluded.expected_yield,expected_price=excluded.expected_price,actual_yield=excluded.actual_yield,actual_price=excluded.actual_price,updated_at=now();
  return v_id;
end $$;
revoke all on function public.save_farmer_farm_season(jsonb,jsonb) from public,anon;
grant execute on function public.save_farmer_farm_season(jsonb,jsonb) to authenticated;

-- Reject a season or farm belonging to another user, including direct API writes.
create or replace function public.check_farmer_operation_season() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from public.farmer_seasons s where s.farm_id=new.farm_id and s.season_year=new.season_year and s.user_id=new.user_id) then
   raise exception 'Önce bu tarla için sezon kaydı oluştur';
 end if;
 return new;
end $$;
drop trigger if exists farmer_operation_season_check on public.farmer_operations;
create trigger farmer_operation_season_check before insert or update on public.farmer_operations for each row execute function public.check_farmer_operation_season();
notify pgrst,'reload schema';
commit;
