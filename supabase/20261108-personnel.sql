begin;

-- Personnel costs are saved once; generated labour rows feed existing farm finance.
create table public.farmer_personnel_expenses(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 person_name text not null check(length(trim(person_name)) between 1 and 160),
 expense_date date not null check(expense_date between date '2000-01-01' and date '2200-12-31'),
 season_year integer not null check(season_year between 2000 and 2200),
 salary numeric(12,2) not null default 0 check(salary between 0 and 9999999999.99),
 insurance numeric(12,2) not null default 0 check(insurance between 0 and 9999999999.99),
 other_cost numeric(12,2) not null default 0 check(other_cost between 0 and 9999999999.99),
 total_cost numeric(12,2) generated always as (salary+insurance+other_cost) stored,
 selected_farm_ids uuid[] not null check(cardinality(selected_farm_ids) between 1 and 500),
 notes text not null default '' check(length(notes)<=1000),
 is_void boolean not null default false,
 currency text not null default 'TRY' check(currency in ('TRY','EUR')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,user_id),unique(user_id,request_id),
 check(salary+insurance+other_cost between 0.01 and 9999999999.99)
);
create table public.farmer_personnel_allocations(
 expense_id uuid not null,
 farm_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 season_year integer not null,
 area_decare numeric not null check(area_decare>0 and area_decare<=1000000),
 amount numeric(12,2) not null check(amount between 0 and 9999999999.99),
 currency text not null default 'TRY' check(currency in ('TRY','EUR')),
 primary key(expense_id,farm_id),
 unique(expense_id,farm_id,user_id,season_year),
 foreign key(expense_id,user_id) references public.farmer_personnel_expenses(id,user_id) on delete cascade,
 foreign key(farm_id,season_year) references public.farmer_seasons(farm_id,season_year) on delete restrict
);
create index personnel_owner_date on public.farmer_personnel_expenses(user_id,expense_date desc);
create index personnel_allocation_owner on public.farmer_personnel_allocations(user_id,season_year);
create index personnel_allocation_farm on public.farmer_personnel_allocations(farm_id,season_year);
alter table public.farmer_personnel_expenses enable row level security;
alter table public.farmer_personnel_expenses force row level security;
alter table public.farmer_personnel_allocations enable row level security;
alter table public.farmer_personnel_allocations force row level security;
revoke all on public.farmer_personnel_expenses,public.farmer_personnel_allocations from public,anon,authenticated;
grant select on public.farmer_personnel_expenses,public.farmer_personnel_allocations to authenticated;
create policy personnel_owner_read on public.farmer_personnel_expenses for select to authenticated using(user_id=(select auth.uid()));
create policy personnel_allocations_owner_read on public.farmer_personnel_allocations for select to authenticated using(user_id=(select auth.uid()));
create trigger aaa_account_currency before insert or update on public.farmer_personnel_expenses for each row execute function public.agroverix_stamp_account_currency();
create trigger aaa_account_currency before insert or update on public.farmer_personnel_allocations for each row execute function public.agroverix_stamp_account_currency();

alter table public.farmer_operations add column personnel_expense_id uuid;
alter table public.farmer_operations add constraint personnel_operation_allocation foreign key(personnel_expense_id,farm_id,user_id,season_year)
 references public.farmer_personnel_allocations(expense_id,farm_id,user_id,season_year) on delete cascade;
create unique index personnel_operation_once on public.farmer_operations(personnel_expense_id,farm_id) where personnel_expense_id is not null;

create function public.agroverix_personnel_operation_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if ((tg_op<>'INSERT' and old.personnel_expense_id is not null) or (tg_op<>'DELETE' and new.personnel_expense_id is not null)) and pg_trigger_depth()<2 then
  raise exception 'Personel giderini Personel sayfasından düzenle veya iptal et.' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.agroverix_personnel_operation_guard() from public,anon,authenticated;
create trigger aab_personnel_operation_guard before insert or update or delete on public.farmer_operations for each row execute function public.agroverix_personnel_operation_guard();

