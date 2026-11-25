begin;
-- Additive: preserves publication, assignments, lessons and completion history.
alter table public.modules add column archived_at timestamptz;
create or replace function public.can_read_module(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_active_user() and exists(select 1 from public.modules m where m.id=target and
 (public.is_super_admin() or (m.archived_at is null and m.status='published' and exists(select 1 from public.module_access a where a.module_id=m.id and a.student_id=auth.uid()))));
$$;
create or replace function public.admin_reorder(kind text,parent uuid,ordered_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare actual uuid[];
begin
 if not public.is_super_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 if kind='modules' and parent is null then
  lock table public.modules in share row exclusive mode;
  select coalesce(array_agg(id order by id),'{}') into actual from public.modules where archived_at is null;
 elsif kind='lessons' and parent is not null then
  lock table public.lessons in share row exclusive mode;
  select coalesce(array_agg(id order by id),'{}') into actual from public.lessons where module_id=parent;
 else raise exception 'Invalid scope' using errcode='23514';end if;
 if ordered_ids is null or actual is distinct from (select coalesce(array_agg(x order by x),'{}') from unnest(ordered_ids) x) then raise exception 'List changed; refresh' using errcode='23514';end if;
 if kind='modules' then update public.modules m set sort_order=o.n-1 from unnest(ordered_ids) with ordinality o(id,n) where m.id=o.id and m.archived_at is null;
 else update public.lessons l set sort_order=o.n-1 from unnest(ordered_ids) with ordinality o(id,n) where l.id=o.id and l.module_id=parent;end if;
end;$$;

-- CREATE OR REPLACE preserves ACLs; state them explicitly for review.
revoke all on function public.can_read_module(uuid),public.admin_reorder(text,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.can_read_module(uuid),public.admin_reorder(text,uuid,uuid[]) to authenticated;
commit;
