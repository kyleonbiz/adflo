-- One row per day of what AdFlo's recurring revenue stood at, so the Control center's Sales & revenue page can draw a real
-- trend (clients have no cancellation date, so past revenue cannot be worked out afterwards). Written by the server with the
-- service role (the nightly job and the Sales page); staff can read it. Counts and amounts only: no client names.

create table public.revenue_snapshots (
  day date primary key,
  mrr_cents bigint not null check (mrr_cents >= 0),
  active_clients integer not null check (active_clients >= 0),
  trial_clients integer not null check (trial_clients >= 0),
  seats_sold integer not null check (seats_sold >= 0),
  extra_seat_cents bigint not null check (extra_seat_cents >= 0),
  trial_potential_cents bigint not null check (trial_potential_cents >= 0),
  recorded_at timestamptz not null default now()
);

alter table public.revenue_snapshots enable row level security;
revoke all on public.revenue_snapshots from anon, authenticated;
grant select on public.revenue_snapshots to authenticated;
grant select, insert, update on public.revenue_snapshots to service_role;
create policy revenue_snapshots_read on public.revenue_snapshots for select to authenticated using (public.is_staff('billing'));
