begin;
-- Keep delivery paused until the matching worker has been deployed.
select cron.alter_job(job_id:=jobid,active:=false) from cron.job where jobname='agroverix-admin-notifications';
lock table auth.users in share row exclusive mode;

create table if not exists agroverix_private.member_counter(
 singleton boolean primary key default true check(singleton),
 last_number bigint not null default 0 check(last_number>=0)
);
create table if not exists agroverix_private.member_registry(
 member_number bigint primary key check(member_number>0),
 user_id uuid unique references auth.users(id) on delete set null,
 registered_at timestamptz not null,
 member_code text generated always as
  ('AV-'||lpad(member_number::text,greatest(6,length(member_number::text)),'0')) stored unique
);
alter table agroverix_private.member_counter enable row level security;
alter table agroverix_private.member_counter force row level security;
alter table agroverix_private.member_registry enable row level security;
alter table agroverix_private.member_registry force row level security;
revoke all on agroverix_private.member_counter,agroverix_private.member_registry from public,anon,authenticated;
insert into agroverix_private.member_counter(singleton) values(true) on conflict do nothing;

create or replace function agroverix_private.assign_member(p_user_id uuid,p_registered_at timestamptz) returns void
language plpgsql security definer set search_path='' as $member$
declare next_number bigint;
begin
 perform 1 from agroverix_private.member_counter where singleton for update;
 if exists(select 1 from agroverix_private.member_registry where user_id=p_user_id) then return;end if;
 update agroverix_private.member_counter set last_number=last_number+1 where singleton returning last_number into next_number;
 insert into agroverix_private.member_registry(member_number,user_id,registered_at)
 values(next_number,p_user_id,coalesce(p_registered_at,now()));
end $member$;
revoke all on function agroverix_private.assign_member(uuid,timestamptz) from public,anon,authenticated;

-- Historical accounts retain registration order; reruns never renumber anyone.
do $backfill$
declare account record;
begin
 for account in select u.id,u.created_at from auth.users u
  where not exists(select 1 from agroverix_private.member_registry m where m.user_id=u.id)
  order by u.created_at,u.id
 loop perform agroverix_private.assign_member(account.id,account.created_at);end loop;
end $backfill$;
create or replace function public.agroverix_register_member() returns trigger
language plpgsql security definer set search_path='' as $trigger$
begin
 perform agroverix_private.assign_member(new.id,new.created_at);
 return new;
end $trigger$;
revoke all on function public.agroverix_register_member() from public,anon,authenticated;
drop trigger if exists agroverix_00_member_identity on auth.users;
create trigger agroverix_00_member_identity after insert on auth.users
for each row execute function public.agroverix_register_member();

alter table agroverix_private.admin_notification_outbox add column if not exists signup_member jsonb;
create or replace function public.agroverix_queue_admin_activity() returns trigger
language plpgsql security definer set search_path='' as $queue$
begin
 if tg_op='INSERT' then
  insert into agroverix_private.admin_notification_outbox(source_key,event_kind,user_id,occurred_at)
  values('signup:'||new.id,'signup',new.id,coalesce(new.created_at,now())) on conflict(source_key) do nothing;
 end if;
 return new;
exception when others then
 raise warning 'AgroVerix signup notification could not be queued';
 return new;
end $queue$;
revoke all on function public.agroverix_queue_admin_activity() from public,anon,authenticated;
drop trigger if exists agroverix_admin_activity_notice on auth.users;
create trigger agroverix_admin_activity_notice after insert on auth.users
for each row execute function public.agroverix_queue_admin_activity();

-- Preserve old audit rows, but never deliver an unsent login notification.
update agroverix_private.admin_notification_outbox
 set state='failed',last_error='LOGIN_NOTIFICATIONS_DISABLED',leased_at=null,lease_id=null
 where event_kind='login' and state in ('pending','processing');

create or replace function public.agroverix_notification_claim(p_worker_key text,p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $claim$
declare result jsonb;
begin
 if not exists(select 1 from agroverix_private.notification_settings where singleton and enabled and extensions.digest(worker_key,'sha256')=extensions.digest(coalesce(p_worker_key,''),'sha256')) then
  raise exception 'Unauthorized' using errcode='42501';
 end if;
 update agroverix_private.admin_notification_outbox set state='failed',last_error='DELIVERY_RETRY_LIMIT'
 where event_kind<>'login' and state='processing' and leased_at<now()-interval '10 minutes' and attempts>=6;
 with candidates as(
  select n.id,d.details,d.membership from agroverix_private.admin_notification_outbox n
  left join public.farmer_profiles p on p.user_id=n.user_id
  left join agroverix_private.member_registry m on m.user_id=n.user_id
  cross join lateral(select
   case when n.event_kind='signup' then coalesce(n.signup_profile,agroverix_private.notice_profile(p.full_name,p.province,p.district,p.country)) else null end as details,
   case when n.event_kind='signup' then coalesce(n.signup_member,
    case when m.member_number is not null then jsonb_build_object('member_number',m.member_number,'member_code',m.member_code,'member_count',(select count(*) from auth.users)) end)
    else null end as membership) d
  where n.event_kind in ('signup','system_test') and n.attempts<6
   and ((n.state='pending' and n.available_at<=now()) or (n.state='processing' and n.leased_at<now()-interval '10 minutes'))
   and (n.event_kind<>'signup' or (d.details is not null and d.membership is not null))
  order by n.occurred_at,n.id for update of n skip locked limit greatest(1,least(coalesce(p_limit,5),10))
 ),claimed as(
  update agroverix_private.admin_notification_outbox n
  set state='processing',attempts=n.attempts+1,leased_at=now(),lease_id=gen_random_uuid(),
   signup_profile=case when n.event_kind='signup' then c.details else null end,
   signup_member=case when n.event_kind='signup' then c.membership else null end
  from candidates c where n.id=c.id returning n.id,n.event_kind,n.occurred_at,n.lease_id,n.signup_profile,n.signup_member
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'kind',c.event_kind,'occurred_at',c.occurred_at,'lease_id',c.lease_id,'recipient',s.recipient)
  ||case when c.event_kind='signup' then jsonb_build_object('profile',c.signup_profile,'membership',c.signup_member) else '{}'::jsonb end),'[]'::jsonb)
 into result from claimed c cross join agroverix_private.notification_settings s where s.singleton;
 return result;
