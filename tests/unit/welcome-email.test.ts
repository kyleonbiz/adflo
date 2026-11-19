import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; text: string }[] = [];
const mail = { ready: true, fail: false };
vi.mock("@/lib/mail/onboarding", () => ({
  onboardingMailReady: () => mail.ready,
  sendOnboardingEmail: async (m: { to: string; subject: string; text: string }) => { if (mail.fail) throw new Error("smtp down"); sent.push(m); },
}));
vi.mock("@/lib/control/errors", () => ({ logAppError: vi.fn(async () => undefined) }));

import { emailWelcome } from "@/lib/control/welcome-email";

function fakeSupabase(client: Record<string, unknown> | null, rpcError: { code: string; message: string } | null = null) {
  const ticks: Record<string, unknown>[] = [];
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => { rpcs.push({ fn, args }); return rpcError ? { data: null, error: rpcError } : { data: "2026-12-03T16:09:15Z", error: null }; },
    from: (table: string) => table === "clients"
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: client }) }) }) }
      : { upsert: async (row: Record<string, unknown>) => { ticks.push(row); return { error: null }; } },
  };
  return { db: db as never, ticks, rpcs };
}
const CLIENT = { name: "Mom & Pops Pizza", owner_name: "Pat Lee", owner_email: "pat@pizza.test", workspace_id: "w1" };

beforeEach(() => { sent.length = 0; mail.ready = true; mail.fail = false; });

describe("emailWelcome", () => {
  it("emails the owner a confirm link (stored only as a hash) and ticks the welcome step", async () => {
    const { db, ticks, rpcs } = fakeSupabase(CLIENT);
    const r = await emailWelcome(db, "staff-1", "c1", "https://www.adflo.pro/api/x");
    expect(r).toEqual({ ok: true, emailedTo: "pat@pizza.test" });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("pat@pizza.test");
    const link = sent[0].text.match(/https:\/\/www\.adflo\.pro\/invite\/([A-Za-z0-9_-]{43})/);
    expect(link).not.toBeNull();
    expect(sent[0].text).toContain("pat@pizza.test");
    expect(sent[0].text).toContain("Dec 3, 2026");
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0].fn).toBe("control_invite_link");
    expect(rpcs[0].args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rpcs[0].args)).not.toContain(link![1]); // the secret itself never reaches the database
    expect(ticks).toEqual([{ client_id: "c1", step: "welcome_sent", done_by: "staff-1" }]);
  });
  it("sends nothing and ticks nothing when the owner has no valid email", async () => {
    for (const owner_email of ["", "not an email", "a@b"]) {
      const { db, ticks } = fakeSupabase({ ...CLIENT, owner_email });
      const r = await emailWelcome(db, "s", "c1", "https://x.test/");
      expect(r).toMatchObject({ ok: false, code: "no_owner_email" });
      expect(ticks).toEqual([]);
    }
    expect(sent).toEqual([]);
  });
  it("needs a workspace first", async () => {
    const { db } = fakeSupabase({ ...CLIENT, workspace_id: null });
    expect(await emailWelcome(db, "s", "c1", "https://x.test/")).toMatchObject({ ok: false, code: "no_workspace", status: 409 });
  });
  it("says so plainly when email is not switched on, and does not tick the step", async () => {
    mail.ready = false;
    const { db, ticks } = fakeSupabase(CLIENT);
    const r = await emailWelcome(db, "s", "c1", "https://x.test/");
    expect(r).toMatchObject({ ok: false, code: "mail_off", status: 503 });
    expect(ticks).toEqual([]);
  });
  it("reports a failed send without ticking the step or leaking the error", async () => {
    mail.fail = true;
    const { db, ticks } = fakeSupabase(CLIENT);
    const r = await emailWelcome(db, "s", "c1", "https://x.test/");
    expect(r).toMatchObject({ ok: false, code: "mail_failed", status: 502 });
    expect(JSON.stringify(r)).not.toContain("smtp down");
    expect(ticks).toEqual([]);
  });
  it("sends nothing when there is no open invitation to confirm", async () => {
    const { db, ticks } = fakeSupabase(CLIENT, { code: "P0002", message: "There is no open invitation for the owner. Invite the owner first." });
    const r = await emailWelcome(db, "s", "c1", "https://x.test/");
    expect(r).toMatchObject({ ok: false, code: "no_invite", status: 409 });
    expect(sent).toEqual([]);
    expect(ticks).toEqual([]);
  });
  it("a client that does not exist is not found", async () => {
    const { db } = fakeSupabase(null);
    expect(await emailWelcome(db, "s", "c1", "https://x.test/")).toMatchObject({ ok: false, code: "not_found", status: 404 });
  });
});
