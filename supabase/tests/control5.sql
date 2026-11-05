-- Control Center step 5 tests: error log, failed indexing, error counts.
\set own '''00000000-0000-4000-8000-0000000000a5'''
\set sup '''00000000-0000-4000-8000-0000000000a6'''
\set bil '''00000000-0000-4000-8000-0000000000a7'''
\set wsid '''00000000-0000-4000-8000-0000000000c9'''
\set mem '''00000000-0000-4000-8000-0000000000a8'''
reset role;
insert into auth.users (id, email) values (:own, 'own5@staff.test'), (:sup, 'sup5@staff.test'), (:bil, 'bil5@staff.test'), (:mem, 'm5@client.test');
insert into public.staff_members (user_id, role, display_name, email) values (:own, 'owner', 'Own5', 'own5@staff.test'), (:sup, 'support', 'Sup5', 'sup5@staff.test'), (:bil, 'billing', 'Bil5', 'bil5@staff.test');
insert into public.workspaces (id, name) values (:wsid, 'Zeta Workspace');
insert into public.clients (name, workspace_id) values ('Zeta Corp', :wsid);
insert into public.documents (workspace_id, display_name, original_name, mime_type, size_bytes, storage_key, content_status, status) values
  (:wsid, 'a.pdf', 'a.pdf', 'application/pdf', 1, :'wsid' || '/a', 'failed', 'ready'), (:wsid, 'b.pdf', 'b.pdf', 'application/pdf', 1, :'wsid' || '/b', 'indexed', 'ready');
-- The server records an error with the service role (here: the database owner).
insert into public.app_errors (source, kind, status, workspace_id) values ('dms', 'TypeError', 500, :wsid), ('dms', 'RangeError', 500, null);

select t.as_staff(:bil::uuid);
select t.ok('billing reads errors', t.count('select 1 from public.app_errors') = 2);
select t.ok('error is linked to the client by workspace', t.count($$select 1 from public.app_errors e join public.clients c on c.id = e.client_id where c.name = 'Zeta Corp'$$) = 1);
select t.fails('staff cannot add errors', $$insert into public.app_errors (source, kind) values ('x', 'y')$$);
select t.affected('billing cannot resolve', format($$update public.app_errors set resolved_at = now(), resolved_by = %L$$, :bil::text), 0);
select t.ok('failed documents are counted per client', t.count($$select 1 from public.control_failed_documents() f join public.clients c on c.id = f.client_id where c.name = 'Zeta Corp' and f.failed = 1$$) = 1);
select t.ok('error counts per client', t.count($$select 1 from public.control_error_counts() e join public.clients c on c.id = e.client_id where c.name = 'Zeta Corp' and e.errors = 1$$) = 1);

select t.as_staff(:sup::uuid);
select t.affected('support resolves an error', format($$update public.app_errors set resolved_at = now(), resolved_by = %L where kind = 'TypeError'$$, :sup::text), 1);
select t.fails('resolution cannot be credited to someone else', format($$update public.app_errors set resolved_at = now(), resolved_by = %L where kind = 'RangeError'$$, :own::text));
select t.fails('the error itself cannot be rewritten', $$update public.app_errors set kind = 'Nothing'$$);
select t.ok('resolved errors leave the per-client count', t.count('select 1 from public.control_error_counts()') = 0);

select t.as_staff(:own::uuid);
select t.ok('resolving is audited', t.count($$select 1 from public.staff_audit_log where action = 'app_error.update'$$) = 1);

select t.as_staff(:own::uuid, 'aal1');
select t.ok('password-only session sees nothing', t.count('select 1 from public.app_errors') = 0 and t.count('select 1 from public.control_failed_documents()') = 0);
select t.as_user(:mem::uuid);
select t.ok('a client user sees no errors', t.count('select 1 from public.app_errors') = 0);
reset role;
\echo ALL CONTROL5 TESTS PASSED
