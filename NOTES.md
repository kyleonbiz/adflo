# AdFlo — Working Notes

**Revision list (Kyle's 30 items):** the live checklist is `REVISION_CHECKLIST.md`. Branch `revision-part-1`, PR #22.
Done without a database (everything keeps its records in the browser, like the rest of the app): icon sidebar, Contacts with Vendors tab, name greeting, home queue and where-to-begin, empty states, sentence-case labels, license templates/certifications/compliance/calendar/fees, invoice frequency label, Choose paperwork + print/PDF, signatures, onboarding packets, approval chains (Settings > Approvals), Reporting dropdown (scheduled reports, materials), custom project types, vendor follow-ups/notes/terms, stuck-approval flags, "Remind me", OCR for license and vendor-document photos, useful notifications, Contacts<->Forms bridge, assistant drafts with guardrails, motion.
Waiting on a database or outside service (last): shared contact/vendor profiles, real vendor/contact record merge, emailing reminders and scheduled reports, naming an owner for stuck work, OCR of scanned PDFs and of the document index.
To discuss first: setup for different industries, what the Projects module should include.
Working notes for tests: run `npm run typecheck` before every push (the Vercel build type-checks tests). Run Playwright with `--output=/tmp/...` (traces written inside the project make the dev server reload pages in a loop and the first tests fail), and never leave a stray `next dev` running (a leaked one is reused and misbehaves).

## To do
- [ ] **Automation discovery** — go through every module and list what can be automated.
- [~] **AI assistant** — live at `/app/assistant` (under Home). Claude-backed via `/api/assistant` once `ANTHROPIC_API_KEY` is set (tools: profile, recommend, deploy, status); until then the built-in rules answer. Untested against the real API. Next: let it open/fill modules.
- [x] **Settings page** — renamed; tabs: Business profile, Team, Notifications, Appearance, Guided setup (`/app/setup?tab=...`).
- [ ] **Admin research** — what else can an admin do?
- [x] **Rename "Data Entry & Reporting" → "Reporting"** — already done (commit 87dacd6); verify no leftover labels.
- [~] **Requests (was Admin Support)** — renamed. Still to do: move recurring tasks into Projects so repeating work lives in one place; approvals stay in Requests.
- [x] **File reset** — now a one-time "Tidy up files" tool: out of the sidebar, linked from Documents and Guided setup.
- [x] **Day/Night view switch** — done, in Settings › Appearance (Day, Night, Match my device).
