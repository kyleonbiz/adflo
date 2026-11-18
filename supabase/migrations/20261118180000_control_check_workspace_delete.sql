-- Control Center: delete a cancelled client's workspace and all its data now, without the 30-day wait a workspace owner gets.
-- This function only decides whether it is allowed. The Owner (with the second factor) must be the one asking, the client
-- must be cancelled and have a workspace, and the client's name must be typed back. It records the request in the staff
-- audit log and returns the workspace id. The server then removes the stored files and the workspace with the same code the
-- nightly job uses, and leaves the workspace alone if any file cannot be removed. The client record stays (its workspace
-- link clears itself); deleting the record is the separate "Delete client" button. People's sign-in accounts are kept.

create or replace function public.control_check_workspace_delete(p_client uuid, p_confirm text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.clients;
begin
  if not public.is_staff('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.clients where id = p_client for update;
  if not found then raise exception 'That client no longer exists.' using errcode = 'P0002'; end if;
  if c.workspace_id is null then raise exception 'This client has no workspace to delete.' using errcode = '22023'; end if;
  if c.status <> 'cancelled' then
    raise exception 'Cancel the client first. Only a cancelled client''s workspace can be deleted.' using errcode = '22023';
  end if;
  if lower(btrim(coalesce(p_confirm, ''))) <> lower(btrim(c.name)) then
    raise exception 'The name you typed does not match this client.' using errcode = '22023';
  end if;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'client.workspace_delete_requested', 'client', p_client::text,
          jsonb_build_object('client_id', p_client, 'name', c.name, 'workspace_id', c.workspace_id));
  return c.workspace_id;
end $$;

revoke all on function public.control_check_workspace_delete(uuid, text) from public, anon;
grant execute on function public.control_check_workspace_delete(uuid, text) to authenticated;