create function public.agroverix_personnel_operation_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.farmer_personnel_expenses;
begin
 select * into strict p from public.farmer_personnel_expenses where id=new.expense_id and user_id=new.user_id and not is_void;
 if new.season_year<>p.season_year then raise exception 'Personel giderinin sezonu uyuşmuyor.';end if;
 insert into public.farmer_operations(user_id,farm_id,season_year,operation_type,operation_date,product,total_cost,cost_basis,cost_source,notes,personnel_expense_id)
 values(p.user_id,new.farm_id,p.season_year,'labor',p.expense_date,p.person_name,new.amount,'field_total','manual','Personel gideri · Maaş, sigorta ve diğer giderlerin tarla payı.'||case when p.notes<>'' then ' '||p.notes else '' end,p.id);
 return new;
end $$;
revoke all on function public.agroverix_personnel_operation_insert() from public,anon,authenticated;
create trigger personnel_allocation_operation after insert on public.farmer_personnel_allocations for each row execute function public.agroverix_personnel_operation_insert();

create function public.agroverix_save_personnel_expense(p_expense jsonb,p_farm_ids uuid[],p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();v_id uuid:=nullif(p_expense->>'id','')::uuid;
 v_name text:=trim(p_expense->>'person_name');v_date date:=(p_expense->>'expense_date')::date;v_year integer:=(p_expense->>'season_year')::integer;
 v_salary numeric:=coalesce(nullif(p_expense->>'salary','')::numeric,0);v_insurance numeric:=coalesce(nullif(p_expense->>'insurance','')::numeric,0);v_other numeric:=coalesce(nullif(p_expense->>'other_cost','')::numeric,0);
 v_total numeric;v_ids uuid[];v_count integer;v_area numeric;v_currency text;v_notes text:=coalesce(trim(p_expense->>'notes'),'');
begin
 if v_user is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,81961108));
 if v_id is null and p_request_id is not null then
  select id into v_id from public.farmer_personnel_expenses where user_id=v_user and request_id=p_request_id;
  if found then return v_id;end if;
 end if;
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
  insert into public.farmer_personnel_expenses(user_id,request_id,person_name,expense_date,season_year,salary,insurance,other_cost,selected_farm_ids,notes)
  values(v_user,p_request_id,v_name,v_date,v_year,v_salary,v_insurance,v_other,v_ids,v_notes) returning id into v_id;
 else
  perform 1 from public.farmer_personnel_expenses where id=v_id and user_id=v_user for update;
  if not found then raise exception 'Personel kaydı bulunamadı veya hesabına ait değil.' using errcode='42501';end if;
  update public.farmer_personnel_expenses set person_name=v_name,expense_date=v_date,season_year=v_year,salary=v_salary,insurance=v_insurance,other_cost=v_other,selected_farm_ids=v_ids,notes=v_notes,is_void=false,updated_at=now() where id=v_id and user_id=v_user;
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
revoke all on function public.agroverix_save_personnel_expense(jsonb,uuid[],uuid) from public,anon;
grant execute on function public.agroverix_save_personnel_expense(jsonb,uuid[],uuid) to authenticated;

create function public.agroverix_void_personnel_expense(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Önce giriş yap.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,81961108));
 perform 1 from public.farmer_personnel_expenses where id=p_id and user_id=v_user for update;
 if not found then raise exception 'Personel kaydı bulunamadı veya hesabına ait değil.' using errcode='42501';end if;
 delete from public.farmer_personnel_allocations where expense_id=p_id and user_id=v_user;
 update public.farmer_personnel_expenses set is_void=true,updated_at=now() where id=p_id and user_id=v_user;
end $$;
revoke all on function public.agroverix_void_personnel_expense(uuid) from public,anon;
grant execute on function public.agroverix_void_personnel_expense(uuid) to authenticated;

-- Same existing admin role; ordinary members retain owner-only table access.
create or replace function public.agroverix_admin_report_rows(p_dataset text,p_offset integer default 0,p_limit integer default 500,p_user_id uuid default null)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_agroverix_admin() then raise exception 'Yönetici erişimi gerekli' using errcode='42501';end if;
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'Geçersiz sayfalama';end if;
 if p_dataset not in ('accounts','profiles','farms','seasons','operations','harvest_sales','harvest_receipts','inventory_items','inventory_purchases','inventory_payments','personnel_expenses','personnel_allocations') then raise exception 'Geçersiz rapor';end if;
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
