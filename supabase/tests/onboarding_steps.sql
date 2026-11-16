-- Onboarding guide tests: all eight steps can be ticked, and nothing else.
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set sue '''00000000-0000-4000-8000-0000000000a2'''
\set cid '''7c000000-0000-4000-8000-000000000001'''
reset role;
update public.staff_members set active = true where user_id = :sue;
insert into public.clients (id, name) values (:cid, 'Steps Co');
select t.as_staff(:sue::uuid);
select t.affected('all eight steps can be ticked', format($q$insert into public.client_checklist (client_id, step, done_by) select %L, s, %L from unnest(array['details','workspace','owner_invited','welcome_sent','agreement_sent','plan_set','first_login','live']) s$q$, :cid, :sue), 8);
select t.fails('an unknown step is refused', format($q$insert into public.client_checklist (client_id, step, done_by) values (%L, 'made_up', %L)$q$, :cid, :sue), 'check');
reset role;
delete from public.clients where id = :cid;
delete from public.staff_audit_log where entity_id = '7c000000-0000-4000-8000-000000000001' or detail ->> 'client_id' = '7c000000-0000-4000-8000-000000000001';
update public.staff_members set active = false where user_id = :sue;
\echo ALL ONBOARDING STEPS TESTS PASSED
