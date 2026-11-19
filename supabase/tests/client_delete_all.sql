-- Deleting a client and its workspace in one step: runs after control.sql (reuses its staff people and the t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set sam '''00000000-0000-4000-8000-0000000000a1'''
\set sue '''00000000-0000-4000-8000-0000000000a2'''
\set c1 '''7d000000-0000-4000-8000-000000000001'''
\set c2 '''7d000000-0000-4000-8000-000000000002'''
\set c3 '''7d000000-0000-4000-8000-000000000003'''
\set ws '''7d000000-0000-4000-8000-0000000000a1'''

reset role;
select (select active from public.staff_members where user_id = :sam) as sam_was, (select active from public.staff_members where user_id = :sue) as sue_was \gset
update public.staff_members set active = true where user_id in (:sam, :sue);
insert into public.workspaces (id, name, created_by) values (:ws, 'Both Co', null);
insert into public.clients (id, name, status, workspace_id) values (:c1, 'Both Co', 'trial', :ws), (:c2, 'Paying Co', 'active', null), (:c3, 'Signed Co', 'cancelled', null);
insert into public.agreement_templates (id, title, version, body) values ('7d000000-0000-4000-8000-0000000000b1', 'Delete-all test agreement', 1, 'text');
insert into public.agreements_sent (client_id, template_id, token_hash, accepted_at, accepted_name, accepted_email)
  values (:c3, '7d000000-0000-4000-8000-0000000000b1', repeat('a', 64), now(), 'Sam Signer', 's@x.test');

select t.as_staff(:sue::uuid);
select t.fails('support cannot ask', format($q$select public.control_check_client_delete(%L, 'Both Co')$q$, :c1), 'forbidden');
select t.as_staff(:sam::uuid, 'aal1');
select t.fails('the owner with only a password cannot ask', format($q$select public.control_check_client_delete(%L, 'Both Co')$q$, :c1), 'forbidden');
select t.as_staff(:sam::uuid);
select t.fails('a wrong name is refused', format($q$select public.control_check_client_delete(%L, 'Other')$q$, :c1), 'does not match');
select t.fails('an active client is refused', format($q$select public.control_check_client_delete(%L, 'Paying Co')$q$, :c2), 'Cancel the client first');
select t.fails('a client who accepted an agreement is refused', format($q$select public.control_check_client_delete(%L, 'Signed Co')$q$, :c3), 'accepted an agreement');
reset role;
select t.ok('the refusals logged nothing', (select count(*) from public.staff_audit_log where action = 'client.delete_requested') = 0);

select t.as_staff(:sam::uuid);
select public.control_check_client_delete(:c1, ' both co ') as got \gset
reset role;
select t.ok('it returns the client''s workspace id', :'got' = :ws::text);
select t.ok('it logged the request and deleted nothing itself', (select count(*) from public.staff_audit_log where entity_id = :c1 and action = 'client.delete_requested') = 1 and (select count(*) from public.clients where id = :c1) = 1);

-- what the server does next: erase the workspace, then delete the record
delete from public.workspaces where id = :ws;
select t.as_staff(:sam::uuid);
select public.control_delete_client(:c1);
reset role;
select t.ok('the client and its workspace are both gone', (select count(*) from public.clients where id = :c1) = 0 and (select count(*) from public.workspaces where id = :ws) = 0);

delete from public.agreements_sent where client_id = :c3;
delete from public.agreement_templates where id = '7d000000-0000-4000-8000-0000000000b1';
delete from public.clients where id in (:c2, :c3);
delete from public.staff_audit_log where entity_id in (:c1, :c2, :c3);
update public.staff_members set active = :'sue_was' where user_id = :sue;
update public.staff_members set active = :'sam_was' where user_id = :sam;
\echo ALL CLIENT DELETE ALL TESTS PASSED
