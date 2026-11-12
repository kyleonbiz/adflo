-- Security review open items 14, 15 and 16.
--  14: "uploaded by" name comes from the member row, not from a caller-supplied argument.
--  15: at most 20 pending (unfinished) uploads per user per workspace.
--  16: removing a member revokes the share links they created in that workspace.
-- The p_user_name argument is kept so the app and older callers keep working; it is ignored.

create or replace function public.dms_begin_upload(
  p_workspace uuid, p_document uuid, p_new_document uuid,
  p_original_name text, p_display_name text, p_folder uuid, p_category text,
  p_mime text, p_size bigint, p_nonce text, p_ext text, p_user_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  quota bigint; used bigint; vn integer; doc public.documents; ver public.document_versions; key text;
  uname text;
begin
  if uid is null or not public.dms_has_role(p_workspace, 'editor') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_nonce !~ '^[A-Za-z0-9-]{1,40}$' or p_ext !~ '^[a-z0-9]{1,10}$' or p_size <= 0 then
    raise exception 'invalid_upload' using errcode = '22023';
  end if;

  select w.storage_quota_bytes into quota from public.workspaces w where w.id = p_workspace for update;
  select coalesce(sum(v.size_bytes), 0) into used from public.document_versions v where v.workspace_id = p_workspace;
  if used + p_size > quota then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;
  if (select count(*) from public.document_versions v
        where v.workspace_id = p_workspace and v.created_by = uid and v.status = 'pending') >= 20 then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;

  select coalesce(nullif(m.display_name, ''), m.email, '') into uname
    from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = uid;
  uname := coalesce(uname, '');

  perform set_config('dms.rpc', '1', true);
  if p_document is not null then
    select * into doc from public.documents d
      where d.id = p_document and d.workspace_id = p_workspace and d.status = 'ready' and d.deleted_at is null
      for update;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    if exists (select 1 from public.document_versions v where v.document_id = doc.id and v.status = 'pending') then
      raise exception 'conflict' using errcode = '40001';
    end if;
    select max(v.version_number) + 1 into vn from public.document_versions v where v.document_id = doc.id;
  else
    insert into public.documents (id, workspace_id, folder_id, original_name, display_name, mime_type,
      size_bytes, category, uploaded_by, uploaded_by_name, status, current_version)
    values (p_new_document, p_workspace, p_folder, p_original_name, p_display_name, p_mime,
      p_size, p_category, uid, uname, 'pending', 0)
    returning * into doc;
    vn := 1;
  end if;

  key := p_workspace::text || '/' || doc.id::text || '/v' || vn::text || '-' || p_nonce || '.' || p_ext;
  insert into public.document_versions (workspace_id, document_id, version_number, storage_key, mime_type,
    size_bytes, status, created_by, created_by_name)
  values (p_workspace, doc.id, vn, key, p_mime, p_size, 'pending', uid, uname)
  returning * into ver;
  return jsonb_build_object('document', to_jsonb(doc) - 'search_vector' - 'content_text', 'version', to_jsonb(ver));
end $$;

create or replace function public.dms_remove_member(p_workspace uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor text := public.dms_role(p_workspace); cur public.workspace_members; revoked integer;
begin
  if (select auth.uid()) is null or actor is null or public.dms_rank(actor) < 2 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'forbidden' using errcode = '42501'; -- cannot remove yourself
  end if;
  perform 1 from public.workspace_members m where m.workspace_id = p_workspace and m.role = 'owner' for update;
  select * into cur from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = p_user for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if actor <> 'owner' and public.dms_rank(cur.role) >= 2 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if cur.role = 'owner'
     and (select count(*) from public.workspace_members m where m.workspace_id = p_workspace and m.role = 'owner') <= 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  update public.document_share_links set revoked_at = now()
    where workspace_id = p_workspace and created_by = p_user and revoked_at is null and expires_at > now();
  get diagnostics revoked = row_count;
  delete from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  perform public.dms_audit_write(p_workspace, 'member.removed', 'workspace', p_user,
    jsonb_build_object('email', cur.email, 'role', cur.role, 'linksRevoked', revoked));
end $$;
