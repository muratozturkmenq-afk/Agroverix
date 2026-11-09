begin;
-- Existing personnel expenses remain unchanged; monthly plans post due months only.
create table public.farmer_personnel_schedules(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,person_name text not null check(length(trim(person_name)) between 1 and 160),
 employment_type text not null check(employment_type in ('permanent','temporary')),
 start_month date not null check(extract(day from start_month)=1),month_count integer not null check(month_count between 1 and 12),
 season_year integer not null check(season_year between 2000 and 2200),
 salary numeric(12,2) not null check(salary between 0 and 9999999999.99),insurance numeric(12,2) not null check(insurance between 0 and 9999999999.99),
 other_cost numeric(12,2) not null check(other_cost between 0 and 9999999999.99),
 selected_farm_ids uuid[] not null check(cardinality(selected_farm_ids) between 1 and 500),notes text not null default '' check(length(notes)<=1000),
 is_active boolean not null default true,last_posted_month date,last_error text,
 currency text not null default 'TRY' check(currency in ('TRY','EUR')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,user_id),unique(user_id,request_id),check(salary+insurance+other_cost between 0.01 and 9999999999.99),
 check(start_month>=date '2000-01-01' and start_month+(month_count-1)*interval '1 month'<=date '2200-12-01')
);
alter table public.farmer_personnel_expenses add column employment_type text not null default 'temporary' check(employment_type in ('permanent','temporary'));
alter table public.farmer_personnel_expenses add column period_month date;
alter table public.farmer_personnel_expenses add column schedule_id uuid;
alter table public.farmer_personnel_expenses add column base_other_cost numeric(12,2) not null default 0;
alter table public.farmer_personnel_expenses add column extra_pay numeric(12,2) not null default 0;
alter table public.farmer_personnel_expenses add column advance_total numeric(12,2) not null default 0;
update public.farmer_personnel_expenses set period_month=date_trunc('month',expense_date)::date,base_other_cost=other_cost;
alter table public.farmer_personnel_expenses alter column period_month set not null;
alter table public.farmer_personnel_expenses add constraint personnel_month_matches check(period_month=date_trunc('month',expense_date)::date);
alter table public.farmer_personnel_expenses add constraint personnel_payroll_amounts check(base_other_cost>=0 and extra_pay>=0 and advance_total between 0 and salary and other_cost=base_other_cost+extra_pay);
alter table public.farmer_personnel_expenses add constraint personnel_schedule_owner foreign key(schedule_id,user_id) references public.farmer_personnel_schedules(id,user_id) on delete cascade;
create unique index personnel_schedule_month_once on public.farmer_personnel_expenses(schedule_id,period_month) where schedule_id is not null;

create table public.farmer_personnel_adjustments(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 expense_id uuid not null,request_id uuid not null,kind text not null check(kind in ('advance','extra')),
 entry_date date not null,amount numeric(12,2) not null check(amount between 0.01 and 9999999999.99),
 notes text not null default '' check(length(notes)<=1000),is_void boolean not null default false,
 currency text not null default 'TRY' check(currency in ('TRY','EUR')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,request_id),foreign key(expense_id,user_id) references public.farmer_personnel_expenses(id,user_id) on delete cascade
);
create index personnel_schedules_owner on public.farmer_personnel_schedules(user_id,season_year);
create index personnel_adjustments_owner on public.farmer_personnel_adjustments(user_id,expense_id);
alter table public.farmer_personnel_schedules enable row level security;
alter table public.farmer_personnel_schedules force row level security;
alter table public.farmer_personnel_adjustments enable row level security;
alter table public.farmer_personnel_adjustments force row level security;
revoke all on public.farmer_personnel_schedules,public.farmer_personnel_adjustments from public,anon,authenticated;
grant select on public.farmer_personnel_schedules,public.farmer_personnel_adjustments to authenticated;
create policy personnel_schedules_read on public.farmer_personnel_schedules for select to authenticated using(user_id=(select auth.uid()));
create policy personnel_adjustments_read on public.farmer_personnel_adjustments for select to authenticated using(user_id=(select auth.uid()));
create trigger aaa_account_currency before insert or update on public.farmer_personnel_schedules for each row execute function public.agroverix_stamp_account_currency();
create trigger aaa_account_currency before insert or update on public.farmer_personnel_adjustments for each row execute function public.agroverix_stamp_account_currency();

