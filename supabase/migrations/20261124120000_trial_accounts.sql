-- Free trials without a workspace. Replaces self_serve_start (the same-day version that built a workspace at sign-up).
--
-- A person signs up, confirms their email and names their company: start_trial records them as a client (status trial, flagged
-- self_serve) with a 3-day trial_ends_at. They get no workspace yet; the app shows them sample data. When the trial is over, the
-- account is paused until they subscribe. Once Stripe reports an active subscription, activate_trial_workspace (service role only,
-- called from the server) creates their real workspace and makes them its owner.

alter table public.clients
  add column self_serve boolean not null default false,
  add column trial_ends_at timestamptz;

drop function if exists public.self_serve_start(text, text);

-- A signed-in person with no workspace starts a trial. Returns the client id and when the trial ends; calling it again returns the same trial.
create or replace function public.start_trial(p_company text, p_name text)
returns table (client_id uuid, trial_ends_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); em text; co text := btrim(coalesce(p_company, '')); nm text := btrim(coalesce(p_name, '')); c public.clients;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.workspace_members m where m.user_id = uid) then raise exception 'You already have a workspace.' using errcode = '23505'; end if;
  if not public.signup_is_open() then raise exception 'Sign-up is by invitation only.' using errcode = '42501'; end if;
  select lower(btrim(u.email)) into em from auth.users u where u.id = uid;
  if em is null or em = '' then raise exception 'Your account has no email.' using errcode = '42501'; end if;
  select * into c from public.clients x where x.self_serve and lower(btrim(x.owner_email)) = em;
  if found then return query select c.id, c.trial_ends_at; return; end if;
  if exists (select 1 from public.staff_members s where s.user_id = uid) then raise exception 'Staff accounts do not start trials.' using errcode = '42501'; end if;
  if exists (select 1 from public.workspace_invites i where i.email = em and i.accepted_at is null and i.expires_at > now()) then
    raise exception 'You have an invitation. Open the invitation to join your company''s workspace.' using errcode = '23505';
  end if;
  if char_length(co) < 2 or char_length(co) > 80 then raise exception 'Enter your company name (2 to 80 characters).' using errcode = '22023'; end if;
  if char_length(nm) > 120 then nm := left(nm, 120); end if;
  if exists (select 1 from public.clients x where lower(x.name) = lower(co)) then
    raise exception 'A company with that name already exists. Add a detail such as your city, or ask your owner to invite you.' using errcode = '23505';
  end if;
  if exists (select 1 from public.clients x where lower(btrim(x.owner_email)) = em) then
    raise exception 'This email already belongs to a company. Contact support@adflo.pro.' using errcode = '23505';
  end if;
  insert into public.clients (name, status, plan, seats_limit, owner_name, owner_email, started_on, created_by, self_serve, trial_ends_at)
  values (co, 'trial', 'adflo', 1, nm, em, current_date, uid, true, now() + interval '3 days') returning * into c;
  return query select c.id, c.trial_ends_at;
end $$;
revoke all on function public.start_trial(text, text) from public, anon;
grant execute on function public.start_trial(text, text) to authenticated;

-- The caller's own self-serve trial, for the app to decide what to show: sample data, the paywall, or the new workspace.
create or replace function public.my_trial()
returns table (client_id uuid, company text, trial_ends_at timestamptz, paid boolean, has_workspace boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.trial_ends_at,
         (c.stripe_subscription_id is not null and coalesce(c.billing_status, '') in ('active', 'trialing', 'past_due')),
         c.workspace_id is not null
  from public.clients c
  where c.self_serve and lower(btrim(c.owner_email)) = (select lower(btrim(u.email)) from auth.users u where u.id = (select auth.uid()))
  limit 1
$$;
revoke all on function public.my_trial() from public, anon;
grant execute on function public.my_trial() to authenticated;

-- After payment: build the real workspace and make the person its owner. Server only (service role); it re-checks everything.
create or replace function public.activate_trial_workspace(p_client uuid, p_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.clients; em text; ws uuid;
begin
  select * into c from public.clients where id = p_client for update;
  if not found or not c.self_serve then raise exception 'Not a trial account.' using errcode = 'P0002'; end if;
  if c.workspace_id is not null then return c.workspace_id; end if;
  if c.stripe_subscription_id is null or coalesce(c.billing_status, '') not in ('active', 'trialing', 'past_due') then
    raise exception 'Payment has not been confirmed yet.' using errcode = '42501';
  end if;
  select lower(btrim(u.email)) into em from auth.users u where u.id = p_user;
  if em is null or em <> lower(btrim(c.owner_email)) then raise exception 'That account does not own this trial.' using errcode = '42501'; end if;
  perform set_config('adflo.provisioning', 'on', true); -- this transaction only
  insert into public.workspaces (name, created_by) values (c.name, p_user) returning id into ws;
  perform set_config('adflo.provisioning', 'off', true);
  update public.clients set workspace_id = ws, status = 'active', trial_ends_at = null where id = c.id;
  insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values (ws, p_user, 'owner', c.owner_name, em);
  insert into public.document_folders (workspace_id, name, color, is_system, default_category, created_by) values
    (ws, 'Invoices', 'violet', true, 'invoice', p_user), (ws, 'Receipts', 'emerald', true, 'receipt', p_user),
    (ws, 'Tax Documents', 'amber', true, 'tax', p_user), (ws, 'Contracts', 'blue', true, 'contract', p_user),
    (ws, 'HR Documents', 'rose', true, 'hr', p_user), (ws, 'Insurance', 'sky', true, 'insurance', p_user);
  perform public.dms_audit_write(ws, 'workspace.created', 'workspace', ws, jsonb_build_object('name', c.name, 'self_serve', true));
  return ws;
end $$;
revoke all on function public.activate_trial_workspace(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_trial_workspace(uuid, uuid) to service_role;
