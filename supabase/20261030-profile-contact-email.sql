begin;

-- Optional contact information; never used to identify or authorize an account.
alter table public.farmer_profiles add column if not exists contact_email text;
alter table public.farmer_profiles drop constraint if exists farmer_profile_contact_email_format;
alter table public.farmer_profiles add constraint farmer_profile_contact_email_format
 check (contact_email is null or (char_length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'));
comment on column public.farmer_profiles.contact_email is 'Optional farmer contact email. Login email is managed separately by Supabase Auth.';

-- Runs after the existing signup-profile trigger, including email-confirmation signups.
create or replace function public.agroverix_capture_signup_profile_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare email text:=nullif(lower(trim(new.raw_user_meta_data->'agroverix_profile'->>'contact_email')),'');
begin
 if email is not null and char_length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+$' then
  update public.farmer_profiles set contact_email=email where user_id=new.id;
 end if;
 return new;
end $$;
drop trigger if exists agroverix_capture_signup_profile_email on auth.users;
create trigger agroverix_capture_signup_profile_email after insert on auth.users
 for each row execute function public.agroverix_capture_signup_profile_email();
revoke all on function public.agroverix_capture_signup_profile_email() from public,anon,authenticated;

-- Existing row ownership policies, roles and login-email verification stay intact.
notify pgrst, 'reload schema';
commit;
