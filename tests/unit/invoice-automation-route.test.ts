import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Rec = { workspace_id: string; kind: string; id: string; data: Record<string, unknown> };
interface Db { clients: { name: string; workspace_id: string | null; status: string }[]; records: Rec[]; members: { workspace_id: string; email: string; role: string }[]; failUpdates?: boolean; failInserts?: boolean }

const h = vi.hoisted(() => ({ db: null as unknown, sent: [] as Record<string, unknown>[], failSend: false }));
const DB = () => h.db as Db;

function fakeAdmin() {
  type Q = { table: string; op: string; payload?: Record<string, unknown>; f: Record<string, unknown> };
  const exec = (q: Q) => {
    const db = DB();
    if (q.table === "clients") return { data: db.clients.filter((c) => (q.f["in:status"] as string[] | undefined)?.includes(c.status) && c.workspace_id), error: null };
    if (q.table === "workspace_members") return { data: db.members.filter((m) => m.workspace_id === q.f.workspace_id && (q.f["in:role"] as string[]).includes(m.role)), error: null };
    if (q.op === "insert") {
      if (db.failInserts) return { error: { message: "x" } };
      db.records.push({ workspace_id: q.payload!.workspace_id as string, kind: q.payload!.kind as string, id: q.payload!.id as string, data: q.payload!.data as Record<string, unknown> });
      return { error: null };
    }
    const rows = db.records.filter((r) => r.workspace_id === q.f.workspace_id && r.kind === q.f.kind && (q.f.id === undefined || r.id === q.f.id));
    if (q.op === "update") {
      if (db.failUpdates) return { error: { message: "x" } };
      for (const r of rows) r.data = q.payload!.data as Record<string, unknown>;
      return { error: null };
    }
    return { data: rows.map((r) => ({ id: r.id, data: r.data })), error: null };
  };
  return {
    from(table: string) {
      const q: Q = { table, op: "select", f: {} };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (payload: Record<string, unknown>) => { q.op = "update"; q.payload = payload; return chain; },
        insert: (payload: Record<string, unknown>) => { q.op = "insert"; q.payload = payload; return chain; },
        eq: (k: string, v: unknown) => { q.f[k] = v; return chain; },
        in: (k: string, v: unknown) => { q.f[`in:${k}`] = v; return chain; },
        not: () => chain, order: () => chain, limit: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(exec(q)),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createServiceSupabase: () => fakeAdmin() }));
vi.mock("@/lib/control/job-runs", () => ({ recordJobRun: async () => undefined }));
vi.mock("@/lib/mail/send", () => ({
  reminderMailReady: () => true,
  reminderAddress: () => "reminders@adflo.pro",
  sendReminderEmail: async (m: Record<string, unknown>) => { if (h.failSend) throw new Error("smtp down"); h.sent.push(m); },
}));

import { GET } from "@/app/api/maintenance/invoice-automation/route";

const SECRET = "s".repeat(24);
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const call = (query = "") => GET(new Request(`http://localhost/api/maintenance/invoice-automation${query}`, { headers: { authorization: `Bearer ${SECRET}` } }));
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

