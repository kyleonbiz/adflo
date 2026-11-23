import { onboardingRows } from "./onboarding";
import { agreementState, type AppError, type ClientRecord, type SentAgreement, type Ticket } from "./types";

export type AlertSeverity = "critical" | "warning" | "info";
/** One thing for the Control center bell: what it is about, where it is, and where to go to deal with it. */
export interface ControlAlert { id: string; severity: AlertSeverity; area: string; label: string; text: string; href: string }

export interface AlertInput { clients: ClientRecord[]; tickets: Ticket[]; errors: AppError[]; sent: SentAgreement[]; now?: Date }

const DAY = 86_400_000;
/** At most this many of one kind are listed; the rest are folded into one line so a busy day does not bury everything else. */
const PER_KIND = 4;
/** Errors older than this no longer raise the bell. */
const ERROR_DAYS = 7;
/** A signed agreement is news for this long. */
const ACCEPTED_DAYS = 3;
/** An agreement left unsigned this long needs a nudge. */
const WAITING_DAYS = 7;

const RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const clientHref = (id: string, hash = "") => `/control/clients/${id}${hash}`;

/**
 * What needs staff attention right now, most urgent first: open support tickets, unresolved errors, clients stuck in setup,
 * owners who have signed in and are waiting for their welcome, and agreements that were just signed or are going stale.
 * Pure: the same input always gives the same list, so it is the thing to test.
 */
export function buildControlAlerts({ clients, tickets, errors, sent, now = new Date() }: AlertInput): ControlAlert[] {
  const today = now.toISOString().slice(0, 10);
  const out: ControlAlert[] = [];
  const capped = (list: ControlAlert[], more: ControlAlert) => out.push(...list.slice(0, PER_KIND), ...(list.length > PER_KIND ? [{ ...more, text: `${more.text.replace("{n}", String(list.length - PER_KIND))}` }] : []));

  // Support: a ticket is waiting on us while it is open. "Waiting on client" and closed ones are not ours to act on.
  const open = tickets.filter((t) => t.status === "open").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  capped(
    open.map((t) => ({ id: `ticket-${t.id}`, severity: t.priority === "high" ? "critical" : "warning", area: "Support", label: t.lastFrom === "client" ? "Client replied" : t.source === "client" ? (t.priority === "high" ? "High priority request" : "New request") : t.priority === "high" ? "High priority ticket" : "Open ticket", text: `${t.clientName || "A client"}: ${t.subject}`, href: `/control/support/${t.id}` })),
    { id: "tickets-more", severity: "warning", area: "Support", label: "Open tickets", text: "{n} more open tickets", href: "/control/support" },
  );

  // Errors: one line, because they come in bursts and the Monitoring page is where they are worked through.
  const recent = errors.filter((e) => !e.resolvedAt && now.getTime() - Date.parse(e.at) <= ERROR_DAYS * DAY);
  if (recent.length > 0) {
    const lastDay = recent.filter((e) => now.getTime() - Date.parse(e.at) <= DAY).length;
    const latest = [...recent].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    out.push({ id: "errors", severity: lastDay >= 5 ? "critical" : "warning", area: "Monitoring", label: "Unresolved errors", text: `${plural(recent.length, "unresolved error")} in the last ${ERROR_DAYS} days. Latest: ${latest.kind} in ${latest.source}.`, href: "/control/monitoring" });
  }

  // Onboarding: stalled setups, and owners who are in but have not had their welcome yet.
  const stalled = onboardingRows(clients, today).filter((r) => r.stalled);
  capped(
    stalled.map((r) => ({ id: `stalled-${r.client.id}`, severity: "warning", area: "Onboarding", label: "Setup stalled", text: `${r.client.name} has been in setup for ${plural(r.daysSinceStart, "day")}. Next: ${r.next}.`, href: clientHref(r.client.id, "#onboarding") })),
    { id: "stalled-more", severity: "warning", area: "Onboarding", label: "Setup stalled", text: "{n} more clients are stalled in setup", href: "/control/onboarding" },
  );
  const welcomeDue = clients.filter((c) => (c.status === "trial" || c.status === "active") && c.workspaceId && ((c.seatsUsed ?? 0) > 0 || c.lastActive != null) && !c.checklist.includes("welcome_sent"));
  capped(
    welcomeDue.map((c) => ({ id: `welcome-${c.id}`, severity: "info", area: "Onboarding", label: "Welcome due", text: `${c.name}'s owner has signed in. Send the welcome message.`, href: clientHref(c.id, "#account") })),
    { id: "welcome-more", severity: "info", area: "Onboarding", label: "Welcome due", text: "{n} more owners are waiting for a welcome", href: "/control/onboarding" },
  );

  // Agreements: news when signed, a nudge when left too long.
  const accepted = sent.filter((a) => a.acceptedAt && now.getTime() - Date.parse(a.acceptedAt) <= ACCEPTED_DAYS * DAY).sort((a, b) => Date.parse(b.acceptedAt!) - Date.parse(a.acceptedAt!));
  capped(
    accepted.map((a) => ({ id: `accepted-${a.id}`, severity: "info", area: "Agreements", label: "Signed", text: `${a.acceptedName || "The owner"} accepted ${a.title} for ${a.clientName}.`, href: clientHref(a.clientId, "#agreements") })),
    { id: "accepted-more", severity: "info", area: "Agreements", label: "Signed", text: "{n} more agreements were signed", href: "/control/agreements" },
  );
  const stale = sent.filter((a) => agreementState(a, now.getTime()) === "waiting" && now.getTime() - Date.parse(a.sentAt) >= WAITING_DAYS * DAY).sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
  capped(
    stale.map((a) => ({ id: `waiting-${a.id}`, severity: "warning", area: "Agreements", label: "Not signed", text: `${a.title} for ${a.clientName} has waited ${plural(Math.floor((now.getTime() - Date.parse(a.sentAt)) / DAY), "day")} to be signed.`, href: clientHref(a.clientId, "#agreements") })),
    { id: "waiting-more", severity: "warning", area: "Agreements", label: "Not signed", text: "{n} more agreements are waiting to be signed", href: "/control/agreements" },
  );

  // Stable: by urgency, otherwise in the order they were added above (support, errors, onboarding, agreements).
  return out.map((a, i) => ({ a, i })).sort((x, y) => RANK[x.a.severity] - RANK[y.a.severity] || x.i - y.i).map((x) => x.a);
}
