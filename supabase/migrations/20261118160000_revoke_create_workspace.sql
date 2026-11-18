-- Workspaces are made by AdFlo in the Control center (control_provision_workspace) or come from an owner's team invitation.
-- Signed-in users can no longer create their own through the API, so nobody can bypass the client record, its seat limit and
-- its plan. The function stays (the database tests and staff tooling use it as the table owner) but is no longer callable
-- by the API roles.
revoke all on function public.create_workspace(text, text, text) from public, anon, authenticated;
