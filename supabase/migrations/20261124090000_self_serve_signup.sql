-- Self-serve sign-up: anyone can create an account, then start their own workspace and free trial. Invitations still work.
--
-- Before: a sign-up (a row in auth.users) was accepted only for an invited email or AdFlo staff, and a workspace could only be made
-- by staff in the Control center. Now:
-- 1. A switch (signup_settings.open, default on) decides whether sign-up is open to everyone. Staff can close it again with
--    control_set_signup_open(false); then only invited emails and staff get in, exactly as before.
-- 2. A person with an account but no workspace calls self_serve_start(company, name). That creates their client record (a trial,
--    on the Core + plan), their workspace with the standard folders, and makes them its owner, all in one transaction. The
--    workspace-creation guard stays: only this function and the Control center's provisioning can pass it.
-- 3. Someone who holds an open invitation cannot start their own: the invitation puts them in their company's workspace.
--
-- The 3-day free trial itself starts at Stripe checkout; this only creates the records. The nightly stray-account job already
-- leaves alone owners of trial clients, and removes accounts that never started a workspace after the grace period.

create table public.signup_settings (
  singleton boolean primary key default true check (singleton),
  open boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.signup_settings (singleton, open) values (true, true);
alter table public.signup_settings enable row level security; -- no policies: read and written only through the functions below
revoke all on public.signup_settings from anon, authenticated;

create or replace function public.signup_is_open()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select open from public.signup_settings where singleton), false)
$$;
revoke all on function public.signup_is_open() from public;
grant execute on function public.signup_is_open() to anon, authenticated;

create or replace function public.control_set_signup_open(p_open boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.signup_settings set open = p_open, updated_at = now() where singleton;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'signup.open_changed', 'signup', 'settings', jsonb_build_object('open', p_open));
end $$;
revoke all on function public.control_set_signup_open(boolean) from public, anon;
grant execute on function public.control_set_signup_open(boolean) to authenticated;

-- The sign-up check: staff and invited emails (an owner invitation once confirmed) always pass; anyone with a real-looking email passes while sign-up is open.
create or replace function public.auth_signup_must_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare em text := lower(trim(coalesce(new.email, '')));
begin
  if coalesce(current_setting('adflo.test_fixture', true), '') = 'on' then return new; end if;
  if em ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(em) <= 254 and (
       public.signup_is_open()
    or exists (select 1 from public.staff_members s where lower(s.email) = em)
    or exists (select 1 from public.workspace_invites i where i.email = em and i.accepted_at is null and i.expires_at > now()
               and (not i.needs_confirm or i.confirmed_at is not null))
  ) then return new; end if;
  raise exception 'signup_not_invited: sign-up is by invitation only' using errcode = '42501';
end $$;

-- A signed-in person with no workspace starts their own. Returns the new workspace id; calling it again returns the existing one.
create or replace function public.self_serve_start(p_company text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); em text; co text := btrim(coalesce(p_company, '')); nm text := btrim(coalesce(p_name, '')); ws uuid; cl uuid;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  select m.workspace_id into ws from public.workspace_members m where m.user_id = uid order by m.created_at limit 1;
  if ws is not null then return ws; end if;
  if not public.signup_is_open() then raise exception 'Sign-up is by invitation only.' using errcode = '42501'; end if;
  select lower(btrim(u.email)) into em from auth.users u where u.id = uid;
  if em is null or em = '' then raise exception 'Your account has no email.' using errcode = '42501'; end if;
  if exists (select 1 from public.staff_members s where s.user_id = uid) then raise exception 'Staff accounts do not start workspaces.' using errcode = '42501'; end if;
  if exists (select 1 from public.workspace_invites i where i.email = em and i.accepted_at is null and i.expires_at > now()) then
    raise exception 'You have an invitation. Open the invitation to join your company''s workspace.' using errcode = '23505';
  end if;
  if char_length(co) < 2 or char_length(co) > 80 then raise exception 'Enter your company name (2 to 80 characters).' using errcode = '22023'; end if;
  if char_length(nm) > 120 then nm := left(nm, 120); end if;
  if exists (select 1 from public.clients c where lower(c.name) = lower(co)) then
    raise exception 'A company with that name already exists. Add a detail such as your city, or ask your owner to invite you.' using errcode = '23505';
  end if;
  if exists (select 1 from public.clients c where lower(btrim(c.owner_email)) = em) then
    raise exception 'This email already belongs to a company. Contact support@adflo.pro.' using errcode = '23505';
  end if;

  insert into public.clients (name, status, plan, seats_limit, owner_name, owner_email, started_on, created_by)
  values (co, 'trial', 'core +', 3, nm, em, current_date, uid) returning id into cl;
  perform set_config('adflo.provisioning', 'on', true); -- this transaction only
  insert into public.workspaces (name, created_by) values (co, uid) returning id into ws;
  perform set_config('adflo.provisioning', 'off', true);
  update public.clients set workspace_id = ws where id = cl;
  insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values (ws, uid, 'owner', nm, em);
  insert into public.document_folders (workspace_id, name, color, is_system, default_category, created_by) values
    (ws, 'Invoices', 'violet', true, 'invoice', uid), (ws, 'Receipts', 'emerald', true, 'receipt', uid),
    (ws, 'Tax Documents', 'amber', true, 'tax', uid), (ws, 'Contracts', 'blue', true, 'contract', uid),
    (ws, 'HR Documents', 'rose', true, 'hr', uid), (ws, 'Insurance', 'sky', true, 'insurance', uid);
  perform public.dms_audit_write(ws, 'workspace.created', 'workspace', ws, jsonb_build_object('name', co, 'self_serve', true));
  return ws;
end $$;
revoke all on function public.self_serve_start(text, text) from public, anon;
grant execute on function public.self_serve_start(text, text) to authenticated;
