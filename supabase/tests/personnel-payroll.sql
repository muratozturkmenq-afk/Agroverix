begin;
-- Synthetic field/personnel fixtures use existing owners and are always rolled back.
create temporary table payroll_test_context(owner_id uuid,other_id uuid,a uuid,b uuid,plan_id uuid,temp_plan uuid,stop_plan uuid,current_expense uuid,previous_expense uuid,advance_id uuid,extra_id uuid,request_id uuid) on commit drop;
grant all on payroll_test_context to authenticated;
insert into payroll_test_context(owner_id,other_id,a,b,request_id) select f.user_id,(select user_id from public.farmer_account_settings where user_id<>f.user_id order by user_id limit 1),gen_random_uuid(),gen_random_uuid(),gen_random_uuid() from public.farmer_farms f order by f.id limit 1;
insert into public.farmer_farms(id,user_id,name,province,district,village,crop,area_decare,season_year)
select x.id,t.owner_id,'Örnek Aylık Personel Testi',f.province,f.district,f.village,'Örnek Bitki',x.area,2026 from payroll_test_context t cross join lateral(select * from public.farmer_farms where user_id=t.owner_id order by id limit 1) f cross join lateral(values(t.a,30::numeric),(t.b,70::numeric)) x(id,area);
insert into public.farmer_seasons(farm_id,user_id,season_year,crop,area_decare) select f.id,f.user_id,2026,f.crop,f.area_decare from public.farmer_farms f,payroll_test_context t where f.id in(t.a,t.b);
do $$begin perform set_config('request.jwt.claim.sub',(select owner_id::text from payroll_test_context),true);end $$;
set local role authenticated;
do $$declare t payroll_test_context;v_month date:=date_trunc('month',now() at time zone 'Europe/Istanbul')::date;v_id uuid;v_prev uuid;v_plan uuid;v_retry uuid;v_adj uuid;v_extra uuid;v_count bigint;v_sum numeric;begin
 select * into t from payroll_test_context;
 v_plan:=public.agroverix_save_personnel_schedule(jsonb_build_object('person_name','Örnek Daimi Personel','employment_type','permanent','start_month',(v_month-interval '1 month')::date,'month_count',12,'season_year',2026,'salary',30000,'insurance',5000,'other_cost',1000),array[t.a,t.b],t.request_id);
 update payroll_test_context set plan_id=v_plan;
 if (select count(*) from public.farmer_personnel_expenses where schedule_id=v_plan)<>2 or exists(select 1 from public.farmer_personnel_expenses where schedule_id=v_plan and period_month>v_month) then raise exception 'Current posting included future months or missed due months';end if;
 if (select sum(total_cost) from public.farmer_operations where personnel_expense_id in(select id from public.farmer_personnel_expenses where schedule_id=v_plan))<>72000 then raise exception 'Initial payroll total mismatch';end if;
 v_retry:=public.agroverix_save_personnel_schedule('{}',array[t.a,t.b],t.request_id);
 perform public.agroverix_refresh_personnel_due();
 if v_retry<>v_plan or (select count(*) from public.farmer_personnel_expenses where schedule_id=v_plan)<>2 then raise exception 'Schedule retry duplicated months';end if;
 select id into v_id from public.farmer_personnel_expenses where schedule_id=v_plan and period_month=v_month;
 select id into v_prev from public.farmer_personnel_expenses where schedule_id=v_plan and period_month=(v_month-interval '1 month')::date;
 update payroll_test_context set current_expense=v_id,previous_expense=v_prev;
 v_adj:=public.agroverix_save_personnel_adjustment(jsonb_build_object('expense_id',v_id,'kind','advance','entry_date',(now() at time zone 'Europe/Istanbul')::date,'amount',5000),gen_random_uuid());
 update payroll_test_context set advance_id=v_adj;
 if (select salary-advance_total from public.farmer_personnel_expenses where id=v_id)<>25000 or (select total_cost from public.farmer_personnel_expenses where id=v_id)<>36000 or (select sum(total_cost) from public.farmer_operations where personnel_expense_id=v_id)<>36000 then raise exception 'Advance changed expense cost instead of remaining salary';end if;
 perform public.agroverix_save_personnel_adjustment(jsonb_build_object('expense_id',v_prev,'kind','advance','entry_date',(v_month-interval '1 month')::date,'amount',2000),gen_random_uuid());
 if (select advance_total from public.farmer_personnel_expenses where id=v_id)<>5000 or (select advance_total from public.farmer_personnel_expenses where id=v_prev)<>2000 then raise exception 'Advances were deducted from another month';end if;
 begin perform public.agroverix_save_personnel_adjustment(jsonb_build_object('expense_id',v_prev,'kind','advance','entry_date',v_month,'amount',1),gen_random_uuid());raise exception 'Wrong-month advance was allowed';exception when raise_exception then if sqlerrm='Wrong-month advance was allowed' then raise;end if;end;
 begin perform public.agroverix_save_personnel_adjustment(jsonb_build_object('expense_id',v_id,'kind','advance','entry_date',v_month,'amount',40000),gen_random_uuid());raise exception 'Advance exceeded salary';exception when raise_exception then if sqlerrm='Advance exceeded salary' then raise;end if;end;
 if (select count(*) from public.farmer_personnel_adjustments where expense_id=v_id)<>1 then raise exception 'Failed advance left an orphan ledger row';end if;
 update public.farmer_seasons set area_decare=case when farm_id=t.a then 60 else 40 end where farm_id in(t.a,t.b) and season_year=2026;
 v_extra:=public.agroverix_save_personnel_adjustment(jsonb_build_object('expense_id',v_id,'kind','extra','entry_date',v_month,'amount',2000),gen_random_uuid());
 update payroll_test_context set extra_id=v_extra;
 if (select total_cost from public.farmer_personnel_expenses where id=v_id)<>38000 or (select other_cost from public.farmer_personnel_expenses where id=v_id)<>3000 then raise exception 'Extra payment not included once';end if;
 if (select amount from public.farmer_personnel_allocations where expense_id=v_id and farm_id=t.a)<>11400 or (select sum(total_cost) from public.farmer_operations where personnel_expense_id=v_id)<>38000 then raise exception 'Extra payment did not use original area shares';end if;
 perform public.agroverix_save_personnel_adjustment(jsonb_build_object('id',v_extra,'expense_id',v_id,'kind','extra','entry_date',v_month,'amount',2500),gen_random_uuid());
 if (select total_cost from public.farmer_personnel_expenses where id=v_id)<>38500 then raise exception 'Extra edit duplicated cost';end if;
 -- Legacy single-month clients send other_cost including extras; preserve the base.
 perform public.agroverix_save_personnel_expense(jsonb_build_object('id',v_id,'person_name','Örnek Daimi Personel','expense_date',v_month,'season_year',2026,'salary',30000,'insurance',5000,'other_cost',3500),array[t.a,t.b],gen_random_uuid());
 if (select total_cost from public.farmer_personnel_expenses where id=v_id)<>38500 or (select base_other_cost from public.farmer_personnel_expenses where id=v_id)<>1000 then raise exception 'Legacy edit counted extra twice';end if;
 perform public.agroverix_void_personnel_adjustment(v_adj);
 if (select advance_total from public.farmer_personnel_expenses where id=v_id)<>0 or (select total_cost from public.farmer_personnel_expenses where id=v_id)<>38500 then raise exception 'Advance cancellation changed cost';end if;
 perform public.agroverix_void_personnel_adjustment(v_extra);
 if (select extra_pay from public.farmer_personnel_expenses where id=v_id)<>0 or (select sum(total_cost) from public.farmer_operations where personnel_expense_id=v_id)<>36000 then raise exception 'Extra cancellation did not reverse costs';end if;
 begin perform agroverix_private.accrue_personnel_due(t.owner_id,(v_month+interval '1 month')::date);raise exception 'Member could invoke private future posting';exception when insufficient_privilege then null;end;
 begin perform agroverix_private.save_personnel_for(t.other_id,'{}',array[t.a],gen_random_uuid());raise exception 'Member could invoke private owner helper';exception when insufficient_privilege then null;end;
 v_plan:=public.agroverix_save_personnel_schedule(jsonb_build_object('person_name','Örnek Geçici Personel','employment_type','temporary','start_month',(v_month+interval '1 month')::date,'month_count',2,'season_year',2026,'salary',100),array[t.a],gen_random_uuid());
 update payroll_test_context set temp_plan=v_plan;
 if exists(select 1 from public.farmer_personnel_expenses where schedule_id=v_plan) then raise exception 'Future temporary schedule accrued early';end if;
 v_plan:=public.agroverix_save_personnel_schedule(jsonb_build_object('person_name','Örnek Durdurulan Personel','employment_type','temporary','start_month',v_month,'month_count',3,'season_year',2026,'salary',100),array[t.a],gen_random_uuid());
 perform public.agroverix_stop_personnel_schedule(v_plan);update payroll_test_context set stop_plan=v_plan;
