-- The client history shows who did something by name, not email. The name comes from the staff list (display_name) when the
-- row is read, so renaming a staff member also renames their past entries. Staff who are not owners cannot read the staff
-- table, so the join happens here.
drop function if exists public.control_client_timeline(uuid);
create function public.control_client_timeline(p_client uuid)
returns table (at timestamptz, staff_email text, staff_name text, action text, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select l.created_at, l.staff_email, coalesce(nullif(trim(s.display_name), ''), ''), l.action, l.detail
  from public.staff_audit_log l
  left join public.staff_members s on lower(s.email) = lower(l.staff_email)
  where public.is_staff('billing') and (l.entity_id = p_client::text or l.detail ->> 'client_id' = p_client::text)
  order by l.created_at desc limit 100
$$;
revoke all on function public.control_client_timeline(uuid) from public, anon;
grant execute on function public.control_client_timeline(uuid) to authenticated;
