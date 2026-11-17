# Control Center access test (production)

Run this against the **production** URL after the first Owner exists, and again after any change to sign-in, the Control Center, or the
staff database functions. It covers the roadmap item "Verify Control Center access on production".

**Why it matters:** the Control Center shows every client. Three layers protect it: the page gate (`requireStaff`), the staff API gate
(`staffRoute`), and the database (`staff_role()` requires `aal2`, RLS hides staff tables). Each step below tries to get past one layer.

## Set up (use throwaway accounts, never real clients)

You need four accounts. Create them at `/signup` (confirm each email), then make the staff ones in the Supabase SQL editor.

| Account | Role | How |
|---------|------|-----|
| `[ owner email ]` | Owner, with an authenticator enrolled | The first-Owner insert from `GO_LIVE.md` |
| `[ support email ]` | Support (can edit clients) | Control Center → Team, added by the Owner |
| `[ billing email ]` | Billing (read-only) | Control Center → Team, added by the Owner |
| `[ outsider email ]` | Not staff, ordinary client user | Sign up only. Never add to Team |

Use a private window per account so sessions do not mix. Record the date and who ran it at the bottom.

## 1. Signed out

- [ ] Open `/control` signed out → redirected to `/login?next=/control`.
- [ ] Open `/control/clients`, `/control/team`, `/control/audit` signed out → each redirects to sign-in, none shows data.
- [ ] In the browser console while signed out, run `await (await fetch('/api/control/clients',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status` → `401`.

## 2. Signed in, but not staff (the outsider)

- [ ] Open `/control` → **404 page** (the Control Center does not reveal that it exists).
- [ ] Open `/control/clients`, `/control/team`, `/control/audit`, `/control/monitoring`, `/control/verify`, `/control/security` → all 404.
- [ ] Console: `await (await fetch('/api/control/clients',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status` → `403`. Same for `/api/control/staff`, `/api/control/tickets`. (These routes only accept POST, and an empty body is enough to hit the access check.)
- [ ] The workspace app (`/app`) still works for this account. Nothing from other workspaces appears.

## 3. Staff with a password only (no second factor yet)

Use the Support account **before** it has an authenticator, then again after enrolling but **before** entering a code.

- [ ] Sign in with the password only → `/control` redirects to `/control/security` (no factor yet) or `/control/verify` (factor enrolled). **No client names, plans or tickets are visible at any point.**
- [ ] Console: `await (await fetch('/api/control/clients',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).json()` → error `mfa_required`, status `403`.
- [ ] Try `/api/control/tickets` and `/api/control/staff` the same way → `403`, nothing created.
- [ ] Sign out and back in: still no data until the code is entered.

## 4. Owner with the authenticator code

- [ ] Sign in, enter a wrong code → refused, no access. Enter the right code → Control Center opens.
- [ ] Clients, Plans and pricing, Support, Agreements, Team, Monitoring and Audit all load for the Owner.
- [ ] Monitoring: every health check is green (database, error logging, cron secret, assistant key, dev mode off).
- [ ] Sign out → `/control` redirects to sign-in again. The back button does not show cached data.
- [ ] A code reused or expired is refused.

## 5. Roles

- [ ] **Billing** (read-only): can view clients, cannot change one. Console write attempt → `403 read_only`.
- [ ] **Support**: can edit a client and answer tickets, cannot open Team management or change plan prices (Owner only).
- [ ] **Owner only:** adding or removing staff, changing roles, publishing agreement templates, reading the audit log.
- [ ] Removing or demoting the last active Owner is refused ("There must always be one active Owner.").
- [ ] Turn off the Support account in Team → its next request is refused, even in an open session.

## 6. Actions and audit

- [ ] As Support, change a client's status. The change appears in Control Center → Audit with your email and the time (Owner views it).
- [ ] Send a password reset to a client address: the email arrives, the link lands on `/reset-password`, the audit log records it.
- [ ] Try a reset to an address that is **not** a client → refused ("not a client owner or member").
- [ ] Hit the reset button more than 3 times for one address in an hour → rate limited.

## 7. Cross-site and cookie checks

- [ ] From another origin (for example a page on a different domain, or `curl` with a foreign `Origin` header), a POST to `/api/control/*` is refused (`Cross-origin request blocked`).
- [ ] In DevTools → Application → Cookies, the sign-in cookies are `Secure` and `SameSite=Lax` (or stricter), and `HttpOnly` where the library sets it.
- [ ] `CONTROL_DEMO` is not set on the production host. `/control` signed out must redirect, never show sample data.

## If any box fails

Treat it as a security finding: stop, note the exact steps and what was visible, fix before any client signs in, and add a regression test.
Record it in `SECURITY_REVIEW.md` and follow `INCIDENT_PLAN.md` if real data could have been exposed.

## Run log

| Date | Run by | Environment URL | Result | Notes |
|------|--------|-----------------|--------|-------|
| [ ] | [ ] | [ ] | [ ] | [ ] |
