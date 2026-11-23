-- This month's usage for every client's workspace, for the Control center. Staff with the second factor only,
-- and only these four counters (never what anyone typed). Zeros when a workspace has used nothing yet.
create or replace function public.control_usage_month()
returns table (client_id uuid, ai_actions integer, tokens bigint, ocr_reads integer, quick_actions integer)
language sql stable security definer set search_path = '' as $$
  select c.id, coalesce(u.ai_actions, 0), coalesce(u.tokens, 0), coalesce(u.ocr_reads, 0), coalesce(u.quick_actions, 0)
  from public.clients c
  left join public.workspace_usage u
    on u.workspace_id = c.workspace_id and u.period = date_trunc('month', now() at time zone 'utc')::date
  where public.is_staff('billing')
$$;
revoke all on function public.control_usage_month() from public, anon;
grant execute on function public.control_usage_month() to authenticated;
