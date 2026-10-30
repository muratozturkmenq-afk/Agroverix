begin;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists agroverix_private.notification_settings(
 singleton boolean primary key default true check(singleton),
 recipient text not null check(recipient ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
 worker_key text not null default encode(extensions.gen_random_bytes(32),'hex'),
 gateway_key text,
 enabled boolean not null default true,
 transport_ready boolean not null default false,
 last_error text,
 last_sent_at timestamptz
);
insert into agroverix_private.notification_settings(singleton,recipient) values(true,'agroverixinfo@gmail.com')
on conflict(singleton) do update set recipient=excluded.recipient;

create table if not exists agroverix_private.admin_notification_outbox(
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique,
 event_kind text not null check(event_kind in ('signup','login','system_test')),
 user_id uuid references auth.users(id) on delete set null,
 occurred_at timestamptz not null default now(),
 state text not null default 'pending' check(state in ('pending','processing','sent','failed')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 leased_at timestamptz,
 lease_id uuid,
 sent_at timestamptz,
 last_error text
);
create index if not exists admin_notice_pending_idx on agroverix_private.admin_notification_outbox(state,available_at);
alter table agroverix_private.notification_settings enable row level security;
alter table agroverix_private.notification_settings force row level security;
alter table agroverix_private.admin_notification_outbox enable row level security;
alter table agroverix_private.admin_notification_outbox force row level security;
revoke all on agroverix_private.notification_settings,agroverix_private.admin_notification_outbox from public,anon,authenticated;

-- Only server-generated Auth events enter the queue. Mail delivery cannot block sign-in.
create or replace function public.agroverix_queue_admin_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into agroverix_private.admin_notification_outbox(source_key,event_kind,user_id,occurred_at)
  values('signup:'||new.id,'signup',new.id,coalesce(new.created_at,now())) on conflict(source_key) do nothing;
 elsif new.last_sign_in_at is not null and new.last_sign_in_at is distinct from old.last_sign_in_at then
  insert into agroverix_private.admin_notification_outbox(source_key,event_kind,user_id,occurred_at)
  values('login:'||new.id||':'||extract(epoch from new.last_sign_in_at),'login',new.id,new.last_sign_in_at) on conflict(source_key) do nothing;
 end if;
 return new;
exception when others then
 raise warning 'AgroVerix admin notification could not be queued';
 return new;
end $$;
drop trigger if exists agroverix_admin_activity_notice on auth.users;
create trigger agroverix_admin_activity_notice after insert or update of last_sign_in_at on auth.users
for each row execute function public.agroverix_queue_admin_activity();
revoke all on function public.agroverix_queue_admin_activity() from public,anon,authenticated;

create or replace function public.agroverix_notification_transport(p_worker_key text,p_ready boolean,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from agroverix_private.notification_settings where singleton and enabled and extensions.digest(worker_key,'sha256')=extensions.digest(coalesce(p_worker_key,''),'sha256')) then
  raise exception 'Unauthorized' using errcode='42501';
 end if;
 if p_ready is not null or p_error is not null then
  update agroverix_private.notification_settings set transport_ready=coalesce(p_ready,transport_ready),last_error=left(p_error,80) where singleton;
 end if;
 return true;
end $$;

create or replace function public.agroverix_notification_claim(p_worker_key text,p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from agroverix_private.notification_settings where singleton and enabled and extensions.digest(worker_key,'sha256')=extensions.digest(coalesce(p_worker_key,''),'sha256')) then
  raise exception 'Unauthorized' using errcode='42501';
 end if;
 update agroverix_private.admin_notification_outbox set state='failed',last_error='DELIVERY_RETRY_LIMIT'
 where state='processing' and leased_at<now()-interval '10 minutes' and attempts>=6;
 with candidates as(
  select id from agroverix_private.admin_notification_outbox
  where attempts<6 and ((state='pending' and available_at<=now()) or (state='processing' and leased_at<now()-interval '10 minutes'))
  order by occurred_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,5),10))
 ),claimed as(
  update agroverix_private.admin_notification_outbox n set state='processing',attempts=attempts+1,leased_at=now(),lease_id=gen_random_uuid()
  from candidates c where n.id=c.id returning n.id,n.event_kind,n.occurred_at,n.lease_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'kind',c.event_kind,'occurred_at',c.occurred_at,'lease_id',c.lease_id,'recipient',s.recipient)),'[]'::jsonb)
 into result from claimed c cross join agroverix_private.notification_settings s where s.singleton;
 return result;
