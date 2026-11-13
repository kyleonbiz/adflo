# AdFlo

The client-facing back-office platform from Aurum Ventura Enterprise LLC. It started as a multi-tenant document manager:
folders and tags, metadata, filename/metadata and **document-text search** (text-based PDF, DOCX,
XLSX, PPTX, CSV, TXT; no OCR), private file storage, versioning,
expiring share links and an audit trail — on Next.js, Supabase (Postgres, Auth, Storage),
Tailwind and shadcn/ui-style components.

The site address (`/`) redirects into the app (`/app/overview`). The landing page is at `/landing` (`src/app/landing/page.tsx`: the hero, the demo workspace, then the story sections and a Book a demo form in `src/components/marketing/sections.tsx`; the form opens the visitor's email app, addressed to `NEXT_PUBLIC_SALES_EMAIL`); Open workspace goes into the app. The earlier marketing page (hero, features, plans) is in git history at commit `534795a`.

* **With Supabase configured** – real sign-in, workspaces and (for Documents) a real database and storage.
* **Without Supabase** – the app still opens, as a **preview** labelled "Preview" in the top
  bar. Every service starts empty and keeps its records in the visitor's own browser, so nothing is shared between
  visitors and nothing is stored on the server. The server-memory API (`/api/dms/dev/*`) remains for
  development only and is refused in production unless `DMS_ALLOW_DEV_MODE=true`.
* **Old demo links** – `/demo/...` redirects to the same page under `/app/...`.

## About this app (read this first if you are reviewing it)

**What it is.** A back-office tool for small businesses: one place for invoices, licenses and renewals, vendors,
contacts, projects and tasks, forms, documents and reporting, with an AI assistant ("Addy"). It is built to remove
admin busywork: reminders, duplicate checks and expiry tracking happen for you.

**Choices made on purpose (please do not treat these as gaps).**

* **No money handling.** No payments, banking details, bank-detail locks, quotes or three-way matching.
* **No accounting-software sync** (QuickBooks, Xero) and no SSO.
* **Email only.** Invoices, licenses, projects, contacts and documents are sent by opening your email app with the
  message filled in. There is no text messaging.
* **Database last.** Outside Documents, records live in the browser tab (preview mode) until the database is wired up;
  that work and the final full test pass are deliberately scheduled at the end.
* **Role view is a preview.** Owner / Admin / Contributor screens are switched with "View as" in the top bar; real
  enforcement comes with sign-in roles and the database.

**Built and working.** Invoice duplicate and unusual-amount warnings (opt-in, Settings > Invoice options); license
Safe / Warning / Critical risk tiers with "depends on" links; vendor Non-compliant flag; role views; a shared email Send
dialog on Invoices, Forms, Vendors, Licenses, Projects, Contacts and Documents.

**Not built yet.** Industry setup that renames screens (Construction, Healthcare, Property Management), the staff
operations portal extras, chasing reminders, auto-saved drafts and a one-click audit ZIP.

**Where to look.** Screens: `src/components/<module>/`. Business rules: `src/lib/<module>/logic.ts` (each has unit tests
in `tests/unit/`). Pages: `src/app/app/`. Database: `supabase/migrations/`.

## Control center (staff console)

`/control` is Aurum Ventura's own back office, separate from the client app: a client directory (status, plan, seats,
owner, notes) and an audit log of every staff change. It uses the same look as the app. Staff are rows in
`staff_members` (roles `owner`, `support`, `billing`); clients are never staff and cannot see these tables. Anyone who is
not active staff gets a 404. Every change to a client is written to `staff_audit_log` by a database trigger, and only the
Owner can read the log. Billing is read-only; Owner and Support can edit clients. Without a database it opens as a
development-only preview with labelled sample clients (a production build without a database shows nothing).

**Create the first Owner** (once, in the Supabase SQL editor, after signing up through `/signup`):

```sql
insert into public.staff_members (user_id, role, display_name, email)
select id, 'owner', 'Your Name', email from auth.users where email = 'you@example.com';
```

Two-factor (an authenticator app) is required for staff and enforced in the database: a password-only session sees no
staff data. Turn on TOTP under Supabase Authentication, Multi-Factor.

* **Clients**: status, plan, seats in use (counted by a database function that exposes only counts and last sign-in),
  price, and a detail page with the onboarding checklist.
* **Plans & pricing**: the Owner sets plan prices and seats; only the Owner can give a client their own price.
* **Team**: the Owner adds people (who must already have an AdFlo account), changes roles, and turns access off. There is
  always at least one active Owner.

* **Support**: a ticket queue (open, waiting on client, closed; priority; assigned teammate) with permanent internal notes,
  and each client's page shows its tickets and a timeline of every logged change.
* **Password resets**: staff send a client's owner or member a reset email (never the password or the link). The address
  must belong to a client, every send is audit logged, and the link lands on `/reset-password`. Set the Supabase auth
  Site URL and allowed redirect URLs so `/reset-password` on your domain is permitted.

* **Agreements**: the Owner publishes terms as versioned, never-edited text; staff create a one-time link for a client
  (shown once; only its hash is stored; valid 30 days; AdFlo does not send email itself yet, so staff paste the link into
  their own email). The client opens `/agreement/<secret>`, types their name and email and accepts; the acceptance, who
  and when, is recorded and shown on the client's timeline. Sending also ticks the onboarding step.

* **Monitoring**: health checks (database answers, error logging, cron secret, assistant key, dev mode), a log of server
  errors, and which clients have documents that could not be indexed or recent errors. The log stores only the error
  class and route, never messages or client data, and needs `SUPABASE_SERVICE_ROLE_KEY` on the server to record anything.
  Clients also show last sign-in, and "Quiet" when an active client has not signed in for 30 days.

**Demo switch.** To click through the screens before the database is set up, set `CONTROL_DEMO=true` on the server (Vercel →
Settings → Environment Variables, then redeploy). `/control` then opens without sign-in and shows only built-in sample data;
it never reads or writes the database and refuses every change. The switch is ignored as soon as Supabase is configured, so it
cannot expose `/control` on a live deployment, but remove the variable before real clients use the app anyway.

Billing is deliberately later: the Control center tracks plan and price only, with no invoicing or card payments.

## Platform modules

The app is growing from a document manager into a client portal of ten service modules
(`src/lib/modules/registry.ts`). All ten exist: **01 Documents**, **02 Invoices**
(`src/lib/invoices/`, `src/components/invoices/`), **03 Licenses & renewals** (`src/lib/licenses/`,
`src/components/licenses/`), **04 Vendors** (`src/lib/vendors/`, `src/components/vendors/`),
**05 CRM & Data** (`src/lib/contacts/`, `src/components/contacts/`), **06 Tasks**
(`src/lib/projects/`, `src/components/projects/`), **07 Forms & paperwork**
(`src/lib/forms/`, `src/components/forms/`) and **08 Reporting**
(`src/lib/datasets/`, `src/components/reporting/`), **09 Tidy up files** (`src/lib/files/`, `src/components/files/`) and **10 Settings**
(`src/lib/setup/`, `src/components/setup/`). Every service starts empty and keeps its records in the browser until the database is
connected (see the limits below).

**Shared import engine** (`src/lib/import/`): `parseCsv` (RFC 4180 quoting, BOM, CRLF, comma/semicolon/tab,
limits of 5,000 rows, 50 columns and 2,000 characters per cell, control characters stripped, line numbers
kept for error reports), `suggestMapping` / `mapRows` (match source columns to target fields by name and
alias), and `runImport` (validate each row, then sort into accepted, rejected and duplicate). CRM & Data is
its first user; modules 08 (Data Entry) and 10 (File Reset) are meant to reuse it. Files are read in the
browser and never uploaded.

* **Navigation:** a left sidebar on wide screens (logo, one icon per module, the current module highlighted,
  Settings apart at the bottom) and a menu button that opens the same list as a drawer on a phone.
