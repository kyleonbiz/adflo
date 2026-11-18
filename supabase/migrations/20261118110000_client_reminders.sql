-- A log of the reminder emails staff send to a client's owner from the onboarding tracker, so the tracker can show
-- "last reminded" and the app can refuse a second reminder the same day. Staff read it; only the function below writes it.

create table public.client_reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('signup', 'agreement')),
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now()
);
create index client_reminders_client_idx on public.client_reminders (client_id, sent_at desc);
create index client_reminders_sent_by_idx on public.client_reminders (sent_by);

alter table public.client_reminders enable row level security;
revoke all on public.client_reminders from anon, authenticated;
grant select on public.client_reminders to authenticated;
create policy reminders_read on public.client_reminders for select to authenticated using (public.is_staff('billing'));

create trigger client_reminders_audit after insert on public.client_reminders for each row execute function public.staff_audit_generic('client_reminder');

create or replace function public.control_log_reminder(p_client uuid, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff('support') then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.client_reminders (client_id, kind, sent_by) values (p_client, p_kind, (select auth.uid()));
end $$;

revoke all on function public.control_log_reminder(uuid, text) from public, anon, authenticated;
grant execute on function public.control_log_reminder(uuid, text) to authenticated;
