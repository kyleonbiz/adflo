-- Control center billing invoices: who can read and change them, and the audit trail. Runs after control.sql (reuses t.as_staff).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set own '''c1000000-0000-4000-8000-0000000000a1'''
\set sup '''c1000000-0000-4000-8000-0000000000a2'''
\set bil '''c1000000-0000-4000-8000-0000000000a3'''
\set cli '''c1000000-0000-4000-8000-0000000000a4'''
\set cid '''c1000000-0000-4000-8000-0000000000c1'''

reset role;
insert into auth.users (id, email) values (:own, 'ci-owner@s.test'), (:sup, 'ci-support@s.test'), (:bil, 'ci-billing@s.test'), (:cli, 'ci-client@c.test');
insert into public.staff_members (user_id, role, display_name, email) values (:own, 'owner', 'O', 'ci-owner@s.test'), (:sup, 'support', 'S', 'ci-support@s.test'), (:bil, 'billing', 'B', 'ci-billing@s.test');
insert into public.clients (id, name, status, plan, seats_limit, owner_name, owner_email) values (:cid, 'Invoice Test Co', 'active', 'adflo', 3, 'Pat', 'pat@ci.test');

select t.as_staff(:bil::uuid);
insert into public.control_invoices (id, client_id, data) values ('inv-1', :cid, '{"number":"INV-1","client":"Invoice Test Co","status":"draft","amountCents":5000}');
select t.ok('the billing role can create an invoice', t.count($q$select 1 from public.control_invoices$q$) = 1);
select t.ok('the person and time are set by the database', (select updated_by = :bil::uuid and updated_at > now() - interval '1 minute' from public.control_invoices where id = 'inv-1'));
update public.control_invoices set data = '{"number":"INV-1","client":"Invoice Test Co","status":"sent","amountCents":5000}' where id = 'inv-1';
select t.ok('and change it', (select data ->> 'status' from public.control_invoices where id = 'inv-1') = 'sent');

select t.as_staff(:sup::uuid);
select t.ok('support can read invoices', t.count($q$select 1 from public.control_invoices$q$) = 1);
select t.fails('but not create one', $q$insert into public.control_invoices (id, data) values ('inv-2', '{"number":"INV-2"}')$q$, 'row-level security');
select t.affected('nor change one', $q$update public.control_invoices set data = '{"status":"paid"}' where id = 'inv-1'$q$, 0);
select t.affected('nor delete one', $q$delete from public.control_invoices where id = 'inv-1'$q$, 0);

select t.as_staff(:cli::uuid);
select t.ok('a client reads none', t.count($q$select 1 from public.control_invoices$q$) = 0);
select t.fails('and cannot create one', $q$insert into public.control_invoices (id, data) values ('inv-3', '{"number":"INV-3"}')$q$, 'row-level security');
select t.as_anon();
select t.fails('anon cannot touch the table', $q$select * from public.control_invoices$q$, 'permission denied');

select t.as_staff(:own::uuid);
select t.fails('an invoice must be a JSON object', $q$insert into public.control_invoices (id, data) values ('bad', '[1]')$q$, 'check');
select t.fails('a huge invoice is refused', $q$insert into public.control_invoices (id, data) values ('big', jsonb_build_object('x', repeat('a', 30001)))$q$, 'check');
delete from public.control_invoices where id = 'inv-1';
select t.ok('the owner can delete', t.count($q$select 1 from public.control_invoices$q$) = 0);
select t.ok('the audit log has created, status changed and deleted, with the staff member',
  t.count($q$select 1 from public.staff_audit_log where entity = 'billing_invoice' and action in ('billing_invoice.created', 'billing_invoice.status_changed') and staff_email = 'ci-billing@s.test'$q$) = 2
  and t.count($q$select 1 from public.staff_audit_log where action = 'billing_invoice.deleted' and staff_email = 'ci-owner@s.test'$q$) = 1);
select t.ok('the log keeps the number and amount, not the whole invoice',
  (select detail ->> 'number' = 'INV-1' and detail ->> 'amount_cents' = '5000' and not detail ? 'items' from public.staff_audit_log where action = 'billing_invoice.created' limit 1));

reset role;
delete from public.staff_audit_log where entity = 'billing_invoice';
delete from public.clients where id = :cid;
delete from public.staff_members where user_id in (:own, :sup, :bil);
delete from auth.users where id in (:own, :sup, :bil, :cli);
\echo ALL CONTROL INVOICES TESTS PASSED
