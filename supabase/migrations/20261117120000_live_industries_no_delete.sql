-- live_industries is switched on and off, never deleted from: the original migration granted select, insert and update only,
-- but the table also kept Supabase's default DELETE grant. No policy allowed deletes, so this only removes the unused grant.
revoke delete on public.live_industries from authenticated;
