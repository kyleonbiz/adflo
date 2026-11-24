-- Lines the server's automations write to the activity trail: they may name themselves, a signed-in person never can.
-- Runs after rls.sql (reuses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set own '''ac000000-0000-4000-8000-0000000000a1'''
\set edt '''ac000000-0000-4000-8000-0000000000a2'''
\set ws '''ac000000-0000-4000-8000-0000000000b1'''

reset role;
insert into auth.users (id, email) values (:own, 'aa-owner@x.test'), (:edt, 'aa-editor@x.test');
insert into public.workspaces (id, name, created_by) values (:ws, 'Auto Log Co', null);
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values
  (:ws, :own, 'owner', 'Olive Owner', 'aa-owner@x.test'), (:ws, :edt, 'editor', 'Edith Editor', 'aa-editor@x.test');

-- the server (no signed-in person)
reset role;
insert into public.workspace_activity (workspace_id, id, data) values (:ws, 'auto-1', '{"verb":"emailed a reminder about","what":"invoice INV-1","area":"Invoices","href":"/app/invoices","by":"AdFlo"}');
insert into public.workspace_activity (workspace_id, id, data) values (:ws, 'auto-2', '{"verb":"added","what":"a task","area":"Tasks","href":"/app/projects"}');
select t.ok('a server line keeps the name it gave itself', (select data ->> 'by' from public.workspace_activity where id = 'auto-1') = 'AdFlo');
select t.ok('a server line with no name is AdFlo', (select data ->> 'by' from public.workspace_activity where id = 'auto-2') = 'AdFlo');
select t.ok('a server line has no person and the time is set by the database', (select actor_id is null and at > now() - interval '1 minute' from public.workspace_activity where id = 'auto-1'));

-- a signed-in person
select t.as_user(:edt);
insert into public.workspace_activity (workspace_id, id, data) values (:ws, 'mine-1', '{"verb":"created","what":"invoice INV-2","area":"Invoices","href":"/app/invoices","by":"AdFlo"}');
select t.ok('a person cannot pass as AdFlo', (select data ->> 'by' from public.workspace_activity where id = 'mine-1') = 'Edith Editor');
select t.ok('members see the automation lines', t.count($q$select 1 from public.workspace_activity where id like 'auto-%'$q$) = 2);
select t.fails('and nobody can change one', $q$update public.workspace_activity set data = '{}' where id = 'auto-1'$q$, 'permission denied');

reset role;
delete from public.workspace_activity where workspace_id = :ws;
delete from public.audit_logs where workspace_id = :ws;
delete from public.workspace_members where workspace_id = :ws;
delete from public.workspaces where id = :ws;
delete from auth.users where id in (:own, :edt);
\echo ALL AUTOMATION ACTIVITY TESTS PASSED
