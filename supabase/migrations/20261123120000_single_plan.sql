-- One plan: AdFlo, $65 a month with the owner's seat, plus $10 a month for each additional seat. Everything is included
-- (the Claude assistant, OCR and priority support too). Core, Core + and Enterprise are retired, not deleted: they keep every
-- feature so nobody loses anything, and their clients move to the new plan (a client's own price override is untouched).
insert into public.plans (name, price_cents, seats_included, features)
values ('adflo', 6500, 1, array[
  'documents','contacts','tasks','setup','licenses_basic','vendors','licenses','forms','invoices','projects','reporting',
  'versioning','assistant_rules','reporting_scheduled','certifications','activity','assistant_ai','ocr','priority_support'])
on conflict (lower(name)) do update set price_cents = excluded.price_cents, seats_included = excluded.seats_included,
  features = excluded.features, active = true;

update public.plans set active = false, features = (select features from public.plans where lower(name) = 'adflo')
 where lower(name) in ('core', 'core +', 'enterprise');
update public.clients set plan = 'adflo' where lower(plan) in ('core', 'core +', 'enterprise');

-- The new plan has the same storage as Core + had (20 GB). Only ever raised, so a client who already has more keeps it.
update public.workspaces w set storage_quota_bytes = greatest(w.storage_quota_bytes, 20::bigint * 1073741824)
from public.clients c where c.workspace_id = w.id and lower(c.plan) = 'adflo';
