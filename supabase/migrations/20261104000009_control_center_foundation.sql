-- AdFlo Control Center, step 1: staff accounts, the client directory and the staff audit log.
-- Staff are Aurum Ventura's own people. They are never workspace members, and clients can never see these tables.
-- To create the first Owner, run once as the database owner (SQL editor / service role):
--   insert into public.staff_members (user_id, role, display_name, email)
--   select id, 'owner', 'Your Name', email from auth.users where email = 'you@example.com';

create table public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'support', 'billing')),
  display_name text not null default '' check (char_length(display_name) <= 80),
  email text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Helpers. SECURITY DEFINER so policies can read staff_members without recursing into its own policy.
create or replace function public.staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select s.role from public.staff_members s where s.user_id = (select auth.uid()) and s.active
$$;

create or replace function public.is_staff(min_role text default 'billing')
returns boolean language sql stable security definer set search_path = '' as $$
  -- owner may do everything; support may do support work; billing is read-only for now.
  select case public.staff_role()
    when 'owner' then true
    when 'support' then min_role in ('support', 'billing')
    when 'billing' then min_role = 'billing'
    else false
  end
$$;
revoke all on function public.staff_role(), public.is_staff(text) from public, anon;
grant execute on function public.staff_role(), public.is_staff(text) to authenticated, service_role;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended', 'cancelled')),
  plan text not null default 'standard' check (char_length(plan) between 1 and 40),
  seats_limit integer not null default 3 check (seats_limit between 0 and 10000),
  owner_name text not null default '' check (char_length(owner_name) <= 120),
  owner_email text not null default '' check (char_length(owner_email) <= 254),
  notes text not null default '' check (char_length(notes) <= 4000),
  -- The client's workspace once it exists. One client, one workspace.
  workspace_id uuid unique references public.workspaces (id) on delete set null,
  started_on date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_status_idx on public.clients (status);
create unique index clients_name_idx on public.clients (lower(name));

create table public.staff_audit_log (
  id bigint generated always as identity primary key,
  staff_user_id uuid references auth.users (id) on delete set null,
  staff_email text not null default '',
  action text not null,
  entity text not null,
  entity_id text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index staff_audit_log_created_idx on public.staff_audit_log (created_at desc);

-- Every change to a client is logged by the database itself, so no code path can skip it.
create or replace function public.clients_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  who text := coalesce((select s.email from public.staff_members s where s.user_id = (select auth.uid())), '');
  d jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    d := jsonb_build_object('name', new.name, 'status', new.status, 'plan', new.plan, 'seats_limit', new.seats_limit);
    insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
    values ((select auth.uid()), who, 'client.created', 'client', new.id::text, d);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then d := d || jsonb_build_object('status', jsonb_build_array(old.status, new.status)); end if;
    if new.plan is distinct from old.plan then d := d || jsonb_build_object('plan', jsonb_build_array(old.plan, new.plan)); end if;
    if new.seats_limit is distinct from old.seats_limit then d := d || jsonb_build_object('seats_limit', jsonb_build_array(old.seats_limit, new.seats_limit)); end if;
    if new.name is distinct from old.name then d := d || jsonb_build_object('name', jsonb_build_array(old.name, new.name)); end if;
    if new.owner_email is distinct from old.owner_email then d := d || jsonb_build_object('owner_email', jsonb_build_array(old.owner_email, new.owner_email)); end if;
    if new.notes is distinct from old.notes then d := d || jsonb_build_object('notes', 'edited'); end if;
    new.updated_at := now();
    if d <> '{}'::jsonb then
      insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
      values ((select auth.uid()), who, case when new.status is distinct from old.status then 'client.status_changed' else 'client.updated' end, 'client', new.id::text, d);
    end if;
    return new;
  else
    insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
    values ((select auth.uid()), who, 'client.deleted', 'client', old.id::text, jsonb_build_object('name', old.name));
    return old;
  end if;
end $$;
revoke all on function public.clients_audit() from public, anon, authenticated;

create trigger clients_audit_ins after insert on public.clients for each row execute function public.clients_audit();
create trigger clients_audit_upd before update on public.clients for each row execute function public.clients_audit();
create trigger clients_audit_del after delete on public.clients for each row execute function public.clients_audit();

alter table public.staff_members enable row level security;
alter table public.clients enable row level security;
alter table public.staff_audit_log enable row level security;

revoke all on public.staff_members, public.clients, public.staff_audit_log from anon, authenticated;
grant select on public.staff_members to authenticated;
grant select, insert, update on public.clients to authenticated;
grant select on public.staff_audit_log to authenticated;

-- Staff see their own row; the owner sees everyone. Only the owner changes who is staff (step 2 adds the screen).
create policy staff_self_read on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff('owner'));
-- Clients: any staff can read; owner and support can create and edit. Nobody deletes (cancel instead).
create policy clients_read on public.clients for select to authenticated using (public.is_staff('billing'));
create policy clients_insert on public.clients for insert to authenticated with check (public.is_staff('support'));
create policy clients_update on public.clients for update to authenticated
  using (public.is_staff('support')) with check (public.is_staff('support'));
-- The log is read-only to staff (owner only); rows are written by the trigger above.
create policy audit_owner_read on public.staff_audit_log for select to authenticated using (public.is_staff('owner'));
