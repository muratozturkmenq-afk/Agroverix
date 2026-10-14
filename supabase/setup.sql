-- Run in Supabase SQL Editor before opening real registrations.
create table if not exists public.farmer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  identity_number text not null,
  province text,
  district text,
  village text,
  latitude double precision,
  longitude double precision,
  crop text,
  area_decare numeric(10,2),
  anonymous_insights_consent boolean not null default false,
  consent_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint farmer_profile_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint farmer_profile_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint farmer_profile_area_positive check (area_decare is null or area_decare > 0),
  constraint farmer_profile_identity_number_format check (identity_number ~ '^[0-9]{11}$')
);

-- Existing installations: profile now contains identity/account information only.
alter table public.farmer_profiles alter column province drop not null;
alter table public.farmer_profiles alter column district drop not null;
alter table public.farmer_profiles alter column village drop not null;
alter table public.farmer_profiles alter column latitude drop not null;
alter table public.farmer_profiles alter column longitude drop not null;
alter table public.farmer_profiles alter column crop drop not null;
alter table public.farmer_profiles alter column area_decare drop not null;

alter table public.farmer_profiles enable row level security;
alter table public.farmer_profiles force row level security;
revoke all on table public.farmer_profiles from anon;
grant select, insert, update, delete on public.farmer_profiles to authenticated;

drop policy if exists "Farmers can read only their own profile" on public.farmer_profiles;
create policy "Farmers can read only their own profile"
  on public.farmer_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Farmers can create only their own profile" on public.farmer_profiles;
create policy "Farmers can create only their own profile"
  on public.farmer_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Farmers can update only their own profile" on public.farmer_profiles;
create policy "Farmers can update only their own profile"
  on public.farmer_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Farmers can delete only their own profile" on public.farmer_profiles;
create policy "Farmers can delete only their own profile"
  on public.farmer_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists farmer_profiles_district_idx on public.farmer_profiles (province, district);

create table if not exists public.farmer_farms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  province text not null,
  district text not null,
  village text not null,
  latitude double precision,
  longitude double precision,
  crop text not null,
  area_decare numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint farmer_farm_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint farmer_farm_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint farmer_farm_area_positive check (area_decare > 0)
);

alter table public.farmer_farms enable row level security;
alter table public.farmer_farms force row level security;
revoke all on table public.farmer_farms from anon;
grant select, insert, update, delete on public.farmer_farms to authenticated;

drop policy if exists "Farmers can read only their own farms" on public.farmer_farms;
create policy "Farmers can read only their own farms"
  on public.farmer_farms for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Farmers can create only their own farms" on public.farmer_farms;
create policy "Farmers can create only their own farms"
  on public.farmer_farms for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Farmers can update only their own farms" on public.farmer_farms;
create policy "Farmers can update only their own farms"
  on public.farmer_farms for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Farmers can delete only their own farms" on public.farmer_farms;
create policy "Farmers can delete only their own farms"
  on public.farmer_farms for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists farmer_farms_user_idx on public.farmer_farms (user_id, created_at);
