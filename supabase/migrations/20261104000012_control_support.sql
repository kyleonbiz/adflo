-- Control Center step 3: support queue, notes, client timeline, logged password resets.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null default '' check (char_length(body) <= 5000),
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assignee uuid references public.staff_members (user_id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index support_tickets_client_idx on public.support_tickets (client_id);

-- Notes are a permanent record: they can be added but never edited or removed.
create table public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author uuid references auth.users (id) on delete set null,
  author_email text not null default '',
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index ticket_notes_ticket_idx on public.ticket_notes (ticket_id, created_at);

create or replace function public.tickets_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger support_tickets_touch before update on public.support_tickets for each row execute function public.tickets_touch();
create trigger support_tickets_audit after insert or update on public.support_tickets for each row execute function public.staff_audit_generic('ticket');
create trigger ticket_notes_audit after insert on public.ticket_notes for each row execute function public.staff_audit_generic('ticket_note');

-- The author's email is taken from their staff row, not from the request.
create or replace function public.ticket_notes_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.author_email := coalesce((select s.email from public.staff_members s where s.user_id = new.author), '');
  return new;
end $$;
revoke all on function public.ticket_notes_stamp() from public, anon, authenticated;
create trigger ticket_notes_stamp_trg before insert on public.ticket_notes for each row execute function public.ticket_notes_stamp();

alter table public.support_tickets enable row level security;
alter table public.ticket_notes enable row level security;
revoke all on public.support_tickets, public.ticket_notes from anon, authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.ticket_notes to authenticated;

create policy tickets_read on public.support_tickets for select to authenticated using (public.is_staff('billing'));
create policy tickets_insert on public.support_tickets for insert to authenticated with check (public.is_staff('support') and created_by = (select auth.uid()));
create policy tickets_update on public.support_tickets for update to authenticated using (public.is_staff('support')) with check (public.is_staff('support'));
create policy notes_read on public.ticket_notes for select to authenticated using (public.is_staff('billing'));
create policy notes_insert on public.ticket_notes for insert to authenticated with check (public.is_staff('support') and author = (select auth.uid()));

-- Names for the "assigned to" list: any staff can see who is on the team, without emails or roles being editable.
create or replace function public.control_staff_directory()
returns table (user_id uuid, display_name text, role text)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.display_name, s.role from public.staff_members s where s.active and public.is_staff('billing') order by s.display_name
$$;
revoke all on function public.control_staff_directory() from public, anon;
grant execute on function public.control_staff_directory() to authenticated;

-- One client's history: every logged change that names the client (audit rows carry client_id in their detail).
create or replace function public.control_client_timeline(p_client uuid)
returns table (at timestamptz, staff_email text, action text, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select l.created_at, l.staff_email, l.action, l.detail from public.staff_audit_log l
  where public.is_staff('billing') and (l.entity_id = p_client::text or l.detail ->> 'client_id' = p_client::text)
  order by l.created_at desc limit 100
$$;
revoke all on function public.control_client_timeline(uuid) from public, anon;
grant execute on function public.control_client_timeline(uuid) to authenticated;

-- Staff record an action that the database cannot see for itself (like sending a reset email).
create or replace function public.control_log(p_action text, p_entity text, p_entity_id text, p_detail jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff('support') then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), coalesce((select s.email from public.staff_members s where s.user_id = (select auth.uid())), ''),
          left(p_action, 60), left(p_entity, 40), left(p_entity_id, 200), coalesce(p_detail, '{}'));
end $$;
revoke all on function public.control_log(text, text, text, jsonb) from public, anon;
grant execute on function public.control_log(text, text, text, jsonb) to authenticated;

-- A reset email may go only to a client's owner or to a member of a client's workspace; returns that client's id.
create or replace function public.control_reset_target(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select c.id from public.clients c where lower(c.owner_email) = lower(trim(p_email)) limit 1),
    (select c.id from public.clients c join public.workspace_members m on m.workspace_id = c.workspace_id
      where lower(m.email) = lower(trim(p_email)) limit 1))
  where public.is_staff('support')
$$;
revoke all on function public.control_reset_target(text) from public, anon;
grant execute on function public.control_reset_target(text) to authenticated;
