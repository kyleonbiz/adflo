-- Trigger functions are never meant to be called through PostgREST RPC.
revoke all on function public.dms_documents_audit(), public.dms_folders_audit(), public.dms_versions_audit()
  from public, anon, authenticated;