const invoice = (id: string, o: Record<string, unknown> = {}): Rec => ({
  workspace_id: "w1", kind: "invoices", id,
  data: { number: `INV-${id}`, client: "Northwind", clientEmail: `${id}@northwind.test`, description: "Roof repair", items: [{ description: "Roof repair", qty: 1, rateCents: 482000 }], taxRate: 0,
    sender: { name: "Acme Roofing", address: "", phone: "", email: "office@acme.test" }, paymentMethods: ["Check"], amountCents: 482000,
    issuedOn: day(-14), dueOn: day(0), status: "sent", paidOn: null, recurrence: "none", reminderDays: [7, 1], notes: "", ...o },
});
const settings = (automation: Record<string, unknown>, details: Record<string, unknown> = { email: "owner@acme.test" }): Rec => ({ workspace_id: "w1", kind: "settings", id: "config", data: { automation, details } });
const invoices = () => DB().records.filter((r) => r.kind === "invoices");
const REM = { invoiceReminders: true };

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  h.sent = []; h.failSend = false;
  h.db = { clients: [{ name: "Acme Roofing", workspace_id: "w1", status: "active" }], records: [settings(REM), invoice("a")], members: [{ workspace_id: "w1", email: "boss@acme.test", role: "owner" }] } satisfies Db;
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/maintenance/invoice-automation: payment reminders", () => {
  it("refuses without the cron secret", async () => {
    expect((await GET(new Request("http://localhost/api/maintenance/invoice-automation"))).status).toBe(401);
  });

  it("emails the client on the due date, in the business's name, with replies to the invoice's own address", async () => {
    expect(await json(await call())).toMatchObject({ ok: true, workspacesOn: 1, reminded: 1, failed: 0 });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "a@northwind.test", from: "Acme Roofing via AdFlo <reminders@adflo.pro>", replyTo: "office@acme.test" });
    expect(String(h.sent[0].subject)).toContain("is due today");
    expect(String(h.sent[0].text)).toContain("/invoice/");
  });

  it("records it on the invoice, so the same reminder never goes twice", async () => {
    await call();
    expect(invoices()[0].data.remindersSent).toEqual([day(0)]);
    h.sent = [];
    expect(await json(await call())).toMatchObject({ reminded: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("sends the before-due reminder on the reminder day, and weekly overdue notices after", async () => {
    DB().records[1] = invoice("a", { dueOn: day(7), issuedOn: day(-7) }); // 7 days before
    expect(await json(await call())).toMatchObject({ reminded: 1 });
    expect(String(h.sent[0].subject)).toContain("is due");
    h.sent = [];
    DB().records[1] = invoice("a", { dueOn: day(-7), issuedOn: day(-30) }); // a week overdue
    expect(await json(await call())).toMatchObject({ reminded: 1 });
    expect(String(h.sent[0].subject)).toMatch(/^Overdue:/);
  });

  it("does nothing on a day with no reminder, and for paid, voided and draft invoices", async () => {
    DB().records[1] = invoice("a", { dueOn: day(3) });
    expect(await json(await call())).toMatchObject({ reminded: 0 });
    for (const status of ["paid", "void", "draft"]) {
      DB().records[1] = invoice("a", { status });
      expect(await json(await call())).toMatchObject({ reminded: 0 });
    }
    expect(h.sent).toHaveLength(0);
  });

  it("skips an invoice with no usable client email", async () => {
    DB().records[1] = invoice("a", { clientEmail: "" });
    expect(await json(await call())).toMatchObject({ reminded: 0 });
  });

  it("does nothing for a workspace that has not switched it on", async () => {
    DB().records[0] = settings({ invoiceReminders: false, recurringInvoices: "off" });
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, reminded: 0 });
    DB().records.shift();
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, reminded: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("skips clients that are suspended or cancelled", async () => {
    DB().clients[0].status = "cancelled";
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, reminded: 0 });
  });

  it("counts on a dry run and sends and saves nothing", async () => {
    const before = JSON.stringify(DB().records);
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, reminded: 1 });
    expect(h.sent).toHaveLength(0);
    expect(JSON.stringify(DB().records)).toBe(before);
  });

  it("takes the record back when the email cannot be sent, so tomorrow tries again", async () => {
    h.failSend = true;
    expect(await json(await call())).toMatchObject({ reminded: 0, failed: 1 });
    expect(invoices()[0].data.remindersSent).toEqual([]);
    h.failSend = false;
    expect(await json(await call())).toMatchObject({ reminded: 1, failed: 0 });
  });

  it("sends nothing when the record cannot be saved first", async () => {
    DB().failUpdates = true;
    expect(await json(await call())).toMatchObject({ reminded: 0, failed: 1 });
    expect(h.sent).toHaveLength(0);
  });

  it("replies fall back to the business email, then the owner; with none, nothing is sent", async () => {
    DB().records[1] = invoice("a", { sender: { name: "Acme Roofing", address: "", phone: "", email: "" } });
    await call();
    expect(h.sent[0]).toMatchObject({ replyTo: "owner@acme.test" });
    h.sent = []; (invoices()[0].data as Record<string, unknown>).remindersSent = [];
    DB().records[0] = settings(REM, {});
    await call();
    expect(h.sent[0]).toMatchObject({ replyTo: "boss@acme.test" });
    h.sent = []; (invoices()[0].data as Record<string, unknown>).remindersSent = []; DB().members.length = 0;
    expect(await json(await call())).toMatchObject({ reminded: 0, skippedNoReply: 1 });
    expect(h.sent).toHaveLength(0);
    expect(invoices()[0].data.remindersSent).toEqual([]); // not marked as sent
  });

  it("only touches the workspace that switched it on", async () => {
    DB().clients.push({ name: "Other Co", workspace_id: "w2", status: "active" });
    DB().records.push({ ...invoice("o1"), workspace_id: "w2" });
    await call();
    expect(h.sent.map((m) => m.to)).toEqual(["a@northwind.test"]);
  });
});

