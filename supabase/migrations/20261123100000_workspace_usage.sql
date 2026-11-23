-- Monthly usage per workspace: Claude actions, tokens, OCR reads and quick (rules-based) actions.
-- The table has RLS on and no policies, so clients reach it only through the member-checked functions below.
create table public.workspace_usage (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period date not null,
  ai_actions integer not null default 0 check (ai_actions >= 0),
  tokens bigint not null default 0 check (tokens >= 0),
  ocr_reads integer not null default 0 check (ocr_reads >= 0),
  quick_actions integer not null default 0 check (quick_actions >= 0),
  primary key (workspace_id, period)
);
alter table public.workspace_usage enable row level security;
revoke all on public.workspace_usage from public, anon, authenticated;

-- The plan name of a workspace's client record; null when there is none. Members of that workspace only.
create or replace function public.workspace_plan(p_workspace uuid)
returns text language sql stable security definer set search_path = '' as $$
  select c.plan from public.clients c
  where c.workspace_id = p_workspace
    and exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = (select auth.uid()))
$$;

-- This month's usage (UTC month). Zeros when nothing has been recorded. Members only; anyone else gets nothing.
create or replace function public.workspace_usage_now(p_workspace uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'period', to_char(date_trunc('month', now() at time zone 'utc'), 'YYYY-MM-DD'),
    'aiActions', coalesce(u.ai_actions, 0), 'tokens', coalesce(u.tokens, 0),
    'ocrReads', coalesce(u.ocr_reads, 0), 'quickActions', coalesce(u.quick_actions, 0))
  from (select 1) x
  left join public.workspace_usage u on u.workspace_id = p_workspace and u.period = date_trunc('month', now() at time zone 'utc')::date
  where exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = (select auth.uid()))
$$;

-- Adds to this month's counters (never subtracts) and returns the new totals. Members only.
create or replace function public.record_usage(p_workspace uuid, p_ai integer default 0, p_tokens bigint default 0, p_ocr integer default 0, p_quick integer default 0)
returns json language plpgsql security definer set search_path = '' as $$
declare per date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = (select auth.uid())) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if least(p_ai, p_ocr, p_quick) < 0 or p_tokens < 0 or p_ai > 100 or p_ocr > 100 or p_quick > 100 or p_tokens > 1000000 then
    raise exception 'invalid usage amount' using errcode = '22023';
  end if;
  insert into public.workspace_usage as u (workspace_id, period, ai_actions, tokens, ocr_reads, quick_actions)
  values (p_workspace, per, p_ai, p_tokens, p_ocr, p_quick)
  on conflict (workspace_id, period) do update set
    ai_actions = u.ai_actions + excluded.ai_actions, tokens = u.tokens + excluded.tokens,
    ocr_reads = u.ocr_reads + excluded.ocr_reads, quick_actions = u.quick_actions + excluded.quick_actions;
  return public.workspace_usage_now(p_workspace);
end $$;

revoke all on function public.workspace_plan(uuid), public.workspace_usage_now(uuid), public.record_usage(uuid, integer, bigint, integer, integer) from public, anon;
grant execute on function public.workspace_plan(uuid), public.workspace_usage_now(uuid), public.record_usage(uuid, integer, bigint, integer, integer) to authenticated;
