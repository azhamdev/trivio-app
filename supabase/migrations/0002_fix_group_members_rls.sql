-- Fix: creating a trip failed with "new row violates row-level security policy
-- for table group_members" (42501).
--
-- The old group_members INSERT policy checked group ownership with an inline
-- subquery on `groups`, but that subquery is itself filtered by the groups
-- SELECT policy (member-only). At create time the creator isn't a member yet
-- (that's the row being inserted), so the group was invisible to the check and
-- the insert was rejected. A SECURITY DEFINER helper bypasses that filter — the
-- same pattern already used by is_group_member / is_group_open.
--
-- Idempotent: safe to run once on a database created from 0001_init.sql.

create or replace function public.is_group_creator(gid text, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g where g.id = gid and g.created_by = uid
  );
$$;

drop policy if exists "group_members_insert_creator_self" on public.group_members;
create policy "group_members_insert_creator_self" on public.group_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_group_creator(group_id, auth.uid())
  );

-- Clean up the orphan groups left by the failed create attempts (the group row
-- inserted, but its membership row didn't). They're invisible in-app anyway
-- since they have no members.
delete from public.groups g
where not exists (
  select 1 from public.group_members m where m.group_id = g.id
);
