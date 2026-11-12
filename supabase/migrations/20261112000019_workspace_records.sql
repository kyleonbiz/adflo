-- Saved records for the client modules (licenses and tasks first; the other services use the same table later).
-- One row per record, as JSON, so two people editing different records never overwrite each other.
-- Access follows the workspace role, like Documents: members read, editors and above write, viewers cannot.

create table public.workspace_records (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('licenses', 'projects', 'invoices', 'vendors', 'contacts')),
  id text not null check (char_length(id) between 1 and 80),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 200000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (workspace_id, kind, id)
);

-- Marks that a service has saved records at all, so "never saved" (show starter records) and
-- "saved, then everything deleted" (stay empty) can be told apart.
create table public.workspace_record_sets (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('licenses', 'projects', 'invoices', 'vendors', 'contacts')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, kind)
);

alter table public.workspace_records enable row level security;
alter table public.workspace_record_sets enable row level security;

revoke all on public.workspace_records, public.workspace_record_sets from anon;
grant select, insert, update, delete on public.workspace_records to authenticated;
grant select, insert on public.workspace_record_sets to authenticated;
grant all on public.workspace_records, public.workspace_record_sets to service_role;

create policy records_select on public.workspace_records for select to authenticated
  using (public.dms_has_role(workspace_id, 'viewer'));
create policy records_insert on public.workspace_records for insert to authenticated
  with check (public.dms_has_role(workspace_id, 'editor'));
create policy records_update on public.workspace_records for update to authenticated
  using (public.dms_has_role(workspace_id, 'editor'))
  with check (public.dms_has_role(workspace_id, 'editor'));
create policy records_delete on public.workspace_records for delete to authenticated
  using (public.dms_has_role(workspace_id, 'editor'));

create policy record_sets_select on public.workspace_record_sets for select to authenticated
  using (public.dms_has_role(workspace_id, 'viewer'));
create policy record_sets_insert on public.workspace_record_sets for insert to authenticated
  with check (public.dms_has_role(workspace_id, 'editor'));

-- Who saved and when are set here, never by the app, so neither can be faked.
create or replace function public.workspace_records_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger workspace_records_touch before insert or update on public.workspace_records
  for each row execute function public.workspace_records_touch();