create function public.agroverix_personnel_operation_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.farmer_operations set total_cost=new.amount,updated_at=now() where personnel_expense_id=new.expense_id and farm_id=new.farm_id and user_id=new.user_id;
 return new;
end $$;
revoke all on function public.agroverix_personnel_operation_update() from public,anon,authenticated;
create trigger personnel_allocation_amount after update of amount on public.farmer_personnel_allocations for each row when(new.amount is distinct from old.amount) execute function public.agroverix_personnel_operation_update();

create function agroverix_private.save_personnel_for(p_user uuid,p_expense jsonb,p_farm_ids uuid[],p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=p_user;v_id uuid:=nullif(p_expense->>'id','')::uuid;
 v_name text:=trim(p_expense->>'person_name');v_date date:=(p_expense->>'expense_date')::date;v_year integer:=(p_expense->>'season_year')::integer;
 v_salary numeric:=coalesce(nullif(p_expense->>'salary','')::numeric,0);v_insurance numeric:=coalesce(nullif(p_expense->>'insurance','')::numeric,0);v_other numeric:=coalesce(nullif(p_expense->>'other_cost','')::numeric,0);
 v_prior public.farmer_personnel_expenses;v_base_other numeric;v_extra numeric:=0;v_advance numeric:=0;v_type text;v_period date;
 v_total numeric;v_ids uuid[];v_count integer;v_area numeric;v_currency text;v_notes text:=coalesce(trim(p_expense->>'notes'),'');
begin
 if v_user is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,81961108));
 if v_id is null and p_request_id is not null then
  select id into v_id from public.farmer_personnel_expenses where user_id=v_user and request_id=p_request_id;
  if found then return v_id;end if;
 end if;
 if v_id is not null then
  select * into v_prior from public.farmer_personnel_expenses where id=v_id and user_id=v_user for update;
  if not found then raise exception 'Personel kaydı bulunamadı veya hesabına ait değil.' using errcode='42501';end if;
  if date_trunc('month',v_date)::date is distinct from v_prior.period_month and (v_prior.schedule_id is not null or exists(select 1 from public.farmer_personnel_adjustments where expense_id=v_id)) then raise exception 'Avans veya çalışma planı bulunan kaydın ayı değiştirilemez.';end if;
 end if;
 v_base_other:=coalesce(nullif(p_expense->>'base_other_cost','')::numeric,case when v_id is not null then v_other-coalesce(v_prior.extra_pay,0) else v_other end);
 select coalesce(sum(amount) filter(where kind='extra'),0),coalesce(sum(amount) filter(where kind='advance'),0) into v_extra,v_advance from public.farmer_personnel_adjustments where expense_id=v_id and not is_void;
 v_other:=v_base_other+v_extra;v_type:=coalesce(p_expense->>'employment_type',v_prior.employment_type,'temporary');v_period:=date_trunc('month',v_date)::date;
 if v_type not in ('permanent','temporary') or not(v_base_other between 0 and 9999999999.99) or v_base_other<>round(v_base_other,2) then raise exception 'Çalışma şeklini ve diğer gider tutarını kontrol et.';end if;
 if v_advance>v_salary then raise exception 'Maaş, bu ay verilen avans toplamından az olamaz.';end if;
 if v_name is null or length(v_name) not between 1 and 160 or length(v_notes)>1000 then raise exception 'Personel adını ve açıklamayı kontrol et.';end if;
 if v_date is null or v_date not between date '2000-01-01' and date '2200-12-31' or v_year is null or v_year not between 2000 and 2200 then raise exception 'Tarih ve sezonu kontrol et.';end if;
 if not(v_salary between 0 and 9999999999.99 and v_insurance between 0 and 9999999999.99 and v_other between 0 and 9999999999.99)
 or v_salary<>round(v_salary,2) or v_insurance<>round(v_insurance,2) or v_other<>round(v_other,2) then raise exception 'Tutarlar sıfır veya daha büyük ve en fazla iki ondalıklı olmalı.';end if;
 v_total:=v_salary+v_insurance+v_other;
 if not(v_total between 0.01 and 9999999999.99) then raise exception 'Toplam personel gideri sıfırdan büyük ve izin verilen aralıkta olmalı.';end if;
 if p_farm_ids is null or cardinality(p_farm_ids) not between 1 and 500 or array_position(p_farm_ids,null) is not null then raise exception 'Bu sezon için en az bir tarla seç.';end if;
 select array_agg(distinct x order by x) into v_ids from unnest(p_farm_ids) x;
 if cardinality(v_ids)<>cardinality(p_farm_ids) then raise exception 'Aynı tarla iki kez seçilemez.';end if;
 select currency into strict v_currency from public.farmer_account_settings where user_id=v_user;
 -- Lock the selected seasonal areas; allocation is a snapshot at save time.
 perform 1 from public.farmer_seasons s join public.farmer_farms f on f.id=s.farm_id
 where s.farm_id=any(v_ids) and s.season_year=v_year and s.user_id=v_user and f.user_id=v_user order by s.farm_id for update of s;
 select count(*),sum(s.area_decare) into v_count,v_area from public.farmer_seasons s join public.farmer_farms f on f.id=s.farm_id
 where s.farm_id=any(v_ids) and s.season_year=v_year and s.user_id=v_user and f.user_id=v_user and s.currency=v_currency and f.currency=v_currency;
 if v_count<>cardinality(v_ids) or v_area is null or not(v_area>0) then raise exception 'Seçilen tarla ve sezonlar hesabına ait olmalı.' using errcode='42501';end if;
 if v_id is null then
  if p_request_id is null then raise exception 'Kayıt isteği bulunamadı. Tekrar dene.';end if;
  insert into public.farmer_personnel_expenses(user_id,request_id,person_name,expense_date,season_year,salary,insurance,other_cost,selected_farm_ids,notes,base_other_cost,extra_pay,advance_total,employment_type,period_month)
  values(v_user,p_request_id,v_name,v_date,v_year,v_salary,v_insurance,v_other,v_ids,v_notes,v_base_other,v_extra,v_advance,v_type,v_period) returning id into v_id;
 else
  perform 1 from public.farmer_personnel_expenses where id=v_id and user_id=v_user for update;
  if not found then raise exception 'Personel kaydı bulunamadı veya hesabına ait değil.' using errcode='42501';end if;
  update public.farmer_personnel_expenses set person_name=v_name,expense_date=v_date,season_year=v_year,salary=v_salary,insurance=v_insurance,other_cost=v_other,selected_farm_ids=v_ids,notes=v_notes,base_other_cost=v_base_other,extra_pay=v_extra,advance_total=v_advance,employment_type=v_type,period_month=v_period,is_void=false,updated_at=now() where id=v_id and user_id=v_user;
  delete from public.farmer_personnel_allocations where expense_id=v_id and user_id=v_user;
 end if;
 -- Largest remainders distribute cents exactly once, with deterministic ties.
 insert into public.farmer_personnel_allocations(expense_id,farm_id,user_id,season_year,area_decare,amount)
 with weights as(
  select s.farm_id,s.area_decare,(v_total*100)*s.area_decare/v_area as exact_cents from public.farmer_seasons s where s.farm_id=any(v_ids) and s.season_year=v_year and s.user_id=v_user
 ),ranked as(
  select *,floor(exact_cents) as base_cents,row_number() over(order by exact_cents-floor(exact_cents) desc,farm_id) as rn,sum(floor(exact_cents)) over() as floor_total from weights
 ) select v_id,farm_id,v_user,v_year,area_decare,(base_cents+case when rn<=v_total*100-floor_total then 1 else 0 end)/100 from ranked;
 return v_id;
