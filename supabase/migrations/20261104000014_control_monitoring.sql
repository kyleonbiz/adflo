-- Control Center step 5: error log, failed-indexing counts, per-client activity.

-- Only the error CLASS is stored (never a message, file name or row data), plus where it happened and for which workspace.
-- Rows are written by the server with the service role; staff can read them and mark them handled.
create table public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  source text not null check (char_length(source) between 1 and 80),
  kind text not null check (char_length(kind) between 1 and 80),
  status integer check (status is null or status between 100 and 599),
  workspace_id uuid,
  client_id uuid references public.clients (id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create index app_errors_at_idx on public.app_errors (at desc);
create index app_errors_open_idx on public.app_errors (at desc) where resolved_at is null;

create or replace function public.app_errors_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_id is not null and new.client_id is null then
    select c.id into new.client_id from public.clients c where c.workspace_id = new.workspace_id;
  end if;
  return new;
end $$;
revoke all on function public.app_errors_link() from public, anon, authenticated;
create trigger app_errors_link_trg before insert on public.app_errors for each row execute function public.app_errors_link();
create trigger app_errors_audit after update on public.app_errors for each row execute function public.staff_audit_generic('app_error');

alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;
grant select on public.app_errors to authenticated;
grant update (resolved_at, resolved_by) on public.app_errors to authenticated;
create policy errors_read on public.app_errors for select to authenticated using (public.is_staff('billing'));
create policy errors_resolve on public.app_errors for update to authenticated
  using (public.is_staff('support')) with check (public.is_staff('support') and resolved_by = (select auth.uid()));

-- Documents whose text could not be read for search, per client. Counts only.
create or replace function public.control_failed_documents()
returns table (client_id uuid, failed bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, count(*) from public.documents d
  join public.clients c on c.workspace_id = d.workspace_id
  where public.is_staff('billing') and d.deleted_at is null and d.content_status = 'failed'
  group by c.id
$$;
revoke all on function public.control_failed_documents() from public, anon;
grant execute on function public.control_failed_documents() to authenticated;

-- Errors per client in the last 7 days, for the health view.
create or replace function public.control_error_counts()
returns table (client_id uuid, errors bigint)
language sql stable security definer set search_path = '' as $$
  select e.client_id, count(*) from public.app_errors e
  where public.is_staff('billing') and e.client_id is not null and e.at > now() - interval '7 days' and e.resolved_at is null
  group by e.client_id
$$;
revoke all on function public.control_error_counts() from public, anon;
grant execute on function public.control_error_counts() to authenticated;
