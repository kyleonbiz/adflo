-- Tests for 20261125110000_plan_storage.sql. Run through run.sh after rls.sql (uses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
\set sw '''00000000-0000-4000-8000-0000000005f1'''
reset role;
insert into auth.users (id, email) values (:sw, 'storage-owner@s.test');
select t.as_user(:sw);
select public.create_workspace('Storage Co', 'Stan Storage', 'storage-owner@s.test') as wst \gset
reset role;
select t.ok('a new workspace starts with 20 GB', (select storage_quota_bytes from public.workspaces where id = :'wst') = 21474836480);

update public.workspaces set storage_quota_bytes = 5368709120 where id = :'wst';
delete from public.clients where workspace_id = :'wst';
insert into public.clients (name, plan, seats_limit, workspace_id) values ('Storage Client', 'standard', 3, :'wst');
select t.ok('a client on another plan is left as it is', (select storage_quota_bytes from public.workspaces where id = :'wst') = 5368709120);
update public.clients set plan = 'adflo' where workspace_id = :'wst';
select t.ok('moving a client onto AdFlo raises the workspace to 20 GB', (select storage_quota_bytes from public.workspaces where id = :'wst') = 21474836480);

update public.workspaces set storage_quota_bytes = 53687091200 where id = :'wst';
update public.clients set plan = 'adflo', notes = 'x' where workspace_id = :'wst';
update public.clients set plan = 'standard' where workspace_id = :'wst';
update public.clients set plan = 'adflo' where workspace_id = :'wst';
select t.ok('a workspace that already has more keeps it', (select storage_quota_bytes from public.workspaces where id = :'wst') = 53687091200);
\echo ALL STORAGE PLAN TESTS PASSED
