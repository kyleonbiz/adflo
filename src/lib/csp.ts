/**
 * Content Security Policy with a per-request nonce (security review findings 19 and 23).
 *
 * Scripts may run only if they carry the nonce (Next adds it to its own scripts when the request carries this header)
 * or were loaded by a nonced script ('strict-dynamic'). An injected `<script>` or inline handler is therefore blocked
 * even if an escaping mistake ever lets markup through. Styles keep 'unsafe-inline' because React and Tailwind emit
 * inline style attributes; that cannot run code.
 *
 * CSP_MODE: "report-only" (default: the browser logs violations but blocks nothing), "enforce", or "off".
 */
export type CspMode = "enforce" | "report-only" | "off";

export function cspMode(env: Record<string, string | undefined> = process.env): CspMode {
  const m = (env.CSP_MODE ?? "").trim().toLowerCase();
  return m === "enforce" || m === "off" ? m : "report-only";
}

export function cspHeaderName(mode: CspMode): string | null {
  if (mode === "enforce") return "Content-Security-Policy";
  if (mode === "report-only") return "Content-Security-Policy-Report-Only";
  return null;
}

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function origin(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string, opts: { dev?: boolean; supabaseUrl?: string } = {}): string {
  const supa = origin(opts.supabaseUrl);
  const supaWs = supa ? supa.replace(/^http/, "ws") : null;
  const list = (...xs: (string | null | false | undefined)[]) => xs.filter(Boolean).join(" ");
  const directives = [
    "default-src 'self'",
    // 'unsafe-eval' only in development: React's dev tooling needs it.
    `script-src ${list("'self'", `'nonce-${nonce}'`, "'strict-dynamic'", opts.dev && "'unsafe-eval'")}`,
    "style-src 'self' 'unsafe-inline'",
    // Document previews load signed storage URLs; QR codes and small icons are data: URLs.
    `img-src ${list("'self'", "data:", "blob:", supa)}`,
    "font-src 'self' data:",
    `connect-src ${list("'self'", supa, supaWs, opts.dev && "ws:")}`,
    `frame-src ${list("'self'", "blob:", supa)}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    !opts.dev && "upgrade-insecure-requests",
  ];
  return directives.filter(Boolean).join("; ");
}
