import { describe, expect, it } from "vitest";
import { issueInviteLink } from "@/lib/control/invite";

const db = (result: { data?: unknown; error?: { code: string; message: string } | null }) => {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return { db: { rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return { data: result.data ?? null, error: result.error ?? null }; } } as never, calls };
};

describe("issueInviteLink", () => {
  it("makes a link on the given origin and stores only its hash", async () => {
    const { db: d, calls } = db({ data: "2026-12-03T00:00:00Z" });
    const r = await issueInviteLink(d, "c1", "https://www.adflo.pro");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const token = r.link.replace("https://www.adflo.pro/invite/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.expiresAt).toBe("2026-12-03T00:00:00Z");
    expect(calls[0].fn).toBe("control_invite_link");
    expect(calls[0].args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(calls[0].args)).not.toContain(token);
  });
  it("every call makes a different link", async () => {
    const a = await issueInviteLink(db({ data: "x" }).db, "c1", "https://x.test");
    const b = await issueInviteLink(db({ data: "x" }).db, "c1", "https://x.test");
    expect(a.ok && b.ok && a.link !== b.link).toBe(true);
  });
  it("says to invite the owner first when no open invitation exists", async () => {
    const r = await issueInviteLink(db({ error: { code: "P0002", message: "There is no open invitation for the owner. Invite the owner first." } }).db, "c1", "https://x.test");
    expect(r).toEqual({ ok: false, status: 409, message: "There is no open invitation for the owner. Invite the owner first." });
  });
  it("refuses a role that may not do this, and hides anything unexpected", async () => {
    expect(await issueInviteLink(db({ error: { code: "42501", message: "forbidden" } }).db, "c1", "https://x.test")).toMatchObject({ ok: false, status: 403 });
    await expect(issueInviteLink(db({ error: { code: "XX000", message: "secret detail" } }).db, "c1", "https://x.test")).rejects.toBeTruthy();
  });
});
