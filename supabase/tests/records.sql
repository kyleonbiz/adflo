-- Saved records (workspace_records / workspace_record_sets) tests. Run through run.sh after rls.sql (uses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
\set ra '''00000000-0000-4000-8000-00000000ab01'''
\set rb '''00000000-0000-4000-8000-00000000ab02'''
\set rv '''00000000-0000-4000-8000-00000000ab03'''
\set re '''00000000-0000-4000-8000-00000000ab04'''
\set rx '''00000000-0000-4000-8000-00000000ab05'''
reset role;
insert into auth.users (id, email) values (:ra, 'ra@r.test'), (:rb, 'rb@r.test'), (:rv, 'rv@r.test'), (:re, 're@r.test'), (:rx, 'rx@r.test');
select t.as_user(:ra);
select public.create_workspace('Records A', 'Ra', 'ra@r.test') as wsa \gset
select t.as_user(:rb);
select public.create_workspace('Records B', 'Rb', 'rb@r.test') as wsb \gset
reset role;
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values
  (:'wsa', :rv, 'viewer', 'Viewer', 'rv@r.test'),
  (:'wsa', :re, 'editor', 'Editor', 're@r.test');

-- Editors and owners can save; the saver is recorded and the change time is set by the database.
select t.as_user(:re);
insert into public.workspace_records (workspace_id, kind, id, data) values (:'wsa', 'licenses', 'lic-1', '{"name":"State license"}');
select t.ok('an editor saves a record', t.count('select 1 from public.workspace_records') = 1);
select t.ok('the saver is recorded', (select updated_by from public.workspace_records where id = 'lic-1') = :re::uuid);
select t.affected('an editor updates a record', $$update public.workspace_records set data = '{"name":"State license 2"}' where id = 'lic-1'$$, 1);
insert into public.workspace_record_sets (workspace_id, kind) values (:'wsa', 'licenses');
select t.ok('an editor marks a service as saved', t.count('select 1 from public.workspace_record_sets') = 1);
insert into public.workspace_records (workspace_id, kind, id, data, updated_by) values (:'wsa', 'licenses', 'lic-2', '{}', :ra::uuid);
select t.ok('a save cannot be credited to someone else', (select updated_by from public.workspace_records where id = 'lic-2') = :re::uuid);
delete from public.workspace_records where id = 'lic-2';
select t.fails('the same record id cannot be saved twice', format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'licenses', 'lic-1', '{}')$$, :'wsa'));
select t.affected('an editor deletes a record', $$delete from public.workspace_records where id = 'lic-1'$$, 1);
insert into public.workspace_records (workspace_id, kind, id, data) values (:'wsa', 'projects', 'p-1', '{"name":"Audit","tasks":[]}');

-- The app saves with upsert; another editor (here the owner) must be able to update a record someone else created.
select t.as_user(:ra);
insert into public.workspace_records (workspace_id, kind, id, data) values (:'wsa', 'projects', 'p-1', '{"name":"Audit v2","tasks":[]}')
  on conflict (workspace_id, kind, id) do update set data = excluded.data;
select t.ok('upsert updates a record another person created', (select data->>'name' from public.workspace_records where id = 'p-1') = 'Audit v2');
select t.ok('and records who changed it', (select updated_by from public.workspace_records where id = 'p-1') = :ra::uuid);
insert into public.workspace_record_sets (workspace_id, kind) values (:'wsa', 'licenses') on conflict do nothing;
select t.ok('marking a service as saved twice is harmless', t.count('select 1 from public.workspace_record_sets') = 1);

-- Viewers read but never write.
select t.as_user(:rv);
select t.ok('a viewer reads the records', t.count('select 1 from public.workspace_records') = 1);
select t.fails('a viewer cannot add a record', format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'licenses', 'v-1', '{}')$$, :'wsa'), 'row-level security');
select t.affected('a viewer cannot change a record', $$update public.workspace_records set data = '{"x":1}'$$, 0);
select t.affected('a viewer cannot delete a record', $$delete from public.workspace_records$$, 0);
select t.fails('a viewer cannot mark a service as saved', format($$insert into public.workspace_record_sets (workspace_id, kind) values (%L, 'projects')$$, :'wsa'), 'row-level security');

-- Other workspaces and strangers see and touch nothing.
select t.as_user(:rb);
select t.ok('another workspace sees none of it', t.count('select 1 from public.workspace_records') = 0 and t.count('select 1 from public.workspace_record_sets') = 0);
select t.fails('another workspace cannot write into this one', format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'licenses', 'x-1', '{}')$$, :'wsa'), 'row-level security');
select t.as_user(:rx);
select t.ok('a user with no workspace sees nothing', t.count('select 1 from public.workspace_records') = 0);
select t.as_anon();
select t.fails('anon cannot read records', 'select 1 from public.workspace_records', 'permission denied');

-- Shape limits.
select t.as_user(:ra);
select t.fails('an unknown service is refused', format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'secrets', 'a', '{}')$$, :'wsa'), 'check');
select t.fails('a record must be a JSON object', format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'licenses', 'a', '[1]')$$, :'wsa'), 'check');
select t.fails('an empty id is refused', format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'licenses', '', '{}')$$, :'wsa'), 'check');
select t.fails('a huge record is refused', format($$insert into public.workspace_records (workspace_id, kind, id, data) values (%L, 'licenses', 'big', jsonb_build_object('x', repeat('a', 200001)))$$, :'wsa'), 'check');
select t.ok('the owner sees the workspace''s records', t.count('select 1 from public.workspace_records') = 1);

reset role;
\echo ALL RECORDS TESTS PASSED
