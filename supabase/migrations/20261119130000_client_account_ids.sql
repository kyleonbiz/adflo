-- When a client is deleted, the sign-in accounts that belonged to it go too: its workspace's members, and whoever signed up with
-- the owner's email. This lists them (Owner only, second factor required) before the workspace is erased. Staff accounts are never
-- listed, and `other_workspaces` counts memberships elsewhere so a person who also belongs to another client's workspace is kept.
create or replace function public.control_client_account_ids(p_client uuid)
returns table (user_id uuid, email text, other_workspaces bigint)
language plpgsql stable security definer set search_path = '' as $$
declare c public.clients;
begin
  if not public.is_staff('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.clients where id = p_client;
  if not found then raise exception 'That client no longer exists.' using errcode = 'P0002'; end if;
  return query
    select u.id, coalesce(u.email, ''),
           (select count(*) from public.workspace_members m2 where m2.user_id = u.id and m2.workspace_id is distinct from c.workspace_id)
    from auth.users u
    where not exists (select 1 from public.staff_members s where s.user_id = u.id)
      and (
        u.id in (select m.user_id from public.workspace_members m where m.workspace_id = c.workspace_id)
        or (btrim(c.owner_email) <> '' and lower(u.email) = lower(btrim(c.owner_email)))
      );
end $$;
revoke all on function public.control_client_account_ids(uuid) from public, anon;
grant execute on function public.control_client_account_ids(uuid) to authenticated;
