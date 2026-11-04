# Workflow

- **Commit and push straight to `main`.** Do not create feature branches, pull requests or merge commits unless the user explicitly asks for one in that session.
- Before pushing, `git pull --rebase origin main` (or merge if the rebase conflicts) so the push is a fast-forward, then run the checks that matter for the change (lint, unit tests, and the relevant e2e specs).
- If a push is rejected because `main` moved, fetch, integrate the new commits, re-run the checks, and push again. Never force-push `main`.
- Commit when a piece of work is finished and verified; do not leave finished work uncommitted.
