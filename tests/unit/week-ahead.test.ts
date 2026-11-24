import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
interface Db { clients: { name: string; workspace_id: string; status: string }[]; records: Rec[]; members: { workspace_id: string; email: string; role: string }[] }
const h = vi.hoisted(() => ({ db: null as unknown, sent: [] as Record<string, unknown>[], failSend: false }));
const DB = () => h.db as Db;

function fakeAdmin() {
  return {
    from(table: string) {
      const f: Record<string, unknown> = {};
      const run = () => {
        const db = DB();
        if (table === "clients") return { data: db.clients.filter((c) => (f["in:status"] as string[]).includes(c.status)), error: null };
        if (table === "workspace_members") return { data: db.members.filter((m) => m.workspace_id === f.workspace_id && (f["in:role"] as string[]).includes(m.role)), error: null };
        if (table === "documents") return { data: [], error: null };
        return { data: db.records.filter((r) => r.workspace_id === f.workspace_id && r.kind === f.kind).map((r) => ({ id: r.id, data: r.data })), error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, is: () => chain, order: () => chain, limit: () => chain,
        eq: (k: string, v: unknown) => { f[k] = v; return chain; },
        in: (k: string, v: unknown) => { f[`in:${k}`] = v; return chain; },
        then: (resolve: (v: unknown) => unknown) => resolve(run()),
      };
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => fakeAdmin() }));
vi.mock("@/lib/control/job-runs", () => ({ recordJobRun: async () => undefined }));
vi.mock("@/lib/mail/send", () => ({
  reminderMailReady: () => true,
  sendReminderEmail: async (m: Record<string, unknown>) => { if (h.failSend) throw new Error("down"); h.sent.push(m); },
}));

import { GET } from "@/app/api/maintenance/week-ahead/route";
import { buildEvents } from "@/lib/calendar/logic";
import { MAX_LATE, weekAhead, weekAheadEmail } from "@/lib/reminders/week-ahead";

const SECRET = "s".repeat(24);
const MON = "2026-11-23";
const day = (n: number) => new Date(Date.parse(`${MON}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const inv = (id: string, dueOn: string, client = "Zed Co") => ({ id, number: `INV-${id}`, client, dueOn, status: "sent" });
const events = (...i: ReturnType<typeof inv>[]) => buildEvents({ invoices: i, licenses: [], projects: [], vendors: [], reminders: [] } as never, MON);

describe("weekAhead", () => {
  it("is null when nothing is late or due this week", () => {
    expect(weekAhead(events(inv("1", day(30))), MON)).toBeNull();
  });

  it("lists late items, then the seven days from today, and skips old news", () => {
    const w = weekAhead(events(inv("1", day(-3)), inv("2", day(0)), inv("3", day(6)), inv("4", day(7)), inv("5", day(-90))), MON)!;
    expect(w.late.map((e) => e.title)).toEqual(["INV-1 due"]);
    expect(w.days.map(([d]) => d)).toEqual([day(0), day(6)]);
    expect(w.weekTotal).toBe(2);
  });

  it("caps the late list and counts the rest", () => {
    const many = Array.from({ length: 12 }, (_, i) => inv(String(i), day(-1 - i)));
    const w = weekAhead(events(...many), MON)!;
    expect(w.late).toHaveLength(MAX_LATE);
    expect(weekAheadEmail(w, { business: "Acme", today: MON, appUrl: "https://adflo.pro/app/calendar" }).text).toContain("...and 4 more");
  });

  it("writes a subject with counts, one-line titles and an app link", () => {
    const w = weekAhead(events(inv("1", day(-2)), inv("2", day(1), "Zed\r\nBcc: x@y.z")), MON)!;
    const m = weekAheadEmail(w, { business: "Acme\r\nRoofing", today: MON, appUrl: "https://adflo.pro/app/calendar" });
    expect(m.subject).toBe("Your week ahead: 1 item due, 1 late");
    expect(m.text).toContain("Open the calendar: https://adflo.pro/app/calendar");
    expect(m.text).not.toMatch(/\r|Bcc: x@y.z\n/);
    expect(m.html).toContain("Your week ahead");
  });
});

describe("week-ahead job", () => {
  const settings = (weeklyDigest: unknown): Rec => ({ workspace_id: "w1", kind: "settings", id: "config", data: { notifications: { enabled: { weeklyDigest } } } });
  const call = (q = "", headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) => GET(new Request(`http://localhost/api/maintenance/week-ahead${q}`, { headers }));
  const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(`${MON}T12:23:00Z`));
    h.sent = []; h.failSend = false;
    h.db = {
      clients: [{ name: "Acme Roofing", workspace_id: "w1", status: "active" }],
      records: [settings(true), { workspace_id: "w1", kind: "invoices", id: "a", data: inv("a", day(2)) }],
      members: [{ workspace_id: "w1", email: "owner@acme.test", role: "owner" }, { workspace_id: "w1", email: "bad address", role: "admin" }],
    } satisfies Db;
  });

  it("refuses without the secret", async () => {
    expect((await call("", {})).status).toBe(401);
  });

  it("emails the owners once a Monday, in the workspace's name", async () => {
    expect(await json(await call())).toMatchObject({ ok: true, workspacesOn: 1, sent: 1 });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "owner@acme.test" });
    expect(String(h.sent[0].text)).toContain("INV-a due");
  });

  it("does nothing off Monday unless forced, when the switch is off or only looks on, for suspended clients, or when nothing is due", async () => {
    vi.setSystemTime(new Date(`${day(2)}T12:23:00Z`));
    expect(await json(await call())).toMatchObject({ skipped: "not Monday" });
    expect(await json(await call("?force=1"))).toMatchObject({ sent: 1 });
    vi.setSystemTime(new Date(`${MON}T12:23:00Z`)); h.sent = [];
    for (const v of [false, "true", 1, undefined]) { DB().records[0] = settings(v); expect(await json(await call())).toMatchObject({ workspacesOn: 0, sent: 0 }); }
    DB().records[0] = settings(true); DB().clients[0].status = "suspended";
    expect(await json(await call())).toMatchObject({ workspacesOn: 0 });
    DB().clients[0].status = "active"; DB().records.pop();
    expect(await json(await call())).toMatchObject({ workspacesOn: 1, sent: 0 });
    expect(h.sent).toEqual([]);
  });

  it("a dry run sends nothing, and a failed send is counted", async () => {
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, due: 1, sent: 0 });
    h.failSend = true;
    expect(await json(await call())).toMatchObject({ sent: 0, failed: 1 });
  });
});
