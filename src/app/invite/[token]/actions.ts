"use server";

import { redirect } from "next/navigation";
import { hashToken } from "@/lib/control/token";
import { isAgreementToken } from "@/lib/control/validation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** Confirms the invitation behind the link, then sends the owner to sign up with the invited email filled in. */
export async function confirmInvite(token: string) {
  if (!isAgreementToken(token) || !getSupabaseEnv()) redirect(`/invite/${encodeURIComponent(token)}`);
  const { data } = await (await createServerSupabase()).rpc("invite_public_confirm", { p_token_hash: hashToken(token) });
  if (typeof data !== "string" || !data) redirect(`/invite/${token}`); // unknown, expired or already used: the page says which
  redirect(`/signup?email=${encodeURIComponent(data)}`);
}
