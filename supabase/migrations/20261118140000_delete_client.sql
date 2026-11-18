-- The Owner can delete a client record (a test, or one made by mistake). Support and billing cannot.
-- It removes the record with its onboarding steps, sent agreements and reminder log; support tickets and error-log rows
-- are kept but no longer point at a client. The client's AdFlo workspace and its data are never touched, so a connected
-- workspace must be disconnected first. A client who accepted an agreement is kept as the record of that acceptance:
-- cancel them instead. The deletion is written to the staff audit log by the existing delete trigger on clients.

create or replace function public.control_delete_client(p_client uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ws uuid; accepted integer;
begin
  if not public.is_staff('owner') then raise exception 'Only the Owner deletes clients' using errcode = '42501'; end if;
  select c.workspace_id into ws from public.clients c where c.id = p_client for update;
  if not found then raise exception 'That client no longer exists.' using errcode = 'P0002'; end if;
  if ws is not null then
    raise exception 'Disconnect this client''s workspace first (AdFlo account card), so nobody is left on an account with no client record.' using errcode = '22023';
  end if;
  select count(*) into accepted from public.agreements_sent a where a.client_id = p_client and a.accepted_at is not null;
  if accepted > 0 then
    raise exception 'This client has accepted an agreement, so it is kept as their record. Cancel the client instead.' using errcode = '22023';
  end if;
  delete from public.clients c where c.id = p_client;
end $$;

revoke all on function public.control_delete_client(uuid) from public, anon, authenticated;
grant execute on function public.control_delete_client(uuid) to authenticated;
