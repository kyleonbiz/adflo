-- Tests for 20261125100000_seat_limit.sql. Run through run.sh after rls.sql (uses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
\set so '''00000000-0000-4000-8000-0000000005e1'''
\set sp '''00000000-0000-4000-8000-0000000005e2'''
reset role;
insert into auth.users (id, email) values (:so, 'seat-owner@s.test'), (:sp, 'plain-owner@s.test');
select t.as_user(:so);
select public.create_workspace('Seats Co', 'Sam Seat', 'seat-owner@s.test') as wss \gset
select t.as_user(:sp);
select public.create_workspace('No Client Co', 'Pat Plain', 'plain-owner@s.test') as wsn \gset
reset role;
-- A client record for Seats Co with 2 seats (the owner already uses one). Create_workspace may already have made one.
delete from public.clients where workspace_id = :'wss';
insert into public.clients (name, plan, seats_limit, workspace_id) values ('Seats Client', 'adflo', 2, :'wss');
delete from public.clients where workspace_id = :'wsn';

select t.as_user(:so);
select public.dms_invite_member(:'wss', 'one@s.test', 'viewer');
select t.ok('the second seat can be invited', (select count(*) from public.workspace_invites where workspace_id = :'wss') = 1);
select t.fails('a third person is refused at the seat limit', format($q$select public.dms_invite_member(%L, 'two@s.test', 'viewer')$q$, :'wss'), 'seat_limit');
select public.dms_invite_member(:'wss', 'one@s.test', 'editor');
select t.ok('inviting the same address again uses no extra seat',
  (select count(*) from public.workspace_invites where workspace_id = :'wss') = 1 and (select role from public.workspace_invites where workspace_id = :'wss') = 'editor');
reset role;
update public.clients set seats_limit = 3 where workspace_id = :'wss';
select t.as_user(:so);
select public.dms_invite_member(:'wss', 'two@s.test', 'viewer');
select t.ok('raising the limit lets the next person in', (select count(*) from public.workspace_invites where workspace_id = :'wss') = 2);
reset role;
update public.workspace_invites set expires_at = now() - interval '1 day' where workspace_id = :'wss' and email = 'two@s.test';
select t.as_user(:so);
select public.dms_invite_member(:'wss', 'three@s.test', 'viewer');
select t.ok('an expired invite no longer holds a seat', (select count(*) from public.workspace_invites where workspace_id = :'wss' and email = 'three@s.test') = 1);

select t.as_user(:sp);
select public.dms_invite_member(:'wsn', 'a@p.test', 'viewer');
select public.dms_invite_member(:'wsn', 'b@p.test', 'viewer');
select public.dms_invite_member(:'wsn', 'c@p.test', 'viewer');
select t.ok('a workspace with no client record has no seat limit', (select count(*) from public.workspace_invites where workspace_id = :'wsn') = 3);
reset role;
\echo ALL SEATS TESTS PASSED