end $claim$;
revoke all on function public.agroverix_notification_claim(text,integer) from public,anon,authenticated;
grant execute on function public.agroverix_notification_claim(text,integer) to service_role;

create or replace function public.agroverix_admin_notification_status() returns jsonb
language plpgsql security definer set search_path='' as $status$
declare result jsonb;
begin
 if not public.is_agroverix_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 select jsonb_build_object('recipient',s.recipient,'enabled',s.enabled,'transport_ready',s.transport_ready,'last_error',s.last_error,'last_sent_at',s.last_sent_at,
 'member_count',(select count(*) from auth.users),
 'total_registered',(select last_number from agroverix_private.member_counter where singleton),
 'pending',(select count(*) from agroverix_private.admin_notification_outbox where event_kind<>'login' and state in ('pending','processing')),
 'sent',(select count(*) from agroverix_private.admin_notification_outbox where event_kind<>'login' and state='sent'),
 'failed',(select count(*) from agroverix_private.admin_notification_outbox where event_kind<>'login' and state='failed')) into result
 from agroverix_private.notification_settings s where singleton;
 return result;
end $status$;
revoke all on function public.agroverix_admin_notification_status() from public,anon;
grant execute on function public.agroverix_admin_notification_status() to authenticated;

create or replace function public.agroverix_dispatch_admin_notifications() returns bigint
language plpgsql security definer set search_path='' as $dispatch$
declare settings agroverix_private.notification_settings;request_id bigint;
begin
 select * into settings from agroverix_private.notification_settings where singleton;
 if not settings.enabled or nullif(settings.gateway_key,'') is null then return null;end if;
 if not exists(select 1 from agroverix_private.admin_notification_outbox where event_kind in ('signup','system_test') and ((state='pending' and available_at<=now()) or (state='processing' and leased_at<now()-interval '10 minutes' and attempts<6))) then return null;end if;
 select net.http_post(url:='https://drfpdtioxhmamspyzoyh.supabase.co/functions/v1/admin-notify',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||settings.gateway_key,'X-AgroVerix-Worker',settings.worker_key),
 body:='{}'::jsonb,timeout_milliseconds:=90000) into request_id;
 return request_id;
end $dispatch$;
revoke all on function public.agroverix_dispatch_admin_notifications() from public,anon,authenticated;

create or replace function public.agroverix_admin_report_rows(p_dataset text,p_offset integer default 0,p_limit integer default 500,p_user_id uuid default null)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_agroverix_admin() then raise exception 'Yönetici erişimi gerekli' using errcode='42501';end if;
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'Geçersiz sayfalama';end if;
 if p_dataset not in ('accounts','profiles','farms','seasons','operations','harvest_sales','harvest_receipts') then raise exception 'Geçersiz rapor';end if;
 if p_offset=0 then insert into agroverix_private.report_access_log(admin_id,dataset,selected_user_id) values(auth.uid(),p_dataset,p_user_id);end if;
 if p_dataset='accounts' then
  return query select jsonb_build_object('user_id',u.id,'member_code',m.member_code,'member_number',m.member_number,'email',u.email,'currency',coalesce(cs.currency,'TRY'),'phone',coalesce(p.phone,u.phone),'full_name',p.full_name,'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'phone_confirmed',u.phone_confirmed_at is not null and p.phone is not distinct from u.phone,'sms_consent',coalesce(p.sms_consent,false),'sms_consent_at',p.sms_consent_at)
  from auth.users u left join public.farmer_account_settings cs on cs.user_id=u.id left join public.farmer_profiles p on p.user_id=u.id left join agroverix_private.member_registry m on m.user_id=u.id where p_user_id is null or u.id=p_user_id order by u.id offset p_offset limit p_limit;
 elsif p_dataset='profiles' then return query select to_jsonb(p) from public.farmer_profiles p where p_user_id is null or p.user_id=p_user_id order by p.user_id offset p_offset limit p_limit;
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
