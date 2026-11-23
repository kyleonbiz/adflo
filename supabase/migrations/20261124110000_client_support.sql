-- Client support: a workspace member opens a request from the app, AdFlo staff reply from the Control center, and both
-- sides see one conversation. Tickets get a number (AF-12), a category and the person who asked.
--
-- Clients never touch these tables. The tables stay staff-only (row level security, as before); a member reaches
-- their own workspace's requests only through the narrow functions below, which return just the fields a client
-- should see (no priority, assignee or internal notes).

-- "if not exists" because an earlier, unmerged take on this feature (branch stoic-ritchie) already added workspace_id,
-- source and requester_email to the shared database; this migration works on both that database and a fresh one.
alter table public.support_tickets
  add column if not exists ticket_no bigint generated always as identity,
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists category text not null default 'question' check (category in ('question', 'problem', 'request')),
  add column if not exists source text not null default 'staff' check (source in ('client', 'staff')),
  add column if not exists requester uuid references auth.users (id) on delete set null,
  add column if not exists requester_name text not null default '' check (char_length(requester_name) <= 120),
  add column if not exists requester_email text not null default '' check (char_length(requester_email) <= 320);
create unique index if not exists support_tickets_no_idx on public.support_tickets (ticket_no);
create index if not exists support_tickets_workspace_ticket_idx on public.support_tickets (workspace_id, created_at desc);

-- The conversation: replies from the client and from staff. Internal notes stay in ticket_notes, which clients never see.
create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_kind text not null check (author_kind in ('client', 'staff')),
  author uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- A staff reply is stamped with the staff member's own name, not one from the request.
create or replace function public.ticket_messages_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.author_kind = 'staff' then
    new.author_name := coalesce(nullif((select s.display_name from public.staff_members s where s.user_id = new.author), ''), 'AdFlo Support');
  end if;
  return new;
end $$;
revoke all on function public.ticket_messages_stamp() from public, anon, authenticated;
create trigger ticket_messages_stamp_trg before insert on public.ticket_messages for each row execute function public.ticket_messages_stamp();

-- A client reply puts the ticket back in the queue (open). A staff reply to an open ticket marks it waiting on the client.
create or replace function public.ticket_messages_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.support_tickets t
     set status = case when new.author_kind = 'client' then 'open' when t.status = 'open' then 'pending' else t.status end
   where t.id = new.ticket_id
     and t.status is distinct from case when new.author_kind = 'client' then 'open' when t.status = 'open' then 'pending' else t.status end;
  return new;
end $$;
revoke all on function public.ticket_messages_sync() from public, anon, authenticated;
create trigger ticket_messages_sync_trg after insert on public.ticket_messages for each row execute function public.ticket_messages_sync();

-- The staff audit log records staff actions only. What a client does is not a staff action.
drop trigger support_tickets_audit on public.support_tickets;
create trigger support_tickets_audit after insert or update on public.support_tickets for each row
  when (public.staff_role() is not null) execute function public.staff_audit_generic('ticket');
create trigger ticket_messages_audit after insert on public.ticket_messages for each row
  when (new.author_kind = 'staff') execute function public.staff_audit_generic('ticket_reply');

alter table public.ticket_messages enable row level security;
revoke all on public.ticket_messages from anon, authenticated;
grant select, insert on public.ticket_messages to authenticated;
create policy messages_read on public.ticket_messages for select to authenticated using (public.is_staff('billing'));
create policy messages_insert on public.ticket_messages for insert to authenticated
  with check (public.is_staff('support') and author_kind = 'staff' and author = (select auth.uid()));

-- Client side -----------------------------------------------------------------------------------------------------

-- The workspaces the caller belongs to, as a one-column set (used by the functions below).
create or replace function public.support_my_workspaces()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
$$;
revoke all on function public.support_my_workspaces() from public, anon;
grant execute on function public.support_my_workspaces() to authenticated;

