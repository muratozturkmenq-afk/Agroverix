begin;
-- Same existing admin role; ordinary members retain owner-only table access.
create or replace function public.agroverix_admin_report_rows(p_dataset text,p_offset integer default 0,p_limit integer default 500,p_user_id uuid default null)
returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_agroverix_admin() then raise exception 'Yönetici erişimi gerekli' using errcode='42501';end if;
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'Geçersiz sayfalama';end if;
 if p_dataset not in ('accounts','profiles','farms','seasons','operations','harvest_sales','harvest_receipts','inventory_items','inventory_purchases','inventory_payments') then raise exception 'Geçersiz rapor';end if;
 if p_offset=0 then insert into agroverix_private.report_access_log(admin_id,dataset,selected_user_id) values(auth.uid(),p_dataset,p_user_id);end if;
 if p_dataset='accounts' then
  return query select jsonb_build_object('user_id',u.id,'member_code',m.member_code,'member_number',m.member_number,'email',u.email,'currency',coalesce(cs.currency,'TRY'),'phone',coalesce(p.phone,u.phone),'full_name',p.full_name,'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'phone_confirmed',u.phone_confirmed_at is not null and p.phone is not distinct from u.phone,'sms_consent',coalesce(p.sms_consent,false),'sms_consent_at',p.sms_consent_at)
  from auth.users u left join public.farmer_account_settings cs on cs.user_id=u.id left join public.farmer_profiles p on p.user_id=u.id left join agroverix_private.member_registry m on m.user_id=u.id where p_user_id is null or u.id=p_user_id order by m.member_number nulls last,u.id offset p_offset limit p_limit;
 elsif p_dataset='profiles' then return query select to_jsonb(p) from public.farmer_profiles p where p_user_id is null or p.user_id=p_user_id order by p.user_id offset p_offset limit p_limit;
 elsif p_dataset='inventory_items' then return query select to_jsonb(i) from public.farmer_inventory_items i where p_user_id is null or i.user_id=p_user_id order by i.id offset p_offset limit p_limit;
 elsif p_dataset='inventory_purchases' then return query select to_jsonb(i) from public.farmer_inventory_purchases i where p_user_id is null or i.user_id=p_user_id order by i.id offset p_offset limit p_limit;
 elsif p_dataset='inventory_payments' then return query select to_jsonb(i) from public.farmer_inventory_payments i where p_user_id is null or i.user_id=p_user_id order by i.id offset p_offset limit p_limit;
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
