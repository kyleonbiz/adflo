-- Client support tests: a member opens requests, staff reply, both see one conversation, nobody else sees it.
\set sup '''00000000-0000-4000-8000-0000000005a1'''
\set bil '''00000000-0000-4000-8000-0000000005a2'''
\set alice '''00000000-0000-4000-8000-0000000005a3'''
\set bob '''00000000-0000-4000-8000-0000000005a4'''
\set carol '''00000000-0000-4000-8000-0000000005a5'''
\set ws1 '''00000000-0000-4000-8000-0000000005a6'''
\set ws2 '''00000000-0000-4000-8000-0000000005a7'''
reset role;
insert into auth.users (id, email) values (:sup, 'sup@support.test'), (:bil, 'bil@support.test'), (:alice, 'alice@one.test'), (:bob, 'bob@one.test'), (:carol, 'carol@two.test');
insert into public.staff_members (user_id, role, display_name, email) values (:sup, 'support', 'Sam Support', 'sup@support.test'), (:bil, 'billing', 'Bea Billing', 'bil@support.test');
insert into public.workspaces (id, name) values (:ws1, 'One Roofing'), (:ws2, 'Two Plumbing');
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values
  (:ws1, :alice, 'owner', 'Alice', 'alice@one.test'), (:ws1, :bob, 'editor', 'Bob', 'bob@one.test'), (:ws2, :carol, 'owner', 'Carol', 'carol@two.test');
insert into public.clients (name, workspace_id, owner_email) values ('One Roofing', :ws1, 'alice@one.test');

-- A member opens a request.
select t.as_user(:alice::uuid);
select t.ok('member opens a request', public.support_create_ticket('Cannot upload', 'The PDF fails', 'problem') is not null);
select t.fails('a request needs a subject', $$select public.support_create_ticket('  ', 'x', 'question')$$, 'invalid');
select t.fails('a request needs details', $$select public.support_create_ticket('x', '', 'question')$$, 'invalid');
select t.fails('the category must be known', $$select public.support_create_ticket('x', 'y', 'bug')$$, 'invalid');
select t.ok('the member sees it with a number', t.count($$select 1 from public.support_my_tickets() where subject = 'Cannot upload' and ticket_no is not null and status = 'open' and category = 'problem'$$) = 1);
select t.ok('clients cannot read the table (no rows)', t.count('select 1 from public.support_tickets') = 0);
select t.fails('clients cannot write a ticket directly', $$insert into public.support_tickets (subject) values ('x')$$);
select t.fails('clients cannot write a staff message', $$insert into public.ticket_messages (ticket_id, author_kind, body) values (gen_random_uuid(), 'staff', 'x')$$);

-- A teammate in the same workspace sees it; another workspace does not.
select t.as_user(:bob::uuid);
select t.ok('a teammate sees the workspace request', t.count('select 1 from public.support_my_tickets()') = 1);
select t.as_user(:carol::uuid);
select t.ok('another workspace sees nothing', t.count('select 1 from public.support_my_tickets()') = 0);
select t.as_user(:alice::uuid);

