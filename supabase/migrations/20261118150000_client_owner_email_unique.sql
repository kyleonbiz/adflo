-- One owner email belongs to one client. The Control center checks this before saving (src/lib/control/duplicates.ts); this
-- index is the backstop for two staff saving at once. clients_name_idx already keeps names apart.
-- If old rows already share an owner email the index is skipped (with a notice) instead of failing the deploy; fix the rows
-- listed in the notice and run the create index statement by hand.
do $$
begin
  if exists (select 1 from public.clients where trim(owner_email) <> '' group by lower(trim(owner_email)) having count(*) > 1) then
    raise notice 'clients_owner_email_idx skipped: some clients share an owner email. Resolve them, then create the index.';
  else
    create unique index if not exists clients_owner_email_idx on public.clients (lower(trim(owner_email))) where trim(owner_email) <> '';
  end if;
end $$;
