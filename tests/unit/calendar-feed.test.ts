import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
const h = vi.hoisted(() => ({ db: null as unknown }));
interface Db { feeds: { token_hash: string; workspace_id: string }[]; clients: { workspace_id: string; status: string }[]; records: Rec[]; docs: Record<string, unknown>[] }
const DB = () => h.db as Db;

function fakeAdmin() {
  return {
    from(table: string) {
      const f: Record<string, unknown> = {};
      const run = () => {
        const db = DB();
        if (table === "calendar_feeds") return { data: db.feeds.find((x) => x.token_hash === f.token_hash) ?? null };
        if (table === "clients") return { data: db.clients.find((c) => c.workspace_id === f.workspace_id) ?? null };
        if (table === "workspaces") return { data: { name: "Acme Roofing" } };
        if (table === "documents") return { data: db.docs };
        return { data: db.records.filter((r) => r.workspace_id === f.workspace_id && r.kind === f.kind).map((r) => ({ id: r.id, data: r.data })) };
      };
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, is: () => chain, limit: () => chain,
        eq: (k: string, v: unknown) => { f[k] = v; return chain; },
        maybeSingle: async () => run(),
        then: (resolve: (v: unknown) => unknown) => resolve(run()),
      };
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => fakeAdmin() }));

import { GET } from "@/app/api/calendar/feed/[token]/route";
import { hashToken, newToken } from "@/lib/control/token";
import { feedEvents, feedIcs } from "@/lib/calendar/feed";
import { toIcs } from "@/lib/ics";

const token = newToken();
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const get = (t: string) => GET(new Request(`http://localhost/api/calendar/feed/${t}`), { params: Promise.resolve({ token: t }) } as never);
const rec = (kind: string, id: string, data: Record<string, unknown>): Rec => ({ workspace_id: "w1", kind, id, data });

beforeEach(() => {
  h.db = {
    feeds: [{ token_hash: hashToken(token), workspace_id: "w1" }],
    clients: [{ workspace_id: "w1", status: "active" }],
    records: [
      rec("invoices", "i1", { number: "INV-9", client: "Zed Co", dueOn: day(5), status: "sent" }),
      rec("licenses", "bad", { name: 42 }),
      rec("projects", "p1", { name: "Roof", tasks: [{ id: "t1", title: "Order shingles", dueOn: day(3), done: false }], milestones: [] }),
    ],
    docs: [{ id: "d1", display_name: "COI.pdf", expires_at: `${day(40)}T00:00:00Z` }],
  } satisfies Db;
});

describe("public calendar feed", () => {
  it("serves the workspace's dates as an .ics calendar with private headers", async () => {
    const res = await get(`${token}.ics`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    const body = await res.text();
    expect(body).toContain("X-WR-CALNAME:AdFlo: Acme Roofing");
    expect(body).toContain("INV-9");
    expect(body).toContain("Order shingles");
    expect(body).toContain("COI.pdf");
    expect(body).not.toContain("\"name\":42");
  });

  it("answers 404 for a malformed, unknown or revoked link, and for a suspended client", async () => {
    expect((await get("short.ics")).status).toBe(404);
    expect((await get(`${newToken()}.ics`)).status).toBe(404);
    DB().clients[0].status = "suspended";
    expect((await get(`${token}.ics`)).status).toBe(404);
    DB().clients[0].status = "cancelled";
    expect((await get(token)).status).toBe(404);
  });
});

describe("feed window and file", () => {
  it("keeps only events from a month ago to a year and a half ahead", () => {
    const src = { invoices: [
      { id: "a", number: "A", client: "C", dueOn: day(-90), status: "sent" },
      { id: "b", number: "B", client: "C", dueOn: day(-10), status: "sent" },
      { id: "c", number: "C", client: "C", dueOn: day(900), status: "sent" },
    ], licenses: [], projects: [], vendors: [], reminders: [] } as never;
    expect(feedEvents(src, today).map((e) => e.title)).toHaveLength(1);
  });

  it("names the calendar, asks apps to refresh, and links back to AdFlo", () => {
    const ics = feedIcs([{ id: "inv-1", day: day(2), title: "INV-1 due", detail: "Zed Co", kind: "Invoices", href: "/app/invoices", late: true } as never], { name: "Acme\r\nRoofing", today, origin: "https://adflo.pro" });
    expect(ics).toContain("X-WR-CALNAME:AdFlo: Acme Roofing");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(ics).toContain("https://adflo.pro/app/invoices");
    expect(ics).toContain("(overdue)");
  });

  it("adds no refresh lines when no options are given", () => {
    expect(toIcs([{ uid: "x", day: today, summary: "S" }], today)).not.toContain("REFRESH-INTERVAL");
  });
});
