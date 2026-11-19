-- Accounts match to the letter: workspaces only for clients, sign-ups only for invited emails. Run last, through run.sh.
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set stf '''ac000000-0000-4000-8000-0000000000f1'''
\set cl '''ac000000-0000-4000-8000-0000000000f2'''

-- Fixture: a staff member and a client with an owner email (the sessions start with the checks off).
insert into auth.users (id, email) values (:stf, 'staff-am@adflo.test');
insert into public.staff_members (user_id, role, display_name, email) values (:stf, 'owner', 'Am Staff', 'staff-am@adflo.test');
insert into public.clients (id, name, owner_name, owner_email) values (:cl, 'Match Co', 'Mia Match', 'mia@match.test');

-- From here the real rules apply.
set adflo.test_fixture = off;

select t.fails('nothing but provisioning can create a workspace', $$insert into public.workspaces (name) values ('Random Co')$$, 'only be created for a client');
select t.ok('no workspace was made', not exists (select 1 from public.workspaces where name = 'Random Co'));

select t.as_staff(:stf::uuid);
select public.control_provision_workspace(:cl);
reset role;
select t.ok('provisioning still works: the workspace is linked to its client', (select w.name from public.clients c join public.workspaces w on w.id = c.workspace_id where c.id = :cl) = 'Match Co');
select t.fails('and the door is closed again afterwards', $$insert into public.workspaces (name) values ('Random Co 2')$$, 'only be created for a client');

select t.fails('a stranger cannot sign up', $$insert into auth.users (id, email) values (gen_random_uuid(), 'random@nowhere.test')$$, 'sign-up is by invitation');
select t.fails('an account with no email cannot sign up', $$insert into auth.users (id, email) values (gen_random_uuid(), null)$$, 'sign-up is by invitation');
select t.fails('someone who is a client but was never invited by email cannot sign up', $$insert into auth.users (id, email) values (gen_random_uuid(), 'mia2@match.test')$$, 'sign-up is by invitation');
-- An owner invitation must be confirmed first.
select t.fails('the owner cannot sign up before confirming the invitation', $$insert into auth.users (id, email) values (gen_random_uuid(), 'mia@match.test')$$, 'sign-up is by invitation');
select t.as_staff(:stf::uuid);
select public.control_invite_link(:cl, repeat('a', 64));
reset role;
select t.ok('a link alone does not open sign-up', (select not confirmed from public.invite_public_view(repeat('a', 64))));
select t.fails('still cannot sign up with an unconfirmed link', $$insert into auth.users (id, email) values (gen_random_uuid(), 'mia@match.test')$$, 'sign-up is by invitation');
select t.ok('an unknown link confirms nothing', public.invite_public_confirm(repeat('b', 64)) is null);
select t.ok('the link shows the client and the invited email', (select client_name || '|' || email from public.invite_public_view(repeat('a', 64))) = 'Match Co|mia@match.test');
-- Re-inviting starts over: the old link stops working.
select t.as_staff(:stf::uuid);
select public.control_invite_owner(:cl);
reset role;
select t.ok('re-inviting withdraws the earlier link', not exists (select 1 from public.invite_public_view(repeat('a', 64))));
select t.ok('and the withdrawn link confirms nothing', public.invite_public_confirm(repeat('a', 64)) is null);
select t.as_staff(:stf::uuid);
select public.control_invite_link(:cl, repeat('c', 64));
reset role;
select t.ok('confirming returns the invited email', public.invite_public_confirm(repeat('c', 64)) = 'mia@match.test');
select t.ok('confirming twice is harmless', public.invite_public_confirm(repeat('c', 64)) = 'mia@match.test');
select t.ok('the invitation now shows as confirmed', (select confirmed from public.invite_public_view(repeat('c', 64))));
select t.ok('the invited owner can sign up, in any letter case', (select count(*) from (select 1 from public.workspace_invites where email = 'mia@match.test' and accepted_at is null) q) = 1);
insert into auth.users (id, email) values ('ac000000-0000-4000-8000-0000000000f3', 'Mia@Match.test');
select t.ok('...and the account exists', exists (select 1 from auth.users where id = 'ac000000-0000-4000-8000-0000000000f3'));
insert into auth.users (id, email) values ('ac000000-0000-4000-8000-0000000000f4', 'STAFF-AM@adflo.test');
select t.ok('staff can sign up with their own email', exists (select 1 from auth.users where id = 'ac000000-0000-4000-8000-0000000000f4'));

update public.workspace_invites set expires_at = now() - interval '1 day' where email = 'mia@match.test';
select t.ok('an expired link shows as expired and confirms nothing', (select expired from public.invite_public_view(repeat('c', 64))) and public.invite_public_confirm(repeat('c', 64)) is null);
select t.fails('an expired invitation no longer lets anyone sign up', $$insert into auth.users (id, email) values (gen_random_uuid(), 'mia@match.test')$$, 'sign-up is by invitation');

-- The client history names the staff member (from the team list), not just their email.
select t.as_staff(:stf::uuid);
select t.ok('the client history shows the staff member by name', (select count(*) from public.control_client_timeline(:cl) where staff_email = 'staff-am@adflo.test' and staff_name = 'Am Staff') > 0);
reset role;

-- Clean up what this file made, so nothing leaks into later runs.
set adflo.test_fixture = on;
delete from public.clients where id = :cl;
delete from public.workspaces where name = 'Match Co';
delete from auth.users where email in ('Mia@Match.test', 'STAFF-AM@adflo.test') or id in ('ac000000-0000-4000-8000-0000000000f3', 'ac000000-0000-4000-8000-0000000000f4');
delete from public.staff_members where user_id = :stf;
delete from public.staff_audit_log where staff_email = 'staff-am@adflo.test';
delete from auth.users where id = :stf;
\echo ALL ACCOUNTS MATCH TESTS PASSED
