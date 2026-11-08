-- Transaction-only checks. No Auth accounts, real messages or permanent test rows.
begin;
do $test$
declare
 base_count bigint;
 original_number bigint;
 code text;
 owner_id uuid;
 worker text;
 payload jsonb;
 event jsonb;
 signup_id uuid:=gen_random_uuid();
 login_id uuid:=gen_random_uuid();
 lease uuid;
begin
 select count(*) into base_count from auth.users;
 if (select count(*) from agroverix_private.member_registry where user_id is not null)<>base_count then raise exception 'Membership backfill incomplete';end if;
 if exists(select 1 from auth.users u left join agroverix_private.member_registry m on m.user_id=u.id where m.user_id is null) then raise exception 'Missing member identity';end if;
 if exists(select 1 from agroverix_private.member_registry where member_code<>'AV-'||lpad(member_number::text,greatest(6,length(member_number::text)),'0')) then raise exception 'Invalid member code';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='agroverix_private' and c.relname in ('member_registry','member_counter') and (not c.relrowsecurity or not c.relforcerowsecurity)) then raise exception 'Private registry needs forced RLS';end if;
 if has_table_privilege('anon','agroverix_private.member_registry','SELECT') or has_table_privilege('authenticated','agroverix_private.member_registry','SELECT') then raise exception 'Members must not see registry';end if;
 if has_function_privilege('anon','public.agroverix_notification_claim(text,integer)','EXECUTE') or has_function_privilege('authenticated','public.agroverix_notification_claim(text,integer)','EXECUTE') then raise exception 'Queue exposed';end if;
 if has_function_privilege('anon','agroverix_private.assign_member(uuid,timestamptz)','EXECUTE') or has_function_privilege('authenticated','agroverix_private.assign_member(uuid,timestamptz)','EXECUTE') then raise exception 'Member assignment exposed';end if;
 if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='agroverix_admin_activity_notice' and (tgtype&16)=16) then raise exception 'Login updates still trigger notifications';end if;
 if exists(select 1 from agroverix_private.admin_notification_outbox where event_kind='login' and state in ('pending','processing')) then raise exception 'Old login notifications still pending';end if;

 select user_id,member_code into owner_id,code from agroverix_private.member_registry where user_id is not null order by member_number limit 1;
 select last_number into original_number from agroverix_private.member_counter where singleton;
 perform agroverix_private.assign_member(owner_id,now());
 if (select last_number from agroverix_private.member_counter where singleton)<>original_number or (select member_code from agroverix_private.member_registry where user_id=owner_id)<>code then raise exception 'Existing member was renumbered';end if;
 -- Synthetic tombstone identities test the locked counter and are rolled back.
 perform agroverix_private.assign_member(null,now());
 perform agroverix_private.assign_member(null,now());
 if (select last_number from agroverix_private.member_counter where singleton)<>original_number+2 then raise exception 'Counter allocation failed';end if;
 if not exists(select 1 from agroverix_private.member_registry where member_number=original_number+1 and user_id is null) or not exists(select 1 from agroverix_private.member_registry where member_number=original_number+2 and user_id is null) then raise exception 'Sequential identities missing';end if;
 begin
  insert into agroverix_private.member_registry(member_number,registered_at) values(original_number+1,now());
  raise exception 'Duplicate code accepted';
 exception when unique_violation then null;
 end;

 select worker_key into worker from agroverix_private.notification_settings where singleton;
 insert into agroverix_private.admin_notification_outbox(id,source_key,event_kind,occurred_at)
 values(login_id,'rollback-login:'||login_id,'login','1900-01-01');
 insert into agroverix_private.admin_notification_outbox(id,source_key,event_kind,occurred_at,signup_profile,signup_member)
 values(signup_id,'rollback-signup:'||signup_id,'signup','1900-01-01',
  '{"full_name":"Örnek Test Üyesi","province":"Şanlıurfa","district":"Haliliye"}',
  '{"member_number":999999,"member_code":"AV-999999","member_count":999999}');
 payload:=public.agroverix_notification_claim(worker,10);
 if exists(select 1 from jsonb_array_elements(payload) v where v->>'kind'='login') then raise exception 'Login event claimed';end if;
 select v into event from jsonb_array_elements(payload) v where v->>'id'=signup_id::text;
 if event is null or event#>>'{membership,member_code}'<>'AV-999999' then raise exception 'Signup identity missing';end if;
 lease:=(event->>'lease_id')::uuid;
 if public.agroverix_notification_finish(worker,signup_id,gen_random_uuid(),true) then raise exception 'Wrong lease accepted';end if;
 update agroverix_private.admin_notification_outbox set leased_at=now()-interval '11 minutes' where id=signup_id;
 payload:=public.agroverix_notification_claim(worker,10);
 select v into event from jsonb_array_elements(payload) v where v->>'id'=signup_id::text;
 if event#>>'{membership,member_count}'<>'999999' then raise exception 'Retry payload changed';end if;
 lease:=(event->>'lease_id')::uuid;
 if not public.agroverix_notification_finish(worker,signup_id,lease,true) then raise exception 'Queue acknowledgement failed';end if;
 payload:=public.agroverix_notification_claim(worker,10);
 if exists(select 1 from jsonb_array_elements(payload) v where v->>'id'=signup_id::text) then raise exception 'Signup repeated';end if;
 if (select count(*) from auth.users)<>base_count then raise exception 'Auth accounts changed';end if;
end $test$;

set local role authenticated;
do $private$
begin
 begin perform public.agroverix_admin_notification_status();raise exception 'Non-admin accessed member count';exception when insufficient_privilege then null;end;
 begin perform public.agroverix_admin_report_rows('accounts',0,1);raise exception 'Non-admin accessed codes';exception when insufficient_privilege then null;end;
 begin perform member_code from agroverix_private.member_registry;raise exception 'Private codes exposed';exception when insufficient_privilege then null;end;
end $private$;
reset role;
rollback;
select 'Üye kodları, gizlilik ve yalnızca yeni üyelik bildirimi kontrolleri geçti. Test kayıtları geri alındı.' as sonuc;