end $$;

create or replace function public.agroverix_notification_finish(p_worker_key text,p_id uuid,p_lease_id uuid,p_sent boolean,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if not exists(select 1 from agroverix_private.notification_settings where singleton and enabled and extensions.digest(worker_key,'sha256')=extensions.digest(coalesce(p_worker_key,''),'sha256')) then
  raise exception 'Unauthorized' using errcode='42501';
 end if;
 update agroverix_private.admin_notification_outbox
 set state=case when p_sent then 'sent' when attempts>=6 then 'failed' else 'pending' end,
 sent_at=case when p_sent then now() else null end,last_error=case when p_sent then null else left(p_error,80) end,
 available_at=now()+make_interval(secs=>least(3600,(power(2,attempts)*30)::integer)),leased_at=null,lease_id=null
 where id=p_id and lease_id=p_lease_id and state='processing';
 get diagnostics affected=row_count;
 if p_sent and affected=1 then update agroverix_private.notification_settings set transport_ready=true,last_error=null,last_sent_at=now() where singleton;end if;
 return affected=1;
end $$;

create or replace function public.agroverix_admin_notification_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_agroverix_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 select jsonb_build_object('recipient',s.recipient,'enabled',s.enabled,'transport_ready',s.transport_ready,'last_error',s.last_error,'last_sent_at',s.last_sent_at,
 'pending',(select count(*) from agroverix_private.admin_notification_outbox where state in ('pending','processing')),
 'sent',(select count(*) from agroverix_private.admin_notification_outbox where state='sent'),
 'failed',(select count(*) from agroverix_private.admin_notification_outbox where state='failed')) into result
 from agroverix_private.notification_settings s where singleton;
 return result;
end $$;

-- The gateway JWT is a public anon key; the separate random worker key authorizes delivery.
-- Neither the SMTP password nor a service-role credential is stored in client files.
create or replace function public.agroverix_dispatch_admin_notifications() returns bigint
language plpgsql security definer set search_path='' as $$
declare settings agroverix_private.notification_settings;request_id bigint;
begin
 select * into settings from agroverix_private.notification_settings where singleton;
 if not settings.enabled or nullif(settings.gateway_key,'') is null then return null;end if;
 if not exists(select 1 from agroverix_private.admin_notification_outbox where (state='pending' and available_at<=now()) or (state='processing' and leased_at<now()-interval '10 minutes' and attempts<6)) then return null;end if;
 select net.http_post(url:='https://drfpdtioxhmamspyzoyh.supabase.co/functions/v1/admin-notify',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||settings.gateway_key,'X-AgroVerix-Worker',settings.worker_key),
 body:='{}'::jsonb,timeout_milliseconds:=90000) into request_id;
 return request_id;
end $$;

revoke all on function public.agroverix_notification_transport(text,boolean,text),public.agroverix_notification_claim(text,integer),public.agroverix_notification_finish(text,uuid,uuid,boolean,text),public.agroverix_dispatch_admin_notifications() from public,anon,authenticated;
grant execute on function public.agroverix_notification_transport(text,boolean,text),public.agroverix_notification_claim(text,integer),public.agroverix_notification_finish(text,uuid,uuid,boolean,text) to service_role;
revoke all on function public.agroverix_admin_notification_status() from public,anon;
grant execute on function public.agroverix_admin_notification_status() to authenticated;

insert into agroverix_private.admin_notification_outbox(source_key,event_kind) values('setup-test-v1','system_test') on conflict(source_key) do nothing;
do $$begin
 if not exists(select 1 from cron.job where jobname='agroverix-admin-notifications') then
  perform cron.schedule('agroverix-admin-notifications','*/5 * * * *','select public.agroverix_dispatch_admin_notifications();');
 end if;
end $$;
notify pgrst,'reload schema';
commit;
