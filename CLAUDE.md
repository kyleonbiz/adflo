# Workflow

- **Commit and push straight to `main`.** Do not create feature branches, pull requests or merge commits unless the user explicitly asks for one in that session.
- Before pushing, `git pull --rebase origin main` (or merge if the rebase conflicts) so the push is a fast-forward, then run the checks that matter for the change (lint, unit tests, and the relevant e2e specs).
- If a push is rejected because `main` moved, fetch, integrate the new commits, re-run the checks, and push again. Never force-push `main`.
- Commit when a piece of work is finished and verified; do not leave finished work uncommitted.

# Product positioning

Keep this positioning in features, interface copy, docs and marketing.

- **AdFlo is an administrative management platform** for contractors and property managers, with compliance management and individual equipment and asset tracking (tools, vehicles, appliances, HVAC units, keys) built into it. Managed services will be offered later.
- **Audience:** contractors are the current target and the go-to-market focus. Property managers are the secondary expansion market. Other industries are long-term.
- **Scope:** it simplifies and centralizes the administrative side of running a business: records and documentation, administrative responsibilities and workflows, compliance requirements and deadlines, and equipment and assets. It lowers the administrative burden on owners and their teams.
- **Where it fits:** AdFlo is the administrative layer that sits alongside accounting, payroll, and construction or property management software. It handles the paperwork and administration those systems do not specialize in, and does not replace them. This is the product boundary: say it plainly in marketing and interface copy.
- **What it is not:** not exclusively a compliance platform, an inventory system, a CRM, an accounting platform or a project management tool. Do not narrow it into any of those. Every feature should make business administration easier, more organized and more manageable.
- **Wording:** use "administrative management platform". Do not use "Business Administrative Services".
- **Industries:** all industries stay built; only the ones switched on in Control center > Industries are offered to new sign-ups (contractors for now).
