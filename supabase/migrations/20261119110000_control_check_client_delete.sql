-- Control Center: deleting a client also deletes its workspace, in one step, so a client and its workspace never part ways.
-- This function only decides whether it is allowed: the Owner (with the second factor) must ask, the client's name must be typed
-- back, a paying (active) client must be cancelled first, and a client who accepted an agreement is kept as that record. It
-- records the request in the staff audit log and returns the client's workspace id (null when it has none). The server then
-- erases the workspace's stored files and the workspace, and only then deletes the client record.
create or replace function public.control_check_client_delete(p_client uuid, p_confirm text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.clients; accepted integer;
begin
  if not public.is_staff('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.clients where id = p_client for update;
  if not found then raise exception 'That client no longer exists.' using errcode = 'P0002'; end if;
  if lower(btrim(coalesce(p_confirm, ''))) <> lower(btrim(c.name)) then
    raise exception 'The name you typed does not match this client.' using errcode = '22023';
  end if;
  if c.status = 'active' then
    raise exception 'Cancel the client first. An active client cannot be deleted.' using errcode = '22023';
  end if;
  select count(*) into accepted from public.agreements_sent a where a.client_id = p_client and a.accepted_at is not null;
  if accepted > 0 then
    raise exception 'This client has accepted an agreement, so it is kept as their record. Cancel the client instead.' using errcode = '22023';
  end if;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'client.delete_requested', 'client', p_client::text,
          jsonb_build_object('client_id', p_client, 'name', c.name, 'workspace_id', c.workspace_id));
  return c.workspace_id;
end $$;

revoke all on function public.control_check_client_delete(uuid, text) from public, anon;
grant execute on function public.control_check_client_delete(uuid, text) to authenticated;
