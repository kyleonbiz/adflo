-- Pricing: two plans, Core + ($79/month, 5 seats, 20 GB) and Enterprise (from $199/month, 25 seats, 100 GB).
-- Core is retired, not deleted, so its record stays; clients on it move to Core + at launch pricing.
update public.plans set active = false where lower(name) = 'core';

update public.plans set price_cents = 7900, seats_included = 5 where lower(name) = 'core +';

insert into public.plans (name, price_cents, seats_included, features)
select 'enterprise', 19900, 25, features from public.plans where lower(name) = 'core +'
on conflict do nothing;

update public.clients set plan = 'core +' where lower(plan) = 'core';

-- Storage per workspace follows the plan (20 GB on Core +, 100 GB on Enterprise). Only ever raised here, never lowered.
update public.workspaces w set storage_quota_bytes = greatest(w.storage_quota_bytes,
  case lower(c.plan) when 'core +' then 20::bigint * 1073741824 when 'enterprise' then 100::bigint * 1073741824 else 0 end)
from public.clients c where c.workspace_id = w.id and lower(c.plan) in ('core +', 'enterprise');
