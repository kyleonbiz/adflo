-- The Owner can delete a client who accepted an agreement, after ticking an explicit acknowledgement. Deleting the client deletes
-- the signed agreement records with it, so before anything is removed each acceptance (title, version, who, when) is copied
-- into the staff audit log, which is kept. Without the acknowledgement the request is refused with the hint `needs_ack`.
drop function if exists public.control_check_client_delete(uuid, text);
create function public.control_check_client_delete(p_client uuid, p_confirm text, p_ack boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.clients; signed jsonb;
begin
  if not public.is_staff('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.clients where id = p_client for update;
  if not found then raise exception 'That client no longer exists.' using errcode = 'P0002'; end if;
  if lower(btrim(coalesce(p_confirm, ''))) <> lower(btrim(c.name)) then
    raise exception 'The name you typed does not match this client.' using errcode = '22023';
  end if;
  if c.status = 'active' then
    raise exception 'Cancel the client first. An active client cannot be deleted.' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('title', t.title, 'version', t.version, 'accepted_by', a.accepted_name,
           'accepted_email', a.accepted_email, 'accepted_at', a.accepted_at) order by a.accepted_at), '[]'::jsonb)
    into signed
  from public.agreements_sent a join public.agreement_templates t on t.id = a.template_id
  where a.client_id = p_client and a.accepted_at is not null;
  if jsonb_array_length(signed) > 0 and not coalesce(p_ack, false) then
    raise exception 'This client has signed agreements. Deleting the client deletes those records too (a copy is kept in the audit log). Tick the box to confirm.'
      using errcode = '22023', hint = 'needs_ack';
  end if;
  insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
  values ((select auth.uid()), public.control_staff_email(), 'client.delete_requested', 'client', p_client::text,
          jsonb_build_object('client_id', p_client, 'name', c.name, 'workspace_id', c.workspace_id, 'signed_agreements', signed));
  return c.workspace_id;
end $$;
revoke all on function public.control_check_client_delete(uuid, text, boolean) from public, anon;
grant execute on function public.control_check_client_delete(uuid, text, boolean) to authenticated;

-- The delete itself no longer refuses signed agreements: control_check_client_delete is the gate (it has already logged them).
drop function if exists public.control_delete_client(uuid);
create function public.control_delete_client(p_client uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if not public.is_staff('owner') then raise exception 'Only the Owner deletes clients' using errcode = '42501'; end if;
  select c.workspace_id into ws from public.clients c where c.id = p_client for update;
  if not found then raise exception 'That client no longer exists.' using errcode = 'P0002'; end if;
  if ws is not null then
    raise exception 'Delete or disconnect this client''s workspace first, so nobody is left on an account with no client record.' using errcode = '22023';
  end if;
  delete from public.clients c where c.id = p_client;
end $$;
revoke all on function public.control_delete_client(uuid) from public, anon, authenticated;
grant execute on function public.control_delete_client(uuid) to authenticated;
