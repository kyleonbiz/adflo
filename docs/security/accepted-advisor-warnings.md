# Supabase advisor warnings we accept

Last reviewed: 2026-11-17 against the `adflo-test` project. Re-run both advisors (Supabase dashboard > Advisors, or the
`get_advisors` tool) after every migration and before launch. Anything new that is not listed here needs a decision.

## Security

| Warning | Count | Decision | Why |
|---|---|---|---|
| Public can execute a `SECURITY DEFINER` function | 2 | **Accepted** | `agreement_public_view` and `agreement_public_accept` are what the public agreement link calls, so signed-out visitors must reach them. Each one checks the secret token itself and returns only that one agreement. Covered by `supabase/tests/control4.sql`. |
| Signed-in users can execute a `SECURITY DEFINER` function | 35 | **Accepted** | Clients and staff call these through the app on purpose (`create_workspace`, `dms_*`, `control_*`, role helpers). Each checks the caller's role or workspace membership inside the function; there is no policy bypass for anyone else. The access tests in `supabase/tests` (`rls.sql`, `control*.sql`, `open_items.sql`) prove the checks. A new function in this list must get a test before it ships. |
| Leaked password protection disabled | 1 | **Not accepted: turn on** | Supabase Auth > Sign In / Up > password settings. Needs a paid plan. Open item in the launch roadmap. |

## Performance (all "info" level)

| Warning | Decision | Why |
|---|---|---|
| Unindexed foreign keys | **Fixed** for the growing tables in `20261117130000_foreign_key_indexes.sql`. The rest are **accepted** | The remaining ones are on small staff-only tables (agreements, support tickets, error log, clients, audit log). Revisit when any passes a few thousand rows. |
| Unused indexes (17, including the nine added in `20261117130000_foreign_key_indexes.sql`) | **Accepted** | The test project has almost no data, so the planner does not use the document search, star, tag and foreign-key indexes yet. Re-check on real data before dropping any. |
