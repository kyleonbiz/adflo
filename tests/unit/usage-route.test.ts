import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ mine: null as unknown, recorded: [] as unknown[] }));
vi.mock("@/lib/control/usage-server", () => ({ myUsage: async () => m.mine, recordUsage: async (a: unknown) => { m.recorded.push(a); } }));

import { GET, POST } from "@/app/api/usage/route";

beforeEach(() => { m.mine = null; m.recorded = []; });

describe("/api/usage", () => {
  it("returns the plan's limits next to this month's usage", async () => {
    m.mine = { plan: "adflo", usage: { aiActions: 1, tokens: 2, ocrReads: 3, quickActions: 4 }, seats: { used: 1, limit: 3 }, storage: { usedBytes: 5, quotaBytes: 20 } };
    const res = await GET();
    const body = await res.json();
    expect(body.data).toMatchObject({ plan: "adflo", seats: { used: 1, limit: 3 }, limits: { aiActions: 250, ocrPerMonth: 200, tokenBackstop: 3_000_000 } });
  });
  it("gives no limits for a legacy plan, and 404 when usage cannot be read", async () => {
    m.mine = { plan: "standard", usage: { aiActions: 0, tokens: 0, ocrReads: 0, quickActions: 0 }, seats: null, storage: null };
    expect((await (await GET()).json()).data.limits).toBeNull();
    m.mine = null;
    expect((await GET()).status).toBe(404);
  });
  it("counts a quick action on POST, from our own site only", async () => {
    expect((await POST(new Request("http://localhost/api/usage", { method: "POST", headers: { host: "localhost" } }))).status).toBe(200);
    expect(m.recorded).toEqual([{ quickActions: 1 }]);
    expect((await POST(new Request("http://localhost/api/usage", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }))).status).toBe(403);
  });
});
