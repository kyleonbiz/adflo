import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashToken, newToken } from "./token";

export type InviteLinkResult = { ok: true; link: string; expiresAt: string } | { ok: false; status: number; message: string };

/**
 * Makes a fresh confirm link for the client's open owner invitation. Only its hash is stored, so the link exists only in
 * what is returned here; a new link replaces the earlier one. The owner opens it, confirms, and only then can sign up.
 */
export async function issueInviteLink(supabase: SupabaseClient, clientId: string, origin: string): Promise<InviteLinkResult> {
  const token = newToken();
  const { data, error } = await supabase.rpc("control_invite_link", { p_client: clientId, p_token_hash: hashToken(token) });
  if (error) {
    if (error.code === "P0002") return { ok: false, status: 409, message: error.message || "Invite the owner first." };
    if (error.code === "42501") return { ok: false, status: 403, message: "Your role cannot do this, or you have not entered your two-factor code." };
    throw error;
  }
  return { ok: true, link: `${origin}/invite/${token}`, expiresAt: String(data) };
}
