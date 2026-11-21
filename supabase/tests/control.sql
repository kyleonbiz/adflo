-- Control Center tests: run after rls.sql by run.sh (reuses the t.* helpers it defines).
\set sam '''00000000-0000-4000-8000-0000000000a1'''
\set sue '''00000000-0000-4000-8000-0000000000a2'''
\set bill '''00000000-0000-4000-8000-0000000000a3'''
\set cli '''00000000-0000-4000-8000-0000000000a4'''
create function t.as_staff(u uuid, level text default 'aal2') returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'aal', level)::text, false);
  set role authenticated;
end $$;
grant execute on function t.as_staff(uuid, text) to public;
reset role;
insert into auth.users (id, email) values (:sam, 'sam@staff.test'), (:sue, 'sue@staff.test'), (:bill, 'bill@staff.test'), (:cli, 'client@c.test');
insert into public.staff_members (user_id, role, display_name, email) values
  (:sam, 'owner', 'Sam', 'sam@staff.test'), (:sue, 'support', 'Sue', 'sue@staff.test'), (:bill, 'billing', 'Bill', 'bill@staff.test');

select t.as_user(:cli::uuid);
select t.ok('client user cannot read clients', t.count('select 1 from public.clients') = 0);
select t.ok('client user cannot read staff', t.count('select 1 from public.staff_members') = 0);
select t.ok('client user cannot read audit log', t.count('select 1 from public.staff_audit_log') = 0);
select t.fails('client user cannot create a client', $$insert into public.clients (name) values ('Nope Co')$$);
select t.as_staff(:sam::uuid, 'aal1');
select t.ok('owner with only a password sees no clients', t.count('select 1 from public.clients') = 0);
select t.ok('...nor the audit log', t.count('select 1 from public.staff_audit_log') = 0);
select t.ok('...but can read their own staff row to be asked for a code', t.count('select 1 from public.staff_members') = 1);
select t.fails('...and cannot create a client', $$insert into public.clients (name) values ('Sneaky Co')$$);
select t.as_anon();
select t.fails('anon cannot read clients', 'select 1 from public.clients');

select t.as_staff(:sue::uuid);
select t.affected('support creates a client', $$insert into public.clients (name, plan, seats_limit) values ('Acme Roofing', 'standard', 5)$$, 1);
select t.affected('support suspends a client', $$update public.clients set status = 'suspended' where name = 'Acme Roofing'$$, 1);
select t.fails('support cannot delete a client', $$delete from public.clients$$);
select t.ok('support cannot read the audit log', t.count('select 1 from public.staff_audit_log') = 0);
select t.ok('support sees only their own staff row', t.count('select 1 from public.staff_members') = 1);
select t.fails('seat limit cannot be negative', $$update public.clients set seats_limit = -1$$);

select t.as_staff(:bill::uuid);
select t.ok('billing can read clients', t.count('select 1 from public.clients') = 1);
select t.affected('billing cannot edit a client', $$update public.clients set plan = 'pro'$$, 0);
select t.fails('billing cannot create a client', $$insert into public.clients (name) values ('Other Co')$$);

select t.as_staff(:sam::uuid);
select t.ok('owner reads the audit log', t.count($$select 1 from public.staff_audit_log where entity = 'client'$$) = 2);
select t.ok('audit records who suspended', t.count($$select 1 from public.staff_audit_log where action = 'client.status_changed' and staff_email = 'sue@staff.test'$$) = 1);
select t.fails('nobody writes the audit log directly', $$insert into public.staff_audit_log (action, entity) values ('x', 'y')$$);
select t.ok('owner sees all staff', t.count('select 1 from public.staff_members') = 3);

reset role;
update public.staff_members set active = false where user_id = :sue;
select t.as_staff(:sue::uuid);
select t.ok('deactivated staff lose access', t.count('select 1 from public.clients') = 0);
reset role;
\echo ALL CONTROL TESTS PASSED

-- Workspace linking and one-click provisioning ------------------------------------------------------------
\set own '''7a000000-0000-4000-8000-0000000000b1'''
\set late '''7a000000-0000-4000-8000-0000000000b2'''
reset role;
update public.staff_members set active = true where user_id = :sue;
insert into auth.users (id, email) values (:own, 'owner@acme.test'), (:late, 'late@acme.test');
-- a client who already made their own workspace
insert into public.workspaces (id, name, created_by) values ('7a000000-0000-4000-8000-0000000000c1', 'Self Made Co', :own);
insert into public.workspace_members (workspace_id, user_id, role, email) values ('7a000000-0000-4000-8000-0000000000c1', :own, 'owner', 'owner@acme.test');
insert into public.clients (id, name, owner_email) values
  ('7a000000-0000-4000-8000-0000000000d1', 'Self Made Co', 'owner@acme.test'),
  ('7a000000-0000-4000-8000-0000000000d2', 'Fresh Co', 'late@acme.test'),
  ('7a000000-0000-4000-8000-0000000000d3', 'No Email Co', '');

select t.as_staff(:sue::uuid, 'aal1');
select t.ok('password-only staff are shown no workspaces', t.count('select 1 from public.control_unlinked_workspaces()') = 0);
select t.fails('...and cannot link one', $$select public.control_link_workspace('7a000000-0000-4000-8000-0000000000d1', '7a000000-0000-4000-8000-0000000000c1')$$, 'forbidden');
select t.as_staff(:bill::uuid);
select t.fails('billing staff cannot link a workspace', $$select public.control_link_workspace('7a000000-0000-4000-8000-0000000000d1', '7a000000-0000-4000-8000-0000000000c1')$$, 'forbidden');
select t.as_user(:own::uuid);
select t.ok('a client is shown no workspaces', t.count('select 1 from public.control_unlinked_workspaces()') = 0);

