import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;
const valid = (v: unknown): v is string => typeof v === "string" && EMAIL.test(v.trim());
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The email addresses of a workspace's owners and admins (up to `limit`), oldest member first. Only addresses that look real. */
export async function ownerEmails(admin: SupabaseClient, workspaceId: string, limit = 3): Promise<string[]> {
  const { data } = await admin.from("workspace_members").select("email, role").eq("workspace_id", workspaceId).in("role", ["owner", "admin"]).order("created_at").limit(limit);
  return ((data ?? []) as { email: string }[]).map((m) => m.email?.trim()).filter(valid);
}

/**
 * Where replies to email sent on a business's behalf should go: the address given for this email if it is usable (an invoice's own
 * "from" address), else the business email in Settings, else the workspace's first owner or admin. Empty when there is none, in which
 * case nothing should be sent: a reply must never have nowhere to go.
 */
export async function replyAddress(admin: SupabaseClient, workspaceId: string, settings: Record<string, unknown> | undefined, preferred?: string): Promise<string> {
  if (valid(preferred)) return preferred.trim();
  const details = isObj(settings?.details) ? (settings!.details as Record<string, unknown>) : {};
  if (valid(details.email)) return (details.email as string).trim();
  return (await ownerEmails(admin, workspaceId, 3))[0] ?? "";
}
