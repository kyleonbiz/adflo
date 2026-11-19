-- Stray accounts: who the nightly job may remove. Runs after control.sql (reuses its t.* helpers). Service role only.
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set a '''7c000000-0000-4000-8000-0000000000a1'''
\set b '''7c000000-0000-4000-8000-0000000000a2'''
\set c '''7c000000-0000-4000-8000-0000000000a3'''
\set d '''7c000000-0000-4000-8000-0000000000a4'''
\set e '''7c000000-0000-4000-8000-0000000000a5'''
\set f '''7c000000-0000-4000-8000-0000000000a6'''
\set ws '''7c000000-0000-4000-8000-0000000000b1'''

reset role;
-- a: stray (old, nothing). b: stray but too new. c: a member. d: owner of a trial client. e: has a recent invitation. f: staff.
insert into auth.users (id, email, created_at) values
  (:a, 'stray@x.test', now() - interval '30 days'), (:b, 'newbie@x.test', now() - interval '1 day'), (:c, 'member@x.test', now() - interval '30 days'),
  (:d, 'owner@x.test', now() - interval '30 days'), (:e, 'invited@x.test', now() - interval '30 days'), (:f, 'staffer@x.test', now() - interval '30 days');
insert into public.workspaces (id, name, created_by) values (:ws, 'Stray Test Co', null);
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values (:ws, :c, 'editor', 'M', 'member@x.test');
insert into public.clients (id, name, status, owner_email) values ('7c000000-0000-4000-8000-0000000000c1', 'Stray Test Owner Co', 'trial', 'owner@x.test');
insert into public.workspace_invites (workspace_id, email, role, expires_at) values (:ws, 'invited@x.test', 'editor', now() + interval '5 days');
insert into public.staff_members (user_id, role, display_name, email) values (:f, 'support', 'Staffer', 'staffer@x.test');

select t.as_staff('00000000-0000-4000-8000-0000000000a1'::uuid);
select t.fails('the API roles cannot list strays', $q$select * from public.dms_stray_accounts()$q$, 'permission denied');
reset role;
select t.ok('only the old account with nothing is a stray', (select count(*) from public.dms_stray_accounts() where id in (:a, :b, :c, :d, :e, :f)) = 1
  and (select id from public.dms_stray_accounts() where id in (:a, :b, :c, :d, :e, :f)) = :a);

-- a trial client's owner stops being protected when the client is cancelled
update public.clients set status = 'cancelled' where id = '7c000000-0000-4000-8000-0000000000c1';
select t.ok('the owner of a cancelled client is a stray', (select count(*) from public.dms_stray_accounts() where id = :d) = 1);
-- an invitation that ran out long ago no longer protects
update public.workspace_invites set expires_at = now() - interval '30 days' where email = 'invited@x.test';
select t.ok('an invitation that ran out long ago no longer protects', (select count(*) from public.dms_stray_accounts() where id = :e) = 1);

delete from public.workspace_invites where workspace_id = :ws;
delete from public.clients where id = '7c000000-0000-4000-8000-0000000000c1';
delete from public.workspace_members where workspace_id = :ws;
delete from public.workspaces where id = :ws;
delete from public.staff_members where user_id = :f;
delete from public.staff_audit_log where entity_id = '7c000000-0000-4000-8000-0000000000c1';
delete from auth.users where id in (:a, :b, :c, :d, :e, :f);
\echo ALL STRAY ACCOUNTS TESTS PASSED
