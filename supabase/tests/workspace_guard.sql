-- Create-workspace double-submit guard and workspace deletion with folders.
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set erin '''00000000-0000-4000-8000-00000000000e'''
select t.as_user(:erin::uuid);
select public.create_workspace('Guard Co', 'Erin', 'erin@a.test') as w1 \gset
select public.create_workspace('  guard co ', 'Erin', 'erin@a.test') as w2 \gset
select t.ok('a repeat submit returns the same workspace', :'w1' = :'w2');
select t.ok('and creates no second workspace', (select count(*) from public.workspaces where created_by = :erin::uuid and lower(name) = 'guard co') = 1);
select public.create_workspace('Other Co', 'Erin', 'erin@a.test') as w3 \gset
select t.ok('a different name still creates a new workspace', :'w3' <> :'w1');
reset role;
update public.workspaces set created_at = now() - interval '2 minutes' where id = :'w1';
select t.as_user(:erin::uuid);
select public.create_workspace('Guard Co', 'Erin', 'erin@a.test') as w4 \gset
select t.ok('the same name after a minute is allowed', :'w4' <> :'w1');
reset role;
select t.affected('a workspace with folders can be deleted', format('delete from public.workspaces where id in (%L, %L, %L)', :'w1', :'w3', :'w4'), 3);
select t.ok('its folders are gone too', (select count(*) from public.document_folders where workspace_id in (:'w1', :'w3', :'w4')) = 0);
\echo ALL WORKSPACE GUARD TESTS PASSED
