# AdFlo — Working Notes

## To do
- [ ] **Automation discovery** — go through every module and list what can be automated.
- [~] **AI assistant** — live at `/app/assistant` (under Home). Claude-backed via `/api/assistant` once `ANTHROPIC_API_KEY` is set (tools: profile, recommend, deploy, status); until then the built-in rules answer. Untested against the real API. Next: let it open/fill modules.
- [x] **Settings page** — renamed; tabs: Business profile, Team, Notifications, Appearance, Guided setup (`/app/setup?tab=...`).
- [ ] **Admin research** — what else can an admin do?
- [x] **Rename "Data Entry & Reporting" → "Reporting"** — already done (commit 87dacd6); verify no leftover labels.
- [ ] **Admin Support (module 09)** — is it needed? What does it mean?
- [ ] **Business File Reset (module 10)** — discuss whether it's needed at all.
- [x] **Day/Night view switch** — done, in Settings › Appearance (Day, Night, Match my device).
