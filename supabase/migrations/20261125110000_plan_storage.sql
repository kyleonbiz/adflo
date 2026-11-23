-- Storage follows the plan: 20 GB per workspace (the one AdFlo plan's allowance, `limits.storageGb` in src/lib/control/tiers.ts).
-- Only ever raised, so a workspace that already has more keeps it.

-- Every new workspace, however it is created (sign-up, trial, staff), starts with the plan's 20 GB.
alter table public.workspaces alter column storage_quota_bytes set default 21474836480;

-- Workspaces that exist today and are below it (the older 5 GB default) are raised to it.
update public.workspaces set storage_quota_bytes = 21474836480 where storage_quota_bytes < 21474836480;

-- A workspace linked to a client on the AdFlo plan always has at least the plan's storage, including if it was set lower by hand.
create or replace function public.clients_plan_storage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_id is not null and lower(new.plan) = 'adflo' then
    update public.workspaces w set storage_quota_bytes = 21474836480
     where w.id = new.workspace_id and w.storage_quota_bytes < 21474836480;
  end if;
  return new;
end $$;
revoke all on function public.clients_plan_storage() from public, anon, authenticated;

create trigger clients_plan_storage_ins after insert on public.clients for each row execute function public.clients_plan_storage();
create trigger clients_plan_storage_upd after update of plan, workspace_id on public.clients for each row execute function public.clients_plan_storage();
