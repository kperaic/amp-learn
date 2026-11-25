begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('lesson-attachments','lesson-attachments',false,1073741824,array['application/pdf','video/mp4','text/plain','application/zip','application/x-zip-compressed','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','image/webp']),
('module-covers','module-covers',false,10485760,array['image/jpeg','image/png','image/webp']);
-- Students have no direct object SELECT/signing capability. Phase 3 download
-- issuance must authorize through user-session RLS before privileged signing.
create policy learn_storage_admin_read on storage.objects for select to authenticated using(bucket_id in ('lesson-attachments','module-covers') and public.is_super_admin());
create policy learn_attachment_upload on storage.objects for insert to authenticated with check(bucket_id='lesson-attachments' and public.is_super_admin() and exists(select 1 from public.lesson_attachments a where a.storage_path=name and not a.ready and a.uploaded_by=auth.uid()));
create policy learn_cover_upload on storage.objects for insert to authenticated with check(bucket_id='module-covers' and public.is_super_admin() and exists(select 1 from public.modules m where m.id::text=split_part(name,'/',1)));
create policy learn_storage_remove on storage.objects for delete to authenticated using(bucket_id in ('lesson-attachments','module-covers') and public.is_super_admin());
-- No overwrite policy; replacement uses a new object path.
commit;
