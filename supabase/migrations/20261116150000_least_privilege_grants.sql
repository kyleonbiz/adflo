-- Least privilege for signed-in users.
--
-- Supabase gives every new table in `public` a default grant of all privileges to anon, authenticated and
-- service_role. Earlier migrations revoked what they could from anon and granted back only what the app needs, but
-- the `authenticated` role kept the extra privileges on several tables. Row-level security already refused those
-- writes (there is no policy for them) and the REST API cannot TRUNCATE, so nothing was reachable, but a missing policy
-- should not be the only thing standing between a signed-in user and the audit trail. Now the grants match the policies.

-- Nobody signs in to truncate a table, add a foreign key to it or add a trigger to it.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Read-only for clients: membership, workspaces and the audit trail change only through the RPCs and triggers.
revoke insert, update, delete on public.workspaces, public.workspace_members, public.audit_logs from authenticated;

-- Versions are created and finished by dms_begin_upload / dms_complete_upload; clients may only read and delete (admins).
revoke insert, update on public.document_versions from authenticated;

-- The marker that a service has saved records: select and insert only.
revoke update, delete on public.workspace_record_sets from authenticated;
