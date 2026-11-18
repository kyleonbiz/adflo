-- The Owner can delete a published agreement version that no client has accepted (for example a sample or a mistake).
-- A version a client has accepted is kept: the acceptance (who, when) is their record. Links that were sent but never
-- accepted go with it. Every deletion is written to the staff audit log by the same trigger that records publishing.

create trigger agreement_templates_audit_delete after delete on public.agreement_templates for each row execute function public.staff_audit_generic('agreement_template');
create trigger agreements_sent_audit_delete after delete on public.agreements_sent for each row execute function public.staff_audit_generic('agreement');

-- Returns how many unaccepted links were removed with it.
create or replace function public.control_delete_agreement(p_template uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer; accepted integer;
begin
  if not public.is_staff('owner') then raise exception 'Only the Owner deletes agreements' using errcode = '42501'; end if;
  perform 1 from public.agreement_templates t where t.id = p_template for update;
  if not found then raise exception 'That agreement no longer exists.' using errcode = 'P0002'; end if;
  select count(*) into accepted from public.agreements_sent a where a.template_id = p_template and a.accepted_at is not null;
  if accepted > 0 then
    raise exception 'A client has accepted this agreement, so it is kept as their record and cannot be deleted.' using errcode = '22023';
  end if;
  delete from public.agreements_sent a where a.template_id = p_template;
  get diagnostics n = row_count;
  delete from public.agreement_templates t where t.id = p_template;
  return n;
end $$;

revoke all on function public.control_delete_agreement(uuid) from public, anon, authenticated;
grant execute on function public.control_delete_agreement(uuid) to authenticated;