* **Pages:** `/app/overview` (Home), `/app` (Documents), `/app/invoices`, `/app/licenses`, `/app/vendors`, `/app/contacts`, `/app/projects`, `/app/forms`, `/app/reporting`, `/app/file-reset`, `/app/setup`. With a database they sit behind sign-in; without one they open as a preview.
* **With a database connected, licenses and tasks (the Projects service) are saved to the workspace**: one row per record in `workspace_records`, read and written straight from the browser under the signed-in user's own access (members read; editors, admins and owners write; viewers are refused by the database, and the page says so). Changes show at once and are sent in the background, retried if the connection drops, and other people's changes appear when the tab is shown again. The other services use the same code and are switched on one at a time (`PERSISTED_KINDS`). Without a database, everything below stays in the browser as before.
* **Invoices, vendors, contacts, forms and report data are not persisted yet.** They start empty and are held in component state; there is no
  table or API for them until the database step. Reminders are *computed* (next reminder date, alerts,
  renewal tasks, overdue notices) but no email is sent yet. Licenses can be pre-filled from an uploaded PDF, Word, text or CSV file (`/api/licenses/parse` reads the number, issuer, holder and dates next to their labels; photos and scans are read with OCR on the Core + plan, and the file itself is not stored). Vendors get required documents by category, can only be
  activated once every required document is in and unexpired (there is no approval step: anyone on the team can act), and are checked for
  duplicates (normalized name, similar name, tax ID, contact email, shared company email domain) when
  added and across the list. CRM & Data imports in three steps (choose or paste a
  file, map columns, review) and shows every rejected row by file line before anything changes; matching
  contacts are skipped or updated, and the contact list can be de-duplicated and exported. Scheduled
  synchronization with other systems needs the backend and is not built. Reporting
  guesses column types (dates as `3/14/2026` or ISO, money as `$1,200.50` or `(150.25)`), rejects rows that
  break the rules with the file line and reason, drops exact repeats, then builds grouped reports (dates by
  month) and exports CSV or a real `.xlsx` workbook (written with `fflate`; text is stored as plain text, so
  `=CMD()` can never run as a formula). Scheduled summaries show the next send date and a preview but nothing
  is emailed until there is a backend. Tidy up files reads a folder chosen in the browser,
  hashes every file there (SHA-256, files up to 50 MB, 500 MB in total) so identical files are found without
  uploading anything, and builds a plan: standardized names, duplicates moved to a review folder (never
  deleted), misplaced files moved to the right folder, and optionally everything sorted into suggested
  folders. Each change is shown with its reason and must be approved before the plan CSV, a move script and
  an undo script can be downloaded. **A browser cannot change files on a computer, so the app itself never
  moves or deletes anything.** The scripts are POSIX `sh`, quote every path, use `mv -n`, skip anything missing
  or that would overwrite, and contain no delete command; the tests run them under a real shell against names
  with quotes, `$HOME`, backticks, a leading dash and `*`, and check that undo restores the exact original tree.
  Paths with `..`, drive letters or control characters are skipped. A pasted list can be used instead of a
  folder (duplicates are then only "likely"). Settings is a five-step wizard (business profile,
  modules with industry and team-size recommendations, templates, existing data, automatic checks). Progress
  is saved in the browser after every change (`localStorage`, validated and cleaned on load, so damaged or
  hand-edited data is ignored). Finishing installs the chosen templates for real: forms appear in Forms &
  Paperwork and starter records in Licenses & renewals. An unfinished or
  edited setup installs nothing. Choices are per browser, not per account, until the database is connected.
  Forms are built in the app and **sent** to anyone: Send gives a link (`/form/<token>`, which carries the whole form, so
  nothing is looked up or stored) and a ready-written email. The recipient fills it in on a plain public page and
  emails their answers back; the answers include one `ADFLO-RESPONSE:` line, and **Add responses** reads any number of
  pasted emails into the form's responses (repeats are skipped, answers for another or since-edited form are refused).
  Responses are marked new or done. There are no approvals. A response can be turned into a text document by filling
  `{{Field label}}` placeholders in a single pass (submitted text is never re-expanded); responses export to CSV. Until
  records are stored in the database, answers return by email rather than appearing on their own.
  Tasks opens on one list of every task, most urgent first, with a quick-add form; a task can stand alone
  (kept in a built-in "General tasks" project that is never listed as a project) or belong to a project, and the Projects tab
  groups bigger jobs. Overdue tasks are flagged and repeating tasks
  schedule their next occurrence when completed, with a plain-text status report per project. Invoices support recurring series ("Create
  next" drafts the following invoice) and a CSV report whose cells are neutralised against spreadsheet formulas.

## Contents
1. [Quick start (no credentials)](#quick-start-no-credentials)
2. [Supabase setup](#supabase-setup)
3. [Environment variables](#environment-variables)
4. [Architecture and security model](#architecture-and-security-model)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Implemented features](#implemented-features)
8. [Limitations and what is not verified](#limitations-and-what-is-not-verified)
9. [Go live checklist](#go-live-checklist)
10. [Security review](#security-review)
11. [Progress road map](#progress-road-map)
12. [Working notes](#working-notes)
13. [Changelog](#changelog)

Support and operations material (email templates, onboarding runbook, help articles, support policy) stays in `docs/support/`. Instructions for coding assistants are in `CLAUDE.md` and `AGENTS.md`.

## Quick start (no credentials)

```bash
npm install
npm run dev          # http://localhost:3000  (opens the app in preview mode)
```

Requires Node 20.19+ (developed on Node 22). Without Supabase variables the app opens in preview mode (see the top of this file).

## Supabase setup

1. Create a project at supabase.com.
2. **Apply the migrations** in `supabase/migrations/` in order — with the CLI
   (`supabase link --project-ref <ref> && supabase db push`) or by pasting each file into
   the SQL editor. They create the tables, helper functions, RLS policies, RPCs, audit
   triggers, the **private** `documents` bucket and its storage policies.
3. **Auth** (Authentication › URL Configuration): set *Site URL* to your app URL and add
   `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to
   *Redirect URLs*. Email + password sign-in is used; keep "Confirm email" on for production.
4. **Keys** (Project Settings › API): copy the URL and the publishable/anon key into
   `.env.local` (see `.env.example`). Add `SUPABASE_SERVICE_ROLE_KEY` only if you want
   share links; it is read solely by `/share/[token]` on the server.
5. Sign up at `/signup`, then create your workspace on first sign-in. The creator becomes
   `owner` and the five system folders are seeded.
6. **Adding teammates**: owners and admins open **Team** in the workspace header and
   invite by email address. **No email is sent** — tell the person to sign up (or sign in)
   at your app with that exact address. When they do, `/app` calls `dms_accept_invites()`,
   which joins them only if their address is *confirmed* in Supabase Auth, so keep
   "Confirm email" on (with it off, anyone could claim an invite by typing the address).
   Invites expire after 14 days. A person who already has a workspace keeps it as their
   primary one; the new membership exists but there is no workspace switcher yet.
7. **Scheduled cleanup** (recommended): set `CRON_SECRET` (16+ random characters) and
   `SUPABASE_SERVICE_ROLE_KEY`, then call `/api/maintenance/cleanup-uploads` daily — see
   [Deployment](#deployment).
8. **Content search backfill** (only if documents existed before migration `…0007`): they start
   as "not indexed yet" and are searchable by name only. Editors opening the workspace index a
   few at a time automatically; to do it in bulk call `/api/maintenance/reindex` — see
   [Content search](#content-search).

> The bucket limits uploads to 50 MB and a list of MIME types. If you raise
> `DMS_MAX_FILE_SIZE_MB` or add file types, update the bucket row in
> `supabase/migrations/20261023000004_dms_storage.sql` (or the dashboard) too.

## Environment variables

`.env.example` lists them all with comments. Never commit real values.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL. Leave all Supabase variables unset to run in preview mode. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. Safe in the browser: RLS protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only, never prefixed `NEXT_PUBLIC_`. Used for share links, the cleanup and reindex routes and Control center monitoring. |
| `CRON_SECRET` | 16+ random characters, e.g. `openssl rand -hex 24`. Protects the cleanup and reindex routes. |
| `NEXT_PUBLIC_SALES_EMAIL` | Optional. Where the landing page "Book a demo" form sends requests. |
| `ANTHROPIC_API_KEY` | Optional, server only. Without it the assistant (Addy) answers with its built-in rules. Claude answers only for **Core +** workspaces. |
| `ASSISTANT_MODEL` | Optional model override (default `claude-opus-5-5`). |
| `DMS_PENDING_UPLOAD_MAX_AGE_HOURS` | Pending-upload cleanup age (default 24, minimum 3). |
| `DMS_MAX_FILE_SIZE_MB`, `DMS_MAX_FILES_PER_BATCH` | Upload limits (defaults 50 MB, 10 files). |
| `DMS_ALLOWED_EXTENSIONS`, `DMS_EXTRA_FILE_TYPES` | Narrow or extend the upload allow-list. |
| `DMS_ALLOW_DEV_MODE` | Forces the server-memory development mode on in production. Do **not** set it for real client data. |
| `CONTROL_DEMO` | `true` opens `/control` without sign-in on sample data (see the Control center). Ignored once Supabase is configured. |

## Architecture and security model

```
UI components ──► useDocumentManager (state) ──► DmsApi interface
                                                   ├─ http-api  ─► /api/dms/* route handlers ─► DocumentService ─► Supabase adapters
                                                   └─ local-api ─► DocumentService ─► in-memory adapters   (public demo)
```

* `src/lib/dms/service.ts` – all business rules: role checks, upload validation, quota,
  workspace scoping, versioning, share links, audit calls. Pure TypeScript over two ports
  (`DocumentRepository`, `ObjectStorage`), so it is unit-tested without a database.
* `src/lib/dms/supabase/*` – adapters that run **as the signed-in user** (never the service
  role), so Postgres RLS is the tenant boundary. UI filtering is not relied on.
* **Uploads** go browser → Supabase Storage directly via a signed upload URL (no server
  body-size limit). Sequence: `initiate` (server validates name/type/size, atomically
  reserves quota in Postgres, creates a *pending* version) → browser PUT with real progress
  and cancel → `finalize` (server checks the object exists, its size equals what was
  declared, and magic bytes match the extension; otherwise it deletes the object and the
  pending record). Storage RLS only allows creating an object for a pending version the
  caller opened, so quota cannot be bypassed by talking to Storage directly.
* **Downloads/previews** use 60-second signed URLs minted after an authorization check.
  Storage object keys never reach the browser; buckets are never public.
* **Keys** are `<workspace>/<document>/v<n>-<nonce>.<ext>`, built server-side. User file
  names are sanitised for display only and never used in paths.
* **Share links**: 256-bit random token, only its SHA-256 hash is stored, 5 min–7 days,
  resolved by a service-role-only SQL function and redirected to a 60-second signed URL.
  Editors can list a document's live links and revoke their own (admins: any); revocation
  takes effect immediately. Creation, revocation and every *use* of a link are audit-logged
  (a use has no actor, since link holders are anonymous). The URL itself is shown once.
* **Team**: invites and role changes are SECURITY DEFINER RPCs (`workspace_members` and
  `workspace_invites` have no client write grants). Rules, enforced in both the service and
  SQL: admins manage viewers/editors only; only owners grant or touch admin/owner; nobody
  changes their own role or removes themselves; a workspace always keeps one owner (row
  locks serialise concurrent owner changes). Invites match a *confirmed* email only.
* **Abandoned uploads**: `dms_cleanup_stale_uploads()` (service-role only) deletes pending
  versions/documents older than the threshold (≥ 3 h, because signed upload URLs last 2 h)
  and returns their storage keys; the route then deletes the objects and reports counts.
* **Rate limiting**: mutating `/api/dms` requests are limited per signed-in user (120/min),
  with stricter limits on upload initiation (60/min), share-link creation (20/min) and
  invites (20/h); `/share/[token]` is limited per client address (60/min). Exceeding a limit
  returns `429` with `Retry-After`. **The limiter is in memory, per server instance** (see
  limitations).
* **Audit log**: written by database triggers (upload, rename, move, star, category,
  delete/restore/purge, folder changes), by the team/share RPCs themselves (invites, role
  changes, removals, joins, link revocation and use, expired uploads), and by an allow-listed
  RPC (download, share, tags).
  Admins can read it; nobody can edit it. Contents and credentials are never logged.
* **Auth**: `proxy.ts` refreshes the session and gates `/app` and `/api/dms`; handlers
  re-authenticate with `auth.getUser()` (validated server-side). Cross-origin mutations
  are rejected; `next=` redirects are same-site only; API errors are generic.
* **Roles**: viewer (read/download) · editor (+upload, edit, tag, soft-delete, folders,
  share) · admin (+purge, read audit log) · owner.
* Security headers (`nosniff`, `X-Frame-Options: DENY`, referrer/permissions policy) are set
  in `next.config.ts`.

Database layout: `workspaces`, `workspace_members`, `document_folders`, `documents`,
`document_versions` (with `status`), `document_tags`, `document_tag_assignments`,
`audit_logs`, plus `document_share_links`. Child rows use composite foreign keys so they
cannot point into another workspace. `documents` also holds
`content_text`, a generated `search_vector` (GIN-indexed, content only) and the
`content_status` / `content_reason` / `content_indexed_at` / `content_version` columns
described under [Content search](#content-search). Clients cannot write any of them directly.

### Content search

Extracted text is stored per document and searched with PostgreSQL full-text search.

* **When**: right after `finalize` returns (Next's `after()`), the server reads the stored file as
  the signed-in user, extracts text and calls `dms_set_document_content`. The upload never waits
  for it and never fails because of it. The document is searchable by name immediately and by
  content once `content_status` becomes `indexed` (the UI polls briefly and shows the state).
* **What is read** (`src/lib/dms/extract/`): the **text layer** of PDFs (PDF.js via `unpdf`, scripts,
  XFA and font loading off), DOCX, XLSX, PPTX, CSV and TXT. There is **no OCR**: scanned PDFs and
  images have no searchable text and say so. Legacy `.doc`/`.xls` are not accepted by the app.
* **Limits** (untrusted input): files over 25 MB are not read; archives are capped at 3,000 entries,
  40 MB per entry, 80 MB in total and a 150× expansion ratio (checked while inflating, so a lying
  header cannot bypass them); XML is parsed with a small non-expanding tokenizer (no DTD/entities);
  PDFs stop after 300 pages; each file has a 20 s budget; stored text is capped at 400,000
  characters (`reason = truncated`). Password-protected and malformed files are marked, not guessed at.
* **Honest status**: `pending` (name only), `indexed`, `unsupported` (no extractable text, too large,
  scanned…) or `failed` (retryable). Only `indexed` documents ever match on content. A new version
  clears the previous version's text immediately; a slow extraction of an older version is
  discarded (`content_version` must equal `current_version`).
* **Query syntax** (`websearch_to_tsquery('simple')`): words are ANDed, `"quoted phrases"`, `or`,
  `-exclude`. No stemming or stop-words (`simple`), so it works across languages but "rent" does not
  match "rented". A document matches if every word is in its name/metadata/tags **or** the whole
  query matches its text; a query split across the two (one word in the name, another in the
  text) does not match. Sort **Best match** puts name/metadata matches first, then text rank.
* **Snippets** are cut from the stored text by `ts_headline`, which drops markup; matches are wrapped
  in U+E000/U+E001 (stripped from stored text so they cannot be forged) and rendered as React text
  nodes, never HTML.
* **Backfill**: opening the workspace as an editor indexes up to 5 pending documents in the
  background. For bulk work, `GET|POST /api/maintenance/reindex?limit=20[&retryFailed=1]`
  (same `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` as the cleanup route) indexes unindexed
  documents across all workspaces within a 45 s budget and returns counts only; repeat until
  `found` is 0. It is not scheduled for you.
* **Memory/demo parity**: the in-memory store implements the same behaviour with a reference matcher
  (`src/lib/dms/query.ts`); PostgreSQL's parser is richer (e-mail addresses and decimals are single
  tokens there, so searching `example` will not find `me@example.com` in Supabase but will in the
  demo), so the two agree on ordinary words and phrases, not every edge case.

## Testing

```bash
npm run typecheck && npm run lint
npm test            # unit/component tests (vitest)
npm run test:db     # migrations + RLS against a throwaway local PostgreSQL 16 (includes security and content-search regressions)
npm run test:e2e    # Playwright: demo page, dev-mode server flows, content search, tablet/phone layout
```

* `tests/unit` – service rules (roles, **workspace isolation**, upload validation,
  download authorization, folder filtering, search, rename/move/star, delete/restore/purge,
  usage and quota), team rules and share-link revocation, validation helpers, proxy/route
  authentication, rate limiting, the share and cleanup routes, **the Supabase adapters**
  (`SupabaseRepository`/`SupabaseStorage` against a recording fake client: RPC arguments,
  column mapping, tenant scoping, error mapping, signed-URL handling), and component tests
  for empty/error/loading states, the workspace flows and the Team dialog.
* `supabase/tests/run.sh` – boots a temporary Postgres 16, stubs Supabase's `auth`/`storage`
  schemas and roles, applies every migration, and exercises RLS as different users
  (cross-workspace reads/writes, role limits, protected columns, storage policies, quota,
  audit triggers, share-link resolution, invites and acceptance incl. unverified/expired/
  wrong-address cases, role/removal rules, link revocation and use auditing, stale-upload
  cleanup, content search: who may store text, stale versions, status rules, phrase/OR/exclusion,
  snippets, isolation, relevance, work queues). `team.sql`, `hardening.sql` and `content.sql` are
  included from `rls.sql`. Needs the PostgreSQL 16
  server binaries (`PG_BIN` overrides the path).
* `tests/e2e` – needs a Chromium; set `PLAYWRIGHT_CHROMIUM_PATH` or run
  `npx playwright install chromium`. `layout.spec.ts` checks 820 px and 360 px for page
  overflow, panel fit and touch-target size, and writes screenshots to `test-results/layout/`.
  The first visit to each page compiles it in the dev server, so a cold run is slower.

## Deployment

Any Node host works (Vercel, Fly, Docker, …). Follow the [Go live checklist](#go-live-checklist): migrations and Auth, environment variables on the host (never `DMS_ALLOW_DEV_MODE`), then `npm run build && npm start` (Vercel: import the `document-management` directory).

Smoke test with **two** accounts in two workspaces: sign up, create workspaces, upload, download, preview, share link; confirm account B cannot see account A's documents, and that `GET /api/dms/bootstrap` is 401 when signed out.

### Scheduling the upload cleanup

`GET|POST /api/maintenance/cleanup-uploads` removes abandoned pending uploads. It needs
`CRON_SECRET` (≥ 16 characters) and `SUPABASE_SERVICE_ROLE_KEY`, and authenticates with
`Authorization: Bearer <CRON_SECRET>` (or an `x-cron-secret` header). It responds with
counts only. The route is outside `/api/dms`, so it is not behind user login — the secret is
the only gate; without `CRON_SECRET` it returns 503.

* **Vercel**: `vercel.json` schedules it daily at 03:17 UTC; Vercel sends the bearer header
  automatically when `CRON_SECRET` is set as a project environment variable.
* **Elsewhere**: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your.app/api/maintenance/cleanup-uploads`
  from any scheduler (cron, GitHub Actions, Supabase `pg_cron` + `pg_net`).

If this directory is moved to its own repo, `supabase/` and `tests/` move with it unchanged.

## Implemented features

Responsive UI (desktop/tablet/mobile) with hero + demo page · folder cards with counts and
filtering · document grid with type icon, size, date, category, tags, star · search
(filename, tags, category, extension, uploader) · category/type/tag filters · sort · All/
Recent/Starred/Trash views · incremental "Load more" · floating upload dialog (drag-and-drop,
browse, validation, per-file progress, cancel, retry, destination folder, storage usage) ·
floating details panel (full-screen on phones) with PDF/image/CSV/text preview and
"download to view" fallback · download · expiring share links · rename · move · category ·
tags · star · optional expiration date · version history, upload new version, download old
versions · soft delete with confirmation, restore, permanent delete · custom folders
(create/rename/delete; system folders protected) · per-workspace storage usage and quota ·
audit log · Supabase auth (sign in/up/out, onboarding) · RLS on every table and the bucket ·
team management (invite by email, change roles, remove members, pending invites; owners/admins
only) · share-link list and revoke, with creation/revocation/use audited · scheduled cleanup of
abandoned uploads · per-user and per-address rate limiting.

## Limitations and what is not verified

* **Not verified against a hosted Supabase project.** I could not reach one. The SQL is
  tested on a real local Postgres 16 with *stubbed* `auth`/`storage` schemas, so the RLS and
  RPC logic is exercised for real, but Supabase Auth, PostgREST, Storage's signed-URL
  endpoints and the browser→Storage signed upload (the multipart body mirrors
  `@supabase/storage-js`' `uploadToSignedUrl`, checked against its source) have **not** been
  run end to end. `SupabaseRepository`/`SupabaseStorage` are tested against a *fake* client
  (they verify what we ask the database/Storage to do, not how Supabase answers). Run the
  two-account smoke test above before trusting a deployment.
* **Content search covers only what could be extracted.** Scanned/image-only PDFs, images and
  password-protected files have no searchable text (no OCR). Documents are searchable by name
  alone until indexed, and the details panel shows each document's state. Extraction runs inside
  the Next.js server process after the upload response; on a serverless host it is bounded by the
  platform's function duration (`maxDuration` is set to 60 s on the routes that index), and a
  killed run leaves the document `pending` for the backfill to pick up. **The migration, RPCs,
  extraction and queries are tested on local PostgreSQL 16 and in-process only**; extraction of real
  files through Supabase Storage and PostgREST has not been run end to end. Search ranking is
  PostgreSQL's `ts_rank_cd`, not tuned. Text is stored in the same table as the metadata, so anyone
  who can read a document row can read its text via the API (they can already download the file).
* Mutations are mostly one round trip each; multi-step operations rely on the RPCs (quota
  reservation, completing/aborting uploads, tag replacement, purge, team changes). Deleting
  storage objects after a purge or cleanup is best-effort: a failure leaves an orphaned
  object, never a dangling record, and the cleanup route only *reports* such failures. There
  is no scan for objects that have no database row at all.
* The cleanup route and its schedule are not exercised against a real Supabase project, and
  nothing triggers it by itself: you must schedule it.
* Signed upload URLs are valid for Supabase's fixed 2 hours.
* **Rate limiting is in memory and per server instance.** On a multi-instance or serverless
  deployment each instance counts separately (effective limit = limit × instances) and
  counters reset on restart. It blunts loops and casual abuse; it is not a hard guarantee.
  Use a CDN/WAF or a shared store (e.g. Redis) for that. `create_workspace`, login and
  signup are not limited by this app (Supabase Auth applies its own limits).
* **Team**: invites send no email (the inviter must tell the person); they are matched on a
  *confirmed* address, so this depends on "Confirm email" being on. There is no workspace
  switcher: a user who belongs to several workspaces always opens their oldest one. Users
  cannot leave a workspace, change their own role, or transfer ownership in one step
  (promote a second owner, then have them demote you). The Team UI is hidden from editors and
  viewers. Removing a member does not delete what they uploaded or revoke share links they
  created (an admin can revoke those).
* Share links serve the current version, are limited per client address only in memory, and
  the full URL cannot be shown again after creation. Revocation is by link (no "revoke all
  for this document" button).
* Expiration dates are informational (badge on cards); nothing enforces or notifies.
* Previews: PDF, images, CSV, text only.
* In preview mode, document search covers what you add in your own
  browser session. The Team screen needs a database and is not shown in the preview.
* Styling follows the supplied reference screenshot (glass frame, centred document cards, floating upload and details panels) but is an interpretation, not a pixel match; fonts are Geist, bundled locally.
  Responsive behaviour is checked at 1440, 820, 390 and 360 px in Chromium (Playwright layout
  specs plus a manual look at the screenshots), not across other browsers or real devices;
  there is no visual-regression testing.
* Dependencies were installed at current latest versions (Next 16.4, React 19, Tailwind 4,
  zod 4, Vitest 5; `fflate` for archives, `unpdf` for PDF text); `@hookform/resolvers` is pinned to v5 because v6 fails peer resolution.

## Go live checklist

Do these three together; each needs the others to test properly. The sections above have the detail (Supabase setup, Environment variables, Deployment).

### 1. Database (Supabase)

- [ ] Create a Supabase project.
- [ ] Apply every file in `supabase/migrations`, in filename order.
- [ ] Turn on **TOTP** under Authentication > Multi-Factor. Staff in the Control Center must use an authenticator app, and the database enforces it.
- [ ] Set the auth **Site URL** and allowed **redirect URLs** to your hosted domain, including `/reset-password` and `/auth/callback`.
- [ ] Sign up through `/signup`, then make yourself the first Owner (the SQL is under [Control center](#control-center-staff-console)).
- [ ] Copy from Project Settings > API: the project URL, the publishable (anon) key and the service-role key.
- [ ] Optional: `npm run test:db` applies every migration to a throwaway local PostgreSQL 16 and runs the access-policy tests. It needs PostgreSQL 16 installed and does not touch your Supabase project.

### 2. Hosting (Vercel, or any Node host)

Set the variables in [Environment variables](#environment-variables) on the host: at least the two Supabase keys, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`.

- [ ] Leave `DMS_ALLOW_DEV_MODE` unset. It must not be on for real client data.
- [ ] `npm run build && npm start`, or import the repository into Vercel. `vercel.json` already schedules the nightly upload cleanup (03:17 UTC).

### 3. Assistant (Addy)

- [ ] Set `ANTHROPIC_API_KEY` (and optionally `ASSISTANT_MODEL`) on the host; see Environment variables for what each does. Never paste the key into chat or commit it.

### After it is live: check these

- [ ] Sign up, create a workspace, sign out and back in.
- [ ] Upload a document, search for text inside it, create and open a share link.
- [ ] `/control`: sign in as the Owner with an authenticator code; a non-staff account gets a 404.
- [ ] Send a password reset from the Control Center and follow the link to `/reset-password`.
- [ ] Ask Addy to set up a business; confirm it asks before deploying and that it refuses card numbers and passwords.
- [ ] Monitoring page in the Control Center: every health check green.

### Know before you go live

Connecting the database gives real sign-in, workspaces, Documents storage, share links and the Control Center. It also saves **licenses and tasks (projects)** to the workspace, shared by everyone on the team and kept across devices (table `workspace_records`, from the `workspace_records` migration; editors and above can change them, viewers can only read). Home, Reporting and the bell read those saved records.

**Invoices, vendors, contacts and forms are still saved only in each visitor's browser.** They use the same save path and only need switching on (add the service to `PERSISTED_KINDS` in `src/lib/records/supabase-backend.ts`, then check it). Sample data is switched off for a connected workspace, so it can never replace real records.

After the database is connected, also check:
- [ ] Add a license, refresh the page, and it is still there. Open the app in a second browser signed in as a teammate: they see it too.
- [ ] Sign in as a **viewer**: licenses and tasks show, and a change is refused with a "view-only" message rather than failing silently.

## Security review

Scope: everything under `document-management/` (Next.js routes, service layer, Supabase adapters,
SQL migrations 1–6, proxy, config). Migration 7 and the content-search pipeline were added afterwards and
are covered in the addendum at the end; the findings table below predates them. The Python
repo root is out of scope.

Method: manual read of every API route, `proxy.ts`, the auth routes, the service and adapters, and all
SQL (RLS, `SECURITY DEFINER` functions, storage policies), plus `npm audit` and live probes of the
suspected issues. Confirmed Critical/High/Medium findings were fixed with regression tests.

**Not verified against a hosted Supabase project.** Behaviour of Supabase Auth, PostgREST, Storage
(signed upload URL semantics, `storage.objects.metadata`, `Content-Disposition` handling) is
inferred from documentation and the local PostgreSQL harness with stubbed `auth`/`storage` schemas.
See "Needs a hosted project" at the end.

### Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Medium | Open redirect in `/auth/callback?next=` via tab/newline (`/%09/evil.com`) | Fixed |
| 2 | Medium | Storage-quota bypass: `dms_complete_upload` trusted a caller-supplied size | Fixed |
| 3 | Medium | Share links could be minted with any expiry through the API (7-day cap bypass) | Fixed |
| 4 | Medium | Unlimited self-service workspaces, each with its own default quota | Fixed (cap of 5 owned) |
| 5 | Medium | Operator-configurable upload types could enable HTML/SVG/JS (stored XSS on inline serving) | Fixed (blocklist) |
| 6 | Low | `/auth/signout` accepted cross-site POST (logout CSRF) | Fixed |
| 7 | Low | Origin check tolerated a missing header with `Sec-Fetch-Site: cross-site` | Fixed |
| 8 | Low | File names written directly through the API bypass the sanitiser; used in `Content-Disposition` | Fixed (DB check + re-sanitise) |
| 9 | Low | `create_workspace` stored a client-supplied email on the member row | Fixed |
| 10 | Low | JSON bodies parsed with no size cap | Fixed (256 KB) |
| 11 | Info | Missing HSTS / clickjacking / base-uri / form-action headers | Fixed (see note on CSP) |
| 12–19 | Low/Info | Open, see "Open items" | Open |

No Critical or High findings were confirmed.

### Fixed findings

#### 1. Open redirect after sign-in — Medium
`src/lib/safe-redirect.ts` (was lines 2–4); used by `src/app/auth/callback/route.ts:9,13` and `src/components/auth/auth-form.tsx:50`.
`safeNext` rejected `//` and `\` but not tab/CR/LF. The WHATWG URL parser strips those, so
`next=/%09/evil.com` → `new URL("/\t/evil.com", origin)` → `https://evil.com`. Reproduced with Node before the fix.
Exploit: attacker sends a victim a callback link carrying a valid code (e.g. their own) and a hostile `next`;
the victim is signed in (login CSRF) and bounced to a phishing page that looks like the post-login screen.
Fix: accept only visible ASCII, no backslash, no leading `//`, and confirm by parsing that the result stays on the
same origin; return the re-serialised path. Tests: `tests/unit/security.test.ts` (14 hostile inputs + a 3,000-case fuzz).

#### 2. Storage quota bypass in `dms_complete_upload` — Medium
`supabase/migrations/…0003_dms_functions.sql:185-206` (replaced in `…0006_dms_security_hardening.sql`).
The function wrote the **caller-supplied** `p_size` into `document_versions` / `documents` and never looked at the
stored object. Quota is checked against the size *declared* at `dms_begin_upload`. An editor calling the RPC directly could
declare 1 byte, upload a 50 MB object (the bucket only enforces a per-object limit), then complete with `p_size = 1`,
repeating without ever consuming quota. The app's own `finalizeUpload` compared sizes, but the database did not.
Fix: the function now ignores `p_size`/`p_mime`, requires the object to exist in `storage.objects`, and requires its stored
size to equal the declared (quota-checked) size. SQL tests: object missing, size mismatch, lying `p_size`, version stays pending.

#### 3. Share-link lifetime cap bypass — Medium
`supabase/migrations/…0002_dms_rls.sql:105-106` (insert policy), `src/lib/dms/supabase/repository.ts:293`.
The 7-day cap lived only in the service layer; the table accepts client inserts, so an editor could insert a link row
with `expires_at` 100 years out (and arbitrary `created_at`/`revoked_at`), creating a permanent public URL to a
client document that outlives the member's access.
Fix: `BEFORE INSERT` trigger `dms_share_links_guard` (for the `authenticated` role) forces `created_at = now()`, clears
`revoked_at`, and rejects `expires_at` beyond 7 days. SQL tests cover 30 days, "never", exactly 7 days, forged timestamps.

#### 4. Unlimited workspaces → unlimited quota — Medium
`supabase/migrations/…0003_dms_functions.sql:110-131`.
Any authenticated user could call `create_workspace` repeatedly, each workspace getting the default 5 GB quota.
Fix: a user may own at most 5 workspaces (`workspace_limit`, mapped to a friendly error). Product decision to confirm:
the number, and whether self-created workspaces should get a smaller default quota than paid ones.

#### 5. Active-content file types could be enabled by configuration — Medium
`src/lib/dms/config.ts` (`DMS_EXTRA_FILE_TYPES`).
An operator (or a mistake) adding `html=text/html` or `svg=image/svg+xml` would let users store files that execute script
when opened inline (the dev download route serves same-origin; Supabase serves from its storage origin).
Fix: `BLOCKED_EXTENSIONS` / `BLOCKED_MIME_PATTERNS` are applied to extra types and cannot be overridden by env. The default allow-list
(pdf, docx, xlsx, pptx, csv, jpg, jpeg, png, txt) is also asserted to contain none. Note the storage bucket's own
`allowed_mime_types` (migration 4) already fails closed for any type not listed there.

#### 6–7. Cross-site request handling — Low
`src/app/auth/signout/route.ts` had no origin check, and `sameOrigin()` (`src/lib/dms/server/respond.ts`) allowed a request with no
`Origin` even when the browser said `Sec-Fetch-Site: cross-site`. JSON-only bodies are required and `@supabase/ssr` cookies are expected to be `SameSite=Lax`
(unverified, see the last section), so exploitability was low; both now reject cross-site requests, and sign-out reuses the same check.

#### 8. File names bypassing the sanitiser — Low
Editors can `PATCH` `documents.display_name` through PostgREST directly. That value reaches `Content-Disposition` via the
signed-URL `download` option (`src/lib/dms/supabase/storage.ts`, `src/app/share/[token]/route.ts`).
Fix: `NOT VALID` CHECK constraints reject control characters and `/` `\` in `display_name`/`original_name` for new and updated
rows, and both download paths re-sanitise the name. (Run `ALTER TABLE … VALIDATE CONSTRAINT` after cleaning any legacy rows.)

#### 9–10. Smaller hardening — Low
`create_workspace` now reads the member email from `auth.users` instead of a client argument (spoofed emails could confuse the
"already a member" check and the team list). `readJson` refuses bodies over 256 KB before parsing.

#### 11. Headers — Info
Added `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, and a CSP limited to `frame-ancestors 'none'; base-uri 'self';
form-action 'self'; object-src 'none'`. A full `script-src` policy needs per-request nonces with this Next version and was
not attempted; React escapes all file-derived text and there is no `dangerouslySetInnerHTML`/`innerHTML` in `src/`.

### Reviewed and found sound

- **Authn on every route.** All `/api/dms/*` handlers run through `route()` → `getDms()` → `auth.getUser()` (validated with the auth
  server, not just the cookie); `proxy.ts` additionally 401s unauthenticated `/api/dms` calls. Dev routes return 404 unless dev mode is
  allowed, which requires Supabase to be unconfigured and `NODE_ENV !== "production"` (or an explicit `DMS_ALLOW_DEV_MODE=true`).
- **Tenant isolation.** The workspace id is derived server-side from the caller's membership, never from the request. Every repository
  query is scoped by workspace *and* runs as the user, so RLS applies. All helper/RPC functions are `search_path = ''`; `SECURITY DEFINER`
  functions check roles explicitly; cross-workspace composite FKs prevent a row referencing another workspace's folder/document/tag.
  Grants: `anon` has no table privileges; sensitive RPCs (`dms_resolve_share`, `dms_cleanup_stale_uploads`, `dms_audit_write`) are
  `service_role`/internal only.
- **Storage.** Keys are generated by the database from validated parts (`<ws>/<doc>/v<n>-<nonce>.<ext>`), so path traversal is impossible;
  the insert policy only allows an object for a pending version the caller opened; ready objects cannot be deleted or overwritten
  (no update policy), which closes the finalize TOCTOU for the content that was verified.
- **Invites and roles.** Acceptance requires `email_confirmed_at`; admins cannot create/modify/remove admins or owners; no self role
  change; last-owner rule serialised with row locks.
- **Share links.** 256-bit random token, only the SHA-256 is stored, 60-second signed redirect, `no-referrer`, revocation and
  use auditing, service-role key used only in `/share/[token]` and the cleanup route and never imported by client code.
- **Cleanup route.** Constant-time comparison (hashes both sides), requires a ≥16-character `CRON_SECRET`, fails closed if unset.
- **Logging.** Only error class names and Postgres error codes are logged; no file names, tokens or document contents.
- **Dependencies.** `npm audit` reports 0 vulnerabilities (prod and dev).
- **DoS bounds.** Page size ≤ 100 (zod and SQL), search ≤ 100 chars, tags ≤ 20 per document, per-user rate limits on writes, uploads, shares, invites.

### Open items (not fixed)

| # | Sev | Item | Why / mitigation |
|---|-----|------|------------------|
| 12 | Low | Rate limiting is in memory per instance and the public-share limiter keys on the first `X-Forwarded-For` entry, which a client can spoof on hosts that append rather than overwrite it. | Tokens are 256-bit so guessing is infeasible; the limiter only blunts noise. Needs a shared limiter (CDN/WAF/Redis) for a hard guarantee. |
| 13 | Low | Guard bypass relies on a transaction-local GUC (`dms.rpc`). Safe today because PostgREST cannot run `set_config`, but any future SQL-executing RPC would defeat it. | Design hardening; do not add RPCs that execute caller-supplied SQL. |
| 14 | Low | Editors can still edit `uploaded_by_name`, `category`, `starred` etc. directly, and pass `p_user_name` to `dms_begin_upload`, so the "uploaded by" label is spoofable (the real `uploaded_by` uuid and audit actor are not). | Integrity of a display label; fix by reading the name from `workspace_members` in the RPC. |
| 15 | Low | An editor can create many pending uploads that reserve quota until the 24 h cleanup (rate-limited at 60/min). | Insider self-DoS of shared quota; lower `DMS_PENDING_UPLOAD_MAX_AGE_HOURS` or add a per-user pending cap. |
| 16 | Low | Share links outlive the member who created them; removing a member does not revoke their links. | By design (links are workspace assets); admins can revoke from the document panel. Consider auto-revoking on member removal. |
| 17 | Low | Finalize compares size and magic bytes but not the stored `Content-Type` against the extension; a `.png` could be stored as `application/pdf` (both allowed by the bucket). | No script-capable type is allowed, so impact is a mislabelled download. |
| 18 | Info | CSV/Excel "formula injection" if a downloaded CSV is opened in a spreadsheet. | Content is the uploader's own; out of scope for storage. |
| 19 | Info | No CSP `script-src`. | See finding 11. |

### Deployment requirements this review depends on

- Supabase Auth **"Confirm email" must stay enabled**; otherwise anyone can sign up with an invited address and be auto-joined.
- Set `CRON_SECRET` (≥16 chars); keep `SUPABASE_SERVICE_ROLE_KEY` server-side only and never prefix it `NEXT_PUBLIC_`.
- Apply migration `20261023000006_dms_security_hardening.sql`, then validate the new CHECK constraints.
- Do not set `DMS_ALLOW_DEV_MODE=true` in production.

### Needs a hosted project to verify

1. `storage.objects.metadata->>'size'` is populated for objects uploaded through signed upload URLs (migration 6 depends on it).
2. A signed upload URL cannot be replayed to overwrite an existing object (we rely on `upsert` being off and no update policy).
3. How Supabase Storage renders the `download=` name in `Content-Disposition` for unusual names.
4. Auth cookie attributes (`SameSite`, `Secure`) set by `@supabase/ssr` in production.
5. End-to-end behaviour of every RLS policy through real PostgREST (the harness exercises them at the SQL layer only).

### Addendum: content search (migration 7, `src/lib/dms/extract/`)

Reviewed by reading the code and exercising it with tests; **not** penetration-tested, and not run against a hosted
Supabase project. No Critical/High findings. Design choices and residual risks:

| Area | What was done | Residual risk |
|------|---------------|---------------|
| Parsing hostile files | Only whitelisted extensions are parsed. Input ≤ 25 MB; archives ≤ 3,000 entries, 40 MB/entry, 80 MB total, 150× ratio, enforced on bytes actually inflated (headers are not trusted); a 20 s deadline checked between units of work plus a hard race; PDFs ≤ 300 pages with scripts/XFA/font loading off; OOXML read by a minimal tag scanner (no DOM, no DOCTYPE, no external entities, only the five XML entities). Tests cover zip bombs (size and ratio), too many entries, truncated/corrupt/lying archives, encrypted entries, DOCTYPE entities, shared-string amplification, garbage PDFs and the deadline. | Parsing runs in the Next.js server process, not a sandbox. A parser bug in PDF.js or fflate would run with the app's privileges; the timeout cannot interrupt a synchronous CPU loop inside a library. Run behind a platform function limit, and consider a separate worker if untrusted users can upload. |
| Who can write text | `content_*` columns are protected by the existing guard trigger; the only writers are `dms_set_document_content` (editor+, current version only) and a service-role twin used by the reindex route. | An editor can call the RPC directly and store text that is **not** in the file (search poisoning inside their own workspace). They can already upload any file, so no boundary is crossed; admins can re-run the extraction by uploading a new version. |
| Stale / racing writes | A write must name the document's current version, so a slow extraction cannot overwrite a newer version; a new version clears old text in the same transaction as completion. | None known. |
| Tenant isolation | Search is SECURITY INVOKER (RLS applies), queue RPCs filter by workspace and role, service-role functions are not executable by `anon`/`authenticated`. Tested: a member of another workspace sees no text, no matches, no queue entries. | Text is as visible as the document row to every member who can read it, including viewers. |
| Snippet injection | Snippets are plain text from `ts_headline` (which drops tags) with U+E000/U+E001 as highlight delimiters; those and control characters are stripped before storage. The UI only renders them as React text nodes; there is still no `dangerouslySetInnerHTML`. | None known. |
| Resource limits | Stored text ≤ 400,000 characters (also keeps the tsvector under PostgreSQL's 1 MB limit); search input ≤ 100 characters; `ts_headline` runs on the returned page only, on at most 200,000 characters per row; reindex is bounded per call (≤ 100 documents, 45 s) and gated by `CRON_SECRET`. | A query over a very large workspace is limited by the GIN index and `ts_rank_cd`; not load-tested. |
| Background work | `after()` indexing never affects the upload response; errors are swallowed and leave the document `pending`/`failed`. Bootstrap indexes ≤ 5 pending documents for editors only. | Many concurrent bootstraps can index the same document more than once (idempotent, wasteful). |
| Logging | Nothing about file names, keys or text is logged; the reindex route returns counts only. | — |

Deployment note: apply migration `20261023000007_dms_content_search.sql`. It drops and recreates the generated
`search_vector` column (content only) and resets nothing else; existing documents become `pending` and are indexed
by the backfill described in the README.


### Addendum 2 (2026-11-05): control center, agreements, assistant, licenses, public pages

Scope: everything added after the first review: migrations 8–19, the staff Control Center and its API, the public agreement
flow, the Claude assistant, license parsing/OCR, the public invoice page, plan gating, and a dependency and git-history scan.
Method: read every new route, helper and SQL function (grants, `SECURITY DEFINER` bodies, RLS policies); ran the full SQL
suite, typecheck, lint, unit and e2e tests; reproduced each fixed issue against the old code before fixing it.
**Not** a penetration test and **not** run against a hosted Supabase project (same limits as above).

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 20 | Medium | The stored agreement-link hash was itself a credential: `agreement_public_accept(hash, …)` is callable by `anon`, and every staff role (including read-only billing) can `SELECT` `token_hash`. Anyone able to read that column, a backup or a query result could record a client's legal acceptance without the link. | Fixed (migration 19) |
| 21 | Low–Med | `CONTROL_DEMO=true` left on after Supabase was connected removed the sign-in redirect for `/control` (the proxy returned 200 to anonymous users; sample data only). The proxy clause only ever took effect in that exact combination. | Fixed |
| 22 | Medium (design) | `/invoice/[token]` carries the whole invoice, unsigned, in the URL and renders it on the app's own origin. XSS is not possible today (every string is escaped, dates pass a strict anchored regex), but anyone can mint an "invoice from AdFlo" with their own payment details on your domain. | **Open: decision needed** |
| 23 | Medium (defence in depth) | No CSP `script-src` (item 19). More relevant now: `invoice/[token]` uses `dangerouslySetInnerHTML` on a cookie-bearing origin, so a single future escaping mistake there is script execution. | **Open: decision needed** |
| 24 | Medium (architecture) | Many modules (todos, approvals, signing, audit, reminders, packets, settings, and staff billing in `lib/control/billing-storage.ts`) persist business data in the browser's `localStorage`: no server auth, no RLS, no audit trail, readable by any script on the origin, and left on shared computers. | **Open: decision needed** |
| 25 | Low | Agreement acceptance proves possession of the link, not who the signer is. Staff who relay the link (the UI shows it to them) can accept it. | Open: send the link to the client from the server and record IP / user agent. |
| 26 | Low | Assistant spend is capped only by the per-instance in-memory limiter (20 messages/min/user, up to 6 model calls each). | Open: add a per-user daily cap in the database. |
| 27 | Low | Password-reset `redirectTo` is built from the request origin. | Open: set `NEXT_PUBLIC_SITE_URL` and rely on Supabase's Redirect URL allow-list. |
| 28 | Low | `/api/licenses/parse` buffers a multipart body before the size check when no `Content-Length` is sent. Vercel's request-size cap hides this; a self-hosted deployment needs a proxy limit. | Open |
| 29 | Info | `planIncludes()` fails open when it cannot tell (by design). Plan gating is a billing control, not a security boundary. | Accepted |

#### 20. Agreement hash as bearer credential: fixed
Before: the app hashed the secret and passed the hash to `agreement_public_view/accept`. After (`…0019_agreement_verify_secret_in_db.sql`):
both functions take the 43-character secret and hash it in the database, so the stored hash matches nothing if replayed.
Tests: `supabase/tests/control4.sql` (billing reads the hash and cannot accept with it; the hash shows nothing to anon; malformed
and wrong-length secrets are refused), `tests/unit/agreement-accept-route.test.ts` (the route sends the secret, never a hash).
Reproduced first: against the old functions the billing-forgery assertion fails. **Deploy the app and the migration together**;
until both are live, links fail closed ("not valid").
Residual: see item 25.

#### 21. Demo switch: fixed
`controlDemoActive()` (`src/lib/supabase/env.ts`) is true only when `CONTROL_DEMO=true` **and** Supabase is not configured; the
proxy no longer consults the variable. Tests in `tests/unit/auth.test.ts`; reproduced first (old proxy answered 200 for `/control`).

#### Reviewed and found sound
- **Database authorization.** Every `SECURITY DEFINER` function sets `search_path = ''`; execute is revoked from `public`/`anon`
  everywhere except the two agreement functions that are meant to be public; every staff function checks `is_staff(...)` itself, and
  `staff_role()` requires `aal2`, so the second factor is enforced by the database, not only the app. Role changes are owner-only, the
  last-owner rule is a trigger, `app_errors` is written only by the service role. All 11 new tables have RLS enabled.
- **Staff API.** Each route goes through `staffRoute`: same-origin check, active staff row, `aal2`, then role. Password-reset email
  only goes to an address that belongs to a client and is audit-logged.
- **Assistant.** It never reads server data. It edits a setup config the client sent (re-validated on return) and can only emit
  same-origin "draft" links built from fixed paths and allow-listed, length- and shape-checked fields; it rejects card, SSN and
  password-like values and cannot save, send, approve or delete. Prompt injection therefore cannot reach another tenant or any record.
- **Maintenance routes** (`CRON_SECRET`, constant-time compare, fail closed), **share links** (service-role RPC only) and **auth callback**
  unchanged and sound.
- **Dependencies.** `npm audit --omit=dev`: 0 vulnerabilities. Eight *moderate* findings exist in the dev-only lint chain
  (`minimatch` ReDoS via `typescript-eslint`); nothing ships. `npm audit fix` would downgrade `eslint-config-next` by a major
  version, so it was not applied.
- **Secrets.** Pattern scan (Anthropic and GitHub tokens, Supabase JWTs and `sbp_` tokens, AWS keys, private keys) over the tree and all 81
  commits found nothing; the scan was checked with a positive control. `.env` files were never committed (only `.env.example`).

#### Test-suite repairs (no behaviour change)
`supabase/tests/control2.sql` had two stale assertions that failed on `main` and stopped `test:db` before the control, agreement and
monitoring suites ran: it counted exactly one `plan.insert` audit row and exactly two visible plans, but the tier migrations (15, 17)
seed more. They now assert on the plan the test creates. `test:db` is green again (355 assertions).

#### Deployment requirements added
- Apply `20261105000019_agreement_verify_secret_in_db.sql` together with this release.
- Remove `CONTROL_DEMO` from production anyway; it is now ignored once Supabase is configured.
- Supabase Auth: keep "Confirm email" on, add your production URL to the Redirect URL allow-list (item 27), and consider requiring
  MFA for staff accounts at enrolment time. These are hosted settings this review could not see.

## Progress road map

Kyle's list, in the order it was given. `[x]` done, `[~]` partly done, `[ ]` not started.
Databases go last. Update this section in the same commit as the work.

- [x] Task reminders so admin work doesn't fall through cracks ("Remind me" on project tasks puts them in the bell and the home feed; Requests no longer exists on main)
- [x] "+" under Projects to add your own project types (in the new-project template dropdown; saved in this browser)
- [x] Sidebar minimizes to icons only
- [x] Home screen: more innovative (queue, day summary, where-to-begin cards while empty)
- [x] Make the app feel alive (pages rise into place in turn, the bell pulses for new items, progress bars animate, home suggests where to begin; all motion off for reduced-motion settings)
- [x] AI agent can complete tasks in any module, with per-module guardrails (prepares drafts in invoices, requests, contacts, vendors, projects and licenses that open prefilled for you to save; cannot save, delete, approve, pay, send or sign; refuses card numbers, SSNs, passwords and tax IDs; max 3 drafts a turn)
- [x] Addressed by your name in the app
- [x] Invoice tracking: frequency choice, stays open until paid (one-time to yearly, shown on each invoice; stays Sent or Overdue until marked paid)
- [x] Licenses & Renewals: templates by business (vehicle registration, tags, insurance, inspection, and 7 other business types)
- [x] Pages stop opening to bare home screens (each module explains itself with a first step when empty; home suggests where to begin)
- [x] Explore more of Licenses & Renewals (templates, certification and policy types, compliance score, add renewals to your calendar, renewal fees with what is coming up in 90 days)
- [x] Vendors: deeper dive (payment terms, how critical, contract end alerts, yearly spend with a 1099 and W-9 check, rating, reminders and notes log, CSV columns)
- [x] Queue on the home dashboard
- [~] Bridge Vendors -> Contacts (menu merged; records still separate, needs database)
- [x] Discuss: what the Projects module should include (built with defaults: owner, progress bar, milestones, dated updates log, link to a contact or vendor, project types; recurring tasks moved here from Requests)
- [x] Discuss: setup for different industries (built with defaults, 17 industries, tick-box bundles in setup, follows industry changes in Settings; every choice is written up in the README working notes for Kyle to adjust)
- [x] Forms & Paperwork: pick paperwork by business type (28 forms, repeating ones flagged; print, PDF or download after filling in)
- [x] Reporting: dropdown with Reports, Scheduled reports, Materials (scheduled: due banner, print or PDF, no email yet; materials: summary plus per-service PDF and CSV)
- [x] Remove anything that looks AI-coded (Title Case labels now sentence case, blue-to-violet gradients and gradient buttons gone, flat navy sign-in)
- [ ] Approval chain (built, then removed: main dropped approvals from Forms and Vendors, so it was not carried over)
- [~] Fix for invisible admin bottlenecks (approvals unanswered for 5 days and unstarted work with no due date now flagged in the digest, bell and home feed; escalating to a named owner needs team data)
- [x] Document signing (in Forms: typed-name signatures with an explicit agreement, several signers, SHA-256 fingerprint and signed-copy PDF; not a certified e-signature service)
- [x] "Needs your attention" feed
- [x] OCR (photos and scans of licenses and certificates are read: license upload fills the form, and attaching a certificate to a vendor document reads its expiry date; scanned PDFs and the document index are not OCR'd yet)
- [x] Bridge gaps between Contacts and Forms (fill out a form for a contact with their details already in; add the person from a filled-in form to Contacts)
- [x] CRM renamed to Contacts
- [x] Notifications made very useful (bell respects the Settings choices, marks what is new, snoozes per item, lists what is waiting on you and for how long)
- [x] Certifications and compliance tracking for licenses and policies (Certification and Policy types with templates, review cycle = renewal term with reminders, document checklist, compliance score)
- [x] Onboarding packets (in Forms: new employee, vendor and client packets of forms, documents and signatures; progress bar, stale flag after 7 days, print or PDF checklist)
- [~] Ghosting fix: automated vendor compliance reminders + comments/notes log for updates and CYA (due-reminder rules, escalating wording, ghosted flag after 3 and a dated notes log done; sending opens your email app until a mail service exists)
- [ ] Contact / vendor profile with all their documents and notes in one place (needs database)
- [ ] Databases (last)

### Round 2 (your newer list, plus what did not survive the merge)

- [x] Licenses & Renewals gets its own tab on the dashboard (counts by state, what expires next, good-standing percent)
- [x] Audit trail: who did what and when (new Activity page: the person's name, what they did, the time; filter by area; saved in this browser)
- [x] Calendar page in the navigation menu (month grid and agenda; invoices due, license expiries and renewals, tasks, milestones, vendor documents, reminders; filter by kind)
- [x] Fix the Reporting page: it is just a bunch of boxes (overview now leads with headline numbers, a ranked where-to-look-first list, a records-by-service chart and a service-by-service table; each service report has one key-numbers panel)
- [x] Dropdowns on service tabs where they make sense (sidebar now opens Contacts, Tasks and Reporting to their sections; Add license, Add contact and New form each have an arrow with the other ways to add; Reporting has one Export menu for CSV or Excel)
- [x] Rename the AI assistant to Addy
- [x] Send a form after creating it (main already had a Send button on each form; now the Send dialog also opens right after you create a new form)
- [x] Make the app feel alive: pages ease in again
- [x] "Remind me" on the flat Tasks list too, not only inside Projects (the alarm-clock button on each open task; the reminder shows in the bell, on Home and on the calendar)
- [x] AI assistant completes a task in any service, within its limits (Addy now adds to your to-do list, sets reminders and ticks off to-dos by itself, each with Undo; everything else is still a draft you save)
- [x] OCR for scanned PDFs (a PDF with no text layer now has its first 3 pages drawn and read like photos, wherever the text reader is turned on; the document index still skips OCR)
- [ ] Sending email for vendor reminders and scheduled reports (needs a mail service)

### Audit Edit Revisions (from the 5 Nov demo audit)
- [x] Invoices, licenses, vendors, contacts and projects are saved in this browser and survive leaving the page or a reload
- [x] Home, the bell and Reporting read those saved records, so they agree with each service
- [x] Cheap fixes: casing leftovers, Documents h1, friendlier sign-in message, unused logo removed, wordmarks resized
- [x] Remaining Title Case labels now sentence case (form fields, dropdown options, dialog titles, document type labels); module and product names such as Licenses & Renewals and Control Center keep their capitals, and the unused `titleCase` helper is gone
- [x] Demo opens blank with a "See AdFlo with sample data" card on Home: a small shop set and a large regulated company set (Settings > Demo data loads or clears them; loading over saved records asks first)
- [x] Accessibility: contrast and tap targets fixed and guarded by tests/e2e/accessibility.spec.ts (axe on 17 pages, desktop and phone)
- [ ] Addy's live Claude mode untested; browsers other than Chromium not tried
- [x] Landing page at /landing is the original hero with the demo workspace (my longer marketing page is in git history, commit 534795a)

## Working notes

**Revision list (Kyle's 30 items):** see the "Progress road map" section above. Branch `revision-part-1`, PR #22.
Working notes for tests: run `npm run typecheck` before every push (the Vercel build type-checks tests). A stale `next dev` or old `.next` makes pages reload in a loop and the first tests fail: kill any stray `next dev` (a leaked one is reused and misbehaves) and `rm -rf .next` before a run, and run Playwright with `--trace off` or `--output=/tmp/...` so traces are not written inside the project.

### Audit Edit Revisions (Nov 9)
Invoices, licenses, vendors, contacts and projects now persist in localStorage (`src/lib/records/storage.ts`, keys `adflo.records.<kind>.v1`). Home, the bell and Reporting build from those records in the browser (`src/lib/records/sources.ts`), so `loadDashboardSources` on the server stays empty. Until the browser's day is known the hook returns empty, so hydration matches the server. AdFlo is not only for small businesses: keep that in mind when choosing demo sample data and product wording.
Sample data: `src/lib/samples/data.ts` builds two sets from today's date (small shop, large regulated company), `storage.ts` loads or clears them, and `src/components/modules/sample-data.tsx` is the Home card and the Settings > Demo data tab. Add a set by adding an entry to `SAMPLE_SETS`. Sample records are written into the same browser storage as real ones, so the services treat them identically.

### Design choices to review (change any of these)

**Industry setup** (`src/lib/setup/industries.ts` holds the table; the libraries it draws from live with their services)
- 17 industries. The 8 original ones plus Auto & fleet, Home services, Beauty & wellness, Legal, Accounting & tax, Trucking & logistics, Education & childcare, Manufacturing, Tech & agency.
- Choosing an industry does not install anything by itself. The Templates step shows "What we'll set up for a <industry> business" with seven tick boxes (license records, paperwork, project templates, vendor documents, approval chain, reminder lead time, home starting points). Every box starts ticked for the services you chose; untick what you do not want.
- The boxes are saved as `bundle:...` ids beside the template ids. What each one puts in place is worked out from the industry each time, so changing the industry in Settings > Business profile changes the licenses, forms, project templates, vendor documents, approval chain and home cards straight away, with no re-install.
- Several industries share a library: Auto & fleet and Trucking use the vehicle one, Home services uses construction, Tech & agency uses professional. Beauty, childcare, manufacturing, legal and accounting got libraries of their own (about 4 license items and 3 forms each).
- Approval chains: an industry's chain is only a default. Any chain set by hand in Settings > Approvals wins. Larger or regulated businesses get two steps (for example Project manager then Owner); small ones get one.
- Reminder lead time is written into Settings > Notifications when setup is finished, and again when the industry is changed. After that you can change it freely.
- Vendor documents: new vendors get the standard documents for their category plus the industry's extras (for example a workers' compensation certificate for construction). Existing vendors are not changed.
- License records from an industry are starting points that expire a term from today, with a note asking for the real numbers and dates. One that has the same name as a record the older "small-business" template already added is skipped.
- Project templates: nine new ones (job closeout, inspection preparation, fleet compliance audit, new client matter, tax season prep, product launch, client project kickoff, enrollment period, production line audit). Each is tagged with the industries it suits and those are listed first in the New project template list.

### Open ideas
- [ ] **Automation discovery** — go through every module and list what can be automated.
- [ ] **Admin research** — what else can an admin do?
- [~] **AI assistant** — live at `/app/assistant` (under Home). Claude-backed via `/api/assistant` once `ANTHROPIC_API_KEY` is set (tools: profile, recommend, deploy, status); until then the built-in rules answer. Untested against the real API. Next: let it open/fill modules.
- Settings (`/app/setup?tab=...`) has tabs Business profile, Team, Notifications, Appearance (Day, Night, Match my device) and Guided setup. File reset is now a one-time "Tidy up files" tool, linked from Documents and Guided setup.

### Merge of revision-part-1 into main (Nov 4)
`main` had moved: another session removed Requests and approvals, renamed Projects to Tasks, redesigned Home and added form sending. Where the two disagreed, `main` won:
- Not carried over: approval chains (Settings > Approvals), the Requests page and its reminders and recurring-task dialog, the "Waiting on you" queue, the "Where to begin" home cards, and vendor approval states.
- Kept from revision-part-1: Contacts name with Vendors as a tab, icon-only sidebar minimize, licenses templates and compliance, OCR, vendor follow-ups and extras, paperwork picker with print/PDF, signing, onboarding packets, the Contacts and Forms bridge, industry setup, assistant guardrails and drafts, Reporting dropdown, notifications, and project owner, milestones, updates log and contact or vendor link.
- Task reminders ("Remind me") still show in the bell and the home feed.

## Changelog

Notable changes clients may care about. Newest first.

### Unreleased
- Support and operations material added under `docs/support/`: email templates, onboarding runbook and help articles.
