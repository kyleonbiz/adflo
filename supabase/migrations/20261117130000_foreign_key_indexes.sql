-- Covering indexes for foreign keys on the tables that grow with every client (flagged by the Supabase performance advisor).
-- Without them, deleting a document, folder, tag or user scans the whole child table to find the rows it cascades to.
-- Not added: foreign keys on small staff-only tables (agreements, support, app_errors, staff_audit_log, clients, live_industries,
-- workspaces, workspace_invites, client_checklist). Those stay in the advisor's info list until they are big enough to matter.

-- Delete or move a document or folder: find its versions, share links, tag links and documents.
create index if not exists document_versions_doc_ws_idx on public.document_versions (document_id, workspace_id);
create index if not exists document_share_links_doc_ws_idx on public.document_share_links (document_id, workspace_id);
create index if not exists document_tag_assignments_doc_ws_idx on public.document_tag_assignments (document_id, workspace_id);
create index if not exists document_tag_assignments_tag_ws_idx on public.document_tag_assignments (tag_id, workspace_id);
create index if not exists documents_folder_ws_idx on public.documents (folder_id, workspace_id) where folder_id is not null;

-- Removing a user sets these to null; the partial indexes skip the rows that are already null.
create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by) where uploaded_by is not null;
create index if not exists document_versions_created_by_idx on public.document_versions (created_by) where created_by is not null;
create index if not exists workspace_records_updated_by_idx on public.workspace_records (updated_by) where updated_by is not null;
create index if not exists workspace_activity_actor_idx on public.workspace_activity (actor_id) where actor_id is not null;
