# AdFlo — Working Notes

**Revision list (Kyle's 30 items):** the live checklist is `REVISION_CHECKLIST.md`. Branch `revision-part-1`, PR #22.
Shipped so far: icon-only sidebar, Contacts (Vendors as a tab), name greeting, home queue + day summary, license templates by business + certification/policy types + compliance score, invoice frequency label, "Choose paperwork" by business type with print/PDF/download, Reporting section dropdown (scheduled reports, materials), custom project types, vendor follow-up reminders + notes log, stuck-approval flags.
Still to do (no database needed): approval chain, document signing, onboarding packets, OCR, useful notifications, AI-agent guardrails per module, landing pages/empty states, AI-look cleanup, livelier home. Needs a database (last): shared contact/vendor profiles, real record merge, emailing reminders and scheduled reports.
To discuss first: setup for different industries, what the Projects module should include.
Note for tests: run `npx tsc --noEmit` before every push (the Vercel build type-checks tests).

## To do
- [ ] **Automation discovery** — go through every module and list what can be automated.
- [~] **AI assistant** — live at `/app/assistant` (under Home). Claude-backed via `/api/assistant` once `ANTHROPIC_API_KEY` is set (tools: profile, recommend, deploy, status); until then the built-in rules answer. Untested against the real API. Next: let it open/fill modules.
- [x] **Settings page** — renamed; tabs: Business profile, Team, Notifications, Appearance, Guided setup (`/app/setup?tab=...`).
- [ ] **Admin research** — what else can an admin do?
- [x] **Rename "Data Entry & Reporting" → "Reporting"** — already done (commit 87dacd6); verify no leftover labels.
- [~] **Requests (was Admin Support)** — renamed. Still to do: move recurring tasks into Projects so repeating work lives in one place; approvals stay in Requests.
- [x] **File reset** — now a one-time "Tidy up files" tool: out of the sidebar, linked from Documents and Guided setup.
- [x] **Day/Night view switch** — done, in Settings › Appearance (Day, Night, Match my device).
