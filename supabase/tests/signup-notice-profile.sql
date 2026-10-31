begin;
do $test$
declare k text; batch jsonb; ready_id uuid:=gen_random_uuid(); missing_id uuid:=gen_random_uuid(); login_id uuid:=gen_random_uuid();
 nonce text:=gen_random_uuid()::text; profile jsonb; row jsonb; lease uuid;
begin
 profile:=agroverix_private.notice_profile('Örnek Test Üyesi','63','842','TR');
 if profile is distinct from '{"full_name":"Örnek Test Üyesi","province":"Şanlıurfa","district":"Haliliye"}'::jsonb then raise exception 'Address labels failed';end if;
 if agroverix_private.notice_profile('','63','842','TR') is not null or agroverix_private.notice_profile('Örnek','6','842','TR') is not null then raise exception 'Incomplete or mismatched address accepted';end if;
 if agroverix_private.notice_profile('Örnek','Bölge','Şehir','DE')->>'district'<>'Şehir' then raise exception 'Free-text address failed';end if;
 if agroverix_private.notice_profile(E'  Örnek\n Test  ','63','842','TR')->>'full_name'<>'Örnek Test' then raise exception 'Display sanitization failed';end if;
 if has_function_privilege('authenticated','public.agroverix_notification_claim(text,integer)','execute') or has_function_privilege('anon','public.agroverix_notification_claim(text,integer)','execute') then raise exception 'Claim access broadened';end if;
 if has_function_privilege('authenticated','agroverix_private.notice_profile(text,text,text,text)','execute') or has_table_privilege('authenticated','agroverix_private.admin_notification_outbox','select') then raise exception 'Private information readable';end if;
 select worker_key into k from agroverix_private.notification_settings where singleton;
 insert into agroverix_private.admin_notification_outbox(id,source_key,event_kind,occurred_at,signup_profile) values
 (ready_id,'profile-test-ready:'||nonce,'signup','1900-01-01',profile),
 (missing_id,'profile-test-missing:'||nonce,'signup','1900-01-01',null),
 (login_id,'profile-test-login:'||nonce,'login','1900-01-01',profile);
 batch:=public.agroverix_notification_claim(k,10);
 select value into row from jsonb_array_elements(batch) where value->>'id'=ready_id::text;
 if row is null or row->'profile' is distinct from profile then raise exception 'Ready signup snapshot missing';end if;
 lease:=(row->>'lease_id')::uuid;
 if exists(select 1 from jsonb_array_elements(batch) where value->>'id'=missing_id::text) then raise exception 'Incomplete signup claimed';end if;
 select value into row from jsonb_array_elements(batch) where value->>'id'=login_id::text;
 if row is null or row ? 'profile' then raise exception 'Login repeated member information';end if;
 if (select attempts from agroverix_private.admin_notification_outbox where id=missing_id)<>0 then raise exception 'Missing profile consumed attempts';end if;
 if public.agroverix_notification_finish(k,ready_id,gen_random_uuid(),true) then raise exception 'Wrong lease accepted';end if;
 if not public.agroverix_notification_finish(k,ready_id,lease,true) then raise exception 'Correct lease failed';end if;
 if public.agroverix_notification_finish(k,ready_id,lease,true) then raise exception 'Repeated acknowledgement accepted';end if;
 batch:=public.agroverix_notification_claim(k,10);
 if exists(select 1 from jsonb_array_elements(batch) where value->>'id'=ready_id::text) then raise exception 'Signup repeated';end if;
 insert into agroverix_private.admin_notification_outbox(source_key,event_kind) values('profile-test-ready:'||nonce,'signup') on conflict(source_key) do nothing;
 if (select count(*) from agroverix_private.admin_notification_outbox where source_key='profile-test-ready:'||nonce)<>1 then raise exception 'Source dedup failed';end if;
end $test$;
rollback;
select 'Başarılı: il/ilçe adları, eksik profil bekleme, yalnızca ilk üyelikte bilgiler, tekrar koruması ve erişim kontrolleri. Test kayıtları geri alındı.' as kontrol;