end $$;
reset role;
-- Only the internal worker can test a future clock. All fixtures roll back.
do $$declare t payroll_test_context;v_month date:=date_trunc('month',now() at time zone 'Europe/Istanbul')::date;begin
 select * into t from payroll_test_context;
 perform agroverix_private.accrue_personnel_due(t.owner_id,(v_month+interval '15 months')::date);
 perform agroverix_private.accrue_personnel_due(t.owner_id,(v_month+interval '15 months')::date);
 if (select count(*) from public.farmer_personnel_expenses where schedule_id=t.plan_id)<>12 or (select count(*) from public.farmer_personnel_expenses where schedule_id=t.temp_plan)<>2 or (select count(*) from public.farmer_personnel_expenses where schedule_id=t.stop_plan)<>1 then raise exception 'Duration, stop, rollover or repeat protection failed';end if;
 if (select sum(total_cost) from public.farmer_operations where personnel_expense_id in(select id from public.farmer_personnel_expenses where schedule_id=t.plan_id))<>432000 then raise exception 'Annual salary costs were counted incorrectly';end if;
 perform set_config('request.jwt.claim.sub',t.other_id::text,true);
end $$;
set local role authenticated;
do $$declare t payroll_test_context;begin
 select * into t from payroll_test_context;
 if exists(select 1 from public.farmer_personnel_schedules where id=t.plan_id) or exists(select 1 from public.farmer_personnel_adjustments where id=t.advance_id) then raise exception 'Payroll owner isolation failed';end if;
 begin perform public.agroverix_stop_personnel_schedule(t.plan_id);raise exception 'Other member stopped a plan';exception when insufficient_privilege then null;end;
 begin perform public.agroverix_save_personnel_adjustment(jsonb_build_object('expense_id',t.current_expense,'kind','advance','entry_date',current_date,'amount',1),gen_random_uuid());raise exception 'Other member entered an advance';exception when insufficient_privilege then null;end;
 begin perform public.agroverix_void_personnel_adjustment(t.advance_id);raise exception 'Other member cancelled an advance';exception when insufficient_privilege then null;end;
 begin insert into public.farmer_personnel_schedules(user_id,request_id,person_name,employment_type,start_month,month_count,season_year,salary,insurance,other_cost,selected_farm_ids) values(t.other_id,gen_random_uuid(),'Örnek','temporary',date '2026-01-01',1,2026,1,0,0,array[t.a]);raise exception 'Direct schedule write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.agroverix_refresh_personnel_due();raise exception 'Anonymous posting allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.farmer_personnel_adjustments;raise exception 'Anonymous payroll read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',(select a.user_id::text from agroverix_private.admins a join auth.users u on u.id=a.user_id where a.active and u.email_confirmed_at is not null limit 1),true);end $$;
set local role authenticated;
do $$declare t payroll_test_context;begin
 select * into t from payroll_test_context;
 if not exists(select 1 from public.agroverix_admin_report_rows('personnel_schedules',0,500,t.owner_id) r where r->>'id'=t.plan_id::text) or not exists(select 1 from public.agroverix_admin_report_rows('personnel_adjustments',0,500,t.owner_id) r where r->>'id'=t.advance_id::text) then raise exception 'Admin payroll datasets missing';end if;
end $$;
reset role;
select 'PASS: due-only monthly posting, 12/2-month limits, retries, rollover, stop, advance month, unchanged salary cost, extra/reversal, original allocations, owner isolation, admin exports' as payroll_checks;
rollback;
