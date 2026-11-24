-- A private calendar link per workspace: paste it into Google, Apple or Outlook Calendar once and the workspace's due dates,
-- expiries and tasks appear there and stay current. Like the "secret address" those calendars give out themselves, anyone
-- who has the link can read the calendar, so it is shown once when made, only a SHA-256 hash of it is stored here, and an
-- owner or admin can replace it (which cuts off the old one) or turn it off at any time.
--
-- Nobody but the database functions below touches the table: the calendar feed itself is served by the server with the service
-- role, which looks the workspace up by the hash.

create table public.calendar_feeds (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index calendar_feeds_created_by_idx on public.calendar_feeds (created_by);

alter table public.calendar_feeds enable row level security;
revoke all on public.calendar_feeds from anon, authenticated;
grant select on public.calendar_feeds to service_role;

-- Owner or admin: make the link, or replace it with a new one (the old one stops working at once).
create or replace function public.calendar_feed_set(p_workspace uuid, p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.dms_has_role(p_workspace, 'admin') then raise exception 'Only an owner or admin can do this.' using errcode = '42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid link.' using errcode = '22023'; end if;
  insert into public.calendar_feeds (workspace_id, token_hash, created_by) values (p_workspace, p_token_hash, (select auth.uid()))
  on conflict (workspace_id) do update set token_hash = excluded.token_hash, created_by = excluded.created_by, created_at = now();
  perform public.dms_audit_write(p_workspace, 'calendar_feed.created', 'workspace', p_workspace, '{}'::jsonb);
end $$;

-- Owner or admin: turn the link off.
create or replace function public.calendar_feed_off(p_workspace uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.dms_has_role(p_workspace, 'admin') then raise exception 'Only an owner or admin can do this.' using errcode = '42501'; end if;
  if exists (select 1 from public.calendar_feeds where workspace_id = p_workspace) then
    delete from public.calendar_feeds where workspace_id = p_workspace;
    perform public.dms_audit_write(p_workspace, 'calendar_feed.removed', 'workspace', p_workspace, '{}'::jsonb);
  end if;
end $$;

-- Any member: is there a link, and since when (never the link itself).
create or replace function public.calendar_feed_info(p_workspace uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select f.created_at from public.calendar_feeds f where f.workspace_id = p_workspace and public.dms_has_role(p_workspace, 'viewer')
$$;

revoke all on function public.calendar_feed_set(uuid, text), public.calendar_feed_off(uuid), public.calendar_feed_info(uuid) from public, anon;
grant execute on function public.calendar_feed_set(uuid, text), public.calendar_feed_off(uuid), public.calendar_feed_info(uuid) to authenticated;
