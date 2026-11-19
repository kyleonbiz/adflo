-- Deleting a workspace no client owns: runs after control.sql (reuses its staff people and the t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set sam '''00000000-0000-4000-8000-0000000000a1'''
\set sue '''00000000-0000-4000-8000-0000000000a2'''
\set orphan '''7f000000-0000-4000-8000-0000000000a1'''
\set owned '''7f000000-0000-4000-8000-0000000000a2'''

reset role;
select (select active from public.staff_members where user_id = :sam) as sam_was, (select active from public.staff_members where user_id = :sue) as sue_was \gset
update public.staff_members set active = true where user_id in (:sam, :sue);
insert into public.workspaces (id, name, created_by) values (:orphan, 'Lingering Co', null), (:owned, 'Owned Co', null);
insert into public.clients (id, name, workspace_id) values ('7f000000-0000-4000-8000-000000000001', 'Owned Co', :owned);

select t.as_staff(:sue::uuid);
select t.fails('support cannot ask', format($q$select public.control_check_orphan_workspace_delete(%L, 'Lingering Co')$q$, :orphan), 'forbidden');
select t.as_staff(:sam::uuid, 'aal1');
select t.fails('the owner with only a password cannot ask', format($q$select public.control_check_orphan_workspace_delete(%L, 'Lingering Co')$q$, :orphan), 'forbidden');
select t.as_anon();
select t.fails('anon cannot ask', format($q$select public.control_check_orphan_workspace_delete(%L, 'Lingering Co')$q$, :orphan));

select t.as_staff(:sam::uuid);
select t.fails('a wrong name is refused', format($q$select public.control_check_orphan_workspace_delete(%L, 'Other')$q$, :orphan), 'does not match');
select t.fails('a workspace a client owns is refused', format($q$select public.control_check_orphan_workspace_delete(%L, 'Owned Co')$q$, :owned), 'A client owns this workspace');
select t.fails('an unknown workspace is refused', $q$select public.control_check_orphan_workspace_delete('7f000000-0000-4000-8000-0000000000ee', 'x')$q$, 'no longer exists');
reset role;
select t.ok('the refusals logged nothing', (select count(*) from public.staff_audit_log where action = 'workspace.delete_requested') = 0);

select t.as_staff(:sam::uuid);
select public.control_check_orphan_workspace_delete(:orphan, '  lingering co ') as got \gset
reset role;
select t.ok('it returns the workspace id', :'got' = :orphan::text);
select t.ok('it logged the request and deleted nothing itself', (select count(*) from public.staff_audit_log where entity_id = :orphan and action = 'workspace.delete_requested') = 1 and (select count(*) from public.workspaces where id = :orphan) = 1);

delete from public.workspaces where id = :orphan;
delete from public.clients where id = '7f000000-0000-4000-8000-000000000001';
delete from public.workspaces where id = :owned;
delete from public.staff_audit_log where entity_id = :orphan;
update public.staff_members set active = :'sue_was' where user_id = :sue;
update public.staff_members set active = :'sam_was' where user_id = :sam;
\echo ALL ORPHAN WORKSPACE DELETE TESTS PASSED
