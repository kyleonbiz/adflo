# Launch plan: contractor compliance, software first

Status: proposal, 2026-11-17. Prices, mix and conversion rates are assumptions to test, not facts.

## Strategy

- **Niche:** contractors. The lead product is **subcontractor compliance**: collect and track each sub's license, insurance certificate (COI), W-9 and safety paperwork, and flag non-compliant subs before they go on site.
- **Lead buyer:** general contractors and larger specialty contractors (30-300 staff) who manage many subs. A lapsed sub certificate exposes them to claims, and they often employ people just to chase the paperwork.
- **Second niche, run in parallel: property managers.** Same product ("vendor and subcontractor compliance, handled"), two front doors. Property managers collect licenses and certificates of insurance from the vendors they hire, so the vendor-compliance workflow is shared. Contractors and property managers also refer each other: a property manager that requires compliance sends its vendors to AdFlo, and a contractor already in AdFlo can share its file with property-manager clients.
- **Software first, service later.** The done-for-you service is offered only when clients ask for it (see below).
- **Broader vision later:** other industries get their own packs once these two prove the model.

### Running two niches

- One product, one onboarding process, two templates (document checklists, license types, reminders), two landing pages and two price sheets. Wording changes ("subs" vs "vendors"), the engine does not.
- Fixed weekly split of selling time (for example 3 days contractors, 2 days property managers) so neither is ignored.
- Pilots in both: 2-3 contractor and 2-3 property-manager pilots.
- Contractors lead the product work. Property managers use the existing vendor-compliance workflow first.
- Build nothing niche-specific (leases, work orders, per-project views) until 2-3 paying clients in that niche ask for the same thing.
- Track each niche separately: conversion, sales cycle, onboarding hours, churn. Review after 6 months and shift effort to the one that earns more.
- Property managers hold tenant data: have privacy terms and a security review in place before their first contract.
- Position against incumbents as a compliance layer that works alongside their property-management system, not a replacement.

## Pricing: by active subcontractors, not seats

| Tier | Buyer | Active subs | Monthly | Onboarding |
|---|---|---|---|---|
| Core | Small trade, 5-30 staff | up to 10 | $149 | $750 |
| Core + (AI, OCR, priority support) | Small trade | up to 25 | $399 | $1,500 |
| Contractor Compliance | Specialty contractor / small GC, 30-100 staff | up to 100 | $1,500 | $3,000 |
| Contractor Pro | GC, 100-300 staff | up to 250 | $3,000 | $5,000 |
| Contractor Enterprise | 500+ subs or several entities | custom | $6,000+ | $7,500+ |

- Overage: about $12 per extra active sub per month.
- Annual prepay: two months free.
- First 5 clients: a 90-day pilot at half price in exchange for a case study, converting to the standard price.
- Onboarding includes importing the sub list and running the first compliance report.

Why: a compliance coordinator costs about $5,000-$7,500 a month fully loaded, so $1,500 is about a quarter of that, $3,000 about half and $6,000 about one hire. Per-sub pricing makes expansion automatic.

Illustrative path to $1M (mix is a guess):

| Tier | Clients | Annual recurring |
|---|---|---|
| Core / Core + (blended $250/mo) | 40 | $120k |
| Contractor Compliance | 12 | $216k |
| Contractor Pro | 8 | $288k |
| Contractor Enterprise | 4 | $288k |
| Total recurring | 64 | ~$912k |
| Onboarding fees (first year) | | ~$136k |

### Property manager pricing: by units (doors) under management

| Tier | Portfolio | Monthly | Onboarding |
|---|---|---|---|
| Starter | up to 100 units | $399 | $1,500 |
| Growth | up to 500 units | $1,500 | $3,000 |
| Portfolio | up to 2,000 units | $3,000 | $5,000 |
| Enterprise | 2,000+ units | $6,000+ | $7,500+ |

Assumptions to test in discovery calls, including the per-unit price implied by each tier. The $1M illustration above uses only contractor tiers; property managers add to it.

Margin guards: track support hours per client (over about 6 hours a month on a Compliance client erodes margin), and measure AI cost per client before launch (COI reading uses it).

## What to build, in order (let paying pilots reorder this)

1. **Subcontractor portal.** A link where each sub uploads license, COI, W-9 and safety documents. Builds on vendor non-compliance flags, required documents by category and forms.
2. **COI checks.** Read the certificate (OCR exists on Core +) and compare it with required limits and additional-insured wording.
3. **Per-project compliance.** Show which subs are clean for each job.
4. **Contractor license and renewal tracking** by state, with dependency links (for example a bond that must be active).
5. **Audit packet.** One click for insurers and owners, showing every sub's status on a date.
6. **Later:** accounting sync (payment holds on non-compliant subs), SSO, real role enforcement, SOC 2.

Only items 1-3 before the first pilots. Do not build 4-6 until paying clients ask.

## Blockers to selling (from the README)

1. Set the prices above in Control Center > Plans (no code).
2. Payments for AdFlo's own subscriptions (Stripe, with invoices and annual billing), wired to the suspend lock. No card data stored. This is separate from the README's "no money handling" rule, which covers clients' money.
3. Outbound email for invitations, welcome messages, agreement links and sub reminders.
4. Move staff billing from the browser to the database.
5. Demo-and-onboarding flow for the larger tiers (self-serve signup matters only for Core / Core +).
6. Replace the temporary support address in `docs/support/support-policy.md`.

## Validate first (15-20 conversations per niche: GCs and compliance or project managers; property managers and their operations leads)

1. How many subs do you track, and who does it?
2. What happened the last time a sub's insurance lapsed?
3. What do you use today, and what does it cost?
4. What would you expect to pay? At what price is it too expensive?

Go ahead with items 1-3 above only if at least 5 would pay for a pilot.

## When the service earns its place

Offer done-for-you setup and upkeep (about $1,500 or more a month on top of software) when 3 or more clients ask for the same help, setup support exceeds 2 hours a month per client, or there are 20 or more paying clients.

## Metrics from day one

Trial or pilot to paid conversion, monthly churn (target under 3%), AI cost per client, support hours per client, subs per client, referral source.

## Open questions

- Who owns the Stripe and email accounts (Aurum Ventura Enterprise LLC)?
- Which state to start in, so license rules are one set?
- Which referral partners (insurance agents and brokers are the natural channel for COI pain)?
