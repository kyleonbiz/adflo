-- Two fixes found in the staging database audit.
-- 1. A double submit of the "create workspace" form made two identical workspaces. Asking again for the same name
--    within a minute now returns the workspace that was just made instead of creating another.
-- 2. Deleting a workspace failed whenever it had folders: the folder audit trigger tried to log into a workspace
--    that was being deleted. The audit writer now skips a workspace that no longer exists.

create or replace function public.dms_audit_write(
  ws uuid, p_action text, p_type text, p_entity uuid, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.workspaces w where w.id = ws) then return; end if;
  insert into public.audit_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  values (ws, (select auth.uid()), p_action, p_type, p_entity, coalesce(p_meta, '{}'::jsonb));
end $$;
revoke all on function public.dms_audit_write(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

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
  -- Serialise one person's creates so two simultaneous submits cannot both pass the check below.
  perform pg_advisory_xact_lock(hashtextextended('create_workspace:' || uid::text, 0));
  select w.id into ws
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id and m.user_id = uid and m.role = 'owner'
  where w.created_by = uid and lower(w.name) = lower(trim(p_name)) and w.created_at > now() - interval '60 seconds'
  order by w.created_at desc limit 1;
  if ws is not null then return ws; end if;
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