end $$;

revoke all on function agroverix_private.save_personnel_for(uuid,jsonb,uuid[],uuid) from public,anon,authenticated;

create or replace function public.agroverix_save_personnel_expense(p_expense jsonb,p_farm_ids uuid[],p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin return agroverix_private.save_personnel_for(auth.uid(),p_expense,p_farm_ids,p_request_id);end $$;

create function agroverix_private.refresh_personnel_pay(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.farmer_personnel_expenses;v_extra numeric;v_advance numeric;v_total numeric;
begin
 select * into strict p from public.farmer_personnel_expenses where id=p_id for update;
 select coalesce(sum(amount) filter(where kind='extra'),0),coalesce(sum(amount) filter(where kind='advance'),0) into v_extra,v_advance from public.farmer_personnel_adjustments where expense_id=p_id and not is_void;
 if v_advance>p.salary then raise exception 'Bu ayın avans toplamı aylık maaşı aşamaz. Avans verildiği ayın maaşından düşülür.';end if;
 v_total:=p.salary+p.insurance+p.base_other_cost+v_extra;
 if not(v_total between 0.01 and 9999999999.99) then raise exception 'Toplam personel maliyeti izin verilen aralığı aşıyor.';end if;
 update public.farmer_personnel_expenses set extra_pay=v_extra,advance_total=v_advance,other_cost=base_other_cost+v_extra,updated_at=now() where id=p_id;
 if not p.is_void and v_extra<>p.extra_pay then
  with weights as(select farm_id,v_total*100*area_decare/sum(area_decare) over() as exact_cents from public.farmer_personnel_allocations where expense_id=p_id),
  ranked as(select *,floor(exact_cents) as base_cents,sum(floor(exact_cents)) over() as floor_total,row_number() over(order by exact_cents-floor(exact_cents) desc,farm_id) as rn from weights)
  update public.farmer_personnel_allocations a set amount=(r.base_cents+case when r.rn<=v_total*100-r.floor_total then 1 else 0 end)/100
  from ranked r where a.expense_id=p_id and a.farm_id=r.farm_id;
 end if;
end $$;
revoke all on function agroverix_private.refresh_personnel_pay(uuid) from public,anon,authenticated;

create function agroverix_private.accrue_personnel_due(p_user uuid default null,p_as_of date default (now() at time zone 'Europe/Istanbul')::date) returns integer language plpgsql security definer set search_path='' as $$
declare v_owner uuid;p public.farmer_personnel_schedules;v_month date;v_end date;v_id uuid;v_count integer:=0;v_added integer:=0;v_cutoff date:=date_trunc('month',p_as_of)::date;
begin
 for v_owner in select distinct user_id from public.farmer_personnel_schedules where is_active and start_month<=v_cutoff and (p_user is null or user_id=p_user) and (last_posted_month is null or last_posted_month<least(v_cutoff,(start_month+(month_count-1)*interval '1 month')::date)) order by user_id loop
  if p_user is null then if not pg_try_advisory_xact_lock(hashtextextended(v_owner::text,81961108)) then continue;end if;
  else perform pg_advisory_xact_lock(hashtextextended(v_owner::text,81961108));end if;
  for p in select * from public.farmer_personnel_schedules where user_id=v_owner and is_active and start_month<=v_cutoff and (last_posted_month is null or last_posted_month<least(v_cutoff,(start_month+(month_count-1)*interval '1 month')::date)) order by id for update skip locked loop
   begin
    v_added:=0;v_end:=least(v_cutoff,(p.start_month+(p.month_count-1)*interval '1 month')::date);
    for v_month in select d::date from generate_series(p.start_month::timestamp,v_end::timestamp,interval '1 month') d where not exists(select 1 from public.farmer_personnel_expenses e where e.schedule_id=p.id and e.period_month=d::date) loop
     v_id:=agroverix_private.save_personnel_for(p.user_id,jsonb_build_object('person_name',p.person_name,'expense_date',v_month,'season_year',p.season_year,'salary',p.salary,'insurance',p.insurance,'other_cost',p.other_cost,'base_other_cost',p.other_cost,'employment_type',p.employment_type,'notes',p.notes),p.selected_farm_ids,md5(p.id::text||':'||v_month::text)::uuid);
     update public.farmer_personnel_expenses set schedule_id=p.id where id=v_id and user_id=p.user_id;
     v_added:=v_added+1;
    end loop;
    update public.farmer_personnel_schedules set last_posted_month=v_end,last_error=null,updated_at=now() where id=p.id;
    v_count:=v_count+v_added;
   exception when others then
    update public.farmer_personnel_schedules set last_error=left(sqlerrm,1000),updated_at=now() where id=p.id;
   end;
  end loop;
 end loop;
 return v_count;
end $$;
revoke all on function agroverix_private.accrue_personnel_due(uuid,date) from public,anon,authenticated;

create function public.agroverix_refresh_personnel_due() returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 return agroverix_private.accrue_personnel_due(auth.uid());
end $$;
revoke all on function public.agroverix_refresh_personnel_due() from public,anon;
grant execute on function public.agroverix_refresh_personnel_due() to authenticated;

create function public.agroverix_save_personnel_schedule(p_schedule jsonb,p_farm_ids uuid[],p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_id uuid;v_name text:=trim(p_schedule->>'person_name');v_type text:=p_schedule->>'employment_type';
 v_start date:=(p_schedule->>'start_month')::date;v_months integer:=(p_schedule->>'month_count')::integer;v_year integer:=(p_schedule->>'season_year')::integer;
 v_salary numeric:=coalesce(nullif(p_schedule->>'salary','')::numeric,0);v_insurance numeric:=coalesce(nullif(p_schedule->>'insurance','')::numeric,0);v_other numeric:=coalesce(nullif(p_schedule->>'other_cost','')::numeric,0);
 v_notes text:=coalesce(trim(p_schedule->>'notes'),'');v_ids uuid[];v_count integer;
begin
 if v_user is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,81961108));
 select id into v_id from public.farmer_personnel_schedules where user_id=v_user and request_id=p_request_id;
 if found then perform agroverix_private.accrue_personnel_due(v_user);return v_id;end if;
 if p_request_id is null or v_name is null or length(v_name) not between 1 and 160 or length(v_notes)>1000 or v_type is null or v_type not in ('permanent','temporary') then raise exception 'Personel adı ve çalışma şeklini kontrol et.';end if;
 if v_start is null or extract(day from v_start)<>1 or v_start<date '2000-01-01' or v_months is null or v_months not between 1 and 12 or v_start+(v_months-1)*interval '1 month'>date '2200-12-01' or v_year is null or v_year not between 2000 and 2200 then raise exception 'Başlangıç ayını, çalışma süresini ve sezonu kontrol et.';end if;
 if not(v_salary between 0 and 9999999999.99 and v_insurance between 0 and 9999999999.99 and v_other between 0 and 9999999999.99 and v_salary+v_insurance+v_other between 0.01 and 9999999999.99) or v_salary<>round(v_salary,2) or v_insurance<>round(v_insurance,2) or v_other<>round(v_other,2) then raise exception 'Aylık tutarları en fazla iki ondalıkla ve sıfır veya daha büyük gir. Toplam sıfırdan büyük olmalı.';end if;
 if p_farm_ids is null or cardinality(p_farm_ids) not between 1 and 500 or array_position(p_farm_ids,null) is not null then raise exception 'En az bir tarla seç.';end if;
 select array_agg(distinct x order by x) into v_ids from unnest(p_farm_ids) x;
 if cardinality(v_ids)<>cardinality(p_farm_ids) then raise exception 'Aynı tarla iki kez seçilemez.';end if;
 select count(*) into v_count from public.farmer_seasons s join public.farmer_farms f on f.id=s.farm_id join public.farmer_account_settings a on a.user_id=v_user where s.farm_id=any(v_ids) and s.season_year=v_year and s.user_id=v_user and f.user_id=v_user and s.currency=a.currency and f.currency=a.currency;
 if v_count<>cardinality(v_ids) then raise exception 'Seçilen tarla ve sezonlar hesabına ait olmalı.' using errcode='42501';end if;
 insert into public.farmer_personnel_schedules(user_id,request_id,person_name,employment_type,start_month,month_count,season_year,salary,insurance,other_cost,selected_farm_ids,notes)
 values(v_user,p_request_id,v_name,v_type,v_start,v_months,v_year,v_salary,v_insurance,v_other,v_ids,v_notes) returning id into v_id;
 perform agroverix_private.accrue_personnel_due(v_user);
 return v_id;
end $$;
revoke all on function public.agroverix_save_personnel_schedule(jsonb,uuid[],uuid) from public,anon;
grant execute on function public.agroverix_save_personnel_schedule(jsonb,uuid[],uuid) to authenticated;

create function public.agroverix_stop_personnel_schedule(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,81961108));
 update public.farmer_personnel_schedules set is_active=false,updated_at=now() where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Çalışma planı bulunamadı veya hesabına ait değil.' using errcode='42501';end if;
