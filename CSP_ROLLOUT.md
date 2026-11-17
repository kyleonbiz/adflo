# Content Security Policy rollout checklist

The policy (`src/lib/csp.ts`, set per request in `src/proxy.ts`) stops injected scripts from running. It ships in **report-only** mode:
the browser logs what it *would* block but blocks nothing. Switching to blocking is one setting, `CSP_MODE=enforce`. This checklist makes
that switch safe. It closes security findings 19 and 23.

What the policy allows: scripts with the request's nonce (and what they load), your own origin, and your Supabase origin for network
calls, images and frames. Everything else is reported (or blocked in enforce mode).

## Before you start

- [ ] Production (or a preview with production-like settings) is deployed with `NEXT_PUBLIC_SUPABASE_URL` set. The policy reads it to allow your Supabase origin.
- [ ] `CSP_MODE` is **unset** (report-only) on that deployment.
- [ ] If you turned on the human check: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set (the policy then also allows `challenges.cloudflare.com`).
- [ ] Confirm the header is present: `curl -sI https://YOUR-DOMAIN/login | grep -i content-security` shows `content-security-policy-report-only` with a `nonce-…` in `script-src`, and the static `content-security-policy` with `frame-ancestors 'none'`.

## Watch for violations

Open DevTools → **Console** (keep "Errors" visible). A violation reads like `Refused to load … because it violates the following Content Security Policy directive …` (in report-only: `[Report Only] Refused …`).
Use a normal desktop browser and **turn off extensions** (they inject scripts and cause false alarms). Also repeat the key flows once on a phone.

## Flows to try (tick each with the console open; note any violation)

Public pages
- [ ] Landing page `/landing`, including the demo workspace and the Book a demo form.
- [ ] `/login`, `/signup`, `/forgot-password` load; the human-check widget appears if enabled.
- [ ] A public share link `/share/<token>` downloads the file.
- [ ] A public invoice link `/invoice/<token>` renders fully.
- [ ] A public agreement page and a public form page `/form/<token>` open and submit.

Signed in, workspace
- [ ] Sign up, confirm by email, sign in, sign out.
- [ ] Password reset: request email, follow the link to `/reset-password`, set a new password.
- [ ] Upload a PDF and a large file (progress bar works; the upload goes to your Supabase origin).
- [ ] Open a PDF preview (frame) and an image preview.
- [ ] Download a document. Search for text inside it.
- [ ] Create and open a share link. Revoke it.
- [ ] Ask Addy a question and use a draft link it offers.
- [ ] License add form: upload a photo or scan (text reading) and a PDF.
- [ ] Invoices, Contacts, Vendors, Projects, Reporting (including a CSV or Excel export), Calendar, Forms.

Control Center
- [ ] Authenticator setup shows the QR code (an image from a `data:` address).
- [ ] Verify with a code, then Clients, Plans, Support, Agreements, Team, Monitoring, Audit all load.
- [ ] Send a password reset to a client.

## Reading the results

| You see | Likely cause | Fix |
|---------|--------------|-----|
| `script-src` blocks an inline script | A script without the nonce | Add `nonce` from `headers().get("x-nonce")`, or move it to a file |
| `connect-src` blocks a call to your Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` differs from the URL the app actually uses (for example a custom Supabase domain) | Set the variable to the exact origin in use |
| `img-src` / `frame-src` blocks a signed storage URL | Storage is on a different host than the API URL | Allow that host in `src/lib/csp.ts` |
| Blocks from `chrome-extension://` or similar | A browser extension | Ignore, or retest with extensions off |
| `style-src` complaints | Should not occur: inline styles are allowed | Report it |

Fix real violations in code (with a test in `tests/unit/csp.test.ts`), redeploy, and repeat the failing flow. **Do not widen `script-src` with `'unsafe-inline'`.**

## Switch to blocking

- [ ] All flows above ran with **zero** real violations.
- [ ] Set `CSP_MODE=enforce` on the production host and redeploy.
- [ ] Repeat the header check: `curl -sI https://YOUR-DOMAIN/login | grep -i content-security` now shows `content-security-policy:` with the nonce policy.
- [ ] Repeat the key flows once more: sign-in, upload, preview, share link, authenticator, Addy. Nothing is blocked.
- [ ] Negative control: in DevTools run `document.body.appendChild(Object.assign(document.createElement('script'),{textContent:'alert(1)'}))`. The console shows a "Refused to execute inline script" error and no alert appears.
- [ ] Mark findings 19 and 23 closed in `SECURITY_REVIEW.md` with the date.

## If something breaks after enforce

Set `CSP_MODE=report-only` (or `off`) and redeploy. That restores the old behaviour in minutes. Then find the violation in the console, fix
it in code, and re-run this list. Keep a note of what broke.

## After it is live

- [ ] Re-run this checklist after adding any new third-party script, font, embed, analytics tool, payment widget or Supabase custom domain.
- [ ] Add the check to your release routine: open the console on the landing page and one signed-in page after each deploy.

## Run log

| Date | Run by | Environment | Mode | Violations found | Outcome |
|------|--------|-------------|------|------------------|---------|
| [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
