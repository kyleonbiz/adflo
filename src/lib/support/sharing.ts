import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Who a ticket is shared with: the client's AdFlo workspace, and the owner to email. Null when the client has no workspace yet. */
export interface ShareTarget { workspaceId: string; ownerEmail: string; clientName: string }

export async function shareTarget(supabase: SupabaseClient, clientId: string): Promise<ShareTarget | null> {
  const { data, error } = await supabase.from("clients").select("name, workspace_id, owner_email").eq("id", clientId).maybeSingle();
  if (error) throw error;
  if (!data?.workspace_id) return null;
  return { workspaceId: data.workspace_id as string, ownerEmail: (data.owner_email as string) ?? "", clientName: data.name as string };
}

export const NO_WORKSPACE = "That client has no AdFlo workspace yet, so there is nobody to share the ticket with.";
/** Shown on tickets AdFlo opens for a client, in place of a person's name. */
export const STAFF_REQUESTER = "AdFlo Support";
