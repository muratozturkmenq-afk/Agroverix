begin;
alter table public.farmer_operations add column if not exists total_cost numeric(12,2) not null default 0;
alter table public.farmer_operations add column if not exists cost_basis text not null default 'package_per_decare';
commit;
