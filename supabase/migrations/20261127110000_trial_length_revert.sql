-- Takes back the adjustable trial length: start_trial is again the two-argument function, and a new trial always lasts 3 days.

drop function if exists public.start_trial(text, text, integer);

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
