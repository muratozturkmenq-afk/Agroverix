begin;
-- Run inside a transaction and always roll back. No new Auth users or mail.
create temporary table personnel_test_context(owner_id uuid,other_id uuid,a uuid,b uuid,c uuid,request_id uuid,expense_id uuid) on commit drop;
grant all on personnel_test_context to authenticated;
insert into personnel_test_context(owner_id,other_id,a,b,c,request_id)
select f.user_id,(select s.user_id from public.farmer_account_settings s where s.user_id<>f.user_id order by s.user_id limit 1),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()
from public.farmer_farms f order by f.id limit 1;
do $$begin if not exists(select 1 from personnel_test_context where owner_id is not null and other_id is not null) then raise exception 'Test requires two existing accounts and an existing farm.';end if;end$$;
insert into public.farmer_farms(id,user_id,name,province,district,village,crop,area_decare,season_year)
select x.id,t.owner_id,'Örnek Personel Testi',f.province,f.district,f.village,'Örnek Bitki',x.area,2026
from personnel_test_context t cross join lateral(select * from public.farmer_farms where user_id=t.owner_id order by id limit 1) f
cross join lateral(values(t.a,30::numeric),(t.b,70::numeric),(t.c,50::numeric)) x(id,area);
insert into public.farmer_seasons(farm_id,user_id,season_year,crop,area_decare)
select f.id,f.user_id,2026,f.crop,f.area_decare from public.farmer_farms f,personnel_test_context t where f.id in(t.a,t.b,t.c);
select set_config('request.jwt.claim.sub',owner_id::text,true) from personnel_test_context;
set local role authenticated;
do $$declare t personnel_test_context;v_id uuid;again uuid;v_sum numeric;begin
 select * into t from personnel_test_context;
 v_id:=public.agroverix_save_personnel_expense(jsonb_build_object('person_name','Örnek Personel','expense_date','2026-06-01','season_year',2026,'salary',800,'insurance',100,'other_cost',100),array[t.a,t.b],t.request_id);
 update personnel_test_context set expense_id=v_id;
 if (select count(*) from public.farmer_personnel_allocations where expense_id=v_id)<>2 then raise exception 'Allocation count mismatch';end if;
 if (select amount from public.farmer_personnel_allocations where expense_id=v_id and farm_id=t.a)<>300 or (select amount from public.farmer_personnel_allocations where expense_id=v_id and farm_id=t.b)<>700 then raise exception '30/70 area allocation failed';end if;
 if (select count(*) from public.farmer_operations where personnel_expense_id=v_id)<>2 or (select sum(total_cost) from public.farmer_operations where personnel_expense_id=v_id)<>1000 then raise exception 'Farm costs missing or counted twice';end if;
 if exists(select 1 from public.farmer_operations where personnel_expense_id=v_id and (cost_basis<>'field_total' or operation_type<>'labor' or inventory_item_id is not null)) then raise exception 'Wrong operation semantics';end if;
 again:=public.agroverix_save_personnel_expense('{}',array[t.a,t.b],t.request_id);
 if again<>v_id or (select count(*) from public.farmer_operations where personnel_expense_id=v_id)<>2 then raise exception 'Retry created duplicates';end if;
 perform public.agroverix_save_personnel_expense(jsonb_build_object('id',v_id,'person_name','Örnek Personel','expense_date','2026-06-02','season_year',2026,'salary',800.01,'insurance',100,'other_cost',100),array[t.a,t.b],gen_random_uuid());
 if (select sum(total_cost) from public.farmer_operations where personnel_expense_id=v_id)<>1000.01 or (select count(*) from public.farmer_operations where personnel_expense_id=v_id)<>2 then raise exception 'Edit did not replace costs atomically';end if;
 if (select amount from public.farmer_personnel_allocations where expense_id=v_id and farm_id=t.b)<>700.01 then raise exception 'Cent remainder mismatch';end if;
 begin update public.farmer_operations set total_cost=1 where personnel_expense_id=v_id;raise exception 'Direct operation edit was allowed';exception when insufficient_privilege then null;end;
 begin delete from public.farmer_operations where personnel_expense_id=v_id;raise exception 'Direct operation delete was allowed';exception when insufficient_privilege then null;end;
 begin insert into public.farmer_personnel_expenses(user_id,request_id,person_name,expense_date,season_year,salary,selected_farm_ids) values(t.owner_id,gen_random_uuid(),'Örnek',current_date,2026,1,array[t.a]);raise exception 'Direct parent write was allowed';exception when insufficient_privilege then null;end;
 begin perform public.agroverix_save_personnel_expense(jsonb_build_object('person_name','Örnek','expense_date','2026-06-01','season_year',2026,'salary',-1),array[t.a],gen_random_uuid());raise exception 'Negative salary was allowed';exception when raise_exception then if sqlerrm='Negative salary was allowed' then raise;end if;end;
 begin perform public.agroverix_save_personnel_expense(jsonb_build_object('person_name','Örnek','expense_date','2026-06-01','season_year',2026,'salary',1.234),array[t.a],gen_random_uuid());raise exception 'Excess decimals were allowed';exception when raise_exception then if sqlerrm='Excess decimals were allowed' then raise;end if;end;
 begin perform public.agroverix_save_personnel_expense(jsonb_build_object('person_name','Örnek','expense_date','2026-06-01','season_year',2026,'salary',1),array[t.a,t.a],gen_random_uuid());raise exception 'Duplicate farms were allowed';exception when raise_exception then if sqlerrm='Duplicate farms were allowed' then raise;end if;end;
 perform public.agroverix_void_personnel_expense(v_id);
 if not (select is_void from public.farmer_personnel_expenses where id=v_id) or exists(select 1 from public.farmer_operations where personnel_expense_id=v_id) or exists(select 1 from public.farmer_personnel_allocations where expense_id=v_id) then raise exception 'Void did not remove costs';end if;
 perform public.agroverix_save_personnel_expense(jsonb_build_object('id',v_id,'person_name','Örnek Personel','expense_date','2026-06-03','season_year',2026,'salary',0.01),array[t.a,t.b,t.c],gen_random_uuid());
 if (select sum(amount) from public.farmer_personnel_allocations where expense_id=v_id)<>0.01 or (select count(*) from public.farmer_operations where personnel_expense_id=v_id)<>3 or (select sum(total_cost) from public.farmer_operations where personnel_expense_id=v_id)<>0.01 then raise exception 'Restore or small-cent allocation failed';end if;
 if (select amount from public.farmer_personnel_allocations where expense_id=v_id and farm_id=t.b)<>0.01 then raise exception 'Largest remainder did not receive the cent';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',other_id::text,true) from personnel_test_context;
