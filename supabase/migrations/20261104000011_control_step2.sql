-- Control Center step 2: onboarding checklist, plans and pricing, seat usage, staff team management.

-- A generic audit trigger for staff-managed tables: TG_ARGV[0] is the entity name. Updates log only the changed
-- columns (long text and secrets are left out). client_id is kept in the detail so a client's timeline can find it.
create or replace function public.staff_audit_generic()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  who text := coalesce((select s.email from public.staff_members s where s.user_id = (select auth.uid())), '');
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  d jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into d
    from jsonb_each(to_jsonb(new)) n where n.value is distinct from to_jsonb(old) -> n.key;
    if d = '{}'::jsonb then return new; end if;
    d := d || case when r ? 'client_id' then jsonb_build_object('client_id', r -> 'client_id') else '{}'::jsonb end;
  else
    d := r;
  end if;
  d := d - 'body' - 'notes' - 'token_hash' - 'updated_at' - 'created_at';
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), who, tg_argv[0] || '.' || lower(tg_op), tg_argv[0],
          coalesce(r ->> 'id', r ->> 'user_id', (r ->> 'client_id') || '/' || (r ->> 'step'), ''), d);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.staff_audit_generic() from public, anon, authenticated;

-- Plans and pricing (owner edits; every staff member reads) -----------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  price_cents integer not null default 0 check (price_cents between 0 and 100000000),
  seats_included integer not null default 3 check (seats_included between 0 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index plans_name_idx on public.plans (lower(name));
insert into public.plans (name, price_cents, seats_included) values ('standard', 0, 3);

alter table public.clients
  add column price_override_cents integer check (price_override_cents is null or price_override_cents between 0 and 100000000),
  add column price_note text not null default '' check (char_length(price_note) <= 200);

-- Only the Owner sets a client's own price.
create or replace function public.clients_guard_price()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and (new.price_override_cents is not null or new.price_note <> ''))
     or (tg_op = 'UPDATE' and (new.price_override_cents is distinct from old.price_override_cents or new.price_note is distinct from old.price_note)) then
    if not public.is_staff('owner') then raise exception 'Only the Owner can set a client price' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
revoke all on function public.clients_guard_price() from public, anon, authenticated;
create trigger clients_guard_price_trg before insert or update on public.clients for each row execute function public.clients_guard_price();

-- Log price overrides too (adds to the step 1 trigger).
create or replace function public.clients_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  who text := coalesce((select s.email from public.staff_members s where s.user_id = (select auth.uid())), '');
  d jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    d := jsonb_build_object('name', new.name, 'status', new.status, 'plan', new.plan, 'seats_limit', new.seats_limit, 'client_id', new.id);
    insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
    values ((select auth.uid()), who, 'client.created', 'client', new.id::text, d);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then d := d || jsonb_build_object('status', jsonb_build_array(old.status, new.status)); end if;
    if new.plan is distinct from old.plan then d := d || jsonb_build_object('plan', jsonb_build_array(old.plan, new.plan)); end if;
    if new.seats_limit is distinct from old.seats_limit then d := d || jsonb_build_object('seats_limit', jsonb_build_array(old.seats_limit, new.seats_limit)); end if;
    if new.name is distinct from old.name then d := d || jsonb_build_object('name', jsonb_build_array(old.name, new.name)); end if;
    if new.owner_email is distinct from old.owner_email then d := d || jsonb_build_object('owner_email', jsonb_build_array(old.owner_email, new.owner_email)); end if;
    if new.price_override_cents is distinct from old.price_override_cents then d := d || jsonb_build_object('price_override_cents', jsonb_build_array(old.price_override_cents, new.price_override_cents)); end if;
    if new.notes is distinct from old.notes then d := d || jsonb_build_object('notes', 'edited'); end if;
    new.updated_at := now();
    if d <> '{}'::jsonb then
      d := d || jsonb_build_object('client_id', new.id);
      insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
      values ((select auth.uid()), who, case when new.status is distinct from old.status then 'client.status_changed' else 'client.updated' end, 'client', new.id::text, d);
    end if;
    return new;
  else
    insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
    values ((select auth.uid()), who, 'client.deleted', 'client', old.id::text, jsonb_build_object('name', old.name));
    return old;
  end if;
