begin;
alter table public.farmer_profiles alter column full_name drop not null;
alter table public.farmer_profiles alter column identity_number drop not null;
alter table public.farmer_profiles add column if not exists phone text;
alter table public.farmer_profiles add column if not exists sms_consent boolean not null default false;
alter table public.farmer_profiles add column if not exists sms_consent_at timestamptz;
alter table public.farmer_profiles add column if not exists sms_consent_updated_at timestamptz;

create or replace function public.agroverix_profile_consent_stamp() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.phone is not null and new.phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Telefon numarası ülke koduyla yazılmalı'; end if;
 if new.sms_consent and (new.phone is null or nullif(trim(new.full_name),'') is null) then raise exception 'SMS izni için ad soyad ve telefon gerekli'; end if;
 if tg_op='INSERT' then
   new.sms_consent_at:=case when new.sms_consent then now() else null end;
   new.sms_consent_updated_at:=now();
 elsif new.sms_consent is distinct from old.sms_consent or new.phone is distinct from old.phone then
   new.sms_consent_at:=case when new.sms_consent then now() else null end;
   new.sms_consent_updated_at:=now();
 else new.sms_consent_at:=old.sms_consent_at;new.sms_consent_updated_at:=old.sms_consent_updated_at;
 end if;
 return new;
end $$;
drop trigger if exists agroverix_profile_consent_stamp on public.farmer_profiles;
create trigger agroverix_profile_consent_stamp before insert or update on public.farmer_profiles for each row execute function public.agroverix_profile_consent_stamp();

-- Persist the registration form even when email confirmation returns no session.
-- This metadata is never used for authorization or administrator privileges.
create or replace function public.agroverix_capture_signup_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare p jsonb:=new.raw_user_meta_data->'agroverix_profile';
begin
 if jsonb_typeof(p)='object' then
  insert into public.farmer_profiles(user_id,full_name,identity_number,province,district,village,phone,kvkk_notice_acknowledged,kvkk_notice_acknowledged_at,sms_consent)
  values(new.id,nullif(trim(p->>'full_name'),''),case when p->>'identity_number' ~ '^[0-9]{11}$' then p->>'identity_number' else null end,
  nullif(p->>'province',''),nullif(p->>'district',''),nullif(p->>'village',''),case when p->>'phone' ~ '^\+[1-9][0-9]{7,14}$' then p->>'phone' else null end,
  coalesce(p->>'kvkk_notice_acknowledged'='true',false),case when p->>'kvkk_notice_acknowledged'='true' then now() else null end,
  coalesce(p->>'sms_consent'='true',false) and nullif(trim(p->>'full_name'),'') is not null and p->>'phone' ~ '^\+[1-9][0-9]{7,14}$')
  on conflict(user_id) do nothing;
 end if;return new;
end $$;
drop trigger if exists agroverix_capture_signup_profile on auth.users;
create trigger agroverix_capture_signup_profile after insert on auth.users for each row execute function public.agroverix_capture_signup_profile();
revoke all on function public.agroverix_capture_signup_profile() from public,anon,authenticated;

create schema if not exists agroverix_private;
revoke all on schema agroverix_private from public,anon,authenticated;
create table if not exists agroverix_private.admins(
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists agroverix_private.report_access_log(
 id bigint generated always as identity primary key,
 admin_id uuid not null references auth.users(id) on delete cascade,
 dataset text not null,
 selected_user_id uuid,
 created_at timestamptz not null default now()
);
revoke all on all tables in schema agroverix_private from public,anon,authenticated;
alter table agroverix_private.admins enable row level security;
alter table agroverix_private.report_access_log enable row level security;

create or replace function public.is_agroverix_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from agroverix_private.admins a join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and a.active and u.email_confirmed_at is not null);
$$;
revoke all on function public.is_agroverix_admin() from public,anon;
grant execute on function public.is_agroverix_admin() to authenticated;

-- Owner data policies stay unchanged. Only this gated function can read all users.
create or replace function public.agroverix_admin_report_rows(p_dataset text,p_offset integer default 0,p_limit integer default 500,p_user_id uuid default null)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_agroverix_admin() then raise exception 'Yönetici erişimi gerekli' using errcode='42501';end if;
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'Geçersiz sayfalama';end if;
 if p_dataset not in ('accounts','profiles','farms','seasons','operations') then raise exception 'Geçersiz rapor';end if;
 if p_offset=0 then insert into agroverix_private.report_access_log(admin_id,dataset,selected_user_id) values(auth.uid(),p_dataset,p_user_id);end if;
 if p_dataset='accounts' then
  return query select jsonb_build_object('user_id',u.id,'email',u.email,'phone',coalesce(p.phone,u.phone),'full_name',p.full_name,'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'phone_confirmed',u.phone_confirmed_at is not null and p.phone is not distinct from u.phone,'sms_consent',coalesce(p.sms_consent,false),'sms_consent_at',p.sms_consent_at)
  from auth.users u left join public.farmer_profiles p on p.user_id=u.id where p_user_id is null or u.id=p_user_id order by u.id offset p_offset limit p_limit;
 elsif p_dataset='profiles' then return query select to_jsonb(p) from public.farmer_profiles p where p_user_id is null or p.user_id=p_user_id order by p.user_id offset p_offset limit p_limit;
 elsif p_dataset='farms' then return query select to_jsonb(f) from public.farmer_farms f where p_user_id is null or f.user_id=p_user_id order by f.id offset p_offset limit p_limit;
 elsif p_dataset='seasons' then return query select to_jsonb(s) from public.farmer_seasons s where p_user_id is null or s.user_id=p_user_id order by s.farm_id,s.season_year offset p_offset limit p_limit;
 elsif p_dataset='operations' then return query select to_jsonb(o) from public.farmer_operations o where p_user_id is null or o.user_id=p_user_id order by o.id offset p_offset limit p_limit;
 end if;
end $$;
revoke all on function public.agroverix_admin_report_rows(text,integer,integer,uuid) from public,anon;
grant execute on function public.agroverix_admin_report_rows(text,integer,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
