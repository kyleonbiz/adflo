/**
 * Test-only: lets the browser tests start a service with records already in it, since the app itself
 * starts empty. A test injects `window.__E2E_SEED__ = { invoices: [...], ... }` before the page loads.
 * `NEXT_PUBLIC_E2E_SEED` is only set by the Playwright dev server; everywhere else the check is a
 * build-time constant, so this reads nothing and returns null.
 */
export function e2eSeed<T>(key: string): T[] | null {
  if (process.env.NEXT_PUBLIC_E2E_SEED !== "1") return null;
  const seeds = (globalThis as { __E2E_SEED__?: Record<string, unknown> }).__E2E_SEED__;
  const list = seeds?.[key];
  return Array.isArray(list) ? (list as T[]) : null;
}
