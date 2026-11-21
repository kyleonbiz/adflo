-- Client support tests: a member opens and follows their own requests; staff replies reach them; internal notes never do.
\set mem '''00000000-0000-4000-8000-00000000c501'''
\set oth '''00000000-0000-4000-8000-00000000c502'''
\set sup '''00000000-0000-4000-8000-00000000c503'''
\set loner '''00000000-0000-4000-8000-00000000c504'''
\set ws '''00000000-0000-4000-8000-00000000c505'''
\set ws2 '''00000000-0000-4000-8000-00000000c506'''
reset role;
insert into auth.users (id, email) values (:mem, 'mem-cs@client.test'), (:oth, 'oth-cs@client.test'), (:sup, 'sup-cs@staff.test'), (:loner, 'loner-cs@client.test');
insert into public.staff_members (user_id, role, display_name, email) values (:sup, 'support', 'SupCs', 'sup-cs@staff.test');
insert into public.workspaces (id, name) values (:ws, 'Support WS'), (:ws2, 'Other WS');
insert into public.workspace_members (workspace_id, user_id, role, email) values (:ws, :mem, 'owner', 'mem-cs@client.test'), (:ws2, :oth, 'owner', 'oth-cs@client.test');
insert into public.clients (name, workspace_id) values ('Support Client', :ws);

select t.as_user(:loner::uuid);
select t.fails('someone with no workspace cannot open a request', $$select public.workspace_submit_ticket('Help', 'x')$$);

select t.as_user(:mem::uuid);
select t.ok('a member opens a request', public.workspace_submit_ticket('Support help me', 'PDF fails', true) is not null);
select t.fails('a request needs a subject', $$select public.workspace_submit_ticket('  ', 'x')$$);
select t.ok('their request shows in their list', t.count($$select 1 from public.workspace_my_tickets() where subject = 'Support help me'$$) = 1);
select t.ok('the tables are closed to clients', t.count('select 1 from public.support_tickets') = 0 and t.count('select 1 from public.ticket_notes') = 0);
select t.fails('a client cannot insert a ticket directly', $$insert into public.support_tickets (subject) values ('x')$$);

reset role;
select t.ok('the ticket is linked to the client, marked urgent and from the client', t.count($$select 1 from public.support_tickets t join public.clients c on c.id = t.client_id where c.name = 'Support Client' and t.priority = 'high' and t.source = 'client' and t.requester_email = 'mem-cs@client.test'$$) = 1);

select t.as_staff(:sup::uuid);
select t.affected('staff adds an internal note', format($$insert into public.ticket_notes (ticket_id, author, body) select id, %L, 'internal only' from public.support_tickets where subject = 'Support help me'$$, :sup::text), 1);
select t.affected('staff replies to the client', format($$insert into public.ticket_notes (ticket_id, author, body, to_client) select id, %L, 'Try again now', true from public.support_tickets where subject = 'Support help me'$$, :sup::text), 1);
select t.fails('staff cannot fake a client message', format($$insert into public.ticket_notes (ticket_id, author, body, from_client) select id, %L, 'x', true from public.support_tickets$$, :sup::text));
select t.affected('staff waits on the client', $$update public.support_tickets set status = 'pending' where subject = 'Support help me'$$, 1);

select t.as_user(:mem::uuid);
select t.ok('the client sees the reply but not the internal note', t.count($$select 1 from public.workspace_ticket_messages((select id from public.workspace_my_tickets() limit 1))$$) = 1);
select t.ok('the reply is shown as AdFlo support', t.count($$select 1 from public.workspace_ticket_messages((select id from public.workspace_my_tickets() limit 1)) where author = 'AdFlo support' and body = 'Try again now'$$) = 1);
select public.workspace_ticket_reply((select id from public.workspace_my_tickets() limit 1), 'Still failing');
select t.ok('the client answered back', t.count($$select 1 from public.workspace_ticket_messages((select id from public.workspace_my_tickets() limit 1)) where from_client and author = 'You'$$) = 1);
select t.ok('their answer reopens the request', t.count($$select 1 from public.workspace_my_tickets() where status = 'open'$$) = 1);
select t.fails('an empty message is refused', $$select public.workspace_ticket_reply((select id from public.workspace_my_tickets() limit 1), '  ')$$);

select t.as_user(:oth::uuid);
select t.ok('another client sees none of it', t.count('select 1 from public.workspace_my_tickets()') = 0);
select t.fails('another client cannot reply on it', $$select public.workspace_ticket_reply((select id from public.support_tickets limit 1), 'hi')$$);
select t.ok('another client cannot read the messages', t.count($$select 1 from public.workspace_ticket_messages((select id from public.support_tickets limit 1))$$) = 0);

select t.as_user(:mem::uuid);
select t.ok('six requests in an hour is too many', (select count(*) from (select public.workspace_submit_ticket('Ask ' || g, '') from generate_series(1, 4) g) x) = 4);
select t.fails('the sixth is refused', $$select public.workspace_submit_ticket('One more', '')$$, 'Too many');

select t.as_anon();
select t.fails('anonymous cannot open a request', $$select public.workspace_submit_ticket('x', 'y')$$);
reset role;
\echo ALL CLIENT SUPPORT TESTS PASSED
