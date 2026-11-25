begin;
-- Preserve all existing rows and any lower administrator-configured bucket limit.
update storage.buckets set file_size_limit=least(coalesce(file_size_limit,50000000),50000000) where id='lesson-attachments';
revoke delete on public.modules,public.lessons from authenticated;
-- INSERT ... RETURNING must see the new row without a STABLE helper querying
-- the pre-insert table snapshot. Student read conditions remain unchanged.
alter policy modules_read on public.modules using(public.is_super_admin() or public.can_read_module(id));
alter policy lessons_read on public.lessons using(public.is_super_admin() or public.can_read_lesson(id));

create function public.admin_reorder(kind text,parent uuid,ordered_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare actual uuid[];
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 if kind='modules' and parent is null then
  lock table public.modules in share row exclusive mode;
  select coalesce(array_agg(id order by id),'{}') into actual from public.modules;
 elsif kind='lessons' and parent is not null then
  lock table public.lessons in share row exclusive mode;
  select coalesce(array_agg(id order by id),'{}') into actual from public.lessons where module_id=parent;
 else raise exception 'Invalid scope' using errcode='23514';end if;
 if ordered_ids is null or actual is distinct from (select coalesce(array_agg(x order by x),'{}') from unnest(ordered_ids) x) then raise exception 'List changed; refresh' using errcode='23514';end if;
 if kind='modules' then update public.modules m set sort_order=o.n-1 from unnest(ordered_ids) with ordinality o(id,n) where m.id=o.id;
 else update public.lessons l set sort_order=o.n-1 from unnest(ordered_ids) with ordinality o(id,n) where l.id=o.id and l.module_id=parent;end if;
end;$$;
create function public.admin_set_access(target uuid,selected uuid[],additive boolean default false) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 perform 1 from public.profiles where id=target and role='student' for update;
 if not found or selected is null or exists(select 1 from unnest(selected) x where x is null or not exists(select 1 from public.modules where id=x)) then raise exception 'Invalid selection' using errcode='23514';end if;
 if not additive then delete from public.module_access where student_id=target and not(module_id=any(selected));end if;
 insert into public.module_access(student_id,module_id,granted_by) select target,x,auth.uid() from (select distinct unnest(selected) x) s on conflict do nothing;
end;$$;
create function public.admin_student_directory() returns table(id uuid,first_name text,last_name text,language text,active boolean,email text,invited_at timestamptz,confirmed_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 return query select p.id,p.first_name,p.last_name,p.language,p.active,u.email::text,u.invited_at,u.email_confirmed_at from public.profiles p join auth.users u on u.id=p.id where p.role='student' order by p.last_name,p.first_name;
end;$$;
create function public.admin_find_account(target_email text) returns table(id uuid,role text,invited boolean,confirmed boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 return query select u.id,p.role,u.invited_at is not null,u.email_confirmed_at is not null from auth.users u left join public.profiles p on p.id=u.id where lower(u.email)=lower(trim(target_email));
end;$$;
create function public.admin_provision_student(target uuid,given_name text,family_name text,target_language text,selected uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 perform public.provision_student(target,given_name,family_name,target_language);
 perform public.admin_set_access(target,selected,true);
end;$$;
create function public.admin_upload_limit(bucket text) returns bigint language plpgsql stable security definer set search_path='' as $$
declare lim bigint;
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 if bucket not in ('lesson-attachments','module-covers') then raise exception 'Invalid bucket';end if;
 select least(coalesce(file_size_limit,50000000),case when bucket='module-covers' then 10485760 else 50000000 end) into lim from storage.buckets where id=bucket;
 return lim;
end;$$;
create function public.admin_finish_attachment(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.lesson_attachments; meta jsonb;
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 select * into a from public.lesson_attachments where id=target for update;
 if not found then raise exception 'Attachment missing';end if;
 select metadata into meta from storage.objects where bucket_id='lesson-attachments' and name=a.storage_path;
 if meta is null or (meta->>'size')::bigint is distinct from a.file_size_bytes or lower(split_part(coalesce(meta->>'mimetype',''),';',1))<>a.mime_type or a.file_size_bytes>public.admin_upload_limit('lesson-attachments') then raise exception 'Upload metadata mismatch' using errcode='23514';end if;
 update public.lesson_attachments set ready=true where id=target;
end;$$;
create function public.admin_set_cover(target uuid,object_path text) returns void language plpgsql security definer set search_path='' as $$
declare meta jsonb;
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 if split_part(object_path,'/',1)<>target::text then raise exception 'Invalid path';end if;
 select metadata into meta from storage.objects where bucket_id='module-covers' and name=object_path;
 if meta is null or coalesce((meta->>'size')::bigint,0)<=0 or (meta->>'size')::bigint>public.admin_upload_limit('module-covers') or coalesce(meta->>'mimetype','') not in ('image/jpeg','image/png','image/webp') then raise exception 'Invalid image';end if;
 update public.modules set cover_path=object_path where id=target;
 if not found then raise exception 'Module missing';end if;
end;$$;
-- Enforce the new limit on new uploads without invalidating pre-existing larger files.
create function public.check_attachment_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.file_size_bytes>least(50000000,coalesce((select file_size_limit from storage.buckets where id='lesson-attachments'),50000000)) then raise exception 'Attachment exceeds upload limit' using errcode='23514';end if;return new;
end;$$;
create trigger attachment_limit before insert on public.lesson_attachments for each row execute function public.check_attachment_limit();
revoke all on function public.admin_reorder(text,uuid,uuid[]),public.admin_set_access(uuid,uuid[],boolean),public.admin_student_directory(),public.admin_find_account(text),public.admin_provision_student(uuid,text,text,text,uuid[]),public.admin_upload_limit(text),public.admin_finish_attachment(uuid),public.admin_set_cover(uuid,text),public.check_attachment_limit() from public,anon,authenticated,service_role;
grant execute on function public.admin_reorder(text,uuid,uuid[]),public.admin_set_access(uuid,uuid[],boolean),public.admin_student_directory(),public.admin_find_account(text),public.admin_provision_student(uuid,text,text,text,uuid[]),public.admin_upload_limit(text),public.admin_finish_attachment(uuid),public.admin_set_cover(uuid,text) to authenticated;
commit;
