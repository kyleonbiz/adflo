-- Client support: a signed-in workspace member can ask for help from inside AdFlo, see their own requests and AdFlo's
-- replies, and answer back. Staff keep working in the Control center queue; their internal notes stay internal, and
-- only a note marked "to client" is ever shown to the client.
-- Clients never touch the tables. Everything goes through the functions below, which only look at the caller's own
-- requests and only run for a member of a workspace.

alter table public.support_tickets
  add column workspace_id uuid references public.workspaces (id) on delete set null,
  add column requested_by uuid references auth.users (id) on delete set null,
  add column requester_email text not null default '',
  add column source text not null default 'staff' check (source in ('staff', 'client'));
create index support_tickets_requester_idx on public.support_tickets (requested_by) where requested_by is not null;
create index support_tickets_workspace_idx on public.support_tickets (workspace_id) where workspace_id is not null;

alter table public.ticket_notes
  add column to_client boolean not null default false,
  add column from_client boolean not null default false,
  add check (not (to_client and from_client));

-- Staff notes take the author's email from their staff row; a client's reply keeps the email it was sent from.
create or replace function public.ticket_notes_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.from_client then
    new.author_email := coalesce((select s.email from public.staff_members s where s.user_id = new.author), '');
  end if;
  return new;
end $$;

-- A staff member can never write a note that looks like it came from the client.
drop policy notes_insert on public.ticket_notes;
create policy notes_insert on public.ticket_notes for insert to authenticated
  with check (public.is_staff('support') and author = (select auth.uid()) and not from_client);

-- Open a request. Returns the new ticket's id. A few an hour is plenty; more is a loop or a bot.
create or replace function public.workspace_submit_ticket(p_subject text, p_body text, p_urgent boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); ws uuid; em text; cid uuid; tid uuid; subj text := btrim(coalesce(p_subject, ''));
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select m.workspace_id, coalesce(nullif(m.email, ''), (select u.email from auth.users u where u.id = uid), '') into ws, em
    from public.workspace_members m where m.user_id = uid order by m.created_at limit 1;
  if ws is null then raise exception 'Not a member of a workspace' using errcode = '42501'; end if;
  if char_length(subj) not between 1 and 200 then raise exception 'Enter a subject (up to 200 characters).' using errcode = '22023'; end if;
  if char_length(coalesce(p_body, '')) > 5000 then raise exception 'Keep the details under 5,000 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.support_tickets t where t.requested_by = uid and t.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests just now. Please wait a little and try again.' using errcode = '54000';
  end if;
  select c.id into cid from public.clients c where c.workspace_id = ws limit 1;
  insert into public.support_tickets (client_id, workspace_id, subject, body, priority, requested_by, requester_email, source)
  values (cid, ws, subj, btrim(coalesce(p_body, '')), case when p_urgent then 'high' else 'normal' end, uid, em, 'client')
  returning id into tid;
  return tid;
end $$;

-- The caller's own requests, newest first.
create or replace function public.workspace_my_tickets()
returns table (id uuid, subject text, body text, status text, created_at timestamptz, updated_at timestamptz, replies bigint)
language sql stable security definer set search_path = '' as $$
  select t.id, t.subject, t.body, t.status, t.created_at, t.updated_at,
         (select count(*) from public.ticket_notes n where n.ticket_id = t.id and n.to_client)
  from public.support_tickets t
  where t.requested_by = (select auth.uid()) and t.source = 'client'
  order by t.created_at desc limit 50
$$;

-- The conversation on one of the caller's requests: AdFlo's replies and their own follow-ups, never internal notes.
create or replace function public.workspace_ticket_messages(p_ticket uuid)
returns table (id uuid, from_client boolean, author text, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.from_client, case when n.from_client then 'You' else 'AdFlo support' end, n.body, n.created_at
  from public.ticket_notes n join public.support_tickets t on t.id = n.ticket_id
  where n.ticket_id = p_ticket and t.requested_by = (select auth.uid()) and t.source = 'client' and (n.to_client or n.from_client)
  order by n.created_at
$$;

-- Answer back on one of their own requests. A reply reopens a closed request or one that was waiting on them.
create or replace function public.workspace_ticket_reply(p_ticket uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); t public.support_tickets; b text := btrim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into t from public.support_tickets x where x.id = p_ticket and x.requested_by = uid and x.source = 'client' for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if char_length(b) not between 1 and 5000 then raise exception 'Write a message (up to 5,000 characters).' using errcode = '22023'; end if;
  if (select count(*) from public.ticket_notes n where n.ticket_id = p_ticket and n.from_client and n.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many messages just now. Please wait a little and try again.' using errcode = '54000';
  end if;
  insert into public.ticket_notes (ticket_id, author, author_email, body, from_client) values (p_ticket, uid, t.requester_email, b, true);
  if t.status <> 'open' then update public.support_tickets set status = 'open' where id = p_ticket; end if;
end $$;

revoke all on function public.workspace_submit_ticket(text, text, boolean), public.workspace_my_tickets(),
  public.workspace_ticket_messages(uuid), public.workspace_ticket_reply(uuid, text) from public, anon;
grant execute on function public.workspace_submit_ticket(text, text, boolean), public.workspace_my_tickets(),
  public.workspace_ticket_messages(uuid), public.workspace_ticket_reply(uuid, text) to authenticated;
