-- Closing a workspace: the owner asks for deletion, nothing is removed for 30 days (they can change their mind), and a nightly
-- job then removes the workspace and everything in it. Clients cannot write to `workspaces` directly; they use the functions below.

alter table public.workspaces
  add column deletion_requested_at timestamptz,
  add column deletion_requested_by uuid references auth.users (id) on delete set null;
create index workspaces_deletion_idx on public.workspaces (deletion_requested_at) where deletion_requested_at is not null;
create index workspaces_deletion_by_idx on public.workspaces (deletion_requested_by);

-- Owner only. The workspace name must be typed exactly (ignoring case and surrounding spaces). Asking again changes nothing and
-- returns the original request time, so the 30 days always count from the first request.
create or replace function public.workspace_request_deletion(p_workspace uuid, p_confirm text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare w public.workspaces;
begin
  if not public.dms_has_role(p_workspace, 'owner') then raise exception 'Only the owner can close this workspace.' using errcode = '42501'; end if;
  select * into w from public.workspaces where id = p_workspace for update;
  if not found then raise exception 'Workspace not found.' using errcode = 'P0002'; end if;
  if lower(trim(coalesce(p_confirm, ''))) <> lower(trim(w.name)) then raise exception 'The name you typed does not match.' using errcode = '22023'; end if;
  if w.deletion_requested_at is null then
    update public.workspaces set deletion_requested_at = now(), deletion_requested_by = (select auth.uid()) where id = p_workspace
      returning deletion_requested_at into w.deletion_requested_at;
    insert into public.audit_logs (workspace_id, actor_id, action, entity_type, entity_id)
      values (p_workspace, (select auth.uid()), 'workspace.deletion_requested', 'workspace', p_workspace);
  end if;
  return w.deletion_requested_at;
end $$;
revoke all on function public.workspace_request_deletion(uuid, text) from public, anon, authenticated;
grant execute on function public.workspace_request_deletion(uuid, text) to authenticated;

-- Owner only. Cancels a pending request; the workspace carries on exactly as it was.
create or replace function public.workspace_cancel_deletion(p_workspace uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.dms_has_role(p_workspace, 'owner') then raise exception 'Only the owner can cancel this.' using errcode = '42501'; end if;
  if exists (select 1 from public.workspaces where id = p_workspace and deletion_requested_at is not null) then
    update public.workspaces set deletion_requested_at = null, deletion_requested_by = null where id = p_workspace;
    insert into public.audit_logs (workspace_id, actor_id, action, entity_type, entity_id)
      values (p_workspace, (select auth.uid()), 'workspace.deletion_cancelled', 'workspace', p_workspace);
  end if;
end $$;
revoke all on function public.workspace_cancel_deletion(uuid) from public, anon, authenticated;
grant execute on function public.workspace_cancel_deletion(uuid) to authenticated;

-- For the nightly job (service role only): workspaces whose grace period has ended, and who asked.
create or replace function public.dms_due_workspace_deletions(p_grace interval default interval '30 days')
returns table (id uuid, requested_by uuid)
language sql stable security definer set search_path = '' as $$
  select w.id, w.deletion_requested_by from public.workspaces w
  where w.deletion_requested_at is not null and w.deletion_requested_at <= now() - p_grace
  order by w.deletion_requested_at
  limit 20
$$;
revoke all on function public.dms_due_workspace_deletions(interval) from public, anon, authenticated;
grant execute on function public.dms_due_workspace_deletions(interval) to service_role;

-- Deleting a workspace removes its documents and folders, and their audit triggers would then log "document.purged" and
-- "folder.deleted" against a workspace that no longer exists, which the foreign key refuses and so blocks the whole delete.
-- The writer now skips the entry when its workspace is gone (everything about that workspace is being erased anyway).
create or replace function public.dms_audit_write(
  ws uuid, p_action text, p_type text, p_entity uuid, p_meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  select ws, (select auth.uid()), p_action, p_type, p_entity, coalesce(p_meta, '{}'::jsonb)
  where exists (select 1 from public.workspaces w where w.id = ws)
$$;
revoke all on function public.dms_audit_write(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
