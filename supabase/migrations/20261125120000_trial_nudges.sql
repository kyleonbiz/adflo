-- Free-trial nudges: when each of the two emails (trial ending soon, trial ended) went to a self-serve trial's owner. A daily job
-- claims one by setting its time where it is still empty, so a rerun or a second run can never send the same email twice.

alter table public.clients
  add column trial_ending_sent_at timestamptz,
  add column trial_ended_sent_at timestamptz;
