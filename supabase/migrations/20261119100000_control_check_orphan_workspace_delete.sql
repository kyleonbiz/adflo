-- Control Center: delete a workspace that no client owns, so none linger. Like control_check_workspace_delete this only decides
-- whether it is allowed: the Owner (with the second factor) must ask, no client may be linked to the workspace (a client's own
-- workspace is deleted from that client, after cancelling it), and the workspace's name must be typed back. It records the request
-- in the staff audit log and returns the workspace id; the server then removes the stored files and the workspace.
create or replace function public.control_check_orphan_workspace_delete(p_workspace uuid, p_confirm text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare w public.workspaces;
begin
  if not public.is_staff('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into w from public.workspaces where id = p_workspace for update;
  if not found then raise exception 'That workspace no longer exists.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.clients c where c.workspace_id = p_workspace) then
    raise exception 'A client owns this workspace. Delete it from that client (cancel the client first).' using errcode = '22023';
  end if;
  if lower(btrim(coalesce(p_confirm, ''))) <> lower(btrim(w.name)) then
    raise exception 'The name you typed does not match this workspace.' using errcode = '22023';
  end if;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'workspace.delete_requested', 'workspace', p_workspace::text,
          jsonb_build_object('name', w.name, 'workspace_id', p_workspace));
  return p_workspace;
end $$;

revoke all on function public.control_check_orphan_workspace_delete(uuid, text) from public, anon;
grant execute on function public.control_check_orphan_workspace_delete(uuid, text) to authenticated;