end $$;
revoke all on function public.agroverix_stop_personnel_schedule(uuid) from public,anon;
grant execute on function public.agroverix_stop_personnel_schedule(uuid) to authenticated;

create function public.agroverix_save_personnel_adjustment(p_adjustment jsonb,p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_id uuid:=nullif(p_adjustment->>'id','')::uuid;v_expense uuid:=(p_adjustment->>'expense_id')::uuid;v_kind text:=p_adjustment->>'kind';
 v_date date:=(p_adjustment->>'entry_date')::date;v_amount numeric:=(p_adjustment->>'amount')::numeric;v_notes text:=coalesce(trim(p_adjustment->>'notes'),'');
 p public.farmer_personnel_expenses;v_old public.farmer_personnel_adjustments;
begin
 if v_user is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,81961108));
 if v_id is null and p_request_id is not null then select id into v_id from public.farmer_personnel_adjustments where user_id=v_user and request_id=p_request_id;if found then return v_id;end if;end if;
 select * into p from public.farmer_personnel_expenses where id=v_expense and user_id=v_user and not is_void for update;
 if not found then raise exception 'Etkin personel ve ay kaydı bulunamadı veya hesabına ait değil.' using errcode='42501';end if;
 if v_kind is null or v_kind not in ('advance','extra') or v_date is null or date_trunc('month',v_date)::date<>p.period_month then raise exception 'Avans ve ek ödeme, verildiği ayın personel kaydına girilmeli. Tarihle aynı ayı seç.';end if;
 if v_date>(now() at time zone 'Europe/Istanbul')::date then raise exception 'Gelecek tarihli avans veya ek ödeme henüz kaydedilemez.';end if;
 if v_amount is null or not(v_amount between 0.01 and 9999999999.99) or v_amount<>round(v_amount,2) or length(v_notes)>1000 then raise exception 'Tutar sıfırdan büyük ve en fazla iki ondalıklı olmalı.';end if;
 if v_id is null then
  if p_request_id is null then raise exception 'Kayıt isteği bulunamadı.';end if;
  insert into public.farmer_personnel_adjustments(user_id,expense_id,request_id,kind,entry_date,amount,notes) values(v_user,v_expense,p_request_id,v_kind,v_date,v_amount,v_notes) returning id into v_id;
 else
  select * into v_old from public.farmer_personnel_adjustments where id=v_id and user_id=v_user for update;
  if not found then raise exception 'Avans veya ek ödeme bulunamadı veya hesabına ait değil.' using errcode='42501';end if;
  if v_old.expense_id<>v_expense or v_old.kind<>v_kind then raise exception 'Düzenlemede personel/ay ve işlem türü değiştirilemez. Eski kaydı iptal edip yeni kayıt oluştur.';end if;
  update public.farmer_personnel_adjustments set entry_date=v_date,amount=v_amount,notes=v_notes,is_void=false,updated_at=now() where id=v_id and user_id=v_user;
 end if;
 perform agroverix_private.refresh_personnel_pay(v_expense);
 return v_id;
