-- Delete-a-client's-workspace check: runs after control.sql (reuses its staff people and the t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set sam '''00000000-0000-4000-8000-0000000000a1'''
\set sue '''00000000-0000-4000-8000-0000000000a2'''
\set cid '''7e000000-0000-4000-8000-000000000001'''
\set wsid '''7e000000-0000-4000-8000-0000000000a1'''

reset role;
select (select active from public.staff_members where user_id = :sam) as sam_was, (select active from public.staff_members where user_id = :sue) as sue_was \gset
update public.staff_members set active = true where user_id in (:sam, :sue);
insert into public.workspaces (id, name, created_by) values (:wsid, 'Closing Co', null);
insert into public.clients (id, name, status, workspace_id) values (:cid, 'Closing Co', 'active', :wsid);
insert into public.clients (id, name, status) values ('7e000000-0000-4000-8000-000000000002', 'No Workspace Co', 'cancelled');

-- who may ask
select t.as_staff(:sue::uuid);
select t.fails('support cannot ask', format($q$select public.control_check_workspace_delete(%L, 'Closing Co')$q$, :cid), 'forbidden');
select t.as_staff(:sam::uuid, 'aal1');
select t.fails('the owner with only a password cannot ask', format($q$select public.control_check_workspace_delete(%L, 'Closing Co')$q$, :cid), 'forbidden');
select t.as_anon();
select t.fails('anon cannot ask', format($q$select public.control_check_workspace_delete(%L, 'Closing Co')$q$, :cid));

-- the safety steps
select t.as_staff(:sam::uuid);
select t.fails('an active client is refused', format($q$select public.control_check_workspace_delete(%L, 'Closing Co')$q$, :cid), 'Cancel the client first');
reset role;
update public.clients set status = 'cancelled' where id = :cid;
select t.as_staff(:sam::uuid);
select t.fails('a wrong name is refused', format($q$select public.control_check_workspace_delete(%L, 'Other Co')$q$, :cid), 'does not match');
select t.fails('an empty name is refused', format($q$select public.control_check_workspace_delete(%L, '')$q$, :cid), 'does not match');
select t.fails('a client with no workspace is refused', $q$select public.control_check_workspace_delete('7e000000-0000-4000-8000-000000000002', 'No Workspace Co')$q$, 'no workspace');
select t.fails('an unknown client is refused', $q$select public.control_check_workspace_delete('7e000000-0000-4000-8000-0000000000ee', 'x')$q$, 'no longer exists');
reset role;
select t.ok('the refusals changed nothing and logged nothing', (select count(*) from public.workspaces where id = :wsid) = 1
  and (select count(*) from public.staff_audit_log where entity_id = :cid and action = 'client.workspace_delete_requested') = 0);

-- the allowed case: it returns the workspace id, logs the request, and deletes nothing itself
select t.as_staff(:sam::uuid);
select public.control_check_workspace_delete(:cid, '  closing CO ') as got \gset
reset role;
select t.ok('it returns the client''s workspace id', :'got' = :wsid::text);
select t.ok('it logged the request in the staff audit log', (select count(*) from public.staff_audit_log where entity_id = :cid and action = 'client.workspace_delete_requested') = 1);
select t.ok('it deleted nothing itself', (select count(*) from public.workspaces where id = :wsid) = 1 and (select count(*) from public.clients where id = :cid) = 1);

-- the server's delete then leaves the client record behind with no workspace
delete from public.workspaces where id = :wsid;
select t.ok('after the workspace is deleted the client record stays, unlinked', (select count(*) from public.clients where id = :cid and workspace_id is null) = 1);

-- tidy up
delete from public.clients where id in (:cid, '7e000000-0000-4000-8000-000000000002');
delete from public.staff_audit_log where entity_id in ('7e000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000002');
update public.staff_members set active = :'sue_was' where user_id = :sue;
update public.staff_members set active = :'sam_was' where user_id = :sam;
\echo ALL CLIENT WORKSPACE DELETE TESTS PASSED
