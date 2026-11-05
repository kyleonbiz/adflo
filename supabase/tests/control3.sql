-- Control Center step 3 tests: tickets, notes, timeline, reset targets, directory.
\set own '''00000000-0000-4000-8000-0000000000d1'''
\set sup '''00000000-0000-4000-8000-0000000000d2'''
\set bil '''00000000-0000-4000-8000-0000000000d3'''
\set cu '''00000000-0000-4000-8000-0000000000d5'''
\set ws '''00000000-0000-4000-8000-0000000000e1'''
reset role;
insert into auth.users (id, email) values (:own, 'own3@staff.test'), (:sup, 'sup3@staff.test'), (:bil, 'bil3@staff.test'), (:cu, 'member3@client.test');
insert into public.staff_members (user_id, role, display_name, email) values (:own, 'owner', 'Own3', 'own3@staff.test'), (:sup, 'support', 'Sup3', 'sup3@staff.test'), (:bil, 'billing', 'Bil3', 'bil3@staff.test');
insert into public.workspaces (id, name) values (:ws, 'Delta Workspace');
insert into public.workspace_members (workspace_id, user_id, role, email) values (:ws, :cu, 'editor', 'member3@client.test');
insert into public.clients (name, workspace_id, owner_email) values ('Delta Inc', :ws, 'boss@delta.test');

select t.as_staff(:sup::uuid);
select t.affected('support opens a ticket for a client', format($$insert into public.support_tickets (client_id, subject, body, priority, created_by) select id, 'Cannot upload', 'PDF fails', 'high', %L from public.clients where name = 'Delta Inc'$$, :sup::text), 1);
select t.fails('a ticket cannot claim another creator', format($$insert into public.support_tickets (subject, created_by) values ('x', %L)$$, :own::text));
select t.fails('a ticket cannot be assigned to a non-staff user', format($$update public.support_tickets set assignee = %L$$, :cu::text));
select t.affected('support assigns to a teammate', format($$update public.support_tickets set assignee = %L$$, :own::text), 1);
select t.affected('support adds a note', format($$insert into public.ticket_notes (ticket_id, author, body) select id, %L, 'Asked for the file' from public.support_tickets$$, :sup::text), 1);
select t.ok('note shows author email from the staff row', t.count($$select 1 from public.ticket_notes where author_email = 'sup3@staff.test'$$) = 1);
select t.fails('a note cannot be written as someone else', format($$insert into public.ticket_notes (ticket_id, author, body) select id, %L, 'x' from public.support_tickets$$, :own::text));
select t.fails('notes cannot be edited', $$update public.ticket_notes set body = 'changed'$$);
select t.fails('notes cannot be deleted', $$delete from public.ticket_notes$$);
select t.affected('support closes the ticket', $$update public.support_tickets set status = 'closed'$$, 1);
select t.fails('status must be a known value', $$update public.support_tickets set status = 'gone'$$);
select t.ok('support sees the directory of active staff', t.count('select 1 from public.control_staff_directory()') >= 3);
select t.ok('reset allowed for a client owner email', public.control_reset_target('Boss@Delta.test') is not null);
select t.ok('reset allowed for a workspace member', public.control_reset_target('member3@client.test') is not null);
select t.ok('reset refused for a stranger', public.control_reset_target('stranger@x.test') is null);
select public.control_log('password_reset.sent', 'password_reset', 'member3@client.test', '{"note":"test"}');

select t.as_staff(:bil::uuid);
select t.ok('billing reads tickets and notes', t.count('select 1 from public.support_tickets') = 1 and t.count('select 1 from public.ticket_notes') = 1);
select t.fails('billing cannot open a ticket', format($$insert into public.support_tickets (subject, created_by) values ('x', %L)$$, :bil::text));
select t.affected('billing cannot update a ticket', $$update public.support_tickets set priority = 'low'$$, 0);
select t.fails('billing cannot write the audit log', $$select public.control_log('x', 'y', 'z')$$, 'Not allowed');
select t.ok('billing sees no reset target', public.control_reset_target('boss@delta.test') is null);
select t.ok('timeline shows ticket activity for the client', t.count($$select 1 from public.control_client_timeline((select id from public.clients where name = 'Delta Inc'))$$) >= 2);

select t.as_staff(:own::uuid);
select t.ok('reset is in the audit log', t.count($$select 1 from public.staff_audit_log where action = 'password_reset.sent'$$) = 1);
select t.ok('ticket text is not copied into the audit log', t.count($$select 1 from public.staff_audit_log where entity like 'ticket%' and detail ? 'body'$$) = 0);

select t.as_staff(:own::uuid, 'aal1');
select t.ok('password-only session sees no tickets', t.count('select 1 from public.support_tickets') = 0);
select t.ok('...no timeline', t.count($$select 1 from public.control_client_timeline((select id from public.clients limit 1))$$) = 0);
reset role;
\echo ALL CONTROL3 TESTS PASSED