end $$;

-- Onboarding checklist: a row means the step is done -------------------------------------------
create table public.client_checklist (
  client_id uuid not null references public.clients (id) on delete cascade,
  step text not null check (step in ('workspace', 'owner_invited', 'agreement_sent', 'plan_set', 'first_login')),
  done_at timestamptz not null default now(),
  done_by uuid references auth.users (id) on delete set null,
  primary key (client_id, step)
);

-- Seats in use and last activity per client. Staff cannot read workspace_members or auth.users directly;
-- this function returns only these three figures, and only to staff with the second factor.
create or replace function public.control_client_usage()
returns table (client_id uuid, seats_used bigint, last_active timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, count(m.user_id), max(u.last_sign_in_at)
  from public.clients c
  left join public.workspace_members m on m.workspace_id = c.workspace_id
  left join auth.users u on u.id = m.user_id
  where public.is_staff('billing')
  group by c.id
$$;
revoke all on function public.control_client_usage() from public, anon;
grant execute on function public.control_client_usage() to authenticated;

-- Staff team ---------------------------------------------------------------------------------
-- The last active Owner can never be demoted, deactivated or removed.
create or replace function public.staff_guard_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and old.active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.active)
     and not exists (select 1 from public.staff_members s where s.role = 'owner' and s.active and s.user_id <> old.user_id) then
    raise exception 'There must always be one active Owner' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.staff_guard_last_owner() from public, anon, authenticated;
create trigger staff_guard_last_owner_trg before update or delete on public.staff_members for each row execute function public.staff_guard_last_owner();

-- Owner adds a person by email. The person must already have signed up; the owner never sees other account data.
create or replace function public.control_add_staff(p_email text, p_role text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_staff('owner') then raise exception 'Only the Owner manages staff' using errcode = '42501'; end if;
  if p_role not in ('owner', 'support', 'billing') then raise exception 'Unknown role' using errcode = '22023'; end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(p_email));
  if uid is null then raise exception 'No account with that email yet. They need to sign up first.' using errcode = 'P0002'; end if;
  insert into public.staff_members (user_id, role, display_name, email, active)
  values (uid, p_role, left(coalesce(nullif(trim(p_name), ''), split_part(p_email, '@', 1)), 80), lower(trim(p_email)), true)
  on conflict (user_id) do update set role = excluded.role, active = true, display_name = excluded.display_name;
  return uid;
end $$;
revoke all on function public.control_add_staff(text, text, text) from public, anon;
grant execute on function public.control_add_staff(text, text, text) to authenticated;

create trigger plans_audit after insert or update or delete on public.plans for each row execute function public.staff_audit_generic('plan');
create trigger checklist_audit after insert or delete on public.client_checklist for each row execute function public.staff_audit_generic('checklist');
create trigger staff_audit after insert or update or delete on public.staff_members for each row execute function public.staff_audit_generic('staff');

alter table public.plans enable row level security;
alter table public.client_checklist enable row level security;
revoke all on public.plans, public.client_checklist from anon, authenticated;
grant select, insert, update on public.plans to authenticated;
grant select, insert, delete on public.client_checklist to authenticated;
grant insert, update on public.staff_members to authenticated;

create policy plans_read on public.plans for select to authenticated using (public.is_staff('billing'));
create policy plans_insert on public.plans for insert to authenticated with check (public.is_staff('owner'));
create policy plans_update on public.plans for update to authenticated using (public.is_staff('owner')) with check (public.is_staff('owner'));
create policy checklist_read on public.client_checklist for select to authenticated using (public.is_staff('billing'));
create policy checklist_insert on public.client_checklist for insert to authenticated with check (public.is_staff('support') and done_by = (select auth.uid()));
create policy checklist_delete on public.client_checklist for delete to authenticated using (public.is_staff('support'));
create policy staff_owner_write on public.staff_members for update to authenticated using (public.is_staff('owner')) with check (public.is_staff('owner'));
create policy staff_owner_insert on public.staff_members for insert to authenticated with check (public.is_staff('owner'));
