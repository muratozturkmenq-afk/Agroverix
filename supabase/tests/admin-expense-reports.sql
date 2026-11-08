-- Read-only verification of existing records; audit writes are rolled back.
begin;
do $test$
declare admin_id uuid; other_id uuid; dataset text; table_name text; expected bigint; actual bigint; page jsonb; row_data jsonb; offset_rows integer;
begin
 select a.user_id into admin_id from agroverix_private.admins a join auth.users u on u.id=a.user_id where a.active and u.email_confirmed_at is not null limit 1;
 if admin_id is null then raise exception 'No existing authorized administrator';end if;
 select u.id into other_id from auth.users u where u.id<>admin_id order by exists(select 1 from public.farmer_farms f where f.user_id=u.id) desc,u.created_at limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 if not public.is_agroverix_admin() then raise exception 'Administrator context failed';end if;
 for dataset,table_name in select * from (values ('accounts','users'),('profiles','farmer_profiles'),('farms','farmer_farms'),('seasons','farmer_seasons'),('operations','farmer_operations'),('harvest_sales','farmer_harvest_sales'),('harvest_receipts','farmer_harvest_receipts'),('inventory_items','farmer_inventory_items'),('inventory_purchases','farmer_inventory_purchases'),('inventory_payments','farmer_inventory_payments')) d(dataset,table_name)
 loop
  execute format('select count(*) from %I.%I',case when dataset='accounts' then 'auth' else 'public' end,table_name) into expected;
  actual:=0;offset_rows:=0;
  loop
   select coalesce(jsonb_agg(r),'[]') into page from public.agroverix_admin_report_rows(dataset,offset_rows,2,null) r;
   actual:=actual+jsonb_array_length(page);
   exit when jsonb_array_length(page)<2;
   offset_rows:=offset_rows+2;
  end loop;
  if actual<>expected then raise exception 'All-member count mismatch for %: % / %',dataset,actual,expected;end if;
  if other_id is not null then
   execute format('select count(*) from %I.%I where %I=$1',case when dataset='accounts' then 'auth' else 'public' end,table_name,case when dataset='accounts' then 'id' else 'user_id' end) into expected using other_id;
   select count(*) into actual from public.agroverix_admin_report_rows(dataset,0,500,other_id);
   if actual<>expected then raise exception 'Selected-member count mismatch for %',dataset;end if;
   for row_data in select * from public.agroverix_admin_report_rows(dataset,0,500,other_id) loop
    if row_data->>'user_id'<>other_id::text then raise exception 'Selected member mixed with another owner';end if;
   end loop;
  end if;
 end loop;
 if other_id is null then raise exception 'An existing regular member is needed for privacy checks';end if;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 if public.is_agroverix_admin() then raise exception 'Privacy test requires a regular member';end if;
end $test$;
set local role authenticated;
do $private$
begin
 if exists(select 1 from public.farmer_inventory_items where user_id<>auth.uid()) or exists(select 1 from public.farmer_inventory_purchases where user_id<>auth.uid()) or exists(select 1 from public.farmer_inventory_payments where user_id<>auth.uid()) then raise exception 'Another owner data is visible';end if;
 begin perform public.agroverix_admin_report_rows('inventory_items',0,10);raise exception 'Non-admin read inventory';exception when insufficient_privilege then null;end;
 begin perform public.agroverix_admin_report_rows('inventory_purchases',0,10);raise exception 'Non-admin read purchases';exception when insufficient_privilege then null;end;
 begin perform public.agroverix_admin_report_rows('inventory_payments',0,10);raise exception 'Non-admin read payments';exception when insufficient_privilege then null;end;
end $private$;
reset role;
rollback;
select 'Tüm üyelerin kayıtları, masrafları, ödemeleri ve kullanıcı gizliliği kontrolleri geçti.' as sonuc;
