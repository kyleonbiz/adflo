import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; text: string }[] = [];
const mail = { ready: true, fail: false };
vi.mock("@/lib/mail/onboarding", () => ({
  onboardingMailReady: () => mail.ready,
  sendOnboardingEmail: async (m: { to: string; subject: string; text: string }) => { if (mail.fail) throw new Error("smtp down"); sent.push(m); },
}));
vi.mock("@/lib/control/errors", () => ({ logAppError: vi.fn(async () => undefined) }));

import { emailInvitation } from "@/lib/control/invitation-email";
import { emailWelcome } from "@/lib/control/welcome-email";

function fakeSupabase(client: Record<string, unknown> | null, opts: { rpcError?: { code: string; message: string } | null; members?: number } = {}) {
  const ticks: Record<string, unknown>[] = [];
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => { rpcs.push({ fn, args }); return opts.rpcError ? { data: null, error: opts.rpcError } : { data: "2026-12-03T16:09:15Z", error: null }; },
    from: (table: string) => table === "clients"
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: client }) }) }) }
      : table === "workspace_members"
        ? { select: () => ({ eq: () => ({ limit: async () => ({ data: Array.from({ length: opts.members ?? 0 }, () => ({ workspace_id: "w1" })) }) }) }) }
        : { upsert: async (row: Record<string, unknown>) => { ticks.push(row); return { error: null }; } },
  };
  return { db: db as never, ticks, rpcs };
}
const CLIENT = { name: "Mom & Pops Pizza", owner_name: "Pat Lee", owner_email: "pat@pizza.test", workspace_id: "w1" };

beforeEach(() => { sent.length = 0; mail.ready = true; mail.fail = false; });

describe("emailInvitation", () => {
  it("emails the owner a confirm link (stored only as a hash) and ticks nothing", async () => {
    const { db, ticks, rpcs } = fakeSupabase(CLIENT);
    const r = await emailInvitation(db, "c1", "https://www.adflo.pro/api/x");
    expect(r).toEqual({ ok: true, emailedTo: "pat@pizza.test" });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("You are invited to AdFlo for Mom & Pops Pizza");
    const link = sent[0].text.match(/https:\/\/www\.adflo\.pro\/invite\/([A-Za-z0-9_-]{43})/);
    expect(link).not.toBeNull();
    expect(sent[0].text).toContain("pat@pizza.test");
    expect(sent[0].text).toContain("Dec 3, 2026");
    expect(rpcs[0].fn).toBe("control_invite_link");
    expect(rpcs[0].args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rpcs[0].args)).not.toContain(link![1]); // the secret itself never reaches the database
    expect(ticks).toEqual([]); // the welcome step is for the welcome email, not this one
  });
  it("sends nothing when the owner has no valid email", async () => {
    for (const owner_email of ["", "not an email", "a@b"]) {
      expect(await emailInvitation(fakeSupabase({ ...CLIENT, owner_email }).db, "c1", "https://x.test/")).toMatchObject({ ok: false, code: "no_owner_email" });
    }
    expect(sent).toEqual([]);
  });
  it("needs a workspace first, and says plainly when email is off", async () => {
    expect(await emailInvitation(fakeSupabase({ ...CLIENT, workspace_id: null }).db, "c1", "https://x.test/")).toMatchObject({ code: "no_workspace", status: 409 });
    mail.ready = false;
    expect(await emailInvitation(fakeSupabase(CLIENT).db, "c1", "https://x.test/")).toMatchObject({ code: "mail_off", status: 503 });
  });
  it("sends nothing when there is no open invitation to confirm", async () => {
    const { db } = fakeSupabase(CLIENT, { rpcError: { code: "P0002", message: "There is no open invitation for the owner. Invite the owner first." } });
    expect(await emailInvitation(db, "c1", "https://x.test/")).toMatchObject({ ok: false, code: "no_invite", status: 409 });
    expect(sent).toEqual([]);
  });
  it("reports a failed send without leaking the error", async () => {
    mail.fail = true;
    const r = await emailInvitation(fakeSupabase(CLIENT).db, "c1", "https://x.test/");
    expect(r).toMatchObject({ ok: false, code: "mail_failed", status: 502 });
    expect(JSON.stringify(r)).not.toContain("smtp down");
  });
  it("a client that does not exist is not found", async () => {
    expect(await emailInvitation(fakeSupabase(null).db, "c1", "https://x.test/")).toMatchObject({ ok: false, code: "not_found", status: 404 });
  });
});

describe("emailWelcome", () => {
  it("is a different email from the invitation: no sign-up link, and it ticks the welcome step", async () => {
    const { db, ticks, rpcs } = fakeSupabase(CLIENT, { members: 1 });
    const r = await emailWelcome(db, "staff-1", "c1", "https://www.adflo.pro/api/x");
    expect(r).toEqual({ ok: true, emailedTo: "pat@pizza.test" });
    expect(sent[0].subject).toBe("Welcome to AdFlo, Mom & Pops Pizza");
    expect(sent[0].text).toContain("https://www.adflo.pro/login");
    expect(sent[0].text).not.toContain("/invite/");
    expect(rpcs).toEqual([]); // no confirm link is made for a welcome
    expect(ticks).toEqual([{ client_id: "c1", step: "welcome_sent", done_by: "staff-1" }]);
  });
  it("is refused until someone has joined the workspace, and ticks nothing", async () => {
    const { db, ticks } = fakeSupabase(CLIENT, { members: 0 });
    expect(await emailWelcome(db, "s", "c1", "https://x.test/")).toMatchObject({ ok: false, code: "not_joined", status: 409 });
    expect(sent).toEqual([]);
    expect(ticks).toEqual([]);
  });
  it("reports a failed send without ticking the step or leaking the error", async () => {
    mail.fail = true;
    const { db, ticks } = fakeSupabase(CLIENT, { members: 1 });
    const r = await emailWelcome(db, "s", "c1", "https://x.test/");
    expect(r).toMatchObject({ ok: false, code: "mail_failed", status: 502 });
    expect(JSON.stringify(r)).not.toContain("smtp down");
    expect(ticks).toEqual([]);
  });
  it("says so plainly when email is not switched on", async () => {
    mail.ready = false;
    expect(await emailWelcome(fakeSupabase(CLIENT, { members: 1 }).db, "s", "c1", "https://x.test/")).toMatchObject({ code: "mail_off", status: 503 });
  });
});
