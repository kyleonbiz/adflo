import { describe, expect, it } from "vitest";
import { buildControlAlerts } from "@/lib/control/alerts";
import type { AppError, ClientRecord, SentAgreement, Ticket } from "@/lib/control/types";

const NOW = new Date("2026-11-20T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const client = (o: Partial<ClientRecord> = {}): ClientRecord => ({
  id: "c1", name: "Acme Roofing", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "Pat", ownerEmail: "pat@acme.test", notes: "", workspaceId: "w1",
  startedOn: ago(1).slice(0, 10), createdAt: ago(1), priceOverrideCents: null, priceNote: "", seatsUsed: 0, lastActive: null, checklist: [], ...o,
});
const ticket = (o: Partial<Ticket> = {}): Ticket => ({ id: "t1", clientId: "c1", clientName: "Acme Roofing", subject: "Cannot upload", body: "", status: "open", priority: "normal", assignee: null, createdAt: ago(1), updatedAt: ago(1), source: "staff", requesterEmail: "", ...o });
const error = (o: Partial<AppError> = {}): AppError => ({ id: 1, at: ago(0.5), source: "POST /api/dms/uploads", kind: "TypeError", status: 500, clientId: null, clientName: "", resolvedAt: null, ...o });
const sent = (o: Partial<SentAgreement> = {}): SentAgreement => ({ id: "a1", clientId: "c1", clientName: "Acme Roofing", title: "Terms of Service", version: 1, sentAt: ago(1), expiresAt: ago(-29), acceptedAt: null, acceptedName: null, ...o });
const build = (o: Partial<Parameters<typeof buildControlAlerts>[0]> = {}) => buildControlAlerts({ clients: [], tickets: [], errors: [], sent: [], now: NOW, ...o });

describe("Control center bell", () => {
  it("is empty when nothing needs staff", () => {
    expect(build()).toEqual([]);
    expect(build({ clients: [client()], tickets: [ticket({ status: "closed" }), ticket({ id: "t2", status: "pending" })] })).toEqual([]);
  });

  it("lists open tickets, high priority as urgent and first", () => {
    const a = build({ tickets: [ticket({ id: "t1" }), ticket({ id: "t2", priority: "high", subject: "Down" })] });
    expect(a.map((x) => [x.id, x.severity])).toEqual([["ticket-t2", "critical"], ["ticket-t1", "warning"]]);
    expect(a[0]).toMatchObject({ area: "Support", text: "Acme Roofing: Down", href: "/control/support/t2" });
  });

  it("folds a long list of one kind into one line", () => {
    const tickets = Array.from({ length: 7 }, (_, i) => ticket({ id: `t${i}`, createdAt: ago(i + 1) }));
    const a = build({ tickets });
    expect(a).toHaveLength(5);
    expect(a[4]).toMatchObject({ id: "tickets-more", text: "3 more open tickets", href: "/control/support" });
  });

  it("raises one line for unresolved recent errors, urgent when it is a burst", () => {
    expect(build({ errors: [error({ resolvedAt: ago(0) }), error({ id: 2, at: ago(30) })] })).toEqual([]);
    const one = build({ errors: [error()] });
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ id: "errors", severity: "warning", href: "/control/monitoring" });
    expect(one[0].text).toContain("1 unresolved error in the last 7 days");
    const burst = build({ errors: Array.from({ length: 5 }, (_, i) => error({ id: i })) });
    expect(burst[0].severity).toBe("critical");
    expect(burst[0].text).toContain("5 unresolved errors");
  });

  it("flags a client stuck in setup, with what is next", () => {
    const stuck = client({ id: "c9", name: "Birch & Co", startedOn: ago(10).slice(0, 10), createdAt: ago(10), checklist: ["details"] });
    const a = build({ clients: [stuck, client({ id: "c2", name: "Fresh Co" })] });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: "stalled-c9", severity: "warning", href: "/control/clients/c9#onboarding" });
    expect(a[0].text).toBe("Birch & Co has been in setup for 10 days. Next: Workspace created.");
  });

  it("tells staff when an owner has signed in and the welcome is still due", () => {
    const due = client({ id: "c3", name: "In Co", seatsUsed: 1, lastActive: ago(0), checklist: ["details", "workspace", "owner_invited", "first_login"] });
    const done = client({ id: "c4", name: "Done Co", seatsUsed: 1, lastActive: ago(0), checklist: ["welcome_sent"] });
    const notIn = client({ id: "c5", name: "Not In Co" });
    const a = build({ clients: [due, done, notIn] });
    expect(a.map((x) => x.id)).toEqual(["welcome-c3"]);
    expect(a[0]).toMatchObject({ severity: "info", href: "/control/clients/c3#account" });
  });

  it("reports agreements just signed, and ones left unsigned for a week", () => {
    const a = build({ sent: [
      sent({ id: "s1", acceptedAt: ago(1), acceptedName: "Pat Lee" }),
      sent({ id: "s2", acceptedAt: ago(10), acceptedName: "Old" }),
      sent({ id: "s3", sentAt: ago(9), clientName: "Birch & Co", clientId: "c7" }),
      sent({ id: "s4", sentAt: ago(2) }),
      sent({ id: "s5", sentAt: ago(20), expiresAt: ago(1) }),
    ] });
    expect(a.map((x) => x.id)).toEqual(["waiting-s3", "accepted-s1"]);
    expect(a[1].text).toBe("Pat Lee accepted Terms of Service for Acme Roofing.");
    expect(a[0]).toMatchObject({ severity: "warning", href: "/control/clients/c7#agreements" });
  });

  it("puts the most urgent first and keeps the rest in a steady order", () => {
    const a = build({
      clients: [client({ id: "c3", name: "In Co", seatsUsed: 1, lastActive: ago(0) })],
      tickets: [ticket({ priority: "high" })],
      errors: [error()],
    });
    expect(a.map((x) => x.severity)).toEqual(["critical", "warning", "info"]);
    expect(build({ tickets: [ticket()], errors: [error()] }).map((x) => x.id)).toEqual(["ticket-t1", "errors"]);
  });
});
