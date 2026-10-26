# AdFlo — Working Notes

## To do
- [ ] **Automation discovery** — go through every module and list what can be automated.
- [~] **AI assistant** — live at `/app/assistant` (under Home). Claude-backed via `/api/assistant` once `ANTHROPIC_API_KEY` is set (tools: profile, recommend, deploy, status); until then the built-in rules answer. Untested against the real API. Next: let it open/fill modules.
- [x] **Settings page** — renamed; tabs: Business profile, Team, Notifications, Appearance, Guided setup (`/app/setup?tab=...`).
- [ ] **Admin research** — what else can an admin do?
- [x] **Rename "Data Entry & Reporting" → "Reporting"** — already done (commit 87dacd6); verify no leftover labels.
- [~] **Requests (was Admin Support)** — renamed. Still to do: move recurring tasks into Projects so repeating work lives in one place; approvals stay in Requests.
- [x] **File reset** — now a one-time "Tidy up files" tool: out of the sidebar, linked from Documents and Guided setup.
- [x] **Day/Night view switch** — done, in Settings › Appearance (Day, Night, Match my device).
