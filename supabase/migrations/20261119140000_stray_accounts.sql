-- Stray accounts: a sign-in that belongs to nobody. Sign-up is already limited to invited emails (accounts_must_match), but an
-- account can still be left behind later: a member is removed from a workspace, a workspace is deleted while its people's
-- sign-ins are kept, or an invitation runs out before the person first signs in. For the nightly job (service role only): accounts
-- that are in no workspace, are not staff, are not the owner of a trial or active client, have had no invitation for the grace
-- period, and are older than the grace period.
create or replace function public.dms_stray_accounts(p_grace interval default interval '7 days')
returns table (id uuid, email text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, coalesce(u.email, ''), u.created_at
  from auth.users u
  where u.created_at <= now() - p_grace
    and not exists (select 1 from public.workspace_members m where m.user_id = u.id)
    and not exists (select 1 from public.staff_members s where s.user_id = u.id)
    and not exists (select 1 from public.workspace_invites i where i.email = lower(u.email) and i.expires_at > now() - p_grace)
    and not exists (select 1 from public.clients c where lower(btrim(c.owner_email)) = lower(u.email) and c.status in ('trial', 'active'))
  order by u.created_at
  limit 20
$$;
revoke all on function public.dms_stray_accounts(interval) from public, anon, authenticated;
grant execute on function public.dms_stray_accounts(interval) to service_role;
