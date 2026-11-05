-- Agreement links: the database now checks the link's secret itself.
--
-- Before, the app hashed the secret and passed the hash to the public (anon) functions. That made the stored hash a
-- bearer credential: any staff role that can read agreements_sent (billing is read-only) -- or anyone who got hold of a
-- backup or a query result -- could call agreement_public_accept(hash, ...) directly and record a client's legal
-- acceptance without ever holding the link.
--
-- Now the public functions take the secret and hash it here, so the stored hash is of no use to a caller: passing it
-- would hash it a second time and match nothing. The secret is exactly what newToken() makes: 43 URL-safe characters.
--
-- Deploy note: the app and this migration go out together. An older app sending a hash gets "not found" (it fails
-- closed) until it is updated.

drop function if exists public.agreement_public_view(text);
drop function if exists public.agreement_public_accept(text, text, text);

-- What the client sees at their link. Anyone holding the secret may call this; nothing else is exposed.
create function public.agreement_public_view(p_token text)
returns table (title text, version integer, body text, client_name text, accepted_at timestamptz, accepted_name text, expired boolean)
language sql stable security definer set search_path = '' as $$
  select t.title, t.version, t.body, c.name, a.accepted_at, a.accepted_name, (a.accepted_at is null and a.expires_at < now())
  from public.agreements_sent a
  join public.agreement_templates t on t.id = a.template_id
  join public.clients c on c.id = a.client_id
  where p_token ~ '^[A-Za-z0-9_-]{43}$'
    and a.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'utf8')), 'hex')
$$;

-- Accept once. Returns false when the link is unknown, expired, already used or the details are invalid.
create function public.agreement_public_accept(p_token text, p_name text, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return false; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 120 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(p_email) > 254 then return false; end if;
  update public.agreements_sent set accepted_at = now(), accepted_name = trim(p_name), accepted_email = lower(trim(p_email))
  where token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'utf8')), 'hex')
    and accepted_at is null and expires_at > now();
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke all on function public.agreement_public_view(text), public.agreement_public_accept(text, text, text) from public, anon, authenticated;
grant execute on function public.agreement_public_view(text), public.agreement_public_accept(text, text, text) to anon, authenticated;
