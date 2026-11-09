-- Landing page: demo requests. Anyone can send one through demo_request_submit(); only staff can read them.

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  company text not null check (char_length(company) between 1 and 160),
  company_size text not null check (company_size in ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  message text not null default '' check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.demo_requests enable row level security;

-- No insert policy on purpose: visitors go through the function below, which checks every field.
create policy demo_requests_read on public.demo_requests for select to authenticated using (public.is_staff('support'));

create function public.demo_request_submit(p_name text, p_email text, p_company text, p_size text, p_message text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_company, ''))) not between 1 and 160
    or p_email is null or char_length(p_email) > 254 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    or p_size not in ('1-10', '11-50', '51-200', '201-1000', '1000+')
    or char_length(coalesce(p_message, '')) > 2000 then
    return false;
  end if;
  insert into public.demo_requests (full_name, email, company, company_size, message)
  values (trim(p_name), lower(trim(p_email)), trim(p_company), p_size, trim(coalesce(p_message, '')));
  return true;
end $$;

revoke all on function public.demo_request_submit(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.demo_request_submit(text, text, text, text, text) to anon, authenticated;
