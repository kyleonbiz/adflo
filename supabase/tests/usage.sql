-- Tests for 20261123100000_workspace_usage.sql. Run through run.sh after rls.sql (uses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
\set uo '''00000000-0000-4000-8000-0000000a5e01'''
\set ux '''00000000-0000-4000-8000-0000000a5e02'''
reset role;
insert into auth.users (id, email) values (:uo, 'uo@u.test'), (:ux, 'ux@u.test');
select t.as_user(:uo);
select public.create_workspace('Usage Co', 'Uma Owner', 'uo@u.test') as wsu \gset
select public.record_usage(:'wsu', 1, 1200, 0, 0);
select public.record_usage(:'wsu', 1, 800, 1, 2);
select t.ok('a member adds to this month''s counters',
  (select (public.workspace_usage_now(:'wsu')::jsonb) @> '{"aiActions":2,"tokens":2000,"ocrReads":1,"quickActions":2}'::jsonb));
select t.fails('a negative amount is refused', format('select public.record_usage(%L, -1)', :'wsu'), '22023');
select t.fails('an absurd amount is refused', format('select public.record_usage(%L, 101)', :'wsu'), '22023');
select t.as_user(:ux);
select t.fails('a non-member can not record usage', format('select public.record_usage(%L, 1)', :'wsu'), '42501');
select t.ok('a non-member reads nothing', (select public.workspace_usage_now(:'wsu')) is null);
select t.ok('the table is closed to direct reads', not has_table_privilege('authenticated', 'public.workspace_usage', 'select'));
reset role;
-- Staff read this month's counters per client (control.sql, which runs earlier, defines t.as_staff and the staff rows).
insert into public.clients (id, name, plan, workspace_id) values ('7a000000-0000-4000-8000-0000000000e1', 'Usage Client', 'adflo', :'wsu');
select t.as_staff('00000000-0000-4000-8000-0000000000a3'::uuid);
select t.ok('billing staff read the counters per client',
  (select ai_actions = 2 and tokens = 2000 and ocr_reads = 1 and quick_actions = 2 from public.control_usage_month() where client_id = '7a000000-0000-4000-8000-0000000000e1'));
select t.as_staff('00000000-0000-4000-8000-0000000000a3'::uuid, 'aal1');
select t.ok('staff without the second factor read nothing', t.count('select 1 from public.control_usage_month()') = 0);
select t.as_user(:ux);
select t.ok('a client user reads nothing', t.count('select 1 from public.control_usage_month()') = 0);
reset role;
\echo ALL USAGE TESTS PASSED
