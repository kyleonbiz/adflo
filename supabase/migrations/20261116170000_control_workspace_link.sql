-- Control Center: connect a client record to its AdFlo workspace, and set the account up in one step.
-- Staff cannot read workspaces or members directly, so everything goes through these functions. Each one needs a
-- support or owner staff member who has passed the second factor (is_staff('support') includes that check), and each
-- change is written to the staff audit log and ticks the matching onboarding step.

-- Workspaces no client is linked to yet: just enough to choose the right one.
create or replace function public.control_unlinked_workspaces()
returns table (id uuid, name text, created_at timestamptz, members bigint, owner_email text)
language sql stable security definer set search_path = '' as $$
  select w.id, w.name, w.created_at,
         (select count(*) from public.workspace_members m where m.workspace_id = w.id),
         coalesce((select m.email from public.workspace_members m where m.workspace_id = w.id and m.role = 'owner' order by m.created_at limit 1), '')
  from public.workspaces w
  where public.is_staff('support')
    and not exists (select 1 from public.clients c where c.workspace_id = w.id)
  order by w.created_at desc
  limit 200
$$;

create or replace function public.control_staff_email()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select s.email from public.staff_members s where s.user_id = (select auth.uid())), '')
$$;
revoke all on function public.control_staff_email() from public, anon, authenticated;

-- Link an existing workspace (the client signed up and made it themselves).
create or replace function public.control_link_workspace(p_client uuid, p_workspace uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.clients; ws_name text;
begin
  if not public.is_staff('support') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.clients where id = p_client for update;
  if not found then raise exception 'Client not found' using errcode = 'P0002'; end if;
  if c.workspace_id is not null then raise exception 'This client already has a workspace. Unlink it first.' using errcode = '23505'; end if;
  select w.name into ws_name from public.workspaces w where w.id = p_workspace;
  if ws_name is null then raise exception 'Workspace not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.clients x where x.workspace_id = p_workspace) then
    raise exception 'That workspace belongs to another client.' using errcode = '23505';
  end if;
  update public.clients set workspace_id = p_workspace where id = p_client;
  insert into public.client_checklist (client_id, step, done_by) values (p_client, 'workspace', (select auth.uid())) on conflict do nothing;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'client.workspace_linked', 'client', p_client::text,
          jsonb_build_object('client_id', p_client, 'workspace', ws_name));
end $$;

create or replace function public.control_unlink_workspace(p_client uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare old_ws uuid;
begin
  if not public.is_staff('support') then raise exception 'forbidden' using errcode = '42501'; end if;
  select workspace_id into old_ws from public.clients where id = p_client for update;
  if old_ws is null then raise exception 'This client has no workspace linked.' using errcode = 'P0002'; end if;
  update public.clients set workspace_id = null where id = p_client;
  delete from public.client_checklist where client_id = p_client and step in ('workspace', 'owner_invited', 'first_login');
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'client.workspace_unlinked', 'client', p_client::text, jsonb_build_object('client_id', p_client));
end $$;

-- Invite the client's owner (the email on the client record) into the linked workspace as its owner.
-- They join automatically the next time they sign in with that verified email. The invite lasts 14 days.
create or replace function public.control_invite_owner(p_client uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare c public.clients; em text; exp timestamptz;
begin
  if not public.is_staff('support') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.clients where id = p_client for update;
  if not found then raise exception 'Client not found' using errcode = 'P0002'; end if;
  if c.workspace_id is null then raise exception 'Link or create the workspace first.' using errcode = 'P0002'; end if;
  em := lower(trim(c.owner_email));
  if em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(em) > 254 then
    raise exception 'Add the owner''s email to the client first.' using errcode = '22023';
  end if;
  if exists (select 1 from public.workspace_members m where m.workspace_id = c.workspace_id and lower(m.email) = em) then
    raise exception 'They are already in the workspace.' using errcode = '23505';
  end if;
  insert into public.workspace_invites (workspace_id, email, role, invited_by)
  values (c.workspace_id, em, 'owner', (select auth.uid()))
  on conflict (workspace_id, email) where accepted_at is null
  do update set role = 'owner', invited_by = excluded.invited_by, created_at = now(), expires_at = now() + interval '14 days'
  returning expires_at into exp;
  insert into public.client_checklist (client_id, step, done_by) values (p_client, 'owner_invited', (select auth.uid())) on conflict do nothing;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'client.owner_invited', 'client', p_client::text, jsonb_build_object('client_id', p_client, 'email', em));
  return exp;
end $$;

-- One click: make an empty workspace for the client (with the standard folders), link it, and invite the owner.
-- Nobody from staff becomes a member, so staff are never counted as seats and do not see the client's files.
create or replace function public.control_provision_workspace(p_client uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.clients; ws uuid;
begin
  if not public.is_staff('support') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.clients where id = p_client for update;
  if not found then raise exception 'Client not found' using errcode = 'P0002'; end if;
  if c.workspace_id is not null then raise exception 'This client already has a workspace.' using errcode = '23505'; end if;
  if lower(trim(c.owner_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Add the owner''s email to the client first.' using errcode = '22023';
  end if;
  insert into public.workspaces (name, created_by) values (left(c.name, 80), null) returning id into ws;
  insert into public.document_folders (workspace_id, name, color, is_system, default_category, created_by) values
    (ws, 'Invoices', 'violet', true, 'invoice', null), (ws, 'Receipts', 'emerald', true, 'receipt', null),
    (ws, 'Tax Documents', 'amber', true, 'tax', null), (ws, 'Contracts', 'blue', true, 'contract', null),
    (ws, 'HR Documents', 'rose', true, 'hr', null);
  perform public.control_link_workspace(p_client, ws);
  perform public.control_invite_owner(p_client);
  return ws;
end $$;

revoke all on function public.control_unlinked_workspaces(), public.control_link_workspace(uuid, uuid), public.control_unlink_workspace(uuid),
  public.control_invite_owner(uuid), public.control_provision_workspace(uuid) from public, anon;
grant execute on function public.control_unlinked_workspaces(), public.control_link_workspace(uuid, uuid), public.control_unlink_workspace(uuid),
  public.control_invite_owner(uuid), public.control_provision_workspace(uuid) to authenticated;
