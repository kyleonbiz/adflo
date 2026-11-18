-- Job runs tests: staff read the last run of each scheduled job; nobody else sees it and staff cannot write it.
\set bil '''00000000-0000-4000-8000-0000000000e7'''
\set mem '''00000000-0000-4000-8000-0000000000e8'''
reset role;
insert into auth.users (id, email) values (:bil, 'bil-jr@staff.test'), (:mem, 'm-jr@client.test');
insert into public.staff_members (user_id, role, display_name, email) values (:bil, 'billing', 'BilJr', 'bil-jr@staff.test');
-- The server records a run with the service role (here: the database owner).
insert into public.job_runs (job, ok, detail) values ('cleanup-uploads', true, '2 stale uploads removed');

select t.as_user(:mem::uuid);
select t.ok('a client user sees no job runs', t.count('select 1 from public.job_runs') = 0);
reset role;
select t.as_staff(:bil::uuid);
select t.ok('staff read job runs', t.count('select 1 from public.job_runs') = 1);
select t.fails('staff cannot add a job run', $$insert into public.job_runs (job, ok) values ('x', true)$$);
select t.fails('staff cannot rewrite a job run', $$update public.job_runs set ok = false$$);
reset role;
\echo ALL JOB RUNS TESTS PASSED
