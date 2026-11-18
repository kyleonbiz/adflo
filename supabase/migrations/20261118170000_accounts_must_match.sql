-- Accounts match to the letter: a workspace exists only for a client, and an account exists only for someone AdFlo invited.
--
-- 1. A workspace can only be inserted by control_provision_workspace (the Control center's "create workspace for this client"
--    step), which links it to its client in the same transaction. No other code path, function or role can create one.
-- 2. A sign-up (a row in auth.users) is accepted only when its email matches an open invitation (a client's owner invite
--    from the Control center, or a team invite from a workspace owner) or an AdFlo staff member. Anyone else is refused
--    before the account exists, so there are no stray accounts without a workspace to land in.
--
-- Both checks can be skipped by a test fixture session with `adflo.test_fixture = on` (the database tests set it; nothing
-- in the app does, and the API roles cannot run SET).

create or replace function public.workspaces_only_for_clients()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('adflo.provisioning', true), '') <> 'on' and coalesce(current_setting('adflo.test_fixture', true), '') <> 'on' then
    raise exception 'A workspace can only be created for a client, in the Control center.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.workspaces_only_for_clients() from public, anon, authenticated;
create trigger workspaces_only_for_clients before insert on public.workspaces for each row execute function public.workspaces_only_for_clients();

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
  perform set_config('adflo.provisioning', 'on', true); -- this transaction only
  insert into public.workspaces (name, created_by) values (left(c.name, 80), null) returning id into ws;
  perform set_config('adflo.provisioning', 'off', true);
  insert into public.document_folders (workspace_id, name, color, is_system, default_category, created_by) values
    (ws, 'Invoices', 'violet', true, 'invoice', null), (ws, 'Receipts', 'emerald', true, 'receipt', null),
    (ws, 'Tax Documents', 'amber', true, 'tax', null), (ws, 'Contracts', 'blue', true, 'contract', null),
    (ws, 'HR Documents', 'rose', true, 'hr', null);
  perform public.control_link_workspace(p_client, ws);
  perform public.control_invite_owner(p_client);
  return ws;
end $$;
revoke all on function public.control_provision_workspace(uuid) from public, anon;
grant execute on function public.control_provision_workspace(uuid) to authenticated;

create or replace function public.auth_signup_must_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare em text := lower(trim(coalesce(new.email, '')));
begin
  if coalesce(current_setting('adflo.test_fixture', true), '') = 'on' then return new; end if;
  if em <> '' and (
       exists (select 1 from public.staff_members s where lower(s.email) = em)
    or exists (select 1 from public.workspace_invites i where i.email = em and i.accepted_at is null and i.expires_at > now())
  ) then return new; end if;
  raise exception 'signup_not_invited: sign-up is by invitation only' using errcode = '42501';
end $$;
revoke all on function public.auth_signup_must_match() from public, anon, authenticated;
create trigger auth_signup_must_match before insert on auth.users for each row execute function public.auth_signup_must_match();
