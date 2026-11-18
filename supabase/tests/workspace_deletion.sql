-- Workspace deletion tests: owner-only request with a typed name, a 30-day grace period, cancel, the nightly due list and the cascade.
\set own '''00000000-0000-4000-8000-0000000000e9'''
\set edt '''00000000-0000-4000-8000-0000000000ea'''
\set wsid '''00000000-0000-4000-8000-0000000000eb'''
reset role;
insert into auth.users (id, email) values (:own, 'own-del@client.test'), (:edt, 'edt-del@client.test');
insert into public.workspaces (id, name) values (:wsid, 'Delete Me Co');
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values
  (:wsid, :own, 'owner', 'Owner', 'own-del@client.test'), (:wsid, :edt, 'editor', 'Editor', 'edt-del@client.test');
insert into public.documents (id, workspace_id, original_name, display_name, mime_type, size_bytes, status, current_version)
  values ('7c000000-0000-4000-8000-0000000000d1', :wsid, 'x.pdf', 'x.pdf', 'application/pdf', 1, 'ready', 1);
insert into public.document_versions (workspace_id, document_id, version_number, storage_key, mime_type, size_bytes, status)
  values (:wsid, '7c000000-0000-4000-8000-0000000000d1', 1, :wsid || '/7c000000-0000-4000-8000-0000000000d1/1', 'application/pdf', 1, 'ready');
insert into public.workspace_records (workspace_id, kind, id, data) values (:wsid, 'contacts', 'c1', '{"name":"A"}');

select t.as_user(:edt::uuid);
select t.fails('an editor cannot request deletion', format($$select public.workspace_request_deletion(%L, 'Delete Me Co')$$, :wsid::text));
select t.fails('an editor cannot write the columns directly', format($$update public.workspaces set deletion_requested_at = now() where id = %L$$, :wsid::text));
reset role;
select t.as_user(:own::uuid);
select t.fails('the wrong name is refused', format($$select public.workspace_request_deletion(%L, 'delete me')$$, :wsid::text));
select t.ok('nothing is scheduled by a refused request', (select deletion_requested_at is null from public.workspaces where id = :wsid));
select public.workspace_request_deletion(:wsid, '  delete me co ') as first_at \gset
select t.ok('the owner can request with the name typed in any case', :'first_at' is not null);
select t.ok('the request time is saved with who asked', (select deletion_requested_by = :own::uuid and deletion_requested_at is not null from public.workspaces where id = :wsid));
select pg_sleep(0.01);
select t.ok('asking again keeps the first request time', public.workspace_request_deletion(:wsid, 'Delete Me Co') = :'first_at'::timestamptz);
reset role;
select t.ok('the request is in the workspace audit trail', (select count(*) from public.audit_logs where workspace_id = :wsid and action = 'workspace.deletion_requested') = 1);

-- not due yet
select t.ok('a new request is not due', (select count(*) from public.dms_due_workspace_deletions() where id = :wsid) = 0);

-- cancel
select t.as_user(:edt::uuid);
select t.fails('an editor cannot cancel', format($$select public.workspace_cancel_deletion(%L)$$, :wsid::text));
reset role;
select t.as_user(:own::uuid);
select public.workspace_cancel_deletion(:wsid);
select t.ok('cancelling clears the request', (select deletion_requested_at is null and deletion_requested_by is null from public.workspaces where id = :wsid));
select public.workspace_request_deletion(:wsid, 'Delete Me Co');
reset role;

-- the nightly list
update public.workspaces set deletion_requested_at = now() - interval '31 days' where id = :wsid;
select t.as_user(:own::uuid);
select t.fails('a client user cannot read the due list', $$select * from public.dms_due_workspace_deletions()$$);
reset role;
select t.ok('after 30 days the workspace is due, with who asked', (select count(*) from public.dms_due_workspace_deletions() where id = :wsid and requested_by = :own::uuid) = 1);
update public.workspaces set deletion_requested_at = now() - interval '29 days' where id = :wsid;
select t.ok('at 29 days it is not due yet', (select count(*) from public.dms_due_workspace_deletions() where id = :wsid) = 0);

-- the cascade (the job removes the stored files first, then this)
select t.ok('before: the workspace has documents, versions and records', (select count(*) from public.documents where workspace_id = :wsid) = 1
  and (select count(*) from public.document_versions where workspace_id = :wsid) = 1 and (select count(*) from public.workspace_records where workspace_id = :wsid) = 1);
delete from public.workspaces where id = :wsid;
select t.ok('after: the workspace and everything in it is gone', (select count(*) from public.workspaces where id = :wsid) = 0
  and (select count(*) from public.documents where workspace_id = :wsid) = 0
  and (select count(*) from public.document_versions where workspace_id = :wsid) = 0
  and (select count(*) from public.workspace_records where workspace_id = :wsid) = 0
  and (select count(*) from public.workspace_members where workspace_id = :wsid) = 0
  and (select count(*) from public.audit_logs where workspace_id = :wsid) = 0);
select t.ok('the people themselves are not touched by the cascade', (select count(*) from auth.users where id in (:own, :edt)) = 2);
\echo ALL WORKSPACE DELETION TESTS PASSED
