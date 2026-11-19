-- Agreements get an effective date, and a Privacy Policy joins Terms of Service as a published agreement.

alter table public.agreement_templates add column effective_date date;
-- Versions published before this change were effective the day they were published.
update public.agreement_templates set effective_date = (created_at at time zone 'utc')::date where effective_date is null;
alter table public.agreement_templates alter column effective_date set not null;
alter table public.agreement_templates alter column effective_date set default (now() at time zone 'utc')::date;

-- Publishing takes the effective date (defaults to today).
drop function if exists public.control_publish_agreement(text, text);
create function public.control_publish_agreement(p_title text, p_body text, p_effective date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v integer; id uuid; canon text;
begin
  if not public.is_staff('owner') then raise exception 'Only the Owner publishes agreements' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('agreement:' || lower(trim(p_title))));
  select coalesce(max(t.version), 0) + 1, (array_agg(t.title order by t.version))[1] into v, canon from public.agreement_templates t where lower(t.title) = lower(trim(p_title));
  -- A later version keeps the title exactly as first written, so "terms" and "Terms" are one series.
  insert into public.agreement_templates (title, version, body, effective_date, created_by)
  values (coalesce(canon, trim(p_title)), v, p_body, coalesce(p_effective, (now() at time zone 'utc')::date), (select auth.uid())) returning agreement_templates.id into id;
  return id;
end $$;
revoke all on function public.control_publish_agreement(text, text, date) from public, anon;
grant execute on function public.control_publish_agreement(text, text, date) to authenticated;

-- The client's view of their link also carries the effective date.
drop function if exists public.agreement_public_view(text);
create function public.agreement_public_view(p_token text)
returns table (title text, version integer, body text, client_name text, accepted_at timestamptz, accepted_name text, expired boolean, effective_date date)
language sql stable security definer set search_path = '' as $$
  select t.title, t.version, t.body, c.name, a.accepted_at, a.accepted_name, (a.accepted_at is null and a.expires_at < now()), t.effective_date
  from public.agreements_sent a
  join public.agreement_templates t on t.id = a.template_id
  join public.clients c on c.id = a.client_id
  where p_token ~ '^[A-Za-z0-9_-]{43}$'
    and a.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'utf8')), 'hex')
$$;
revoke all on function public.agreement_public_view(text) from public, anon, authenticated;
grant execute on function public.agreement_public_view(text) to anon, authenticated;

-- A Privacy Policy to be filled in later: the Owner publishes the real text as the next version.
insert into public.agreement_templates (title, version, body)
select 'Privacy Policy', 1, E'# Privacy Policy\n\nThe privacy policy will be added here.'
where not exists (select 1 from public.agreement_templates t where lower(t.title) = 'privacy policy');
