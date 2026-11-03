# AdFlo — Working Notes

**Revision list (Kyle's 30 items):** the live checklist is `REVISION_CHECKLIST.md`. Branch `revision-part-1`, PR #22.
Done without a database (everything keeps its records in the browser, like the rest of the app): icon sidebar, Contacts with Vendors tab, name greeting, home queue and where-to-begin, empty states, sentence-case labels, license templates/certifications/compliance/calendar/fees, invoice frequency label, Choose paperwork + print/PDF, signatures, onboarding packets, approval chains (Settings > Approvals), Reporting dropdown (scheduled reports, materials), custom project types, vendor follow-ups/notes/terms, stuck-approval flags, "Remind me", OCR for license and vendor-document photos, useful notifications, Contacts<->Forms bridge, assistant drafts with guardrails, motion.
Waiting on a database or outside service (last): shared contact/vendor profiles, real vendor/contact record merge, emailing reminders and scheduled reports, naming an owner for stuck work, OCR of scanned PDFs and of the document index.
To discuss first: setup for different industries, what the Projects module should include.
Working notes for tests: run `npm run typecheck` before every push (the Vercel build type-checks tests). Run Playwright with `--output=/tmp/...` (traces written inside the project make the dev server reload pages in a loop and the first tests fail), and never leave a stray `next dev` running (a leaked one is reused and misbehaves).

## Design choices to review (change any of these)

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

## To do
- [ ] **Automation discovery** — go through every module and list what can be automated.
- [~] **AI assistant** — live at `/app/assistant` (under Home). Claude-backed via `/api/assistant` once `ANTHROPIC_API_KEY` is set (tools: profile, recommend, deploy, status); until then the built-in rules answer. Untested against the real API. Next: let it open/fill modules.
- [x] **Settings page** — renamed; tabs: Business profile, Team, Notifications, Appearance, Guided setup (`/app/setup?tab=...`).
- [ ] **Admin research** — what else can an admin do?
- [x] **Rename "Data Entry & Reporting" → "Reporting"** — already done (commit 87dacd6); verify no leftover labels.
- [~] **Requests (was Admin Support)** — renamed. Still to do: move recurring tasks into Projects so repeating work lives in one place; approvals stay in Requests.
- [x] **File reset** — now a one-time "Tidy up files" tool: out of the sidebar, linked from Documents and Guided setup.
- [x] **Day/Night view switch** — done, in Settings › Appearance (Day, Night, Match my device).
