import { describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName, cspMode, newNonce } from "@/lib/csp";

describe("content security policy", () => {
  it("allows scripts only with the request nonce and never 'unsafe-inline' or eval in production", () => {
    const csp = buildCsp("abc123", { supabaseUrl: "https://proj.supabase.co" });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("allows only the project's own Supabase origin for network, images and frames", () => {
    const csp = buildCsp("n", { supabaseUrl: "https://proj.supabase.co/rest/v1" });
    expect(csp).toContain("connect-src 'self' https://proj.supabase.co wss://proj.supabase.co");
    expect(csp).toContain("img-src 'self' data: blob: https://proj.supabase.co");
    expect(csp).toContain("frame-src 'self' blob: https://proj.supabase.co");
    expect(buildCsp("n", {})).not.toContain("supabase");
  });
  it("adds eval and websockets only in development", () => {
    const dev = buildCsp("n", { dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
  it("allows Cloudflare Turnstile only when the human check is switched on", () => {
    expect(buildCsp("n", {})).not.toContain("cloudflare");
    const on = buildCsp("n", { turnstile: true });
    expect(on).toContain("frame-src 'self' blob: https://challenges.cloudflare.com");
    expect(on).toContain("connect-src 'self' https://challenges.cloudflare.com");
    expect(on).toContain("'strict-dynamic' https://challenges.cloudflare.com");
  });
  it("generates a different unguessable nonce each time", () => {
    const a = newNonce(), b = newNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
  it("defaults to report-only and honours CSP_MODE", () => {
    expect(cspMode({})).toBe("report-only");
    expect(cspMode({ CSP_MODE: "enforce" })).toBe("enforce");
    expect(cspMode({ CSP_MODE: "OFF" })).toBe("off");
    expect(cspMode({ CSP_MODE: "nonsense" })).toBe("report-only");
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName("off")).toBeNull();
  });
});
