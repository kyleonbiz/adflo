-- Support and the Owner can withdraw an agreement that was sent to a client and not accepted yet (a test, or sent by mistake).
-- Its link stops working. One a client has accepted is kept: the acceptance (who, when) is their record.
-- The deletion is written to the staff audit log by the delete trigger on agreements_sent.

create or replace function public.control_delete_sent_agreement(p_sent uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare was_accepted timestamptz;
begin
  if not public.is_staff('support') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select a.accepted_at into was_accepted from public.agreements_sent a where a.id = p_sent for update;
  if not found then raise exception 'That agreement is no longer on this client.' using errcode = 'P0002'; end if;
  if was_accepted is not null then
    raise exception 'The client has accepted this agreement, so it is kept as their record and cannot be deleted.' using errcode = '22023';
  end if;
  delete from public.agreements_sent a where a.id = p_sent;
end $$;

revoke all on function public.control_delete_sent_agreement(uuid) from public, anon, authenticated;
grant execute on function public.control_delete_sent_agreement(uuid) to authenticated;
