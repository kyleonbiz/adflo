-- More services saved to the workspace, and the activity trail.
--
-- 1. workspace_records / workspace_record_sets accept the rest of the shared services: to-dos, reminders, signing
--    requests, packets, scheduled reports, custom project types, and the three single-object settings (business
--    settings, setup answers, approval chains; each one a single record with the id "config").
--    Access is unchanged: members read; editors and above write; viewers cannot.
-- 2. workspace_activity: the activity trail. Append-only: nobody can change or remove a line once it is written, and
--    the database, not the app, says who did it, when, and under what name.

alter table public.workspace_records drop constraint workspace_records_kind_check;
alter table public.workspace_records add constraint workspace_records_kind_check check (kind in (
  'licenses', 'projects', 'invoices', 'vendors', 'contacts',
  'todos', 'reminders', 'signing', 'packets', 'schedules', 'projecttypes',
  'settings', 'setup', 'chains'));

alter table public.workspace_record_sets drop constraint workspace_record_sets_kind_check;
alter table public.workspace_record_sets add constraint workspace_record_sets_kind_check check (kind in (
  'licenses', 'projects', 'invoices', 'vendors', 'contacts',
  'todos', 'reminders', 'signing', 'packets', 'schedules', 'projecttypes',
  'settings', 'setup', 'chains'));

create table public.workspace_activity (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Chosen by the app so that sending the same line twice (a retry) is harmless.
  id text not null check (char_length(id) between 1 and 80),
  at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  -- What was done: verb, what it was done to, the area and a link. The person's name is added by the database.
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 4000),
  primary key (workspace_id, id)
);
create index workspace_activity_recent_idx on public.workspace_activity (workspace_id, at desc);

alter table public.workspace_activity enable row level security;

revoke all on public.workspace_activity from anon, authenticated;
grant select, insert on public.workspace_activity to authenticated;
grant all on public.workspace_activity to service_role;

create policy activity_select on public.workspace_activity for select to authenticated
  using (public.dms_has_role(workspace_id, 'viewer'));
-- There is no update or delete policy, and no update or delete grant: a line cannot be changed or removed.
create policy activity_insert on public.workspace_activity for insert to authenticated
  with check (public.dms_has_role(workspace_id, 'editor'));

-- When, who and under what name are set here, never by the app, so none of them can be faked.
create or replace function public.workspace_activity_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uname text;
begin
  new.at := now();
  new.actor_id := (select auth.uid());
  select coalesce(nullif(m.display_name, ''), nullif(m.email, ''), '') into uname
    from public.workspace_members m
    where m.workspace_id = new.workspace_id and m.user_id = (select auth.uid());
  new.data := new.data || jsonb_build_object('by', coalesce(uname, ''));
  return new;
end $$;
revoke all on function public.workspace_activity_stamp() from public, anon, authenticated;
create trigger workspace_activity_stamp before insert on public.workspace_activity
  for each row execute function public.workspace_activity_stamp();
