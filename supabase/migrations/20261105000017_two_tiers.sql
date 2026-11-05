-- Two tiers replace the three: Core (everything except the Claude assistant and OCR) and AI (adds those).
-- The three earlier tiers are retired, not deleted, so any client already on one keeps its record.
update public.plans set active = false where lower(name) in ('essentials', 'business', 'complete');

insert into public.plans (name, price_cents, seats_included, features) values
 ('core', 0, 10, array['documents','contacts','tasks','setup','licenses_basic','vendors','licenses','forms','invoices','projects','reporting','versioning','assistant_rules','reporting_scheduled','certifications','activity']),
 ('ai', 0, 25, array['documents','contacts','tasks','setup','licenses_basic','vendors','licenses','forms','invoices','projects','reporting','versioning','assistant_rules','reporting_scheduled','certifications','activity','assistant_ai','ocr','priority_support'])
on conflict do nothing;
