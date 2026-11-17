# AdFlo backup and restore plan

**Status: template.** Fill every `[ ]`, then run the restore drill once and record the result at the bottom. A backup you have never
restored is a guess. Check each provider's current plan terms before relying on a number below: they change.

## What has to be recoverable

| Data | Where it lives | Covered by the database backup? |
|------|----------------|--------------------------------|
| Accounts, workspaces, members, folders, document records, versions, share-link hashes, audit logs, Control Center data | Supabase Postgres | Yes |
| **The files themselves** (PDFs, images, spreadsheets in the `documents` bucket) | Supabase Storage | **No.** A database backup keeps the *records* of files, not their bytes. Deleted or overwritten files cannot be restored from it |
| Sign-in accounts and password hashes | Supabase Auth (`auth` schema, in Postgres) | Yes, with the database |
| Secrets and settings (env vars, Auth settings, redirect URLs, SMTP, TOTP setting) | Vercel and the Supabase dashboard | No. Keep them in the password vault |
| The code | GitHub | Yes (git history) |

The gap that matters: **a restored database whose files are gone shows documents that cannot be opened.** Plan for the files separately.

## Targets (set these, then check the plan can meet them)

- **Recovery point (most data you can lose):** [ e.g. 24 hours with daily backups, minutes with point-in-time recovery ]
- **Recovery time (how long clients can be without the app):** [ e.g. 4 hours ]
- Supabase plan and what it includes: [ plan name ], backup retention [ days ], point-in-time recovery [ on / off, window ]
- Free projects have no managed backups and pause when idle. Move to a paid plan before real client data (roadmap: Database).

## Backups to have in place

1. **Database, managed:** Supabase daily backups (and point-in-time recovery if you buy it). Confirm in the dashboard under Database → Backups. [ done ]
2. **Database, your own copy:** a scheduled logical dump stored outside Supabase, so a Supabase account problem cannot take everything.
   `pg_dump` against the connection string from Project Settings → Database. Frequency [ e.g. weekly ], stored at [ location ],
   encrypted with [ method ], who holds the key [ names ]. [ done ]
3. **Files:** a scheduled copy of the `documents` bucket to storage you control (the Supabase CLI or the S3-compatible endpoint
   in Project Settings → Storage). Frequency [ ], location [ ], retention [ ]. Without this, deleted files are gone. [ done ]
4. **Settings snapshot:** list of environment variables (names only), Auth settings, redirect URLs and SMTP in the vault. [ done ]

Backups contain client data: encrypt them, limit who can read them, and delete old copies on your retention schedule.

## Restore drill (run into a scratch project, never over production)

Do this once before the first client, then every [ 6 months ] and after any big migration.

1. Create a scratch Supabase project named `adflo-restore-test`. Never point it at production Vercel.
2. **Database.** Either use Supabase's "restore to a new project" if your plan offers it, or restore your own dump:
   - Apply `supabase/migrations/*` in filename order to the empty project (this creates the schema, policies and functions), **or**
     restore the full dump with `psql`. Do not mix the two on one project.
   - Check the migrations list matches production.
3. **Files.** Copy the bucket backup into the scratch project's `documents` bucket, keeping the same object paths
   (`<workspace>/<document>/v<n>-<nonce>.<ext>`).
4. **Point a preview deployment at the scratch project** (its own env vars). Sign in as a test user.
5. **Check:**
   - [ ] Row counts match production for workspaces, members, documents, document_versions, audit_logs, clients.
   - [ ] A document opens and downloads, and its size matches the record.
   - [ ] Search finds text inside a document.
   - [ ] Control Center opens for the Owner (the authenticator needs re-enrolling on a new project: expected).
   - [ ] Tenant isolation still holds (rerun the checks in `SECURITY_REVIEW.md`, "Hosted tenant-isolation check").
   - [ ] Monitoring page health checks are green.
6. **Write down** how long each step took and what failed. Update this plan.
7. Delete the scratch project and any downloaded dumps you do not need.

## Real restore (production data loss)

1. Stop the damage: follow `INCIDENT_PLAN.md` first (contain, preserve evidence).
2. Decide the target time: the last good moment, from the audit log and the incident log.
3. Restore into a **new** project first, verify it with the drill checks above, then repoint Vercel (new URL, anon key, service-role key,
   Auth redirect URLs, SMTP, TOTP) and redeploy. Keep the old project paused, not deleted, until you are sure.
4. Tell affected clients what was lost and what you recovered (see the notification section of the incident plan).
5. Add a regression test or alert so the cause is caught next time.

## Restore drill log

| Date | Who | What was restored | Time taken | Result | Problems and fixes |
|------|-----|-------------------|-----------|--------|--------------------|
| [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
