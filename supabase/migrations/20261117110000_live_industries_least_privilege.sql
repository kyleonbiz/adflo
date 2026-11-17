-- live_industries was created after the least-privilege sweep (20261116150000), so it kept Supabase's default grants.
-- Clients and the public never need to truncate it, add a foreign key to it or add a trigger to it.
revoke truncate, references, trigger on public.live_industries from anon, authenticated;
revoke all on public.live_industries from anon;
