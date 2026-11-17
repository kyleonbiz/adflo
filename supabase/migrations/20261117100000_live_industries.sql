-- Which industries are open to new sign-ups. The Owner switches them in Control center > Industries.
-- No rows means "contractors only", which the app also assumes if this table cannot be read.
create table public.live_industries (
  industry text primary key check (char_length(industry) between 1 and 60),
  live boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.live_industries (industry, live) values ('Construction & trades', true);

alter table public.live_industries enable row level security;
grant select, insert, update on public.live_industries to authenticated;

-- Every signed-in user needs the list (the setup picker); only the Owner changes it.
create policy live_industries_read on public.live_industries for select to authenticated using (true);
create policy live_industries_insert on public.live_industries for insert to authenticated with check (public.is_staff('owner'));
create policy live_industries_update on public.live_industries for update to authenticated using (public.is_staff('owner')) with check (public.is_staff('owner'));
