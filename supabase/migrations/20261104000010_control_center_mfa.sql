-- Control Center: staff data is only reachable with a second factor.
-- A password-only session (aal1) gets nothing from the staff tables except the person's own staff row,
-- which the app reads to decide whether to ask them to set up or enter their code.
create or replace function public.staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select s.role from public.staff_members s
  where s.user_id = (select auth.uid()) and s.active
    and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;
