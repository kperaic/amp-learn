begin;

-- Delete a single draft or published lesson without archiving its module.
create function public.admin_delete_lesson(target uuid,confirmation text) returns void
language plpgsql security definer set search_path='' as $$
declare item public.lessons;
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 -- Serialize child writes so every attachment is queued before metadata is removed.
 lock table public.lessons,public.lesson_attachments in share row exclusive mode;
 select * into item from public.lessons where id=target for update;
 if not found or confirmation is distinct from item.title then
  raise exception 'Lesson and matching title required' using errcode='23514';
 end if;
 insert into public.file_deletion_queue(bucket,path)
 select 'lesson-attachments',storage_path from public.lesson_attachments where lesson_id=target
 on conflict do nothing;
 delete from public.lesson_attachments where lesson_id=target;
 -- Existing FK cascades remove progress for this lesson only.
 delete from public.lessons where id=target;
end;$$;
revoke all on function public.admin_delete_lesson(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_delete_lesson(uuid,text) to authenticated;
commit;
