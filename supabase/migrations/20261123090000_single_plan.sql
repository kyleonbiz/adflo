-- One plan: AdFlo, $149 a month, everything included (the Claude assistant, OCR and priority support too).
-- The earlier tiers ('core', 'core +') are retired, not deleted: they keep every feature so nobody loses anything,
-- and their clients move to the new plan (a client's own price override, if any, is untouched).
insert into public.plans (name, price_cents, seats_included, features)
values ('adflo', 14900, 50, array[
  'documents','contacts','tasks','setup','licenses_basic','vendors','licenses','forms','invoices','projects','reporting',
  'versioning','assistant_rules','reporting_scheduled','certifications','activity','assistant_ai','ocr','priority_support'])
on conflict (lower(name)) do update set price_cents = excluded.price_cents, seats_included = excluded.seats_included,
  features = excluded.features, active = true;

update public.plans set active = false, features = (select features from public.plans where lower(name) = 'adflo')
 where lower(name) in ('core', 'core +');
update public.clients set plan = 'adflo' where lower(plan) in ('core', 'core +');
