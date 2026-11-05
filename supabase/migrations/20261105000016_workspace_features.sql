-- The features a workspace's plan includes. Clients cannot read `clients` or `plans`, so this returns only the
-- feature list, and only to a member of that workspace. NULL means "everything" (no client record, a legacy plan,
-- or a plan with no list), so nobody loses access until staff move them onto a tier.
create or replace function public.workspace_features(p_workspace uuid)
returns text[]
language sql stable security definer set search_path = '' as $$
  select p.features
  from public.clients c
  join public.plans p on lower(p.name) = lower(c.plan)
  where c.workspace_id = p_workspace
    and exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = (select auth.uid()))
$$;
revoke all on function public.workspace_features(uuid) from public, anon;
grant execute on function public.workspace_features(uuid) to authenticated;
