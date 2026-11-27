-- The free trial's length is passed in by the app and kept to a sensible range. Runs after rls.sql (reuses its t.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\set u1 '''de000000-0000-4000-8000-0000000000a1'''
\set u2 '''de000000-0000-4000-8000-0000000000a2'''
\set u3 '''de000000-0000-4000-8000-0000000000a3'''

reset role;
update public.signup_settings set open = true;
insert into auth.users (id, email) values (:u1, 'tl-one@x.test'), (:u2, 'tl-two@x.test'), (:u3, 'tl-three@x.test');

select t.as_user(:u1);
select * from public.start_trial('Fourteen Day Co', 'One', 14);
select t.as_user(:u2);
select * from public.start_trial('Ninety Day Co', 'Two', 90);
select t.as_user(:u3);
select * from public.start_trial('Default Day Co', 'Three');
reset role;
select t.ok('a 14-day trial lasts 14 days', (select trial_ends_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour' from public.clients where name = 'Fourteen Day Co'));
select t.ok('a length that is not sensible falls back to 3 days', (select trial_ends_at between now() + interval '2 days 23 hours' and now() + interval '3 days 1 hour' from public.clients where name = 'Ninety Day Co'));
select t.ok('no length means 3 days', (select trial_ends_at between now() + interval '2 days 23 hours' and now() + interval '3 days 1 hour' from public.clients where name = 'Default Day Co'));

delete from public.clients where name in ('Fourteen Day Co', 'Ninety Day Co', 'Default Day Co');
delete from auth.users where id in (:u1, :u2, :u3);
\echo ALL TRIAL LENGTH TESTS PASSED
