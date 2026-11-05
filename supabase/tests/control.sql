-- Control Center tests: run after rls.sql by run.sh (reuses the t.* helpers it defines).
\set sam '''00000000-0000-4000-8000-0000000000a1'''
\set sue '''00000000-0000-4000-8000-0000000000a2'''
\set bill '''00000000-0000-4000-8000-0000000000a3'''
\set cli '''00000000-0000-4000-8000-0000000000a4'''
create function t.as_staff(u uuid, level text default 'aal2') returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'aal', level)::text, false);
  set role authenticated;
end $$;
grant execute on function t.as_staff(uuid, text) to public;
reset role;
insert into auth.users (id, email) values (:sam, 'sam@staff.test'), (:sue, 'sue@staff.test'), (:bill, 'bill@staff.test'), (:cli, 'client@c.test');
insert into public.staff_members (user_id, role, display_name, email) values
  (:sam, 'owner', 'Sam', 'sam@staff.test'), (:sue, 'support', 'Sue', 'sue@staff.test'), (:bill, 'billing', 'Bill', 'bill@staff.test');

select t.as_user(:cli::uuid);
select t.ok('client user cannot read clients', t.count('select 1 from public.clients') = 0);
select t.ok('client user cannot read staff', t.count('select 1 from public.staff_members') = 0);
select t.ok('client user cannot read audit log', t.count('select 1 from public.staff_audit_log') = 0);
select t.fails('client user cannot create a client', $$insert into public.clients (name) values ('Nope Co')$$);
select t.as_staff(:sam::uuid, 'aal1');
select t.ok('owner with only a password sees no clients', t.count('select 1 from public.clients') = 0);
select t.ok('...nor the audit log', t.count('select 1 from public.staff_audit_log') = 0);
select t.ok('...but can read their own staff row to be asked for a code', t.count('select 1 from public.staff_members') = 1);
select t.fails('...and cannot create a client', $$insert into public.clients (name) values ('Sneaky Co')$$);
select t.as_anon();
select t.fails('anon cannot read clients', 'select 1 from public.clients');

select t.as_staff(:sue::uuid);
select t.affected('support creates a client', $$insert into public.clients (name, plan, seats_limit) values ('Acme Roofing', 'standard', 5)$$, 1);
select t.affected('support suspends a client', $$update public.clients set status = 'suspended' where name = 'Acme Roofing'$$, 1);
select t.fails('support cannot delete a client', $$delete from public.clients$$);
select t.ok('support cannot read the audit log', t.count('select 1 from public.staff_audit_log') = 0);
select t.ok('support sees only their own staff row', t.count('select 1 from public.staff_members') = 1);
select t.fails('seat limit cannot be negative', $$update public.clients set seats_limit = -1$$);

select t.as_staff(:bill::uuid);
select t.ok('billing can read clients', t.count('select 1 from public.clients') = 1);
select t.affected('billing cannot edit a client', $$update public.clients set plan = 'pro'$$, 0);
select t.fails('billing cannot create a client', $$insert into public.clients (name) values ('Other Co')$$);

select t.as_staff(:sam::uuid);
select t.ok('owner reads the audit log', t.count($$select 1 from public.staff_audit_log where entity = 'client'$$) = 2);
select t.ok('audit records who suspended', t.count($$select 1 from public.staff_audit_log where action = 'client.status_changed' and staff_email = 'sue@staff.test'$$) = 1);
select t.fails('nobody writes the audit log directly', $$insert into public.staff_audit_log (action, entity) values ('x', 'y')$$);
select t.ok('owner sees all staff', t.count('select 1 from public.staff_members') = 3);

reset role;
update public.staff_members set active = false where user_id = :sue;
select t.as_staff(:sue::uuid);
select t.ok('deactivated staff lose access', t.count('select 1 from public.clients') = 0);
reset role;
\echo ALL CONTROL TESTS PASSED
