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
-- The invitation-only rules below are tested with public sign-up switched off; the self-serve tests at the end switch it on.
update public.signup_settings set open = false;

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


-- Self-serve sign-up: open to anyone while the switch is on, and a new account starts a 3-day trial with no workspace until it pays.
select t.ok('sign-up is on by default in a fresh database', (select open from public.signup_settings) is not null);
update public.signup_settings set open = true;
insert into auth.users (id, email) values ('ac000000-0000-4000-8000-0000000000a1', 'Nina@Newco.test');
select t.fails('an email that is not an email still cannot sign up', $$insert into auth.users (id, email) values (gen_random_uuid(), 'not-an-email')$$, 'sign-up is by invitation');
select t.as_user('ac000000-0000-4000-8000-0000000000a1');
select * from public.start_trial('Newco Builders', 'Nina New');
reset role;
select t.ok('a trial starts: a self-serve trial client for 3 days, and no workspace yet',
  (select c.status || '|' || c.plan || '|' || c.self_serve || '|' || (c.workspace_id is null) || '|' || (c.trial_ends_at between now() + interval '2 days 23 hours' and now() + interval '3 days 1 hour') from public.clients c where c.name = 'Newco Builders') = 'trial|adflo|true|true|true');
select t.as_user('ac000000-0000-4000-8000-0000000000a1');
select t.ok('asking again returns the same trial', (select count(*) from public.start_trial('Another Name', 'Nina')) = 1);
select t.ok('the trial owner sees their own trial, not paid, no workspace', (select not paid and not has_workspace and company = 'Newco Builders' from public.my_trial()));
select t.fails('a trial owner cannot activate a workspace themselves', $$select public.activate_trial_workspace((select client_id from public.my_trial()), 'ac000000-0000-4000-8000-0000000000a1')$$, 'permission denied');
reset role;
select t.ok('still only one client for Nina', (select count(*) from public.clients where lower(owner_email) = 'nina@newco.test') = 1);
select t.fails('activation is refused until payment is confirmed', $$select public.activate_trial_workspace((select id from public.clients where name = 'Newco Builders'), 'ac000000-0000-4000-8000-0000000000a1')$$, 'Payment has not been confirmed');
update public.clients set stripe_subscription_id = 'sub_test_1', billing_status = 'active' where name = 'Newco Builders';
select t.fails('and refused for a different account', $$select public.activate_trial_workspace((select id from public.clients where name = 'Newco Builders'), 'ac000000-0000-4000-8000-0000000000a2')$$, 'does not own');
select public.activate_trial_workspace((select id from public.clients where name = 'Newco Builders'), 'ac000000-0000-4000-8000-0000000000a1');
select t.ok('after payment the owner has a workspace with the standard folders',
  (select m.role from public.workspace_members m join public.clients c on c.workspace_id = m.workspace_id where c.name = 'Newco Builders' and m.user_id = 'ac000000-0000-4000-8000-0000000000a1') = 'owner'
  and (select count(*) from public.document_folders f join public.clients c on c.workspace_id = f.workspace_id where c.name = 'Newco Builders' and f.is_system) = 6);
select t.ok('and the client is active with the trial over', (select status = 'active' and trial_ends_at is null from public.clients where name = 'Newco Builders'));
select t.ok('activating twice returns the same workspace', public.activate_trial_workspace((select id from public.clients where name = 'Newco Builders'), 'ac000000-0000-4000-8000-0000000000a1') = (select workspace_id from public.clients where name = 'Newco Builders'));
insert into auth.users (id, email) values ('ac000000-0000-4000-8000-0000000000a2', 'nora@newco.test');
select t.as_user('ac000000-0000-4000-8000-0000000000a2');
select t.fails('a company name that is taken is refused', $$select * from public.start_trial('newco builders', 'Nora')$$, 'already exists');
select t.fails('a one-letter company name is refused', $$select * from public.start_trial('X', 'Nora')$$, 'company name');
reset role;
select t.fails('nothing else can create a workspace', $$insert into public.workspaces (name) values ('Sneaky Co')$$, 'only be created for a client');
-- Someone with an open invitation joins their company's workspace instead of starting another.
insert into public.workspace_invites (workspace_id, email, role) select workspace_id, 'ned@newco.test', 'editor' from public.clients where name = 'Newco Builders';
insert into auth.users (id, email) values ('ac000000-0000-4000-8000-0000000000a3', 'ned@newco.test');
select t.as_user('ac000000-0000-4000-8000-0000000000a3');
select t.fails('an invited person cannot start a second workspace', $$select * from public.start_trial('Ned Co', 'Ned')$$, 'invitation');
reset role;
-- Staff can close sign-up again, and then it is invitation-only as before.
select t.as_staff(:stf::uuid);
select public.control_set_signup_open(false);
reset role;
select t.fails('with sign-up closed a stranger cannot sign up again', $$insert into auth.users (id, email) values (gen_random_uuid(), 'late@nowhere.test')$$, 'sign-up is by invitation');
insert into public.workspace_invites (workspace_id, email, role) select workspace_id, 'ona@newco.test', 'editor' from public.clients where name = 'Newco Builders';
insert into auth.users (id, email) values ('ac000000-0000-4000-8000-0000000000a4', 'ona@newco.test');
select t.ok('and the invited can still sign up', exists (select 1 from auth.users where email = 'ona@newco.test'));
select t.as_user('ac000000-0000-4000-8000-0000000000a2');
select t.fails('and a person with no workspace cannot start one', $$select * from public.start_trial('Closed Co', 'Nora')$$, 'invitation only');
reset role;
select t.as_user('ac000000-0000-4000-8000-0000000000a1');
select t.fails('an ordinary user cannot flip the switch', $$select public.control_set_signup_open(true)$$, 'forbidden');
reset role;

-- Clean up what this file made, so nothing leaks into later runs.
set adflo.test_fixture = on;
select set_config('request.jwt.claim.sub', '', false); -- the last test user is not staff, so the audit trail must not name them
delete from public.clients where id = :cl;
delete from public.workspaces where name in ('Match Co', 'Newco Builders');
delete from public.clients where name = 'Newco Builders';
delete from public.workspace_invites where email in ('ned@newco.test', 'ona@newco.test');
update public.signup_settings set open = true;
delete from auth.users where email in ('Mia@Match.test', 'STAFF-AM@adflo.test') or id in ('ac000000-0000-4000-8000-0000000000f3', 'ac000000-0000-4000-8000-0000000000f4', 'ac000000-0000-4000-8000-0000000000a1', 'ac000000-0000-4000-8000-0000000000a2', 'ac000000-0000-4000-8000-0000000000a3', 'ac000000-0000-4000-8000-0000000000a4');
delete from public.staff_members where user_id = :stf;
delete from public.staff_audit_log where staff_email = 'staff-am@adflo.test';
delete from auth.users where id = :stf;
\echo ALL ACCOUNTS MATCH TESTS PASSED
