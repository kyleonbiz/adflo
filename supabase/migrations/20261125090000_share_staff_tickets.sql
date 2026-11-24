-- Staff can share a ticket they logged with the client. Sharing links the ticket to the client's workspace (the same link a
-- client's own request has), so it shows in the client's Support list and conversation. The client's view of a ticket now
-- also says who started it, so a request AdFlo opened reads as AdFlo's and not as the client's.
create or replace function public.support_ticket(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.support_tickets;
begin
  select * into t from public.support_tickets x where x.id = p_id and x.workspace_id in (select public.support_my_workspaces());
  if not found then return null; end if;
  return jsonb_build_object(
    'id', t.id, 'ticket_no', t.ticket_no, 'subject', t.subject, 'body', t.body, 'category', t.category, 'status', t.status,
    'source', t.source, 'created_at', t.created_at, 'requester_name', t.requester_name,
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'author_kind', m.author_kind, 'author_name', m.author_name, 'body', m.body, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
                 from public.ticket_messages m where m.ticket_id = t.id));
end $$;
revoke all on function public.support_ticket(uuid) from public, anon;
grant execute on function public.support_ticket(uuid) to authenticated;
