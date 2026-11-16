-- Tests for 20261112201947_security_open_items.sql and 20261116150000_least_privilege_grants.sql.
-- Run through run.sh after rls.sql (uses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
\set oo '''00000000-0000-4000-8000-00000000ac01'''
\set oe '''00000000-0000-4000-8000-00000000ac02'''
\set doc1 '''9a000000-0000-4000-8000-000000000001'''
reset role;
insert into auth.users (id, email) values (:oo, 'oo@o.test'), (:oe, 'oe@o.test');
select t.as_user(:oo);
select public.create_workspace('Open Items', 'Olive Owner', 'oo@o.test') as wso \gset
reset role;
insert into public.workspace_members (workspace_id, user_id, role, display_name, email)
  values (:'wso', :oe, 'editor', 'Eddie Editor', 'oe@o.test');

-- ------------------------------------------------ the uploader's name comes from the membership
select t.as_user(:oe);
select public.dms_begin_upload(:'wso', null, :doc1, 'n.pdf', 'n.pdf', null, 'other', 'application/pdf', 10, 'o1', 'pdf', 'Someone Else') as r1 \gset
reset role;
select t.ok('the document records the member''s own name, not the client-supplied one',
  (select uploaded_by_name from public.documents where id = :doc1) = 'Eddie Editor');
select t.ok('the version records the member''s own name too',
  (select created_by_name from public.document_versions where document_id = :doc1) = 'Eddie Editor');

-- ------------------------------------------------ at most 20 pending uploads per person
select t.as_user(:oe);
select public.dms_begin_upload(:'wso', null, gen_random_uuid(), 'f' || g || '.pdf', 'f' || g || '.pdf', null, 'other',
  'application/pdf', 10, 'n' || g, 'pdf', 'x') from generate_series(2, 20) g;
select t.ok('twenty pending uploads are allowed',
  (select count(*) from public.document_versions where created_by = :oe and status = 'pending') = 20);
select t.fails('a 21st pending upload is refused',
  format($q$select public.dms_begin_upload(%L, null, gen_random_uuid(), 'x.pdf', 'x.pdf', null, 'other', 'application/pdf', 10, 'n21', 'pdf', 'x')$q$, :'wso'),
  'too_many_pending');
select t.as_user(:oo);
select t.ok('the cap is per person: another member can still upload',
  public.dms_begin_upload(:'wso', null, gen_random_uuid(), 'o.pdf', 'o.pdf', null, 'other', 'application/pdf', 10, 'own1', 'pdf', 'x') is not null);

-- ------------------------------------------------ removing a member revokes the share links they made
select t.as_user(:oe);
insert into public.document_share_links (workspace_id, document_id, token_hash, expires_at, created_by)
  values (:'wso', :doc1, 'oi-live', now() + interval '3 days', :oe);
select t.as_user(:oo);
select public.dms_remove_member(:'wso', :oe);
reset role;
select t.ok('the removed member''s active share link is revoked',
  (select revoked_at is not null from public.document_share_links where token_hash = 'oi-live'));
select t.ok('the removal is audited with the number of links revoked',
  (select metadata ->> 'linksRevoked' from public.audit_logs
     where workspace_id = :'wso' and action = 'member.removed' order by created_at desc limit 1) = '1');

-- ------------------------------------------------ signed-in users hold only the privileges the app uses
select t.ok('nobody can truncate a records table through the API role',
  not has_table_privilege('authenticated', 'public.workspace_records', 'truncate')
  and not has_table_privilege('authenticated', 'public.workspace_record_sets', 'truncate'));
select t.ok('the marker table is select and insert only',
  has_table_privilege('authenticated', 'public.workspace_record_sets', 'select')
  and has_table_privilege('authenticated', 'public.workspace_record_sets', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_record_sets', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_record_sets', 'delete'));
select t.ok('the audit trail is read-only for clients',
  has_table_privilege('authenticated', 'public.audit_logs', 'select')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'insert')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'update')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'delete'));
select t.ok('workspaces and memberships are read-only for clients',
  not has_table_privilege('authenticated', 'public.workspaces', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'delete'));
select t.ok('versions are created only through the upload functions',
  not has_table_privilege('authenticated', 'public.document_versions', 'insert')
  and not has_table_privilege('authenticated', 'public.document_versions', 'update'));
select t.ok('no table gives the API roles truncate, references or trigger',
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')));
select t.ok('the app still reads and writes what it needs',
  has_table_privilege('authenticated', 'public.documents', 'update')
  and has_table_privilege('authenticated', 'public.workspace_records', 'insert')
  and has_table_privilege('authenticated', 'public.workspace_records', 'delete')
  and has_table_privilege('authenticated', 'public.document_versions', 'delete'));

reset role;
\echo ALL OPEN ITEMS TESTS PASSED
