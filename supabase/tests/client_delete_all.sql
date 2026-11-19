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
select t.fails('a client with signed agreements is refused without the acknowledgement', format($q$select public.control_check_client_delete(%L, 'Signed Co')$q$, :c3), 'signed agreements');
reset role;
select t.ok('the refusals logged nothing', (select count(*) from public.staff_audit_log where action = 'client.delete_requested') = 0);

select t.as_staff(:sam::uuid);
select public.control_check_client_delete(:c1, ' both co ') as got \gset
reset role;
select t.ok('it returns the client''s workspace id', :'got' = :ws::text);
select t.ok('it logged the request and deleted nothing itself', (select count(*) from public.staff_audit_log where entity_id = :c1 and action = 'client.delete_requested') = 1 and (select count(*) from public.clients where id = :c1) = 1);

-- the accounts that go with a client: its workspace's members and whoever signed up with the owner's email, never staff
reset role;
insert into auth.users (id, email) values ('7d000000-0000-4000-8000-0000000000c1', 'member@both.test'), ('7d000000-0000-4000-8000-0000000000c2', 'owner@both.test'), ('7d000000-0000-4000-8000-0000000000c3', 'shared@both.test');
update public.clients set owner_email = 'owner@both.test' where id = :c1;
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values
  (:ws, '7d000000-0000-4000-8000-0000000000c1', 'editor', 'Mem', 'member@both.test'), (:ws, '7d000000-0000-4000-8000-0000000000c3', 'editor', 'Shr', 'shared@both.test');
insert into public.workspaces (id, name, created_by) values ('7d000000-0000-4000-8000-0000000000a2', 'Other Co', null);
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values ('7d000000-0000-4000-8000-0000000000a2', '7d000000-0000-4000-8000-0000000000c3', 'editor', 'Shr', 'shared@both.test');
select t.as_staff(:sue::uuid);
select t.fails('support cannot list a client''s accounts', format($q$select * from public.control_client_account_ids(%L)$q$, :c1), 'forbidden');
select t.as_staff(:sam::uuid);
select t.ok('the member and the owner-email account are listed', (select count(*) from public.control_client_account_ids(:c1) where email in ('member@both.test', 'owner@both.test')) = 2);
select t.ok('staff are never listed', (select count(*) from public.control_client_account_ids(:c1) where email in (select email from public.staff_members)) = 0);
select t.ok('someone in another workspace too is flagged so they are kept', (select other_workspaces from public.control_client_account_ids(:c1) where email = 'shared@both.test') = 1
  and (select other_workspaces from public.control_client_account_ids(:c1) where email = 'member@both.test') = 0);
reset role;
delete from public.workspace_members where workspace_id in (:ws, '7d000000-0000-4000-8000-0000000000a2');
delete from public.workspaces where id = '7d000000-0000-4000-8000-0000000000a2';
delete from auth.users where id in ('7d000000-0000-4000-8000-0000000000c1', '7d000000-0000-4000-8000-0000000000c2', '7d000000-0000-4000-8000-0000000000c3');

-- a client with signed agreements: allowed with the acknowledgement, and the signature is copied into the audit log first
select t.as_staff(:sam::uuid);
select public.control_check_client_delete(:c3, 'Signed Co', true);
select public.control_delete_client(:c3);
reset role;
select t.ok('the signed client is deleted', (select count(*) from public.clients where id = :c3) = 0 and (select count(*) from public.agreements_sent where client_id = :c3) = 0);
select t.ok('...and its acceptance is kept in the audit log', (select detail -> 'signed_agreements' -> 0 ->> 'accepted_by' from public.staff_audit_log where entity_id = :c3 and action = 'client.delete_requested') = 'Sam Signer');

-- what the server does next: erase the workspace, then delete the record
delete from public.workspaces where id = :ws;
select t.as_staff(:sam::uuid);
select public.control_delete_client(:c1);
reset role;
select t.ok('the client and its workspace are both gone', (select count(*) from public.clients where id = :c1) = 0 and (select count(*) from public.workspaces where id = :ws) = 0);

delete from public.agreement_templates where id = '7d000000-0000-4000-8000-0000000000b1';
delete from public.clients where id in (:c2, :c3);
delete from public.staff_audit_log where entity_id in (:c1, :c2, :c3);
update public.staff_members set active = :'sue_was' where user_id = :sue;
update public.staff_members set active = :'sam_was' where user_id = :sam;
\echo ALL CLIENT DELETE ALL TESTS PASSED
