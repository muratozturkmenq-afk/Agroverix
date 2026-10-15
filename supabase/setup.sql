-- Run in Supabase SQL Editor before opening real registrations.
create table if not exists public.farmer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  identity_number text not null,
  province text,
  district text,
  village text,
  kvkk_notice_acknowledged boolean not null default false,
  kvkk_notice_acknowledged_at timestamptz,
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

-- Existing installations: profile contains identity/account and current address information.
alter table public.farmer_profiles add column if not exists kvkk_notice_acknowledged boolean not null default false;
alter table public.farmer_profiles add column if not exists kvkk_notice_acknowledged_at timestamptz;
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


-- Stage 03: seasonal production operation records. Safe to re-run.
create table if not exists public.farmer_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid not null references public.farmer_farms(id) on delete cascade,
  operation_type text not null check (operation_type in ('tillage','planting','fertilizing','irrigation','spraying','weeding','harvest','other')),
  operation_date date not null default current_date,
  product text,
  brand_name text,
  quantity numeric(12,3),
  quantity_unit text,
  total_cost numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint farmer_operation_quantity_positive check (quantity is null or quantity > 0),
  constraint farmer_operation_cost_nonnegative check (total_cost >= 0)
);

alter table public.farmer_operations add column if not exists brand_name text;
alter table public.farmer_operations alter column quantity type numeric(12,3);

alter table public.farmer_operations enable row level security;
alter table public.farmer_operations force row level security;
revoke all on table public.farmer_operations from anon;
grant select, insert, update, delete on public.farmer_operations to authenticated;

drop policy if exists "Farmers can read only their own operations" on public.farmer_operations;
create policy "Farmers can read only their own operations"
  on public.farmer_operations for select to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.farmer_farms f where f.id = farm_id and f.user_id = (select auth.uid())
  ));
drop policy if exists "Farmers can create only their own operations" on public.farmer_operations;
create policy "Farmers can create only their own operations"
  on public.farmer_operations for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.farmer_farms f where f.id = farm_id and f.user_id = (select auth.uid())
  ));
drop policy if exists "Farmers can update only their own operations" on public.farmer_operations;
create policy "Farmers can update only their own operations"
  on public.farmer_operations for update to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.farmer_farms f where f.id = farm_id and f.user_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.farmer_farms f where f.id = farm_id and f.user_id = (select auth.uid())
  ));
drop policy if exists "Farmers can delete only their own operations" on public.farmer_operations;
create policy "Farmers can delete only their own operations"
  on public.farmer_operations for delete to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.farmer_farms f where f.id = farm_id and f.user_id = (select auth.uid())
  ));

create index if not exists farmer_operations_user_date_idx on public.farmer_operations (user_id, operation_date desc);
create index if not exists farmer_operations_farm_date_idx on public.farmer_operations (farm_id, operation_date desc);