describe("GET /api/maintenance/invoice-automation: recurring invoices", () => {
  const series = (o: Record<string, unknown> = {}) => invoice("s", { recurrence: "monthly", issuedOn: day(-1), dueOn: day(13), reminderDays: [], ...o });
  const monthly = () => { // a monthly invoice issued on the same day last month: the next is due today
    const d = new Date(`${today}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
    const issued = d.toISOString().slice(0, 10);
    return series({ number: "INV-0041", issuedOn: issued, dueOn: new Date(Date.parse(`${issued}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10) });
  };

  it("creates the next invoice as a draft for approval, and tells the owner", async () => {
    DB().records = [settings({ recurringInvoices: "draft" }), monthly()];
    expect(await json(await call())).toMatchObject({ workspacesOn: 1, created: 1, sentNew: 0, failed: 0 });
    const made = invoices().find((r) => r.id !== "s")!;
    expect(made.id).toMatch(/^inv-auto-/);
    expect(made.data).toMatchObject({ status: "draft", issuedOn: today, autoCreatedOn: today, client: "Northwind" });
    expect(made.data.number).toBe("INV-0042"); // the number goes up from the last one
    expect(h.sent.map((m) => m.to)).toEqual(["boss@acme.test"]); // the owner is told; the customer is not emailed
    expect(String(h.sent[0].subject)).toContain("1 recurring invoice created");
  });

  it("is made once, not again on the next run", async () => {
    DB().records = [settings({ recurringInvoices: "draft" }), monthly()];
    await call();
    h.sent = [];
    expect(await json(await call())).toMatchObject({ created: 0 });
    expect(invoices()).toHaveLength(2);
  });

  it("can send it to the customer straight away, with a link to the invoice", async () => {
    DB().records = [settings({ recurringInvoices: "send" }), monthly()];
    expect(await json(await call())).toMatchObject({ created: 1, sentNew: 1 });
    expect(invoices().find((r) => r.id !== "s")!.data.status).toBe("sent");
    const toCustomer = h.sent.find((m) => m.to === "s@northwind.test")!;
    expect(String(toCustomer.subject)).toMatch(/^Invoice INV-.* from Acme Roofing$/);
    expect(String(toCustomer.text)).toContain("/invoice/");
  });

  it("keeps it as a draft when it cannot be sent", async () => {
    h.failSend = true;
    DB().records = [settings({ recurringInvoices: "send" }), monthly()];
    expect(await json(await call())).toMatchObject({ created: 1, sentNew: 0, failed: 1 });
    expect(invoices().find((r) => r.id !== "s")!.data.status).toBe("draft");
  });

  it("does not restart a series that stopped, or one whose last invoice is a draft or voided", async () => {
    DB().records = [settings({ recurringInvoices: "draft" }), series({ issuedOn: day(-60), dueOn: day(-46) })];
    expect(await json(await call())).toMatchObject({ created: 0 });
    for (const status of ["draft", "void"]) {
      DB().records = [settings({ recurringInvoices: "draft" }), { ...monthly(), data: { ...monthly().data, status } }];
      expect(await json(await call())).toMatchObject({ created: 0 });
    }
  });

  it("makes nothing on a dry run, or when switched off", async () => {
    DB().records = [settings({ recurringInvoices: "draft" }), monthly()];
    expect(await json(await call("?dry=1"))).toMatchObject({ dry: true, created: 1 });
    expect(invoices()).toHaveLength(1);
    DB().records = [settings({ recurringInvoices: "off" }), monthly()];
    expect(await json(await call())).toMatchObject({ workspacesOn: 0, created: 0 });
  });

  it("does not remind about an invoice it has only just made", async () => {
    DB().records = [settings({ recurringInvoices: "send", invoiceReminders: true }), monthly()];
    await call();
    const made = invoices().find((r) => r.id !== "s")!;
    expect(made.data.remindersSent ?? []).toEqual([]);
  });
});