select t.as_staff(:sue::uuid);
select t.ok('support sees the unlinked workspace', t.count('select 1 from public.control_unlinked_workspaces() where name = ''Self Made Co'' and owner_email = ''owner@acme.test''') = 1);
select public.control_link_workspace('7a000000-0000-4000-8000-0000000000d1', '7a000000-0000-4000-8000-0000000000c1');
select t.ok('linking ticks the workspace step', t.count($$select 1 from public.client_checklist where client_id = '7a000000-0000-4000-8000-0000000000d1' and step = 'workspace'$$) = 1);
select t.ok('a linked workspace is no longer offered', t.count('select 1 from public.control_unlinked_workspaces() where name = ''Self Made Co''') = 0);
select t.ok('seats in use now count the client''s own people', (select seats_used from public.control_client_usage() where client_id = '7a000000-0000-4000-8000-0000000000d1') = 1);
select t.fails('the same client cannot be linked twice', $$select public.control_link_workspace('7a000000-0000-4000-8000-0000000000d1', '7a000000-0000-4000-8000-0000000000c1')$$, 'already has a workspace');
select t.fails('another client cannot take that workspace', $$select public.control_link_workspace('7a000000-0000-4000-8000-0000000000d2', '7a000000-0000-4000-8000-0000000000c1')$$, 'another client');
select t.fails('inviting someone already in the workspace is refused', $$select public.control_invite_owner('7a000000-0000-4000-8000-0000000000d1')$$, 'already in the workspace');
select t.fails('inviting needs a workspace first', $$select public.control_invite_owner('7a000000-0000-4000-8000-0000000000d2')$$, 'workspace first');
select t.fails('provisioning needs the owner''s email', $$select public.control_provision_workspace('7a000000-0000-4000-8000-0000000000d3')$$, 'email');

select public.control_provision_workspace('7a000000-0000-4000-8000-0000000000d2');
reset role;
select t.ok('provisioning links a new workspace named after the client', t.count($$select 1 from public.clients c join public.workspaces w on w.id = c.workspace_id where c.name = 'Fresh Co' and w.name = 'Fresh Co'$$) = 1);
select t.ok('...with the standard folders', (select count(*) from public.document_folders f join public.clients c on c.workspace_id = f.workspace_id where c.name = 'Fresh Co') = 6);
select t.as_staff(:sue::uuid);
select t.ok('...ticks workspace and owner invited', t.count($$select 1 from public.client_checklist where client_id = '7a000000-0000-4000-8000-0000000000d2' and step in ('workspace', 'owner_invited')$$) = 2);
select t.ok('...and staff are not members of it', (select seats_used from public.control_client_usage() where client_id = '7a000000-0000-4000-8000-0000000000d2') = 0);
select t.fails('provisioning twice is refused', $$select public.control_provision_workspace('7a000000-0000-4000-8000-0000000000d2')$$, 'already has a workspace');
-- re-inviting extends the same invite rather than adding a second
select public.control_invite_owner('7a000000-0000-4000-8000-0000000000d2');
reset role;
select t.ok('one pending invite only', (select count(*) from public.workspace_invites where email = 'late@acme.test' and accepted_at is null) = 1);
select t.ok('the invite is for the owner role', (select role from public.workspace_invites where email = 'late@acme.test') = 'owner');
-- the owner signs in and is taken into the workspace as its owner
select t.as_user(:late::uuid);
select t.ok('signing in accepts the invite', public.dms_accept_invites('Late Owner') = 1);
reset role;
select t.ok('they are now the workspace owner', (select role from public.workspace_members where user_id = :late) = 'owner');
select t.as_staff(:sam::uuid);
select t.ok('both seats now count', (select seats_used from public.control_client_usage() where client_id = '7a000000-0000-4000-8000-0000000000d2') = 1);
select t.ok('every step is in the audit log', t.count($$select 1 from public.staff_audit_log where action in ('client.workspace_linked', 'client.owner_invited')$$) >= 4);
select public.control_unlink_workspace('7a000000-0000-4000-8000-0000000000d1');
select t.ok('unlinking clears the workspace steps', t.count($$select 1 from public.client_checklist where client_id = '7a000000-0000-4000-8000-0000000000d1' and step = 'workspace'$$) = 0);
reset role;
-- remove the clients and their log entries this block created, so the test files after this one start from the same state
delete from public.clients where id in ('7a000000-0000-4000-8000-0000000000d1', '7a000000-0000-4000-8000-0000000000d2', '7a000000-0000-4000-8000-0000000000d3');
delete from public.staff_audit_log where detail ->> 'workspace' = 'Self Made Co' or detail ->> 'email' = 'late@acme.test' or entity_id in ('7a000000-0000-4000-8000-0000000000d1', '7a000000-0000-4000-8000-0000000000d2', '7a000000-0000-4000-8000-0000000000d3');
update public.staff_members set active = false where user_id = :sue; -- leave the staff table as the tests after this expect
\echo ALL WORKSPACE LINK TESTS PASSED
