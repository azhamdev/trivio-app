-- Trivio Phase 4 — initial Supabase schema.
--
-- Covers both the original trip/expense model and Phase 2's personal budgets.
-- Design notes:
--   * All date/time fields are bigint epoch-milliseconds, not timestamptz.
--     The app models every date as a local start-of-day epoch-ms number
--     (see src/utils/dates.ts), so bigint round-trips losslessly with no
--     timezone reinterpretation. `days` is NOT stored — it's derived client
--     side via daysBetweenInclusive.
--   * Entity ids (groups/expenses/budgets/members) are text, generated client
--     side by uid() so optimistic UI can insert a row it already knows the id
--     of. profiles.id is the uuid from Supabase Auth.
--   * "ended" is date-derived, never swept by a client timer: a trip is closed
--     when closed_at is set OR its end_date has passed (enforced client-side by
--     isTripClosed and server-side by is_group_open below).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.now_ms()
returns bigint
language sql
stable
as $$ select (extract(epoch from now()) * 1000)::bigint $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Replaces the old User type. No password column — Supabase Auth owns
-- credentials; this table only holds the display profile.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  email      text,
  created_at bigint not null default public.now_ms()
);

create table if not exists public.groups (
  id            text primary key,
  name          text not null,
  destination   text not null,
  start_date    bigint not null,
  end_date      bigint not null,
  budget        bigint not null default 0,
  currency      text not null default 'IDR',
  code          text not null unique,
  cover_url     text,
  created_by    uuid not null references public.profiles (id) on delete cascade,
  closed_at     bigint,
  closed_reason text check (closed_reason in ('manual', 'ended')),
  created_at    bigint not null default public.now_ms()
);

-- Normalizes Group.members[]. Member display names come from joining profiles.
create table if not exists public.group_members (
  id         text primary key default gen_random_uuid()::text,
  group_id   text not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at bigint not null default public.now_ms(),
  unique (group_id, user_id)
);

-- Normalizes Group.expenses[].
create table if not exists public.expenses (
  id          text primary key,
  group_id    text not null references public.groups (id) on delete cascade,
  title       text not null,
  amount      bigint not null,
  category_id text not null,
  paid_by     uuid references public.profiles (id) on delete set null,
  note        text,
  created_at  bigint not null default public.now_ms()
);

create table if not exists public.personal_budgets (
  id            text primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  amount        bigint not null,
  category_id   text,
  start_date    bigint not null,
  end_date      bigint not null,
  closed_at     bigint,
  closed_reason text check (closed_reason in ('manual', 'ended')),
  created_at    bigint not null default public.now_ms()
);

create table if not exists public.personal_expenses (
  id          text primary key,
  budget_id   text not null references public.personal_budgets (id) on delete cascade,
  title       text not null,
  amount      bigint not null,
  category_id text not null,
  note        text,
  created_at  bigint not null default public.now_ms()
);

create index if not exists group_members_user_idx on public.group_members (user_id);
create index if not exists group_members_group_idx on public.group_members (group_id);
create index if not exists expenses_group_idx on public.expenses (group_id);
create index if not exists personal_budgets_user_idx on public.personal_budgets (user_id);
create index if not exists personal_expenses_budget_idx on public.personal_expenses (budget_id);

-- ---------------------------------------------------------------------------
-- Membership / lifecycle helpers (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------

-- Called by RLS policies on groups/expenses/group_members. It runs as the
-- table owner and so bypasses RLS on group_members, which is what prevents the
-- classic "policy on group_members references group_members" infinite loop.
create or replace function public.is_group_member(gid text, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.user_id = uid
  );
$$;

-- A group accepts new/edited expenses only while it is open: not manually
-- closed and its end date hasn't passed. This moves the client-side
-- isTripClosed guard into an actual security boundary. Note: end_date is a
-- local start-of-day from the creating client, compared here against UTC start
-- of today, so the open/closed flip can differ by a few hours on the final
-- day — acceptable for v1.
create or replace function public.is_group_open(gid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid
      and g.closed_at is null
      and g.end_date >= (extract(epoch from date_trunc('day', now())) * 1000)::bigint
  );
$$;

-- Whether `uid` created group `gid`. SECURITY DEFINER so it bypasses the groups
-- SELECT policy: the creator's very first group_members insert happens before
-- they are a member, so an RLS-filtered check couldn't see the group yet
-- (chicken-and-egg). This lets the creator seed their own membership row.
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

-- ---------------------------------------------------------------------------
-- Auth → profile bridge
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, created_at)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    public.now_ms()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Join-by-code RPC
-- ---------------------------------------------------------------------------
-- Clients never insert into group_members for a join directly (they can't see
-- arbitrary group ids anyway). They call this, which looks the group up by
-- code and adds the caller. Raises coded errors the client maps to messages.
create or replace function public.join_group_by_code(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  select * into g from public.groups where code = upper(trim(p_code));
  if g.id is null then
    raise exception 'NO_GROUP';
  end if;
  if exists (select 1 from public.group_members where group_id = g.id and user_id = auth.uid()) then
    raise exception 'ALREADY_MEMBER';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.expenses          enable row level security;
alter table public.personal_budgets  enable row level security;
alter table public.personal_expenses enable row level security;

-- profiles: any authenticated user can read any profile (group co-members need
-- each other's display names); you may only write your own row.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- groups: visible to members; creatable by yourself; editable (close/reopen) by
-- any member — matching the app, where close/reopen isn't creator-gated.
create policy "groups_select_member" on public.groups
  for select to authenticated using (public.is_group_member(id, auth.uid()));
create policy "groups_insert_creator" on public.groups
  for insert to authenticated with check (created_by = auth.uid());
create policy "groups_update_member" on public.groups
  for update to authenticated
  using (public.is_group_member(id, auth.uid()))
  with check (public.is_group_member(id, auth.uid()));

-- group_members: members can see the roster. The only direct insert allowed is
-- the creator adding themselves at creation time; everyone else joins through
-- join_group_by_code (SECURITY DEFINER, bypasses this policy).
create policy "group_members_select_member" on public.group_members
  for select to authenticated using (public.is_group_member(group_id, auth.uid()));
create policy "group_members_insert_creator_self" on public.group_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_group_creator(group_id, auth.uid())
  );

-- expenses: members read all; any member may add while the group is open; only
-- the group creator may edit/delete, and never on a closed group.
create policy "expenses_select_member" on public.expenses
  for select to authenticated using (public.is_group_member(group_id, auth.uid()));
create policy "expenses_insert_member_open" on public.expenses
  for insert to authenticated with check (
    public.is_group_member(group_id, auth.uid()) and public.is_group_open(group_id)
  );
create policy "expenses_update_creator_open" on public.expenses
  for update to authenticated
  using (
    public.is_group_open(group_id)
    and exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  )
  with check (
    public.is_group_open(group_id)
    and exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );
create policy "expenses_delete_creator_open" on public.expenses
  for delete to authenticated using (
    public.is_group_open(group_id)
    and exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );

-- personal budgets/expenses: strictly private to their owner.
create policy "personal_budgets_all_owner" on public.personal_budgets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "personal_expenses_all_owner" on public.personal_expenses
  for all to authenticated
  using (exists (select 1 from public.personal_budgets b where b.id = budget_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.personal_budgets b where b.id = budget_id and b.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime — let clients subscribe to changes on shared tables so co-members'
-- edits refetch live. RLS still governs which change events each client sees.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.personal_budgets;
alter publication supabase_realtime add table public.personal_expenses;
