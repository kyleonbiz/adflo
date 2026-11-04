-- Control Center step 2 tests (plans, price override, checklist, seat usage, staff team).
\set own '''00000000-0000-4000-8000-0000000000b1'''
\set sup '''00000000-0000-4000-8000-0000000000b2'''
\set bil '''00000000-0000-4000-8000-0000000000b3'''
\set newbie '''00000000-0000-4000-8000-0000000000b4'''
\set cm '''00000000-0000-4000-8000-0000000000b5'''
\set ws '''00000000-0000-4000-8000-0000000000c1'''
reset role;
insert into auth.users (id, email, last_sign_in_at) values (:own, 'own2@staff.test', now()), (:sup, 'sup2@staff.test', now()), (:bil, 'bil2@staff.test', now()),
  (:newbie, 'newbie@staff.test', now()), (:cm, 'member@client.test', '2026-10-30 10:00+00');
insert into public.staff_members (user_id, role, display_name, email) values (:own, 'owner', 'Own', 'own2@staff.test'), (:sup, 'support', 'Sup', 'sup2@staff.test'), (:bil, 'billing', 'Bil', 'bil2@staff.test');
insert into public.workspaces (id, name) values (:ws, 'Gamma Workspace');
insert into public.workspace_members (workspace_id, user_id, role) values (:ws, :cm, 'owner');
insert into public.clients (name, workspace_id) values ('Gamma LLC', :ws);

select t.as_staff(:own::uuid);
select t.affected('owner adds a plan', $$insert into public.plans (name, price_cents, seats_included) values ('pro', 9900, 10)$$, 1);
select t.affected('owner sets a client price', $$update public.clients set price_override_cents = 7900, price_note = 'founding client' where name = 'Gamma LLC'$$, 1);
select t.ok('price change is audited', t.count($$select 1 from public.staff_audit_log where action = 'client.updated' and detail ? 'price_override_cents'$$) = 1);
select t.ok('plan creation is audited', t.count($$select 1 from public.staff_audit_log where action = 'plan.insert'$$) = 1);
select t.ok('usage counts seats and last login', t.count($$select 1 from public.control_client_usage() u join public.clients c on c.id = u.client_id where c.name = 'Gamma LLC' and u.seats_used = 1 and u.last_active = '2026-10-30 10:00+00'$$) = 1);

select t.as_staff(:sup::uuid);
select t.fails('support cannot add a plan', $$insert into public.plans (name) values ('cheap')$$);
select t.affected('support cannot change a plan', $$update public.plans set price_cents = 1$$, 0);
select t.fails('support cannot set a client price', $$update public.clients set price_override_cents = 1 where name = 'Gamma LLC'$$, 'Only the Owner');
select t.affected('support can change seats', $$update public.clients set seats_limit = 8 where name = 'Gamma LLC'$$, 1);
select t.affected('support ticks a checklist step', format($$insert into public.client_checklist (client_id, step, done_by) select id, 'workspace', %L from public.clients where name = 'Gamma LLC'$$, :sup::text), 1);
select t.fails('a step cannot be ticked as someone else', format($$insert into public.client_checklist (client_id, step, done_by) select id, 'plan_set', %L from public.clients where name = 'Gamma LLC'$$, :own::text));
select t.fails('unknown step is refused', format($$insert into public.client_checklist (client_id, step, done_by) select id, 'bogus', %L from public.clients where name = 'Gamma LLC'$$, :sup::text));
select t.affected('support unticks a step', $$delete from public.client_checklist where step = 'workspace'$$, 1);
select t.fails('support cannot add staff', $$select public.control_add_staff('newbie@staff.test', 'support', 'N')$$, 'Only the Owner');
select t.affected('support cannot promote themselves', format($$update public.staff_members set role = 'owner' where user_id = %L$$, :sup::text), 0);

select t.as_staff(:bil::uuid);
select t.ok('billing reads plans', t.count('select 1 from public.plans') = 2);
select t.fails('billing cannot tick a step', format($$insert into public.client_checklist (client_id, step, done_by) select id, 'workspace', %L from public.clients where name = 'Gamma LLC'$$, :bil::text));

select t.as_staff(:own::uuid, 'aal1');
select t.ok('owner without a second factor sees no plans or usage', t.count('select 1 from public.plans') = 0 and t.count('select 1 from public.control_client_usage()') = 0);

select t.as_staff(:own::uuid);
select t.ok('owner adds a person who has signed up', public.control_add_staff('Newbie@staff.test', 'support', 'Newbie') = :newbie::uuid);
select t.fails('unknown email is refused', $$select public.control_add_staff('ghost@nowhere.test', 'support', 'G')$$, 'sign up first');
select t.ok('team change is audited', t.count($$select 1 from public.staff_audit_log where action = 'staff.insert' and detail ->> 'email' = 'newbie@staff.test'$$) = 1);
select t.affected('owner changes a role', format($$update public.staff_members set role = 'billing' where user_id = %L$$, :newbie::text), 1);
select t.affected('owner deactivates a person', format($$update public.staff_members set active = false where user_id = %L$$, :newbie::text), 1);
-- Other owners from earlier test files are still active, so make this the only one to test the guard.
reset role;
update public.staff_members set active = false where role = 'owner' and user_id <> :own;
select t.as_staff(:own::uuid);
select t.fails('the last owner cannot be demoted', format($$update public.staff_members set role = 'support' where user_id = %L$$, :own::text), 'one active Owner');
select t.fails('the last owner cannot deactivate themselves', format($$update public.staff_members set active = false where user_id = %L$$, :own::text), 'one active Owner');
reset role;
\echo ALL CONTROL2 TESTS PASSED
