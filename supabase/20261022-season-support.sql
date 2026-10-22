begin;
-- Optional manual totals for each farm/production season; null means not entered.
alter table public.farmer_seasons add column if not exists expected_support numeric;
alter table public.farmer_seasons add column if not exists actual_support numeric;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.farmer_seasons'::regclass and conname='farmer_seasons_expected_support_valid') then
  alter table public.farmer_seasons add constraint farmer_seasons_expected_support_valid check(expected_support >= 0 and expected_support < 'Infinity'::numeric);
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.farmer_seasons'::regclass and conname='farmer_seasons_actual_support_valid') then
  alter table public.farmer_seasons add constraint farmer_seasons_actual_support_valid check(actual_support >= 0 and actual_support < 'Infinity'::numeric);
 end if;
end $$;
comment on column public.farmer_seasons.expected_support is 'Farmer-entered expected total support in TRY for this farm and production season; NULL unknown, zero none.';
comment on column public.farmer_seasons.actual_support is 'Farmer-entered actual total support in TRY for this farm and production season; NULL unknown, zero none.';
-- Preserve the existing owner-only invoker function and omit-safe support updates for cached clients.
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


notify pgrst,'reload schema';
commit;
