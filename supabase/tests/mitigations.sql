-- Regression tests for security review items 14, 15, 16. Included from rls.sql.
\set kim  '''00000000-0000-4000-8000-0000000000e1'''
\set lee  '''00000000-0000-4000-8000-0000000000e2'''
reset role;
insert into auth.users (id, email, email_confirmed_at) values (:kim, 'kim@m.test', now()), (:lee, 'lee@m.test', now());
select t.as_user(:kim);
select public.create_workspace('Mit Co', 'Kim Real', 'kim@m.test') as wsm \gset
reset role;
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values (:'wsm', :lee, 'editor', 'Lee Real', 'lee@m.test');

-- 14: the uploaded-by label comes from the member row
select t.as_user(:lee);
select public.dms_begin_upload(:'wsm', null, 'a0000000-0000-4000-8000-0000000000a1', 'a.pdf', 'a.pdf', null, 'other',
  'application/pdf', 10, 'mit1', 'pdf', 'Totally Someone Else');
reset role;
select t.ok('uploaded_by_name ignores the caller-supplied name',
  (select uploaded_by_name from public.documents where id = 'a0000000-0000-4000-8000-0000000000a1') = 'Lee Real');
select t.ok('version created_by_name ignores the caller-supplied name',
  (select created_by_name from public.document_versions where document_id = 'a0000000-0000-4000-8000-0000000000a1') = 'Lee Real');

-- 15: per-user pending cap (one already pending above)
select t.as_user(:lee);
select public.dms_begin_upload(:'wsm', null, gen_random_uuid(), 'p' || g || '.pdf', 'p' || g || '.pdf', null, 'other',
  'application/pdf', 1, 'mp' || g, 'pdf', '') from generate_series(1, 19) g;
select t.fails('the 21st pending upload is refused',
  format($q$select public.dms_begin_upload(%L, null, gen_random_uuid(), 'x.pdf', 'x.pdf', null, 'other', 'application/pdf', 1, 'mpx', 'pdf', '')$q$, :'wsm'),
  'too_many_pending');
select t.as_user(:kim);
select t.ok('another member is not affected by the cap',
  (select public.dms_begin_upload(:'wsm', null, gen_random_uuid(), 'k.pdf', 'k.pdf', null, 'other', 'application/pdf', 1, 'mk1', 'pdf', '')) is not null);

-- 16: removing a member revokes their share links
reset role;
select id as doc_m from public.documents where id = 'a0000000-0000-4000-8000-0000000000a1' \gset
update public.document_versions set status = 'ready' where document_id = :'doc_m';
select set_config('dms.rpc', '1', false);
update public.documents set status = 'ready', current_version = 1 where id = :'doc_m';
select set_config('dms.rpc', '', false);
select t.as_user(:lee);
insert into public.document_share_links (workspace_id, document_id, token_hash, expires_at, created_by)
  values (:'wsm', :'doc_m', 'lee-link', now() + interval '1 day', :lee);
select t.as_user(:kim);
select public.dms_remove_member(:'wsm', :lee);
reset role;
select t.ok('removed member''s live share link is revoked',
  (select revoked_at is not null from public.document_share_links where token_hash = 'lee-link'));
select t.ok('removal audit records the revoked link count',
  exists (select 1 from public.audit_logs where action = 'member.removed' and actor_id = :kim and (metadata ->> 'linksRevoked')::int = 1));
\echo mitigations tests done
