# AdFlo incident plan

One page. Print it or keep it in the password vault. Fill in every `[ ]` before the first client goes live.

**What counts as an incident:** client data seen by someone who should not see it, a key or password exposed, a staff account taken over,
the site down or serving wrong data, or a bad deploy or migration.

## Who does what

| Role | Person | Reach them |
|------|--------|------------|
| Incident lead (decides, talks to clients) | Kyle | [ phone ] |
| Backup with access to hosting, database, domain, email | [ name ] | [ phone ] |
| Lawyer (breach notice questions) | [ name ] | [ phone ] |
| Cyber insurance claims line | [ insurer ] | [ policy no. and phone ] |

If the lead cannot be reached within 1 hour, the backup acts on this plan.

## First hour: stop the harm

1. **Write down the time** you learned of it and what you saw. Keep a running log in one place (a private doc). Do not delete evidence.
2. **Contain.** Pick what fits:
   - *Leaked key or secret:* rotate it now (table below), then redeploy.
   - *Staff account taken over:* Control Center → Team: turn the person's access off. Supabase → Authentication → Users: delete their sessions. Remove their authenticator.
   - *A client account taken over:* Control Center → send a password reset to the real owner; remove unknown members from the workspace.
   - *Bad share link:* open the document panel and revoke it (links also expire in 7 days at most).
   - *Bad deploy:* Vercel → Deployments → promote the last good deployment.
   - *Bad migration or corrupted data:* stop writes (put the site in maintenance by removing the production domain from Vercel if needed), then restore from backup into a scratch project first.
   - *Site under attack:* turn on the host's or CDN's attack protection and rate limits.
3. **Preserve.** Export the Supabase logs (Auth, API, Postgres), the Control Center audit log and error log, and Vercel logs for the period.

## Rotate these

| Secret | Where it lives | How |
|--------|----------------|-----|
| `SUPABASE_SERVICE_ROLE_KEY`, publishable key | Vercel env vars, password vault | Supabase → Project Settings → API: roll the keys, update Vercel, redeploy |
| `CRON_SECRET` | Vercel env vars | Generate 24+ random bytes, update Vercel, redeploy (the bundled cron picks it up) |
| `ANTHROPIC_API_KEY` | Vercel env vars | Anthropic console: revoke, create new, update Vercel, redeploy |
| Database password | Supabase | Project Settings → Database: reset password |
| Owner login and authenticator | Supabase Auth | Reset password, re-enrol the authenticator, use the recovery codes (see the MFA recovery plan) |
| Domain, DNS and email logins | Registrar, mail provider | Reset passwords, check forwarding rules and recent logins |

After any rotation, check the Control Center Monitoring page: every health check green.

## Decide who must be told

Within **24 hours** of confirming that client data was exposed, the lead decides, with the lawyer, whether notice is required
(many US states require notice to affected people, some within 30 to 60 days, and some to a regulator). Contract terms and the
Data Processing Addendum may require **faster** notice to the client: check the agreement the client accepted.

- Tell affected clients plainly and early: what happened, what data, what you did, what they should do, how to reach you.
- Tell the insurer as soon as a claim is possible; late notice can void cover.
- Tell sub-processors only if the cause is on their side (Supabase, Vercel, Anthropic).
- Do not speculate in writing. State what is known and when you will update.

## After: within one week

1. Timeline: when it began, was found, was contained, was fixed.
2. Root cause and why existing checks missed it.
3. Fixes, each with an owner and a date. Add a regression test where a test can catch it.
4. Record it in `SECURITY_REVIEW.md` if it changes a finding, and in the changelog clients can read.
5. Update this plan with anything that was missing.

## Quick facts

- Staff changes are audited in `staff_audit_log`; workspace actions in `audit_logs`; server errors in `app_errors` (Control Center → Monitoring).
- Share links last at most 7 days and are stored hashed; revoking is immediate.
- Backups: [ plan and retention, e.g. Supabase plan name and point-in-time recovery window ]. Restore tested on: [ date ].
- Hosting: Vercel project [ name ]. Database: Supabase project [ ref ]. Domain registrar: [ name ].
