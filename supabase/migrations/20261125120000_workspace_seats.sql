-- Seats in use and the seat limit for the caller's own workspace, for the usage panel in the app. People in the workspace plus
-- invites still waiting count, the same as the invite check. Members only; the limit is null when there is no client record.
create or replace function public.workspace_seats(p_workspace uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'used', (select count(*) from public.workspace_members m where m.workspace_id = p_workspace)
          + (select count(*) from public.workspace_invites i where i.workspace_id = p_workspace and i.accepted_at is null and i.expires_at > now()),
    'limit', (select c.seats_limit from public.clients c where c.workspace_id = p_workspace))
  where exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = (select auth.uid()))
$$;
revoke all on function public.workspace_seats(uuid) from public, anon;
grant execute on function public.workspace_seats(uuid) to authenticated;
