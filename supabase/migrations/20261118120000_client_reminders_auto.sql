-- Marks reminders the daily job sent by itself, so a client is only nagged automatically a few times.
alter table public.client_reminders add column auto boolean not null default false;
