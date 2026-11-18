-- The last run of each scheduled job (nightly upload cleanup, reindex), so the Control center's Monitoring page can show
-- that the job really ran. One row per job. Counts only: no keys, file names or client data. The server writes it with the
-- service role; staff can read it.

create table public.job_runs (
  job text primary key check (char_length(job) between 1 and 80),
  ran_at timestamptz not null default now(),
  ok boolean not null,
  detail text not null default '' check (char_length(detail) <= 200)
);

alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;
grant select on public.job_runs to authenticated;
grant select, insert, update on public.job_runs to service_role;
create policy job_runs_read on public.job_runs for select to authenticated using (public.is_staff('billing'));