-- Staff see it as a client request linked to the client record.
select t.as_staff(:sup::uuid);
select t.ok('staff sees the client request', t.count($$select 1 from public.support_tickets where source = 'client' and requester_email = 'alice@one.test' and workspace_id = '00000000-0000-4000-8000-0000000005a6' and client_id is not null$$) = 1);
select t.affected('staff replies to the client', $$insert into public.ticket_messages (ticket_id, author_kind, author, body) select id, 'staff', '00000000-0000-4000-8000-0000000005a1', 'Send the file over' from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6'$$, 1);
select t.ok('the reply carries the staff name', t.count($$select 1 from public.ticket_messages where author_name = 'Sam Support'$$) = 1);
select t.ok('a staff reply marks the open ticket waiting on the client', t.count($$select 1 from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6' and status = 'pending'$$) = 1);
select t.fails('a staff reply cannot be posted as someone else', $$insert into public.ticket_messages (ticket_id, author_kind, author, body) select id, 'staff', '00000000-0000-4000-8000-0000000005a2', 'x' from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6'$$);
select t.fails('staff cannot post as the client', $$insert into public.ticket_messages (ticket_id, author_kind, author, body) select id, 'client', '00000000-0000-4000-8000-0000000005a1', 'x' from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6'$$);
reset role;
select t.ok('the staff reply is in the audit log without its text', t.count($$select 1 from public.staff_audit_log where entity = 'ticket_reply' and not (detail ? 'body')$$) = 1);
select t.as_staff(:sup::uuid);

-- The client sees the conversation, and replying puts the ticket back in the queue.
select t.as_user(:alice::uuid);
select t.ok('the client sees the staff reply', jsonb_array_length(public.support_ticket((select id from public.support_my_tickets() limit 1)) -> 'messages') = 1);
select t.ok('the client view hides priority, assignee and notes', not (public.support_ticket((select id from public.support_my_tickets() limit 1)) ?| array['priority', 'assignee', 'notes']));
select t.affected('the client replies', $$select public.support_reply((select id from public.support_my_tickets() limit 1), 'Attached')$$, 1);
select t.as_staff(:sup::uuid);
select t.ok('a client reply reopens the ticket', t.count($$select 1 from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6' and status = 'open'$$) = 1);
reset role;
select t.ok('client activity is not in the staff audit log', t.count($$select 1 from public.staff_audit_log where staff_email = '' and entity like 'ticket%'$$) = 0);
select t.as_staff(:sup::uuid);

-- Closing and reopening from the client; other workspaces cannot reach it.
select t.as_user(:bob::uuid);
select t.affected('a teammate closes it', $$select public.support_set_closed((select id from public.support_my_tickets() limit 1), true)$$, 1);
select t.as_staff(:sup::uuid);
select t.ok('it shows closed in the queue', t.count($$select 1 from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6' and status = 'closed'$$) = 1);
select t.affected('a staff reply to a closed ticket leaves it closed', $$insert into public.ticket_messages (ticket_id, author_kind, author, body) select id, 'staff', '00000000-0000-4000-8000-0000000005a1', 'Glad that is sorted' from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6'$$, 1);
select t.ok('...still closed', t.count($$select 1 from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6' and status = 'closed'$$) = 1);
reset role;
select id as tid from public.support_tickets where workspace_id = :ws1 \gset
select t.as_user(:carol::uuid);
select t.fails('another workspace cannot reply', format($$select public.support_reply(%L, 'x')$$, :'tid'), 'not_found');
select t.fails('another workspace cannot close', format($$select public.support_set_closed(%L, true)$$, :'tid'), 'not_found');
select t.ok('another workspace still sees nothing of it', public.support_ticket(:'tid'::uuid) is null);
select t.as_user(:alice::uuid);
select t.affected('the client reopens it', $$select public.support_set_closed((select id from public.support_my_tickets() limit 1), false)$$, 1);
select t.ok('...it is open again', t.count($$select 1 from public.support_my_tickets() where status = 'open'$$) = 1);

-- Staff-made tickets stay internal; billing staff read but do not reply; clients are rate limited.
select t.as_staff(:sup::uuid);
select t.affected('staff logs an internal ticket', $$insert into public.support_tickets (subject, created_by) values ('Phone call', '00000000-0000-4000-8000-0000000005a1')$$, 1);
select t.as_user(:alice::uuid);
select t.ok('an internal ticket is not shown to the client', t.count($$select 1 from public.support_my_tickets() where subject = 'Phone call'$$) = 0);
select t.as_staff(:bil::uuid);
select t.ok('billing staff read the conversation', t.count('select 1 from public.ticket_messages') = 3);
select t.fails('billing staff cannot reply', $$insert into public.ticket_messages (ticket_id, author_kind, author, body) select id, 'staff', '00000000-0000-4000-8000-0000000005a2', 'x' from public.support_tickets where workspace_id = '00000000-0000-4000-8000-0000000005a6'$$);
select t.as_user(:carol::uuid);
select t.ok('carol opens requests up to the hourly limit', (select count(public.support_create_ticket('Q' || g, 'details', 'question')) from generate_series(1, 10) g) = 10);
select t.fails('the 11th request in an hour is refused', $$select public.support_create_ticket('one more', 'details', 'question')$$, 'rate_limited');
select t.as_user('00000000-0000-4000-8000-0000000005ab'::uuid);
select t.fails('someone with no workspace cannot open a request', $$select public.support_create_ticket('x', 'y', 'question')$$, 'not_a_member');
select t.as_anon();
select t.fails('signed-out visitors cannot call the support functions', $$select * from public.support_my_tickets()$$);
reset role;
\echo ALL SUPPORT TESTS PASSED