end $$;
revoke all on function public.agroverix_save_personnel_adjustment(jsonb,uuid) from public,anon;
grant execute on function public.agroverix_save_personnel_adjustment(jsonb,uuid) to authenticated;

create function public.agroverix_void_personnel_adjustment(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_expense uuid;
begin
 if auth.uid() is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,81961108));
 update public.farmer_personnel_adjustments set is_void=true,updated_at=now() where id=p_id and user_id=auth.uid() returning expense_id into v_expense;
 if not found then raise exception 'Avans veya ek ödeme bulunamadı veya hesabına ait değil.' using errcode='42501';end if;
 perform agroverix_private.refresh_personnel_pay(v_expense);
end $$;
revoke all on function public.agroverix_void_personnel_adjustment(uuid) from public,anon;
grant execute on function public.agroverix_void_personnel_adjustment(uuid) to authenticated;

-- No browser session or email service is needed for monthly posting.
do $$begin
 if not exists(select 1 from cron.job where jobname='agroverix-personnel-monthly') then
  perform cron.schedule('agroverix-personnel-monthly','5 * * * *','select agroverix_private.accrue_personnel_due();');
 end if;
end $$;
-- Same existing admin role; ordinary members retain owner-only table access.
create or replace function public.agroverix_admin_report_rows(p_dataset text,p_offset integer default 0,p_limit integer default 500,p_user_id uuid default null)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_agroverix_admin() then raise exception 'Yönetici erişimi gerekli' using errcode='42501';end if;
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'Geçersiz sayfalama';end if;
 if p_dataset not in ('accounts','profiles','farms','seasons','operations','harvest_sales','harvest_receipts','inventory_items','inventory_purchases','inventory_payments','personnel_expenses','personnel_allocations','personnel_schedules','personnel_adjustments') then raise exception 'Geçersiz rapor';end if;
 if p_offset=0 then insert into agroverix_private.report_access_log(admin_id,dataset,selected_user_id) values(auth.uid(),p_dataset,p_user_id);end if;
 if p_dataset='accounts' then
  return query select jsonb_build_object('user_id',u.id,'member_code',m.member_code,'member_number',m.member_number,'email',u.email,'currency',coalesce(cs.currency,'TRY'),'phone',coalesce(p.phone,u.phone),'full_name',p.full_name,'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'phone_confirmed',u.phone_confirmed_at is not null and p.phone is not distinct from u.phone,'sms_consent',coalesce(p.sms_consent,false),'sms_consent_at',p.sms_consent_at)
  from auth.users u left join public.farmer_account_settings cs on cs.user_id=u.id left join public.farmer_profiles p on p.user_id=u.id left join agroverix_private.member_registry m on m.user_id=u.id where p_user_id is null or u.id=p_user_id order by m.member_number nulls last,u.id offset p_offset limit p_limit;
 elsif p_dataset='profiles' then return query select to_jsonb(p) from public.farmer_profiles p where p_user_id is null or p.user_id=p_user_id order by p.user_id offset p_offset limit p_limit;
 elsif p_dataset='inventory_items' then return query select to_jsonb(i) from public.farmer_inventory_items i where p_user_id is null or i.user_id=p_user_id order by i.id offset p_offset limit p_limit;
 elsif p_dataset='inventory_purchases' then return query select to_jsonb(i) from public.farmer_inventory_purchases i where p_user_id is null or i.user_id=p_user_id order by i.id offset p_offset limit p_limit;
 elsif p_dataset='inventory_payments' then return query select to_jsonb(i) from public.farmer_inventory_payments i where p_user_id is null or i.user_id=p_user_id order by i.id offset p_offset limit p_limit;
 elsif p_dataset='personnel_expenses' then return query select to_jsonb(p) from public.farmer_personnel_expenses p where p_user_id is null or p.user_id=p_user_id order by p.id offset p_offset limit p_limit;
 elsif p_dataset='personnel_allocations' then return query select to_jsonb(p) from public.farmer_personnel_allocations p where p_user_id is null or p.user_id=p_user_id order by p.expense_id,p.farm_id offset p_offset limit p_limit;
 elsif p_dataset='personnel_schedules' then return query select to_jsonb(p) from public.farmer_personnel_schedules p where p_user_id is null or p.user_id=p_user_id order by p.id offset p_offset limit p_limit;
 elsif p_dataset='personnel_adjustments' then return query select to_jsonb(p) from public.farmer_personnel_adjustments p where p_user_id is null or p.user_id=p_user_id order by p.id offset p_offset limit p_limit;
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
