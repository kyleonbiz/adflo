import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";
import { cookieOptionsFor, surfaceOfPath, type Surface } from "./surface";

// One client per surface. Moving between the app and the Control center without a full page load must not reuse the
// other surface's client, or a sign-in would be saved in the wrong session.
const clients = new Map<Surface, SupabaseClient>();

export function createBrowserSupabase(): SupabaseClient {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  const surface = surfaceOfPath(typeof window === "undefined" ? "/" : window.location.pathname);
  let client = clients.get(surface);
  if (!client) {
    client = createBrowserClient(env.url, env.anonKey, { cookieOptions: cookieOptionsFor(surface), isSingleton: false });
    clients.set(surface, client);
  }
  return client;
}
