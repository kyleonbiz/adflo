# Launch plan: sell the software first, add the service later

Status: proposal, 2026-11-17. Prices and conversion rates are assumptions to test, not facts.

## Goal and the math

Target: $1M a year. Two revenue lines.

| Line | Clients | Monthly each | Annual |
|---|---|---|---|
| Software (Core / Core +) | ~600 | ~$99 blended | ~$713k |
| Service add-on (later) | ~60 | ~$500 on top | ~$360k |

The service add-on is **not sold until software clients ask for it** (see "When the service earns its place").

## Pricing tiers (to be set in Control Center > Plans)

The plans already exist in the database at $0. Proposed prices:

| | Core | Core + |
|---|---|---|
| Monthly price | $79 | $199 |
| Annual price (2 months free) | $790 | $1,990 |
| Seats included | 10 | 25 |
| What it adds | The whole platform: documents, invoices, licenses, vendors, contacts, tasks, forms, reporting, audit trail | Core, plus the Claude assistant, OCR of license/vendor photos, priority support |

Why these numbers:
- Core at $79 sits under the "need approval" threshold for most owners, and one caught lapse pays for a year.
- Core + at $199 covers the AI cost per seat with margin. **Measure the real AI cost per active seat before launch** and raise the price or cap usage if it exceeds about 20% of Core + revenue.
- Annual billing improves cash and cuts churn.
- Founding-client offer: first 25 clients get 3 months at half price in exchange for a testimonial.

## Blockers, in the order to fix them

Each item comes from the README's "not built yet" and "still open" lists.

1. **Set prices** (no code): enter the table above in Control Center > Plans.
2. **Payments.** Add a payment processor (Stripe Checkout and Customer Portal). A webhook updates the client's status (`trial`, `active`, `suspended`) so the existing suspend lock turns access off on a failed payment. The README states AdFlo has "no money handling" as a deliberate choice for clients' own money; this is different, it only bills AdFlo's own subscriptions. Keep it that way and store no card data.
3. **Outbound email.** Add a transactional email provider for invitations, welcome messages, agreement links and password resets, replacing copy-and-paste. Needs a sending domain with SPF/DKIM.
4. **Staff billing to the database.** `lib/control/billing-storage.ts` is browser-only. Move invoices to a table with row-level security (or drop manual invoices once Stripe invoices exist).
5. **Self-serve signup.** Landing page, then trial signup, then a working workspace with sample data, with no staff step. Today staff connect a workspace by hand.
6. **Replace the temporary support address** in `docs/support/support-policy.md` with one on your own domain.

Items 2 to 5 are code. Estimate each before starting, and ship them one at a time.

## When the service earns its place

Do not build or sell the service yet. Start offering it when:
- 3 or more software clients ask for help setting up or running the same thing, or
- setup support is eating more than 2 hours a month per client, or
- 20 or more paying software clients exist.

Then sell it as a third tier at $500 or more a month on top of the software, and track hours per client.

## Metrics to watch from day one

- Trial to paid conversion
- Monthly churn (target under 3%)
- AI cost per active seat
- Support hours per client
- Referral source of each client

## Open questions

- Is $79 / $199 the right price? Test with the first 25 clients.
- Which referral partners (bookkeepers, insurance agents, banks) go first?
- Who owns the Stripe and email accounts (Aurum Ventura Enterprise LLC)?
