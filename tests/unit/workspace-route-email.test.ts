import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  emailInvitation: vi.fn(),
}));

// staffRoute normally checks the staff session and two-factor; here it just hands the handler a database stub.
vi.mock("@/lib/control/api", () => ({
  fail: (status: number, code: string, message: string) => Response.json({ ok: false, error: { code, message } }, { status }),
  staffRoute: async (_req: Request, run: (ctx: { supabase: unknown; staff: { userId: string } }) => Promise<Response>) => run({ supabase: { rpc: mocks.rpc }, staff: { userId: "staff-1" } }),
}));
vi.mock("@/lib/control/invitation-email", () => ({ emailInvitation: mocks.emailInvitation }));
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => null }));
vi.mock("@/lib/dms/server/purge-workspaces", () => ({ purgeWorkspace: vi.fn() }));

import { POST } from "@/app/api/control/clients/[id]/workspace/route";

const ID = "7a000000-0000-4000-8000-0000000000c1";
const call = (action: string) => POST(new Request(`https://www.adflo.pro/api/control/clients/${ID}/workspace`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }), { params: Promise.resolve({ id: ID }) } as never);

beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: "2026-12-03T00:00:00Z", error: null });
  mocks.emailInvitation.mockReset().mockResolvedValue({ ok: true, emailedTo: "pat@acme.test" });
});

describe("workspace route emails the invitation (not the welcome)", () => {
  it("creating the workspace invites the owner and emails them", async () => {
    const res = await call("provision");
    expect(await res.json()).toMatchObject({ ok: true, emailedTo: "pat@acme.test" });
    expect(mocks.emailInvitation).toHaveBeenCalledWith(expect.anything(), ID, expect.stringContaining("/workspace"));
  });
  it("renewing the invitation emails a fresh link", async () => {
    const res = await call("invite");
    expect(await res.json()).toMatchObject({ ok: true, expiresAt: "2026-12-03T00:00:00Z", emailedTo: "pat@acme.test" });
    expect(mocks.emailInvitation).toHaveBeenCalledTimes(1);
  });
  it("a failed email keeps the invitation and says why", async () => {
    mocks.emailInvitation.mockResolvedValue({ ok: false, code: "mail_off", status: 503, message: "Email is not switched on yet." });
    const res = await call("provision");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, emailError: "Email is not switched on yet." });
  });
  it("an unexpected email error is caught and never hides the invitation or leaks detail", async () => {
    mocks.emailInvitation.mockRejectedValue(new Error("smtp secret detail"));
    const res = await call("invite");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("smtp secret detail");
    expect(body.emailError).toMatch(/Copy invitation/);
  });
  it("linking or unlinking a workspace emails nobody", async () => {
    await call("unlink");
    expect(mocks.emailInvitation).not.toHaveBeenCalled();
  });
  it("no email is attempted when the database refuses the invitation", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "They are already in the workspace." } });
    const res = await call("invite");
    expect(res.status).toBe(409);
    expect(mocks.emailInvitation).not.toHaveBeenCalled();
  });
});
