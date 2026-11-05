-- The second tier is called "Core +" (the first stays "Core"). Clients on it follow the plan to its new name.
update public.plans set name = 'core +' where lower(name) = 'ai';
update public.clients set plan = 'core +' where lower(plan) = 'ai';
