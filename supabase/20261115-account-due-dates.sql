begin;
create table if not exists public.farmer_account_due_dates (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('payable','receivable')),
 party_key text not null check(length(btrim(party_key)) between 1 and 300),
 party_name text not null check(length(btrim(party_name)) between 1 and 200),
 season_year integer not null check(season_year between 2000 and 2200),
 due_date date not null check(due_date between date '2000-01-01' and date '2200-12-31'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,kind,party_key,season_year)
);
alter table public.farmer_account_due_dates enable row level security;
alter table public.farmer_account_due_dates force row level security;
drop policy if exists account_due_dates_owner on public.farmer_account_due_dates;
create policy account_due_dates_owner on public.farmer_account_due_dates for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.farmer_account_due_dates from public,anon,authenticated;
grant select,insert,update,delete on public.farmer_account_due_dates to authenticated;
create index if not exists farmer_account_due_dates_calendar on public.farmer_account_due_dates(user_id,kind,season_year,due_date);
notify pgrst,'reload schema';
commit;
