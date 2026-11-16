-- Suspend lock tests: reuses the Alpha Co workspace and people that rls.sql left behind.
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set dave '''00000000-0000-4000-8000-00000000000d'''
\set alice '''00000000-0000-4000-8000-00000000000a'''
\set bob '''00000000-0000-4000-8000-00000000000b'''
\set cid '''7b000000-0000-4000-8000-000000000001'''

reset role;
select id as wsa from public.workspaces where name = 'Alpha Co' \gset
insert into public.clients (id, name, status, workspace_id) values (:cid, 'Alpha Client', 'active', :'wsa');
-- a ready document with a live shared link (the ones rls.sql made were purged or revoked by its later tests)
insert into public.documents (id, workspace_id, original_name, display_name, mime_type, size_bytes, status, current_version)
  values ('7b000000-0000-4000-8000-0000000000d1', :'wsa', 'lock.pdf', 'lock.pdf', 'application/pdf', 1, 'ready', 1);
insert into public.document_versions (workspace_id, document_id, version_number, storage_key, mime_type, size_bytes, status)
  values (:'wsa', '7b000000-0000-4000-8000-0000000000d1', 1, :'wsa' || '/7b000000-0000-4000-8000-0000000000d1/1', 'application/pdf', 1, 'ready');
insert into public.document_share_links (workspace_id, document_id, token_hash, expires_at)
  values (:'wsa', '7b000000-0000-4000-8000-0000000000d1', 'hash-lock', now() + interval '1 hour');

-- in service: everything works
select t.as_user(:dave);
select t.ok('active: a member reads the workspace folders', (select count(*) from public.document_folders where workspace_id = :'wsa') > 0);
select t.ok('active: a member reads the document', (select count(*) from public.documents where id = '7b000000-0000-4000-8000-0000000000d1') = 1);
select t.ok('active: standing is ok', public.workspace_standing(:'wsa') = 'ok');
select t.as_user(:bob);
select t.ok('standing is null for a non-member', public.workspace_standing(:'wsa') is null);
reset role; set role service_role;
select t.ok('active: a shared link opens', (select count(*) from public.dms_resolve_share('hash-lock')) = 1);

-- suspended: locked out of the data, but can still be told why
reset role;
update public.clients set status = 'suspended' where id = :cid;
select t.as_user(:dave);
select t.ok('suspended: folders are gone for a member', (select count(*) from public.document_folders where workspace_id = :'wsa') = 0);
select t.ok('suspended: the document is gone', (select count(*) from public.documents where id = '7b000000-0000-4000-8000-0000000000d1') = 0);
select t.ok('suspended: they can still see their own workspace', (select count(*) from public.workspaces where id = :'wsa') = 1);
select t.ok('suspended: and their own membership', (select count(*) from public.workspace_members where user_id = :dave) >= 1);
select t.ok('suspended: standing says suspended', public.workspace_standing(:'wsa') = 'suspended');
select t.as_user(:alice);
select t.fails('suspended: an admin cannot add a folder', format($q$insert into public.document_folders (workspace_id, name, color, created_by) values (%L, 'Sneaky', 'blue', %L)$q$, :'wsa', :alice), 'row-level security');
select t.as_user(:alice);
select t.ok('suspended: the admin is locked out too', (select count(*) from public.document_folders where workspace_id = :'wsa') = 0);
select t.fails('suspended: starting a fresh workspace is refused', $q$select public.create_workspace('Escape Co', 'Alice', 'a@a.test')$q$, 'account_paused');
select t.as_user(:bob);
select t.ok('another workspace is unaffected', (select count(*) from public.document_folders) > 0);
reset role; set role service_role;
select t.ok('suspended: a link shared earlier stops opening', (select count(*) from public.dms_resolve_share('hash-lock')) = 0);

-- cancelled is locked the same way
reset role;
update public.clients set status = 'cancelled' where id = :cid;
select t.as_user(:dave);
select t.ok('cancelled: locked', (select count(*) from public.document_folders where workspace_id = :'wsa') = 0);
select t.ok('cancelled: standing says cancelled', public.workspace_standing(:'wsa') = 'cancelled');

-- a trial is in service, and turning the account back on restores everything at once
reset role;
update public.clients set status = 'trial' where id = :cid;
select t.as_user(:dave);
select t.ok('trial: access is back', (select count(*) from public.document_folders where workspace_id = :'wsa') > 0);
reset role;
update public.clients set status = 'suspended' where id = :cid;
update public.clients set status = 'active' where id = :cid;
select t.as_user(:dave);
select t.ok('reactivated: access is back and standing is ok', (select count(*) from public.document_folders where workspace_id = :'wsa') > 0 and public.workspace_standing(:'wsa') = 'ok');
select t.as_user(:alice);
select t.affected('reactivated: an admin can add a folder again', format($q$insert into public.document_folders (workspace_id, name, color, created_by) values (%L, 'Back again', 'blue', %L)$q$, :'wsa', :alice), 1);
reset role; set role service_role;
select t.ok('reactivated: the shared link opens again', (select count(*) from public.dms_resolve_share('hash-lock')) = 1);

-- a workspace with no client record is never locked
reset role;
delete from public.document_folders where name = 'Back again' and workspace_id = :'wsa';
delete from public.documents where id = '7b000000-0000-4000-8000-0000000000d1';
delete from public.clients where id = :cid;
select t.as_user(:dave);
select t.ok('no client record: no lock', (select count(*) from public.document_folders where workspace_id = :'wsa') > 0);
reset role;
\echo ALL SUSPEND TESTS PASSED
