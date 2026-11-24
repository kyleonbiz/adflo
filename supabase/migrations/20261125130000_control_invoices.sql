-- AdFlo's own invoices to its clients (the Control center's Billing), saved in the database instead of one staff member's browser.
--
-- Staff only: every staff member can read them (a client's page shows what they owe); the Owner and the Billing role can create,
-- change and delete them; Support cannot. Nobody outside staff can touch the table, and the server's jobs use the service role.
-- Each invoice is one row (the same shape the invoice screen uses, kept as JSON), so two people editing different invoices never
-- overwrite each other. Every create, change and delete is written to the staff audit log.

create table public.control_invoices (
  id text primary key check (char_length(id) between 1 and 80),
  client_id uuid references public.clients (id) on delete set null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 30000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index control_invoices_client_idx on public.control_invoices (client_id);
create index control_invoices_updated_by_idx on public.control_invoices (updated_by);

alter table public.control_invoices enable row level security;
revoke all on public.control_invoices from anon, authenticated;
grant select, insert, update, delete on public.control_invoices to authenticated;
grant all on public.control_invoices to service_role;

create policy control_invoices_read on public.control_invoices for select to authenticated
  using (public.is_staff('billing'));
create policy control_invoices_insert on public.control_invoices for insert to authenticated
  with check (public.staff_role() in ('owner', 'billing'));
create policy control_invoices_update on public.control_invoices for update to authenticated
  using (public.staff_role() in ('owner', 'billing')) with check (public.staff_role() in ('owner', 'billing'));
create policy control_invoices_delete on public.control_invoices for delete to authenticated
  using (public.staff_role() in ('owner', 'billing'));

-- The time and the person are the database's to say; the log keeps what changed in words, not the whole invoice.
create or replace function public.control_invoices_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who text := coalesce((select s.email from public.staff_members s where s.user_id = (select auth.uid())), '');
begin
  if tg_op = 'DELETE' then
    insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
    values ((select auth.uid()), who, 'billing_invoice.deleted', 'billing_invoice', old.id,
            jsonb_build_object('number', old.data ->> 'number', 'client', old.data ->> 'client', 'status', old.data ->> 'status', 'client_id', old.client_id));
    return old;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if tg_op = 'INSERT' or new.data is distinct from old.data then
    insert into public.staff_audit_log (staff_user_id, staff_email, action, entity, entity_id, detail)
    values ((select auth.uid()), who,
            case when tg_op = 'INSERT' then 'billing_invoice.created'
                 when new.data ->> 'status' is distinct from old.data ->> 'status' then 'billing_invoice.status_changed'
                 else 'billing_invoice.updated' end,
            'billing_invoice', new.id,
            jsonb_build_object('number', new.data ->> 'number', 'client', new.data ->> 'client', 'status', new.data ->> 'status',
                               'amount_cents', new.data -> 'amountCents', 'client_id', new.client_id));
  end if;
  return new;
end $$;
revoke all on function public.control_invoices_stamp() from public, anon, authenticated;
create trigger control_invoices_stamp before insert or update or delete on public.control_invoices
  for each row execute function public.control_invoices_stamp();
