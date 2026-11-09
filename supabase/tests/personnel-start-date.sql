begin;
create temporary table payroll_day_context(owner_id uuid,farm_id uuid,plan_id uuid,start_date date) on commit drop;
grant all on payroll_day_context to authenticated;
insert into payroll_day_context(owner_id,farm_id,start_date) select user_id,id,(now() at time zone 'Europe/Istanbul')::date+1 from public.farmer_farms order by id limit 1;
do $$begin perform set_config('request.jwt.claim.sub',(select owner_id::text from payroll_day_context),true);end $$;
set local role authenticated;
do $$declare t payroll_day_context;v_year integer;v_plan uuid;begin
 select * into t from payroll_day_context;
 select season_year into v_year from public.farmer_seasons where farm_id=t.farm_id order by season_year desc limit 1;
 v_plan:=public.agroverix_save_personnel_schedule(jsonb_build_object('person_name','Örnek Günlü Plan','employment_type','temporary','start_date',t.start_date,'month_count',2,'season_year',v_year,'salary',100),array[t.farm_id],gen_random_uuid());
 update payroll_day_context set plan_id=v_plan;
 if (select start_date from public.farmer_personnel_schedules where id=v_plan)<>t.start_date or (select start_month from public.farmer_personnel_schedules where id=v_plan)<>date_trunc('month',t.start_date)::date then raise exception 'Start date did not preserve day';end if;
 if exists(select 1 from public.farmer_personnel_expenses where schedule_id=v_plan) then raise exception 'Expense posted before employment starts';end if;
end $$;
reset role;
do $$declare t payroll_day_context;v_next date;begin
 select * into t from payroll_day_context;v_next:=(date_trunc('month',t.start_date)+interval '1 month')::date;
 perform agroverix_private.accrue_personnel_due(t.owner_id,t.start_date-1);
 if exists(select 1 from public.farmer_personnel_expenses where schedule_id=t.plan_id) then raise exception 'Worker ignored start day';end if;
 perform agroverix_private.accrue_personnel_due(t.owner_id,t.start_date);
 if (select count(*) from public.farmer_personnel_expenses where schedule_id=t.plan_id)<>1 or (select expense_date from public.farmer_personnel_expenses where schedule_id=t.plan_id)<>t.start_date then raise exception 'First expense did not post on exact start date';end if;
 perform agroverix_private.accrue_personnel_due(t.owner_id,v_next);
 if (select count(*) from public.farmer_personnel_expenses where schedule_id=t.plan_id)<>2 or not exists(select 1 from public.farmer_personnel_expenses where schedule_id=t.plan_id and expense_date=v_next) then raise exception 'Next month did not accrue at month start';end if;
 perform agroverix_private.accrue_personnel_due(t.owner_id,v_next+400);
 if (select count(*) from public.farmer_personnel_expenses where schedule_id=t.plan_id)<>2 then raise exception 'Duration exceeded after adding start day';end if;
end $$;
select 'PASS: exact start date, no early expense, first day posting, later calendar months, duration limit' as start_date_checks;
rollback;
