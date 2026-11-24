-- The activity trail also records what AdFlo's automations did (a reminder emailed, a recurring invoice created, a task added),
-- written by the server's own jobs under the name "AdFlo".
--
-- The stamp trigger still decides when, who and under what name for every line a signed-in person writes: a person cannot choose
-- the name. Only a write with no signed-in user (the server's service role, which no browser has) may name itself, and an empty
-- name becomes "AdFlo".

create or replace function public.workspace_activity_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uname text;
begin
  new.at := now();
  new.actor_id := (select auth.uid());
  if new.actor_id is null then
    new.data := new.data || jsonb_build_object('by', coalesce(nullif(left(new.data ->> 'by', 60), ''), 'AdFlo'));
    return new;
  end if;
  select coalesce(nullif(m.display_name, ''), nullif(m.email, ''), '') into uname
    from public.workspace_members m
    where m.workspace_id = new.workspace_id and m.user_id = new.actor_id;
  new.data := new.data || jsonb_build_object('by', coalesce(uname, ''));
  return new;
end $$;
