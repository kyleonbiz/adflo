# Go live: database, hosting and the assistant

Do these three together; each needs the others to test properly. The README has the detail (Supabase setup, Environment variables, Deployment).

## 1. Database (Supabase)

- [ ] Create a Supabase project.
- [ ] Apply every file in `supabase/migrations`, in filename order (20 files at the time of writing).
- [ ] Turn on **TOTP** under Authentication > Multi-Factor. Staff in the Control Center must use an authenticator app, and the database enforces it.
- [ ] Set the auth **Site URL** and allowed **redirect URLs** to your hosted domain, including `/reset-password` and `/auth/callback`.
- [ ] Sign up through `/signup`, then make yourself the first Owner (run once in the Supabase SQL editor):

  ```sql
  insert into public.staff_members (user_id, role, display_name, email)
  select id, 'owner', 'Your Name', email from auth.users where email = 'you@example.com';
  ```
- [ ] Copy from Project Settings > API: the project URL, the publishable (anon) key and the service-role key.
- [ ] Optional: `npm run test:db` applies every migration to a throwaway local PostgreSQL 16 and runs the access-policy tests. It needs PostgreSQL 16 installed and does not touch your Supabase project.

## 2. Hosting (Vercel, or any Node host)

Set these environment variables on the host (never commit real values; `.env.example` lists them all):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. Safe in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Used for share links and the cleanup job. Never prefix with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | 16+ random characters, e.g. `openssl rand -hex 24`. Protects the cleanup route. |
| `NEXT_PUBLIC_SALES_EMAIL` | Optional. Where the landing page "Book a demo" form sends requests. |

- [ ] Leave `DMS_ALLOW_DEV_MODE` unset. It must not be on for real client data.
- [ ] `npm run build && npm start`, or import the repository into Vercel. `vercel.json` already schedules the nightly upload cleanup (03:17 UTC).

## 3. Assistant (Addy)

- [ ] Set `ANTHROPIC_API_KEY` on the host. Without it Addy uses its built-in rules.
- [ ] Optional: `ASSISTANT_MODEL` to change the model (default `claude-opus-5-5`).
- [ ] Claude answers only for workspaces on the **Core +** plan. Core stays on the built-in rules.
- [ ] Never paste the key into chat or commit it.

## After it is live: check these

- [ ] Sign up, create a workspace, sign out and back in.
- [ ] Upload a document, search for text inside it, create and open a share link.
- [ ] `/control`: sign in as the Owner with an authenticator code; a non-staff account gets a 404.
- [ ] Send a password reset from the Control Center and follow the link to `/reset-password`.
- [ ] Ask Addy to set up a business; confirm it asks before deploying and that it refuses card numbers and passwords.
- [ ] Monitoring page in the Control Center: every health check green.

## Know before you go live

Connecting the database gives real sign-in, workspaces, Documents storage, share links and the Control Center. It also saves **licenses and tasks (projects)** to the workspace, shared by everyone on the team and kept across devices (table `workspace_records`, from the `workspace_records` migration; editors and above can change them, viewers can only read). Home, Reporting and the bell read those saved records.

**Invoices, vendors, contacts and forms are still saved only in each visitor's browser.** They use the same save path and only need switching on (add the service to `PERSISTED_KINDS` in `src/lib/records/supabase-backend.ts`, then check it). Sample data is switched off for a connected workspace, so it can never replace real records.

After the database is connected, also check:
- [ ] Add a license, refresh the page, and it is still there. Open the app in a second browser signed in as a teammate: they see it too.
- [ ] Sign in as a **viewer**: licenses and tasks show, and a change is refused with a "view-only" message rather than failing silently.