set local role authenticated;
do $$declare t personnel_test_context;begin
 select * into t from personnel_test_context;
 if exists(select 1 from public.farmer_personnel_expenses where id=t.expense_id) or exists(select 1 from public.farmer_personnel_allocations where expense_id=t.expense_id) or exists(select 1 from public.farmer_operations where personnel_expense_id=t.expense_id) then raise exception 'Owner isolation failed';end if;
 begin perform public.agroverix_void_personnel_expense(t.expense_id);raise exception 'Other owner could cancel';exception when insufficient_privilege then null;end;
 begin perform public.agroverix_save_personnel_expense(jsonb_build_object('person_name','Örnek','expense_date','2026-06-01','season_year',2026,'salary',1),array[t.a],gen_random_uuid());raise exception 'Other owner could allocate to foreign farm';exception when insufficient_privilege then null;end;
 if not public.is_agroverix_admin() then begin perform public.agroverix_admin_report_rows('personnel_expenses',0,500,null);raise exception 'Non-admin report was allowed';exception when insufficient_privilege then null;end;end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform 1 from public.farmer_personnel_expenses;raise exception 'Anonymous read was allowed';exception when insufficient_privilege then null;end;
 begin perform public.agroverix_save_personnel_expense('{}',array[]::uuid[],null);raise exception 'Anonymous save was allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',(select a.user_id::text from agroverix_private.admins a join auth.users u on u.id=a.user_id where a.active and u.email_confirmed_at is not null limit 1),true);end $$;
set local role authenticated;
do $$declare t personnel_test_context;begin
 select * into t from personnel_test_context;
 if not public.is_agroverix_admin() then raise exception 'Admin test account unavailable';end if;
 if not exists(select 1 from public.agroverix_admin_report_rows('personnel_expenses',0,500,t.owner_id) r where r->>'id'=t.expense_id::text) then raise exception 'Admin personnel dataset missing';end if;
 if (select count(*) from public.agroverix_admin_report_rows('personnel_allocations',0,500,t.owner_id) r where r->>'expense_id'=t.expense_id::text)<>3 then raise exception 'Admin allocation dataset missing';end if;
end $$;
reset role;
select 'PASS: area allocation, exact cents, idempotency, edit, cancel, restore, generated costs, owner isolation, anonymous denial' as personnel_checks;

rollback;
