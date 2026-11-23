-- Seats are paid for, so an invite cannot take a workspace past its seat limit. People already in the workspace plus
-- invites still waiting (not expired) count; re-inviting an address that is already invited does not use another seat.
-- A workspace with no client record (an older or internal one) has no limit, so nobody is locked out by accident.
create or replace function public.dms_invite_member(p_workspace uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor text := public.dms_role(p_workspace); em text := lower(trim(coalesce(p_email, ''))); inv uuid;
  cap integer; used integer;
begin
  if (select auth.uid()) is null or actor is null or public.dms_rank(actor) < 2 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(em) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_role is null or public.dms_rank(p_role) is null then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if public.dms_rank(p_role) >= 2 and actor <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and lower(m.email) = em) then
    raise exception 'conflict' using errcode = '23505';
  end if;

  select c.seats_limit into cap from public.clients c where c.workspace_id = p_workspace;
  if cap is not null and not exists (
    select 1 from public.workspace_invites i where i.workspace_id = p_workspace and i.email = em and i.accepted_at is null
  ) then
    select (select count(*) from public.workspace_members m where m.workspace_id = p_workspace)
         + (select count(*) from public.workspace_invites i where i.workspace_id = p_workspace and i.accepted_at is null and i.expires_at > now())
      into used;
    if used >= cap then
      raise exception 'seat_limit' using errcode = 'P0001';
    end if;
  end if;

  insert into public.workspace_invites (workspace_id, email, role, invited_by)
  values (p_workspace, em, p_role, (select auth.uid()))
  on conflict (workspace_id, email) where accepted_at is null
  do update set role = excluded.role, invited_by = excluded.invited_by,
                created_at = now(), expires_at = now() + interval '14 days'
  returning id into inv;
  perform public.dms_audit_write(p_workspace, 'member.invited', 'workspace', inv,
    jsonb_build_object('email', em, 'role', p_role));
  return inv;
end $$;
