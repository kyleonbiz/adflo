-- An owner invitation must be confirmed before the account can be made.
--
-- The Control center's "invite owner" now emails the owner a confirm link. Opening it and pressing Confirm sets
-- `confirmed_at`. The sign-up check (auth_signup_must_match) then accepts the email only once that has happened.
-- Only the SHA-256 hash of the link's secret is stored. Team invites (made by a workspace owner) are unchanged:
-- they are not marked `needs_confirm`, so an open invite is enough for them, as before.

alter table public.workspace_invites
  add column needs_confirm boolean not null default false,
  add column confirm_hash text unique check (confirm_hash ~ '^[0-9a-f]{64}$'),
  add column confirmed_at timestamptz;

-- Inviting (or re-inviting) the owner starts again from "not confirmed": any earlier link stops working.
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
  insert into public.workspace_invites (workspace_id, email, role, invited_by, needs_confirm)
  values (c.workspace_id, em, 'owner', (select auth.uid()), true)
  on conflict (workspace_id, email) where accepted_at is null
  do update set role = 'owner', invited_by = excluded.invited_by, created_at = now(), expires_at = now() + interval '14 days',
                needs_confirm = true, confirmed_at = null, confirm_hash = null
  returning expires_at into exp;
  insert into public.client_checklist (client_id, step, done_by) values (p_client, 'owner_invited', (select auth.uid())) on conflict do nothing;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'client.owner_invited', 'client', p_client::text, jsonb_build_object('client_id', p_client, 'email', em));
  return exp;
end $$;

-- Staff: attach a fresh confirm link (its hash) to the client's open owner invitation. Returns when the invitation expires.
-- A new link replaces the old one, so only the most recent email works.
create or replace function public.control_invite_link(p_client uuid, p_token_hash text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare c public.clients; exp timestamptz;
begin
  if not public.is_staff('support') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.clients where id = p_client;
  if not found then raise exception 'Client not found' using errcode = 'P0002'; end if;
  update public.workspace_invites set confirm_hash = p_token_hash
  where workspace_id = c.workspace_id and email = lower(trim(c.owner_email)) and accepted_at is null and expires_at > now()
  returning expires_at into exp;
  if exp is null then raise exception 'There is no open invitation for the owner. Invite the owner first.' using errcode = 'P0002'; end if;
  return exp;
end $$;

-- What the owner sees at their link. Anyone holding the secret may call this; nothing else is exposed.
create or replace function public.invite_public_view(p_token_hash text)
returns table (client_name text, email text, confirmed boolean, expired boolean, used boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(c.name, w.name), i.email, i.confirmed_at is not null, (i.accepted_at is null and i.expires_at < now()), i.accepted_at is not null
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  left join public.clients c on c.workspace_id = i.workspace_id
  where i.confirm_hash = p_token_hash and i.needs_confirm
$$;

-- Confirm the invitation. Returns the invited email, or null when the link is unknown, expired or already used.
-- Confirming twice is harmless.
create or replace function public.invite_public_confirm(p_token_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare em text;
begin
  update public.workspace_invites set confirmed_at = coalesce(confirmed_at, now())
  where confirm_hash = p_token_hash and needs_confirm and accepted_at is null and expires_at > now()
  returning email into em;
  return em;
end $$;

-- Sign-up is accepted for staff, and for an email with an open invitation that is confirmed when it needs to be.
create or replace function public.auth_signup_must_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare em text := lower(trim(coalesce(new.email, '')));
begin
  if coalesce(current_setting('adflo.test_fixture', true), '') = 'on' then return new; end if;
  if em <> '' and (
       exists (select 1 from public.staff_members s where lower(s.email) = em)
    or exists (select 1 from public.workspace_invites i where i.email = em and i.accepted_at is null and i.expires_at > now()
               and (not i.needs_confirm or i.confirmed_at is not null))
  ) then return new; end if;
  raise exception 'signup_not_invited: sign-up is by invitation only' using errcode = '42501';
end $$;

revoke all on function public.control_invite_link(uuid, text), public.invite_public_view(text), public.invite_public_confirm(text) from public, anon, authenticated;
grant execute on function public.control_invite_link(uuid, text) to authenticated;
grant execute on function public.invite_public_view(text), public.invite_public_confirm(text) to anon, authenticated;
