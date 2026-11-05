-- Control Center step 4: versioned terms and agreements, sent to clients by link, acceptance recorded.

-- Templates are never edited: a change is a new version. Only the Owner publishes.
create table public.agreement_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  version integer not null check (version >= 1),
  body text not null check (char_length(body) between 1 and 60000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (title, version)
);

create table public.agreements_sent (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  template_id uuid not null references public.agreement_templates (id) on delete restrict,
  -- Only the SHA-256 of the link's secret is stored; the link itself is shown to staff once.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  accepted_name text check (accepted_name is null or char_length(accepted_name) between 2 and 120),
  accepted_email text check (accepted_email is null or char_length(accepted_email) <= 254)
);
create index agreements_sent_client_idx on public.agreements_sent (client_id, sent_at desc);

create trigger agreement_templates_audit after insert on public.agreement_templates for each row execute function public.staff_audit_generic('agreement_template');
create trigger agreements_sent_audit after insert or update on public.agreements_sent for each row execute function public.staff_audit_generic('agreement');

-- Publish a new version of a template (version = highest so far + 1).
create or replace function public.control_publish_agreement(p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v integer; id uuid; canon text;
begin
  if not public.is_staff('owner') then raise exception 'Only the Owner publishes agreements' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('agreement:' || lower(trim(p_title))));
  select coalesce(max(t.version), 0) + 1, (array_agg(t.title order by t.version))[1] into v, canon from public.agreement_templates t where lower(t.title) = lower(trim(p_title));
  -- A later version keeps the title exactly as first written, so "terms" and "Terms" are one series.
  insert into public.agreement_templates (title, version, body, created_by) values (coalesce(canon, trim(p_title)), v, p_body, (select auth.uid())) returning agreement_templates.id into id;
  return id;
end $$;

-- Record that a client was sent an agreement, and tick the onboarding step.
create or replace function public.control_send_agreement(p_client uuid, p_template uuid, p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare id uuid;
begin
  if not public.is_staff('support') then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.agreements_sent (client_id, template_id, token_hash, sent_by) values (p_client, p_template, p_token_hash, (select auth.uid())) returning agreements_sent.id into id;
  insert into public.client_checklist (client_id, step, done_by) values (p_client, 'agreement_sent', (select auth.uid())) on conflict do nothing;
  return id;
end $$;

-- What the client sees at their link. Anyone holding the secret may call this; nothing else is exposed.
create or replace function public.agreement_public_view(p_token_hash text)
returns table (title text, version integer, body text, client_name text, accepted_at timestamptz, accepted_name text, expired boolean)
language sql stable security definer set search_path = '' as $$
  select t.title, t.version, t.body, c.name, a.accepted_at, a.accepted_name, (a.accepted_at is null and a.expires_at < now())
  from public.agreements_sent a
  join public.agreement_templates t on t.id = a.template_id
  join public.clients c on c.id = a.client_id
  where a.token_hash = p_token_hash
$$;

-- Accept once. Returns false when the link is unknown, expired, already used or the details are invalid.
create or replace function public.agreement_public_accept(p_token_hash text, p_name text, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 120 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(p_email) > 254 then return false; end if;
  update public.agreements_sent set accepted_at = now(), accepted_name = trim(p_name), accepted_email = lower(trim(p_email))
  where token_hash = p_token_hash and accepted_at is null and expires_at > now();
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke all on function public.control_publish_agreement(text, text), public.control_send_agreement(uuid, uuid, text),
  public.agreement_public_view(text), public.agreement_public_accept(text, text, text) from public, anon, authenticated;
grant execute on function public.control_publish_agreement(text, text), public.control_send_agreement(uuid, uuid, text) to authenticated;
grant execute on function public.agreement_public_view(text), public.agreement_public_accept(text, text, text) to anon, authenticated;

alter table public.agreement_templates enable row level security;
alter table public.agreements_sent enable row level security;
revoke all on public.agreement_templates, public.agreements_sent from anon, authenticated;
grant select on public.agreement_templates, public.agreements_sent to authenticated;
create policy templates_read on public.agreement_templates for select to authenticated using (public.is_staff('billing'));
create policy sent_read on public.agreements_sent for select to authenticated using (public.is_staff('billing'));
