begin;
create table public.farmer_scheduled_payments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 supplier text not null check(length(btrim(supplier)) between 1 and 200),
 season_year integer not null check(season_year between 2000 and 2200),
 amount numeric(18,2) not null check(amount>0 and amount<=1000000000000),
 due_date date not null check(due_date between date '2000-01-01' and date '2200-12-31'),
 notes text not null default '' check(length(notes)<=500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.farmer_scheduled_payments enable row level security;
alter table public.farmer_scheduled_payments force row level security;
revoke all on public.farmer_scheduled_payments from public,anon,authenticated;
grant select,insert,update,delete on public.farmer_scheduled_payments to authenticated;
create policy scheduled_payments_owner on public.farmer_scheduled_payments for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index farmer_scheduled_payments_calendar on public.farmer_scheduled_payments(user_id,season_year,due_date);
notify pgrst,'reload schema';
commit;
