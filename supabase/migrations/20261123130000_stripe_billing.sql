-- Stripe billing: which Stripe customer and subscription belongs to a client, and what state it is in.
-- Written only by the Stripe webhook (service role); staff read it with the rest of the client record.
alter table public.clients
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  add column billing_status text,
  add column billing_interval text check (billing_interval in ('month', 'year')),
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false;

-- Webhook events already handled, so a retried delivery is not applied twice. No policies: service role only.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from public, anon, authenticated;
