begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 first_name text not null check(length(trim(first_name)) between 1 and 100),
 last_name text not null check(length(trim(last_name)) between 1 and 100),
 role text not null check(role in ('super_admin','student')),
 language text not null default 'hr' check(language in ('hr','en')),
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.modules (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 200),
 description text,cover_path text unique,sort_order integer not null default 0 check(sort_order>=0),
 status text not null default 'draft' check(status in ('draft','published')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.lessons (
 id uuid primary key default gen_random_uuid(),module_id uuid not null references public.modules(id) on delete restrict,
 title text not null check(length(trim(title)) between 1 and 200),
 content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb check(jsonb_typeof(content)='object' and coalesce(content->>'type','')='doc' and octet_length(content::text)<=500000),
 bunny_video_id uuid,sort_order integer not null default 0 check(sort_order>=0),
 status text not null default 'draft' check(status in ('draft','published')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.module_access (
 student_id uuid not null references public.profiles(id) on delete cascade,
 module_id uuid not null references public.modules(id) on delete cascade,
 granted_at timestamptz not null default now(),granted_by uuid not null references public.profiles(id) on delete restrict,
 primary key(student_id,module_id)
);
create table public.lesson_attachments (
 id uuid primary key default gen_random_uuid(),lesson_id uuid not null references public.lessons(id) on delete restrict,
 storage_path text not null unique check(storage_path<>'' and storage_path !~ '(^/|\.\.)'),
 original_filename text not null check(length(trim(original_filename)) between 1 and 255),
 mime_type text not null check(mime_type in ('application/pdf','video/mp4','text/plain','application/zip','application/x-zip-compressed','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','image/webp')),
 file_size_bytes bigint not null check(file_size_bytes between 1 and 1073741824),
 sort_order integer not null default 0 check(sort_order>=0),ready boolean not null default false,
 uploaded_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.lesson_progress (
 student_id uuid not null references public.profiles(id) on delete cascade,
 lesson_id uuid not null references public.lessons(id) on delete cascade,
 completed_at timestamptz not null default now(),primary key(student_id,lesson_id)
);
create index profiles_role on public.profiles(role);
create index modules_order on public.modules(sort_order,id);
create index lessons_module_order on public.lessons(module_id,sort_order,id);
create index module_access_module on public.module_access(module_id);
create index attachments_lesson on public.lesson_attachments(lesson_id,sort_order);
create index progress_lesson on public.lesson_progress(lesson_id);

-- Definer helpers prevent recursive RLS. All object references are qualified.
create function public.is_active_user() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active
 and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=p.id));
$$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active_user() and exists(select 1 from public.profiles where id=auth.uid() and role='super_admin');
$$;
create function public.can_read_module(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_active_user() and exists(select 1 from public.modules m where m.id=target and
 (public.is_super_admin() or (m.status='published' and exists(select 1 from public.module_access a where a.module_id=m.id and a.student_id=auth.uid()))));
$$;
create function public.can_read_lesson(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lessons l where l.id=target and public.can_read_module(l.module_id) and (l.status='published' or public.is_super_admin()));
$$;
create function public.current_profile() returns setof public.profiles language sql stable security definer set search_path='' as $$
 select * from public.profiles where id=auth.uid() and public.is_active_user();
$$;
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end;$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger modules_updated before update on public.modules for each row execute function public.touch_updated_at();
create trigger lessons_updated before update on public.lessons for each row execute function public.touch_updated_at();
create trigger attachments_updated before update on public.lesson_attachments for each row execute function public.touch_updated_at();
create function public.validate_student_relation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=new.student_id and role='student') then raise exception 'Student required' using errcode='23514';end if;
 return new;
end;$$;
create trigger access_student before insert or update on public.module_access for each row execute function public.validate_student_relation();
create trigger progress_student before insert or update on public.lesson_progress for each row execute function public.validate_student_relation();

alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.module_access enable row level security;
alter table public.lesson_attachments enable row level security;
alter table public.lesson_progress enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.is_active_user() and (id=auth.uid() or public.is_super_admin()));
create policy profiles_self on public.profiles for update to authenticated using(id=auth.uid() and public.is_active_user()) with check(id=auth.uid() and public.is_active_user());
create policy modules_read on public.modules for select to authenticated using(public.can_read_module(id));
create policy modules_insert on public.modules for insert to authenticated with check(public.is_super_admin());
create policy modules_update on public.modules for update to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy modules_delete on public.modules for delete to authenticated using(public.is_super_admin());
create policy lessons_read on public.lessons for select to authenticated using(public.can_read_lesson(id));
create policy lessons_insert on public.lessons for insert to authenticated with check(public.is_super_admin());
create policy lessons_update on public.lessons for update to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy lessons_delete on public.lessons for delete to authenticated using(public.is_super_admin());
create policy access_admin on public.module_access for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin() and granted_by=auth.uid());
create policy attachments_read on public.lesson_attachments for select to authenticated using(public.is_super_admin() or (ready and public.can_read_lesson(lesson_id)));
create policy attachments_insert on public.lesson_attachments for insert to authenticated with check(public.is_super_admin() and uploaded_by=auth.uid());
create policy attachments_update on public.lesson_attachments for update to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy attachments_delete on public.lesson_attachments for delete to authenticated using(public.is_super_admin());
create policy progress_read on public.lesson_progress for select to authenticated using(public.is_super_admin() or (student_id=auth.uid() and public.can_read_lesson(lesson_id)));
create policy progress_insert on public.lesson_progress for insert to authenticated with check(student_id=auth.uid() and public.can_read_lesson(lesson_id));
create policy progress_delete on public.lesson_progress for delete to authenticated using(student_id=auth.uid() and public.can_read_lesson(lesson_id));

-- Role/active fields have no direct UPDATE grant, including for admins.
create function public.admin_update_student(target uuid,given_name text,family_name text,target_language text,target_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 update public.profiles set first_name=given_name,last_name=family_name,language=target_language,active=target_active where id=target and role='student';
 if not found then raise exception 'Student not found' using errcode='P0002';end if;
end;$$;
create function public.provision_student(target uuid,given_name text,family_name text,target_language text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 -- Explicit admin provisioning only; never trust Auth user_metadata for roles.
 insert into public.profiles(id,first_name,last_name,role,language) values(target,given_name,family_name,'student',target_language)
 on conflict(id) do nothing;
 if not exists(select 1 from public.profiles where id=target and role='student') then raise exception 'Invalid account' using errcode='23514';end if;
end;$$;
revoke all on public.profiles,public.modules,public.lessons,public.module_access,public.lesson_attachments,public.lesson_progress from public,anon,authenticated,service_role;
grant select on public.profiles to authenticated;
grant update(first_name,last_name,language) on public.profiles to authenticated;
grant select,insert,update,delete on public.modules,public.lessons,public.lesson_attachments to authenticated;
grant select,insert,delete on public.module_access,public.lesson_progress to authenticated;
revoke all on function public.is_active_user(),public.is_super_admin(),public.can_read_module(uuid),public.can_read_lesson(uuid),public.current_profile(),public.touch_updated_at(),public.validate_student_relation(),public.admin_update_student(uuid,text,text,text,boolean),public.provision_student(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.is_active_user(),public.is_super_admin(),public.can_read_module(uuid),public.can_read_lesson(uuid),public.current_profile(),public.admin_update_student(uuid,text,text,text,boolean),public.provision_student(uuid,text,text,text) to authenticated;
commit;
