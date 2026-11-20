-- The Owner can edit a published agreement version (its text and effective date) until a client accepts it. Once any
-- client has accepted a version it is locked: the acceptance is their record of what they agreed to, so a change is a
-- new version. Direct writes to the table stay refused; this function is the only way, and every edit is audit-logged.

create trigger agreement_templates_audit_update after update on public.agreement_templates for each row execute function public.staff_audit_generic('agreement_template');

create or replace function public.control_edit_agreement(p_template uuid, p_body text, p_effective date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff('owner') then raise exception 'Only the Owner edits agreements' using errcode = '42501'; end if;
  perform 1 from public.agreement_templates t where t.id = p_template for update;
  if not found then raise exception 'That agreement no longer exists.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.agreements_sent a where a.template_id = p_template and a.accepted_at is not null) then
    raise exception 'A client has accepted this version, so it is locked as their record. Publish a new version to change it.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_body, '')) not between 1 and 60000 or p_effective is null then
    raise exception 'Enter the agreement text and the date it takes effect.' using errcode = '22023';
  end if;
  update public.agreement_templates t set body = p_body, effective_date = p_effective where t.id = p_template;
end $$;

revoke all on function public.control_edit_agreement(uuid, text, date) from public, anon, authenticated;
grant execute on function public.control_edit_agreement(uuid, text, date) to authenticated;
