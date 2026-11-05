-- Tiers: each plan lists the features it includes. NULL means "everything" (legacy plans such as 'standard').
alter table public.plans add column features text[];

insert into public.plans (name, price_cents, seats_included, features) values
 ('essentials', 0, 3, array['documents','contacts','tasks','setup','licenses_basic']),
 ('business', 0, 10, array['documents','contacts','tasks','setup','licenses_basic','vendors','licenses','forms','invoices','projects','reporting','versioning','assistant_rules']),
 ('complete', 0, 25, array['documents','contacts','tasks','setup','licenses_basic','vendors','licenses','forms','invoices','projects','reporting','versioning','assistant_rules','reporting_scheduled','certifications','activity','assistant_ai','ocr','priority_support'])
on conflict do nothing;
