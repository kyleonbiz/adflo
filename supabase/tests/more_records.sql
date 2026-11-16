-- Tests for 20261116160000_more_records_and_activity.sql: the extra saved services and the append-only activity trail.
-- Run through run.sh after rls.sql (uses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
\set ma '''00000000-0000-4000-8000-00000000ad01'''
\set me '''00000000-0000-4000-8000-00000000ad02'''
\set mv '''00000000-0000-4000-8000-00000000ad03'''
\set mx '''00000000-0000-4000-8000-00000000ad04'''
reset role;
insert into auth.users (id, email) values (:ma, 'ma@m.test'), (:me, 'me@m.test'), (:mv, 'mv@m.test'), (:mx, 'mx@m.test');
select t.as_user(:ma);
select public.create_workspace('More A', 'Mia Owner', 'ma@m.test') as wsa \gset
select t.as_user(:mx);
select public.create_workspace('More X', 'Max Other', 'mx@m.test') as wsx \gset
reset role;
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values
  (:'wsa', :me, 'editor', 'Edith Editor', 'me@m.test'),
  (:'wsa', :mv, 'viewer', 'Vic Viewer', 'mv@m.test');

-- ------------------------------------------------ the extra saved services
select t.as_user(:me);
insert into public.workspace_records (workspace_id, kind, id, data)
  select :'wsa', k, 'x1', '{}'::jsonb
  from unnest(array['todos', 'reminders', 'signing', 'packets', 'schedules', 'projecttypes', 'settings', 'setup', 'chains']) k;
select t.ok('an editor saves all nine new services', t.count($$select 1 from public.workspace_records where id = 'x1'$$) = 9);
insert into public.workspace_record_sets (workspace_id, kind)
  select :'wsa', k from unnest(array['todos', 'settings', 'chains']) k;
select t.ok('and marks them as saved', t.count('select 1 from public.workspace_record_sets') = 3);
select t.fails('a service that does not exist is still refused',
  format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'audit', 'a', '{}')$$, :'wsa'), 'check');
select t.fails('the activity trail is not a records service',
  format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'activity', 'a', '{}')$$, :'wsa'), 'check');
select t.as_user(:mv);
select t.ok('a viewer reads the new services', t.count($$select 1 from public.workspace_records where id = 'x1'$$) = 9);
select t.fails('a viewer cannot save a new service',
  format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'todos', 'v1', '{}')$$, :'wsa'), 'row-level security');
select t.as_user(:mx);
select t.ok('another workspace sees none of it', t.count($$select 1 from public.workspace_records where id = 'x1'$$) = 0);

-- ------------------------------------------------ the activity trail: appending
select t.as_user(:me);
insert into public.workspace_activity (workspace_id, id, at, actor_id, data)
  values (:'wsa', 'act-1', '2000-01-01', :ma::uuid, '{"verb":"created","what":"invoice INV-1","area":"Invoices","href":"/app/invoices","by":"Somebody Else"}');
select t.ok('an editor adds a line', t.count('select 1 from public.workspace_activity') = 1);
select t.ok('the time is set by the database, not the app',
  (select at > now() - interval '1 minute' from public.workspace_activity where id = 'act-1'));
select t.ok('the person is set by the database, not the app',
  (select actor_id = :me::uuid from public.workspace_activity where id = 'act-1'));
select t.ok('the name comes from the membership, not the app',
  (select data ->> 'by' from public.workspace_activity where id = 'act-1') = 'Edith Editor');
select t.ok('everything else the app sent is kept',
  (select data ->> 'what' from public.workspace_activity where id = 'act-1') = 'invoice INV-1');
select t.affected('sending the same line again (a retry) is harmless',
  format($$insert into public.workspace_activity (workspace_id, id, data) values (%L, 'act-1', '{"verb":"x"}') on conflict do nothing$$, :'wsa'), 0);
select t.fails('but a plain duplicate is an error',
  format($$insert into public.workspace_activity (workspace_id, id, data) values (%L, 'act-1', '{"verb":"x"}')$$, :'wsa'), 'duplicate key');
select t.fails('a line must be a JSON object',
  format($$insert into public.workspace_activity (workspace_id, id, data) values (%L, 'bad', '[1]')$$, :'wsa'), 'check');
select t.fails('a huge line is refused',
  format($$insert into public.workspace_activity (workspace_id, id, data) values (%L, 'big', jsonb_build_object('x', repeat('a', 4001)))$$, :'wsa'), 'check');
select t.fails('an empty id is refused',
  format($$insert into public.workspace_activity (workspace_id, id, data) values (%L, '', '{}')$$, :'wsa'), 'check');

-- ------------------------------------------------ the activity trail: nobody can rewrite history
select t.fails('a line cannot be edited', $$update public.workspace_activity set data = '{"verb":"x"}'$$, 'permission denied');
select t.fails('a line cannot be removed', $$delete from public.workspace_activity$$, 'permission denied');
select t.fails('the trail cannot be emptied', $$truncate public.workspace_activity$$, 'permission denied');
select t.as_user(:ma);
select t.fails('not even the owner can edit a line', $$update public.workspace_activity set data = '{"verb":"x"}'$$, 'permission denied');
select t.fails('or remove one', $$delete from public.workspace_activity$$, 'permission denied');
select t.ok('the owner reads the trail', t.count('select 1 from public.workspace_activity') = 1);

-- ------------------------------------------------ the activity trail: who can read and write
select t.as_user(:mv);
select t.ok('a viewer reads the trail', t.count('select 1 from public.workspace_activity') = 1);
select t.fails('a viewer cannot add a line',
  format($$insert into public.workspace_activity (workspace_id, id, data) values (%L, 'v1', '{}')$$, :'wsa'), 'row-level security');
select t.as_user(:mx);
select t.ok('another workspace sees none of the trail', t.count('select 1 from public.workspace_activity') = 0);
select t.fails('another workspace cannot write into this one''s trail',
  format($$insert into public.workspace_activity (workspace_id, id, data) values (%L, 'x1', '{}')$$, :'wsa'), 'row-level security');
select t.as_anon();
select t.fails('anon cannot read the trail', 'select 1 from public.workspace_activity', 'permission denied');
select t.fails('anon cannot write to the trail',
  format($$insert into public.workspace_activity (workspace_id, id, data) values (%L, 'a1', '{}')$$, :'wsa'), 'permission denied');

reset role;
select t.ok('the API roles hold only select and insert on the trail',
  has_table_privilege('authenticated', 'public.workspace_activity', 'select')
  and has_table_privilege('authenticated', 'public.workspace_activity', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_activity', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_activity', 'delete')
  and not has_table_privilege('authenticated', 'public.workspace_activity', 'truncate')
  and not has_table_privilege('anon', 'public.workspace_activity', 'select'));
\echo ALL MORE RECORDS TESTS PASSED
