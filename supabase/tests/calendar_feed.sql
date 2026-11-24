-- The private calendar link: who can make, replace, remove and see it. Runs after rls.sql (reuses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set own '''ca000000-0000-4000-8000-0000000000a1'''
\set adm '''ca000000-0000-4000-8000-0000000000a2'''
\set edt '''ca000000-0000-4000-8000-0000000000a3'''
\set vwr '''ca000000-0000-4000-8000-0000000000a4'''
\set out '''ca000000-0000-4000-8000-0000000000a5'''
\set ws '''ca000000-0000-4000-8000-0000000000b1'''
\set h1 '''1111111111111111111111111111111111111111111111111111111111111111'''
\set h2 '''2222222222222222222222222222222222222222222222222222222222222222'''

reset role;
insert into auth.users (id, email) values (:own, 'cf-owner@x.test'), (:adm, 'cf-admin@x.test'), (:edt, 'cf-editor@x.test'), (:vwr, 'cf-viewer@x.test'), (:out, 'cf-out@x.test');
insert into public.workspaces (id, name, created_by) values (:ws, 'Feed Test Co', null);
insert into public.workspace_members (workspace_id, user_id, role, display_name, email) values
  (:ws, :own, 'owner', 'O', 'cf-owner@x.test'), (:ws, :adm, 'admin', 'A', 'cf-admin@x.test'), (:ws, :edt, 'editor', 'E', 'cf-editor@x.test'), (:ws, :vwr, 'viewer', 'V', 'cf-viewer@x.test');

select t.as_user(:edt);
select t.fails('an editor cannot make the link', format($q$select public.calendar_feed_set(%L, %L)$q$, :ws, :h1), 'owner or admin');
select t.as_user(:vwr);
select t.fails('a viewer cannot make the link', format($q$select public.calendar_feed_set(%L, %L)$q$, :ws, :h1), 'owner or admin');
select t.as_user(:out);
select t.fails('an outsider cannot make the link', format($q$select public.calendar_feed_set(%L, %L)$q$, :ws, :h1), 'owner or admin');
select t.as_anon();
select t.fails('anon cannot call it at all', format($q$select public.calendar_feed_set(%L, %L)$q$, :ws, :h1), 'permission denied');

select t.as_user(:adm);
select t.fails('a link that is not a SHA-256 hash is refused', format($q$select public.calendar_feed_set(%L, 'short')$q$, :ws), 'Invalid link');
select public.calendar_feed_set(:ws, :h1);
reset role;
select t.ok('an admin can make the link, and only its hash is stored', (select token_hash from public.calendar_feeds where workspace_id = :ws) = :h1 and (select created_by from public.calendar_feeds where workspace_id = :ws) = :adm);

select t.as_user(:vwr);
select t.ok('any member can see that a link exists', public.calendar_feed_info(:ws) is not null);
select t.fails('but nobody reads the table', $q$select * from public.calendar_feeds$q$, 'permission denied');
select t.as_user(:out);
select t.ok('an outsider sees nothing', public.calendar_feed_info(:ws) is null);

select t.as_user(:own);
select public.calendar_feed_set(:ws, :h2);
reset role;
select t.ok('replacing the link replaces the hash, so the old link stops working', (select count(*) from public.calendar_feeds where workspace_id = :ws) = 1 and (select token_hash from public.calendar_feeds where workspace_id = :ws) = :h2);
select t.ok('two workspaces cannot share a link', (select count(*) from pg_indexes where indexname = 'calendar_feeds_token_hash_key') = 1);

select t.as_user(:edt);
select t.fails('an editor cannot turn it off', format($q$select public.calendar_feed_off(%L)$q$, :ws), 'owner or admin');
select t.as_user(:own);
select public.calendar_feed_off(:ws);
select t.ok('the owner can turn it off', public.calendar_feed_info(:ws) is null);
reset role;
select t.ok('turning it off removes it', (select count(*) from public.calendar_feeds where workspace_id = :ws) = 0);
select t.ok('making, replacing and removing are in the audit log', (select count(*) from public.audit_logs where workspace_id = :ws and action = 'calendar_feed.created') = 2
  and (select count(*) from public.audit_logs where workspace_id = :ws and action = 'calendar_feed.removed') = 1);

delete from public.audit_logs where workspace_id = :ws;
delete from public.workspace_members where workspace_id = :ws;
delete from public.workspaces where id = :ws;
delete from auth.users where id in (:own, :adm, :edt, :vwr, :out);
\echo ALL CALENDAR FEED TESTS PASSED
