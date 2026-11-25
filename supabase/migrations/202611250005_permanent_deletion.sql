begin;

-- Auth Admin API deletion cascades atomically to the student's application data.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
 foreign key (id) references auth.users(id) on delete cascade;
create function public.guard_profile_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.role <> 'student' or old.active then
  raise exception 'Only inactive students may be deleted' using errcode='23514';
 end if;
 return old;
end;$$;
create trigger profiles_delete_guard before delete on public.profiles
 for each row execute function public.guard_profile_deletion();
revoke all on function public.guard_profile_deletion() from public,anon,authenticated,service_role;
-- No new direct profile DELETE grant. Only the server's Auth Admin API deletes users.

-- Durable cleanup records survive a Storage failure after the content transaction.
create table public.file_deletion_queue (
 bucket text not null check(bucket in ('module-covers','lesson-attachments')),
 path text not null,
 primary key(bucket,path)
);
alter table public.file_deletion_queue enable row level security;
revoke all on public.file_deletion_queue from public,anon,authenticated,service_role;
grant select,delete on public.file_deletion_queue to authenticated;
create policy file_cleanup_read on public.file_deletion_queue for select to authenticated using(public.is_super_admin());
create policy file_cleanup_delete on public.file_deletion_queue for delete to authenticated using(public.is_super_admin());

create function public.admin_delete_archived_module(target uuid,confirmation text) returns void
language plpgsql security definer set search_path='' as $$
declare item public.modules;
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 select * into item from public.modules where id=target for update;
 if not found or item.archived_at is null or confirmation is distinct from item.title then
  raise exception 'Archived module and matching title required' using errcode='23514';
 end if;
 -- Block concurrent child writes during collection/deletion; no partial content deletion.
 lock table public.lessons,public.lesson_attachments in share row exclusive mode;
 insert into public.file_deletion_queue(bucket,path)
 select 'lesson-attachments',a.storage_path from public.lesson_attachments a
 join public.lessons l on l.id=a.lesson_id where l.module_id=target
 on conflict do nothing;
 if item.cover_path is not null then
  insert into public.file_deletion_queue values('module-covers',item.cover_path) on conflict do nothing;
 end if;
 delete from public.lesson_attachments where lesson_id in (select id from public.lessons where module_id=target);
 delete from public.lessons where module_id=target;
 delete from public.modules where id=target;
end;$$;
revoke all on function public.admin_delete_archived_module(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_delete_archived_module(uuid,text) to authenticated;
commit;