-- Every request from the caller's workspace, newest first, with when it last moved.
create or replace function public.support_my_tickets()
returns table (id uuid, ticket_no bigint, subject text, category text, status text, created_at timestamptz, last_activity timestamptz, requester_name text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.ticket_no, t.subject, t.category, t.status, t.created_at,
         coalesce((select max(m.created_at) from public.ticket_messages m where m.ticket_id = t.id), t.created_at), t.requester_name
  from public.support_tickets t
  where t.workspace_id in (select public.support_my_workspaces())
  order by t.created_at desc limit 200
$$;
revoke all on function public.support_my_tickets() from public, anon;
grant execute on function public.support_my_tickets() to authenticated;

-- One request with its conversation; null when it is not the caller's workspace's.
create or replace function public.support_ticket(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.support_tickets;
begin
  select * into t from public.support_tickets x where x.id = p_id and x.workspace_id in (select public.support_my_workspaces());
  if not found then return null; end if;
  return jsonb_build_object(
    'id', t.id, 'ticket_no', t.ticket_no, 'subject', t.subject, 'body', t.body, 'category', t.category, 'status', t.status,
    'created_at', t.created_at, 'requester_name', t.requester_name,
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'author_kind', m.author_kind, 'author_name', m.author_name, 'body', m.body, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
                 from public.ticket_messages m where m.ticket_id = t.id));
end $$;
revoke all on function public.support_ticket(uuid) from public, anon;
grant execute on function public.support_ticket(uuid) to authenticated;

-- Opens a request for the caller's workspace. At most 10 an hour per person, so a stuck script cannot flood the queue.
create or replace function public.support_create_ticket(p_subject text, p_body text, p_category text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); mem record; subj text := trim(coalesce(p_subject, '')); bod text := trim(coalesce(p_body, '')); tid uuid;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if char_length(subj) not between 1 and 200 or char_length(bod) not between 1 and 5000 or p_category not in ('question', 'problem', 'request') then
    raise exception 'invalid' using errcode = '22023';
  end if;
  select m.workspace_id, m.display_name, m.email into mem from public.workspace_members m where m.user_id = uid order by m.created_at limit 1;
  if not found then raise exception 'not_a_member' using errcode = '42501'; end if;
  if (select count(*) from public.support_tickets x where x.requester = uid and x.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.support_tickets (client_id, workspace_id, subject, body, category, source, requester, requester_name, requester_email)
  values ((select c.id from public.clients c where c.workspace_id = mem.workspace_id order by c.created_at limit 1), mem.workspace_id, subj, bod, p_category, 'client', uid,
          left(coalesce(mem.display_name, ''), 120), left(coalesce(mem.email, (select u.email from auth.users u where u.id = uid), ''), 320))
  returning id into tid;
  return tid;
end $$;
revoke all on function public.support_create_ticket(text, text, text) from public, anon;
grant execute on function public.support_create_ticket(text, text, text) to authenticated;

-- A reply from the client. It reopens a waiting or closed request (see ticket_messages_sync).
create or replace function public.support_reply(p_id uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); bod text := trim(coalesce(p_body, '')); nm text;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if char_length(bod) not between 1 and 5000 then raise exception 'invalid' using errcode = '22023'; end if;
  if not exists (select 1 from public.support_tickets t where t.id = p_id and t.workspace_id in (select public.support_my_workspaces())) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.ticket_messages m where m.author = uid and m.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select left(coalesce(m.display_name, ''), 120) into nm from public.workspace_members m
    join public.support_tickets t on t.workspace_id = m.workspace_id where t.id = p_id and m.user_id = uid limit 1;
  insert into public.ticket_messages (ticket_id, author_kind, author, author_name, body) values (p_id, 'client', uid, coalesce(nm, ''), bod);
end $$;
revoke all on function public.support_reply(uuid, text) from public, anon;
grant execute on function public.support_reply(uuid, text) to authenticated;

-- "This is sorted" (close) or "it is not fixed" (reopen), from the client.
create or replace function public.support_set_closed(p_id uuid, p_closed boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  update public.support_tickets t set status = case when p_closed then 'closed' else 'open' end
   where t.id = p_id and t.workspace_id in (select public.support_my_workspaces());
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.support_set_closed(uuid, boolean) from public, anon;
grant execute on function public.support_set_closed(uuid, boolean) to authenticated;
