import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { getServiceRoleKey, getSupabaseEnv } from "./env";
import { cookieOptionsFor, SURFACE_HEADER, type Surface } from "./surface";

/**
 * Supabase client bound to the signed-in user's session cookies (RLS applies). The Control center and the client app have
 * separate sessions (see surface.ts): `surface` says which one, and by default it is the one the proxy set for this request.
 */
export async function createServerSupabase(surface?: Surface): Promise<SupabaseClient> {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  const store = await cookies();
  const which: Surface = surface ?? ((await headers()).get(SURFACE_HEADER) === "control" ? "control" : "app");
  return createServerClient(env.url, env.anonKey, {
    cookieOptions: cookieOptionsFor(which),
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS: use only for the share-link route. */
export function createServiceSupabase(): SupabaseClient | null {
  const env = getSupabaseEnv();
  const key = getServiceRoleKey();
  if (!env || !key) return null;
  return createJsClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
