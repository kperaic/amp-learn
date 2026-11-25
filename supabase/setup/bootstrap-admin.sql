-- MANUAL ONLY: confirm the SQL editor belongs to project ozcjishpcyhoghqgpgau.
-- First create your Auth user in Authentication > Users using your own password.
-- Replace these three placeholders; never place a password in this file.
begin;
do $$
declare admin_id uuid := '00000000-0000-0000-0000-000000000000';
 given_name text := 'REPLACE_FIRST_NAME'; family_name text := 'REPLACE_LAST_NAME';
begin
 if admin_id='00000000-0000-0000-0000-000000000000' or given_name='REPLACE_FIRST_NAME' or family_name='REPLACE_LAST_NAME' then raise exception 'Replace bootstrap placeholders first';end if;
 if not exists(select 1 from auth.users where id=admin_id) then raise exception 'Create the Auth user first';end if;
 if exists(select 1 from public.profiles where role='super_admin') then raise exception 'Initial administrator already exists';end if;
 insert into public.profiles(id,first_name,last_name,role,language,active) values(admin_id,given_name,family_name,'super_admin','hr',true);
end;$$;
commit;
