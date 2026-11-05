/**
 * A fake agreement for end-to-end tests, so the client page can be exercised without a database.
 * It exists only when there is no database, the build is not production and the Playwright dev server's
 * `NEXT_PUBLIC_E2E_SEED` flag is set. Anywhere else every function here returns nothing / false.
 * State lives in server memory and is forgotten when the dev server restarts.
 */
import { getSupabaseEnv } from "@/lib/supabase/env";

export const FAKE_AGREEMENT_TOKEN = "FAKE".repeat(10) + "FAK"; // 43 characters, like a real link

const enabled = () => !getSupabaseEnv() && process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E_SEED === "1";
const state = globalThis as { __fakeAgreementAccepted?: { name: string; at: string } | null };

export const isFakeAgreement = (token: unknown) => enabled() && token === FAKE_AGREEMENT_TOKEN;

export function fakeAgreementView() {
  const a = state.__fakeAgreementAccepted ?? null;
  return {
    title: "Terms of Service", version: 1, client_name: "Sample: Acme Roofing", expired: false,
    accepted_at: a?.at ?? null, accepted_name: a?.name ?? null,
    body: "# Terms of Service\nThese sample terms are for testing.\n\n## What you agree to\n- Pay invoices when they are due\n- Keep your account details up to date\n\n## Next steps\n1. Read the terms\n2. Tick both boxes and accept",
  };
}

/** Same rule as the database: accept once. */
export function fakeAgreementAccept(name: string): boolean {
  if (state.__fakeAgreementAccepted) return false;
  state.__fakeAgreementAccepted = { name, at: new Date().toISOString() };
  return true;
}

/** Lets a test start over. */
export function fakeAgreementReset() { state.__fakeAgreementAccepted = null; }
