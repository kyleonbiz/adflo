-- Suspend lock: when a client is suspended or cancelled in the Control Center, their people can no longer reach the
-- workspace's data. Enforced here, where the data lives, so no screen or API can get around it.
-- Nothing is deleted. Turning the client back on restores access at once. Trials and active clients are in service.

-- Is any client record that owns this workspace switched off? Internal: only other functions call it.
create or replace function public.workspace_suspended(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clients c where c.workspace_id = ws and c.status in ('suspended', 'cancelled'))
$$;
revoke all on function public.workspace_suspended(uuid) from public, anon, authenticated;
grant execute on function public.workspace_suspended(uuid) to service_role;

-- Every table policy, storage policy and data function asks dms_has_role, so one change locks them all.
-- dms_role is left alone: it still says who belongs to a workspace, which the "account paused" screen needs.
create or replace function public.dms_has_role(ws uuid, min_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (case public.dms_role(ws) when 'viewer' then 0 when 'editor' then 1 when 'admin' then 2 when 'owner' then 3 end)
    >=
    (case min_role when 'viewer' then 0 when 'editor' then 1 when 'admin' then 2 when 'owner' then 3 end),
    false) and not public.workspace_suspended(ws)
$$;

-- Members can always see their own workspace and who belongs to it (so the app can tell them it is paused),
-- but that is all: documents, folders, records and files go through dms_has_role above.
drop policy workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces for select to authenticated using (public.dms_role(id) is not null);
drop policy members_select on public.workspace_members;
create policy members_select on public.workspace_members for select to authenticated using (public.dms_role(workspace_id) is not null);

-- The caller's workspace standing for the "account paused" screen: 'ok', 'suspended' or 'cancelled'; null for non-members.
create or replace function public.workspace_standing(p_workspace uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when public.dms_role(p_workspace) is null then null
    else coalesce((select c.status from public.clients c where c.workspace_id = p_workspace and c.status in ('suspended', 'cancelled') limit 1), 'ok') end
$$;
revoke all on function public.workspace_standing(uuid) from public, anon;
grant execute on function public.workspace_standing(uuid) to authenticated;

-- A paused client cannot walk around the lock by starting a fresh empty workspace.
create or replace function public.create_workspace(p_name text, p_display_name text, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); ws uuid; em text;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if exists (select 1 from public.workspace_members m where m.user_id = uid and public.workspace_suspended(m.workspace_id)) then
    raise exception 'account_paused: your account is paused. Contact AdFlo.' using errcode = '42501';
  end if;
  if (select count(*) from public.workspace_members m where m.user_id = uid and m.role = 'owner') >= 5 then
    raise exception 'workspace_limit: you already own the maximum number of workspaces' using errcode = 'P0001';
  end if;
  select coalesce(u.email, '') into em from auth.users u where u.id = uid;
  insert into public.workspaces (name, created_by) values (trim(p_name), uid) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role, display_name, email)
  values (ws, uid, 'owner', left(trim(coalesce(p_display_name, '')), 80), coalesce(em, ''));
  insert into public.document_folders (workspace_id, name, color, is_system, default_category, created_by) values
    (ws, 'Invoices', 'violet', true, 'invoice', uid),
    (ws, 'Receipts', 'emerald', true, 'receipt', uid),
    (ws, 'Tax Documents', 'amber', true, 'tax', uid),
    (ws, 'Contracts', 'blue', true, 'contract', uid),
    (ws, 'HR Documents', 'rose', true, 'hr', uid);
  perform public.dms_audit_write(ws, 'workspace.created', 'workspace', ws, jsonb_build_object('name', trim(p_name)));
  return ws;
end $$;
revoke all on function public.create_workspace(text, text, text) from public, anon;
grant execute on function public.create_workspace(text, text, text) to authenticated;

-- Links that were shared before the pause stop opening too.
create or replace function public.dms_resolve_share(p_token_hash text)
returns table (storage_key text, display_name text, mime_type text, workspace_id uuid, document_id uuid, link_id uuid)
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select v.storage_key as k, d.display_name as n, v.mime_type as m, d.workspace_id as w, d.id as d_id, l.id as l_id
    into r
  from public.document_share_links l
  join public.documents d on d.id = l.document_id and d.workspace_id = l.workspace_id
  join public.document_versions v on v.document_id = d.id and v.version_number = d.current_version
  where l.token_hash = p_token_hash and l.revoked_at is null and l.expires_at > now()
    and d.status = 'ready' and d.deleted_at is null and v.status = 'ready'
    and not public.workspace_suspended(d.workspace_id);
  if not found then return; end if;
  perform public.dms_audit_write(r.w, 'document.share_used', 'document', r.d_id,
    jsonb_build_object('linkId', r.l_id));
  return query select r.k, r.n, r.m, r.w, r.d_id, r.l_id;
end $$;
revoke all on function public.dms_resolve_share(text) from public, anon, authenticated;
grant execute on function public.dms_resolve_share(text) to service_role;
