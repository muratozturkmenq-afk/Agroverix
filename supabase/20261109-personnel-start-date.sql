begin;
alter table public.farmer_personnel_schedules add column start_date date;
update public.farmer_personnel_schedules set start_date=start_month;
alter table public.farmer_personnel_schedules alter column start_date set not null;
alter table public.farmer_personnel_schedules add constraint personnel_schedule_start_day check(date_trunc('month',start_date)::date=start_month);
create or replace function agroverix_private.accrue_personnel_due(p_user uuid default null,p_as_of date default (now() at time zone 'Europe/Istanbul')::date) returns integer language plpgsql security definer set search_path='' as $$
declare v_owner uuid;p public.farmer_personnel_schedules;v_month date;v_end date;v_id uuid;v_count integer:=0;v_added integer:=0;v_cutoff date:=date_trunc('month',p_as_of)::date;
begin
 for v_owner in select distinct user_id from public.farmer_personnel_schedules where is_active and start_date<=p_as_of and start_month<=v_cutoff and (p_user is null or user_id=p_user) and (last_posted_month is null or last_posted_month<least(v_cutoff,(start_month+(month_count-1)*interval '1 month')::date)) order by user_id loop
  if p_user is null then if not pg_try_advisory_xact_lock(hashtextextended(v_owner::text,81961108)) then continue;end if;
  else perform pg_advisory_xact_lock(hashtextextended(v_owner::text,81961108));end if;
  for p in select * from public.farmer_personnel_schedules where user_id=v_owner and is_active and start_date<=p_as_of and start_month<=v_cutoff and (last_posted_month is null or last_posted_month<least(v_cutoff,(start_month+(month_count-1)*interval '1 month')::date)) order by id for update skip locked loop
   begin
    v_added:=0;v_end:=least(v_cutoff,(p.start_month+(p.month_count-1)*interval '1 month')::date);
    for v_month in select d::date from generate_series(p.start_month::timestamp,v_end::timestamp,interval '1 month') d where not exists(select 1 from public.farmer_personnel_expenses e where e.schedule_id=p.id and e.period_month=d::date) loop
     v_id:=agroverix_private.save_personnel_for(p.user_id,jsonb_build_object('person_name',p.person_name,'expense_date',case when v_month=p.start_month then p.start_date else v_month end,'season_year',p.season_year,'salary',p.salary,'insurance',p.insurance,'other_cost',p.other_cost,'base_other_cost',p.other_cost,'employment_type',p.employment_type,'notes',p.notes),p.selected_farm_ids,md5(p.id::text||':'||v_month::text)::uuid);
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


create or replace function public.agroverix_save_personnel_schedule(p_schedule jsonb,p_farm_ids uuid[],p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_id uuid;v_name text:=trim(p_schedule->>'person_name');v_type text:=p_schedule->>'employment_type';
 v_start date:=coalesce(p_schedule->>'start_date',p_schedule->>'start_month')::date;v_start_month date;v_months integer:=(p_schedule->>'month_count')::integer;v_year integer:=(p_schedule->>'season_year')::integer;
 v_salary numeric:=coalesce(nullif(p_schedule->>'salary','')::numeric,0);v_insurance numeric:=coalesce(nullif(p_schedule->>'insurance','')::numeric,0);v_other numeric:=coalesce(nullif(p_schedule->>'other_cost','')::numeric,0);
 v_notes text:=coalesce(trim(p_schedule->>'notes'),'');v_ids uuid[];v_count integer;
begin
 if v_user is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,81961108));
 select id into v_id from public.farmer_personnel_schedules where user_id=v_user and request_id=p_request_id;
 if found then perform agroverix_private.accrue_personnel_due(v_user);return v_id;end if;
 if p_request_id is null or v_name is null or length(v_name) not between 1 and 160 or length(v_notes)>1000 or v_type is null or v_type not in ('permanent','temporary') then raise exception 'Personel adı ve çalışma şeklini kontrol et.';end if;
 v_start_month:=date_trunc('month',v_start)::date;
 if v_start is null or v_start<date '2000-01-01' or v_months is null or v_months not between 1 and 12 or v_start_month+(v_months-1)*interval '1 month'>date '2200-12-01' or v_year is null or v_year not between 2000 and 2200 then raise exception 'Başlangıç ayını, çalışma süresini ve sezonu kontrol et.';end if;
 if not(v_salary between 0 and 9999999999.99 and v_insurance between 0 and 9999999999.99 and v_other between 0 and 9999999999.99 and v_salary+v_insurance+v_other between 0.01 and 9999999999.99) or v_salary<>round(v_salary,2) or v_insurance<>round(v_insurance,2) or v_other<>round(v_other,2) then raise exception 'Aylık tutarları en fazla iki ondalıkla ve sıfır veya daha büyük gir. Toplam sıfırdan büyük olmalı.';end if;
 if p_farm_ids is null or cardinality(p_farm_ids) not between 1 and 500 or array_position(p_farm_ids,null) is not null then raise exception 'En az bir tarla seç.';end if;
 select array_agg(distinct x order by x) into v_ids from unnest(p_farm_ids) x;
 if cardinality(v_ids)<>cardinality(p_farm_ids) then raise exception 'Aynı tarla iki kez seçilemez.';end if;
 select count(*) into v_count from public.farmer_seasons s join public.farmer_farms f on f.id=s.farm_id join public.farmer_account_settings a on a.user_id=v_user where s.farm_id=any(v_ids) and s.season_year=v_year and s.user_id=v_user and f.user_id=v_user and s.currency=a.currency and f.currency=a.currency;
 if v_count<>cardinality(v_ids) then raise exception 'Seçilen tarla ve sezonlar hesabına ait olmalı.' using errcode='42501';end if;
 insert into public.farmer_personnel_schedules(user_id,request_id,person_name,employment_type,start_month,start_date,month_count,season_year,salary,insurance,other_cost,selected_farm_ids,notes)
 values(v_user,p_request_id,v_name,v_type,v_start_month,v_start,v_months,v_year,v_salary,v_insurance,v_other,v_ids,v_notes) returning id into v_id;
 perform agroverix_private.accrue_personnel_due(v_user);
 return v_id;
end $$;
revoke all on function public.agroverix_save_personnel_schedule(jsonb,uuid[],uuid) from public,anon;
grant execute on function public.agroverix_save_personnel_schedule(jsonb,uuid[],uuid) to authenticated;


notify pgrst,'reload schema';
commit;
