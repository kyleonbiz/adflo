import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildControlAlerts, type ControlAlert } from "./alerts";
import { TIERS } from "./tiers";
import { isBillingInvoice } from "./billing-db";
import type { Invoice } from "@/lib/invoices/types";
import { type AuditEntry, type ClientRecord, type ClientStatus, type DirectoryEntry, type Plan, type StaffMember, type StaffRole, type Ticket, type TicketMessage, type TicketNote, type TimelineEvent, type AgreementTemplate, type SentAgreement, type AppError, type UnlinkedWorkspace } from "./types";

interface ClientRow {
  id: string; name: string; status: ClientStatus; plan: string; seats_limit: number; owner_name: string;
  owner_email: string; notes: string; workspace_id: string | null; started_on: string | null; created_at: string;
  price_override_cents: number | null; price_note: string;
  billing_status?: string | null; billing_interval?: "month" | "year" | null; current_period_end?: string | null; cancel_at_period_end?: boolean;
}

export const CLIENT_COLUMNS = "id, name, status, plan, seats_limit, owner_name, owner_email, notes, workspace_id, started_on, created_at, price_override_cents, price_note, billing_status, billing_interval, current_period_end, cancel_at_period_end";

export const toClient = (r: ClientRow): ClientRecord => ({
  id: r.id, name: r.name, status: r.status, plan: r.plan, seatsLimit: r.seats_limit, ownerName: r.owner_name,
  ownerEmail: r.owner_email, notes: r.notes, workspaceId: r.workspace_id, startedOn: r.started_on, createdAt: r.created_at,
  priceOverrideCents: r.price_override_cents, priceNote: r.price_note, seatsUsed: null, lastActive: null, checklist: [],
  billingStatus: r.billing_status ?? null, billingInterval: r.billing_interval ?? null, periodEnd: r.current_period_end ?? null, cancelAtPeriodEnd: !!r.cancel_at_period_end,
});

export async function loadClients(supabase: SupabaseClient): Promise<ClientRecord[]> {
  const { data, error } = await supabase.from("clients").select(CLIENT_COLUMNS).order("name");
  if (error) throw new Error("Could not load clients.");
  const clients = (data as ClientRow[]).map(toClient);
  // Seats in use and last sign-in come from a function that exposes only those figures; the checklist is a plain table.
  const [usage, month, steps, waiting, reminders] = await Promise.all([
    supabase.rpc("control_client_usage"),
    supabase.rpc("control_usage_month"),
    supabase.from("client_checklist").select("client_id, step"),
    supabase.from("agreements_sent").select("client_id").is("accepted_at", null),
    supabase.from("client_reminders").select("client_id, sent_at").order("sent_at", { ascending: false }).limit(1000),
  ]);
  type Usage = { client_id: string; seats_used: number; last_active: string | null };
  const u = new Map<string, Usage>(((usage.data ?? []) as Usage[]).map((x) => [x.client_id, x]));
  type Month = { client_id: string; ai_actions: number; tokens: number; ocr_reads: number; quick_actions: number };
  const m = new Map<string, Month>(((month.data ?? []) as Month[]).map((x) => [x.client_id, x]));
  for (const c of clients) {
    const mo = m.get(c.id);
    c.usage = mo && c.workspaceId ? { aiActions: Number(mo.ai_actions), tokens: Number(mo.tokens), ocrReads: Number(mo.ocr_reads), quickActions: Number(mo.quick_actions) } : null;
    const row = u.get(c.id);
    if (row && c.workspaceId) { c.seatsUsed = Number(row.seats_used); c.lastActive = row.last_active; }
    c.agreementsWaiting = ((waiting.data ?? []) as { client_id: string }[]).filter((w) => w.client_id === c.id).length;
    c.lastReminderAt = ((reminders.data ?? []) as { client_id: string; sent_at: string }[]).find((r) => r.client_id === c.id)?.sent_at ?? null;
    c.checklist = (steps.data ?? []).filter((s: { client_id: string }) => s.client_id === c.id).map((s: { step: string }) => s.step);
  }
  return clients;
}

/** How many clients are new (on trial or active, owner not signed in yet): the number on the Onboarding menu item. Best effort: 0 if it cannot be read. */
export async function loadNewClientCount(supabase: SupabaseClient): Promise<number> {
  try {
    const [{ data: rows }, usage, steps] = await Promise.all([
      supabase.from("clients").select("id, workspace_id").in("status", ["trial", "active"]),
      supabase.rpc("control_client_usage"),
      supabase.from("client_checklist").select("client_id").eq("step", "first_login"),
    ]);
    const joined = new Map(((usage.data ?? []) as { client_id: string; seats_used: number; last_active: string | null }[]).map((u) => [u.client_id, u]));
    const ticked = new Set(((steps.data ?? []) as { client_id: string }[]).map((s) => s.client_id));
    return ((rows ?? []) as { id: string; workspace_id: string | null }[]).filter((c) => {
      const u = c.workspace_id ? joined.get(c.id) : undefined;
      return !(ticked.has(c.id) || (u && (Number(u.seats_used) > 0 || u.last_active != null)));
    }).length;
  } catch {
    return 0;
  }
}

export async function loadPlans(supabase: SupabaseClient): Promise<Plan[]> {
  const { data, error } = await supabase.from("plans").select("id, name, price_cents, seats_included, active, features").order("price_cents");
  if (error) throw new Error("Could not load plans.");
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string, priceCents: p.price_cents as number, seatsIncluded: p.seats_included as number, active: p.active as boolean, features: (p.features as string[] | null) ?? null }));
}

/** Owner only: other staff see just their own row. */
/** Workspaces nobody has connected to a client yet (support and owner only; anyone else gets an empty list). */
export async function loadUnlinkedWorkspaces(supabase: SupabaseClient): Promise<UnlinkedWorkspace[]> {
  const { data, error } = await supabase.rpc("control_unlinked_workspaces");
  if (error) throw new Error("Could not load workspaces.");
  return ((data ?? []) as { id: string; name: string; created_at: string; members: number | string; owner_email: string }[])
    .map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, members: Number(r.members), ownerEmail: r.owner_email }));
}

export async function loadStaff(supabase: SupabaseClient): Promise<StaffMember[]> {
  const { data, error } = await supabase.from("staff_members").select("user_id, role, display_name, email, active").order("created_at");
  if (error) throw new Error("Could not load the team.");
  return (data ?? []).map((s) => ({ userId: s.user_id as string, role: s.role as StaffRole, displayName: s.display_name as string, email: s.email as string, active: s.active as boolean }));
}

/** Owner-only: RLS returns nothing to anyone else. */
export async function loadAudit(supabase: SupabaseClient, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from("staff_audit_log").select("id, staff_email, action, entity, entity_id, detail, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Could not load the audit log.");
  // Names come from the team list (the Owner can read it), so a renamed person is renamed in old entries too.
  const names = new Map((await loadStaff(supabase).catch(() => [])).map((m) => [m.email.toLowerCase(), m.displayName.trim()]));
  return (data ?? []).map((r) => ({ id: r.id as number, staffEmail: r.staff_email as string, staffName: names.get(String(r.staff_email ?? "").toLowerCase()) ?? "", action: r.action as string, entity: r.entity as string, entityId: r.entity_id as string, detail: (r.detail ?? {}) as Record<string, unknown>, createdAt: r.created_at as string }));
}

/** Labelled examples for the development preview, so the screens show what they will hold. */
export const SAMPLE_CLIENTS: ClientRecord[] = [
  { id: "sample-1", name: "Sample: Acme Roofing", status: "active", plan: "standard", seatsLimit: 5, ownerName: "Pat Example", ownerEmail: "pat@example.com", notes: "", workspaceId: null, startedOn: "2026-09-01", createdAt: "2026-09-01T00:00:00Z", priceOverrideCents: null, priceNote: "", seatsUsed: 4, lastActive: "2026-11-02T15:00:00Z", checklist: ["details", "workspace", "owner_invited", "welcome_sent", "agreement_sent", "plan_set", "first_login", "live"] },
  { id: "sample-2", name: "Sample: Birch & Co", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "Lee Example", ownerEmail: "lee@example.com", notes: "", workspaceId: null, startedOn: "2026-10-20", createdAt: "2026-10-20T00:00:00Z", priceOverrideCents: 4900, priceNote: "Intro rate", seatsUsed: 1, lastActive: "2026-11-03T09:00:00Z", checklist: ["details", "workspace", "owner_invited"] },
];

export const SAMPLE_PLANS: Plan[] = [
  ...TIERS.map((t, i) => ({ id: `plan-${i + 1}`, name: t.name, priceCents: t.limits.priceCents ?? 0, seatsIncluded: t.seatsIncluded, active: true, features: [...t.features] as string[] })),
  { id: "plan-0", name: "standard", priceCents: 9900, seatsIncluded: 3, active: true, features: null },
];

interface TicketRow {
  id: string; ticket_no: number; client_id: string | null; subject: string; body: string; status: Ticket["status"]; priority: Ticket["priority"]; assignee: string | null;
  created_at: string; updated_at: string; category: Ticket["category"]; source: Ticket["source"]; workspace_id: string | null; requester_name: string; requester_email: string;
  clients: { name: string } | { name: string }[] | null;
}
const TICKET_COLUMNS = "id, ticket_no, client_id, subject, body, status, priority, assignee, created_at, updated_at, category, source, workspace_id, requester_name, requester_email, clients(name)";
const toTicket = (r: TicketRow): Ticket => ({
  id: r.id, ticketNo: r.ticket_no, clientId: r.client_id, clientName: (Array.isArray(r.clients) ? r.clients[0]?.name : r.clients?.name) ?? "", subject: r.subject, body: r.body,
  status: r.status, priority: r.priority, assignee: r.assignee, createdAt: r.created_at, updatedAt: r.updated_at,
  category: r.category, source: r.source, workspaceId: r.workspace_id, requesterName: r.requester_name, requesterEmail: r.requester_email, lastFrom: null,
});

/** Newest first, open ones before closed. Pass `clientId` for one client's tickets. */
export async function loadTickets(supabase: SupabaseClient, clientId?: string): Promise<Ticket[]> {
  let q = supabase.from("support_tickets").select(TICKET_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw new Error("Could not load tickets.");
  const rank = { open: 0, pending: 1, closed: 2 } as const;
  const tickets = (data as unknown as TicketRow[]).map(toTicket);
  // Who spoke last, so the bell can tell a new request from a client who has replied. Best effort: without it the bell still lists the ticket.
  const open = tickets.filter((t) => t.status === "open").map((t) => t.id);
  if (open.length > 0) {
    const { data: msgs } = await supabase.from("ticket_messages").select("ticket_id, author_kind").in("ticket_id", open).order("created_at", { ascending: false }).limit(1000);
    const last = new Map<string, "client" | "staff">();
    for (const m of (msgs ?? []) as { ticket_id: string; author_kind: "client" | "staff" }[]) if (!last.has(m.ticket_id)) last.set(m.ticket_id, m.author_kind);
    for (const t of tickets) t.lastFrom = last.get(t.id) ?? null;
  }
  return tickets.sort((a, b) => rank[a.status] - rank[b.status]);
}

export async function loadTicket(supabase: SupabaseClient, id: string): Promise<{ ticket: Ticket; notes: TicketNote[]; messages: TicketMessage[] } | null> {
  const { data, error } = await supabase.from("support_tickets").select(TICKET_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the ticket.");
  if (!data) return null;
  const [{ data: notes }, { data: messages }] = await Promise.all([
    supabase.from("ticket_notes").select("id, author_email, body, created_at").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_messages").select("id, author_kind, author_name, body, created_at").eq("ticket_id", id).order("created_at"),
  ]);
  return {
    ticket: toTicket(data as unknown as TicketRow),
    notes: (notes ?? []).map((n) => ({ id: n.id as string, authorEmail: n.author_email as string, body: n.body as string, createdAt: n.created_at as string })),
    messages: (messages ?? []).map((m) => ({ id: m.id as string, authorKind: m.author_kind as TicketMessage["authorKind"], authorName: m.author_name as string, body: m.body as string, createdAt: m.created_at as string })),
  };
}

export async function loadDirectory(supabase: SupabaseClient): Promise<DirectoryEntry[]> {
  const { data } = await supabase.rpc("control_staff_directory");
  return ((data ?? []) as { user_id: string; display_name: string; role: StaffRole }[]).map((d) => ({ userId: d.user_id, displayName: d.display_name, role: d.role }));
}

export async function loadTimeline(supabase: SupabaseClient, clientId: string): Promise<TimelineEvent[]> {
  const { data } = await supabase.rpc("control_client_timeline", { p_client: clientId });
  return ((data ?? []) as { at: string; staff_email: string; staff_name?: string; action: string; detail: Record<string, unknown> }[]).map((e) => ({ at: e.at, staffEmail: e.staff_email, staffName: e.staff_name ?? "", action: e.action, detail: e.detail ?? {} }));
}

export const SAMPLE_TICKETS: Ticket[] = [
  { id: "sample-t1", ticketNo: 2, clientId: "sample-1", clientName: "Sample: Acme Roofing", subject: "Cannot upload a PDF", body: "", status: "open", priority: "high", assignee: null, createdAt: "2026-11-03T14:00:00Z", updatedAt: "2026-11-03T14:00:00Z", category: "problem", source: "client", workspaceId: "sample-w1", requesterName: "Sample Owner", requesterEmail: "owner@example.test", lastFrom: null },
  { id: "sample-t2", ticketNo: 1, clientId: "sample-2", clientName: "Sample: Birch & Co", subject: "Add a seat for a new hire", body: "", status: "pending", priority: "normal", assignee: null, createdAt: "2026-11-02T10:00:00Z", updatedAt: "2026-11-02T10:00:00Z", category: "request", source: "client", workspaceId: "sample-w2", requesterName: "Sample Owner", requesterEmail: "owner@example.test", lastFrom: "staff" },
];

export const SAMPLE_TEMPLATES: AgreementTemplate[] = [{ id: "sample-a1", title: "Terms of Service", version: 2, body: "# Terms of Service\nSample text. The real agreement appears here once the Owner publishes it.\n\n## What you agree to\n- Pay invoices when they are due\n- Keep your account details up to date\n\n## Next steps\n1. Read the terms\n2. Tick both boxes and accept", effectiveDate: "2026-10-01", createdAt: "2026-10-01T00:00:00Z", accepted: true },
  { id: "sample-a2", title: "Privacy Policy", version: 1, body: "# Privacy Policy\nThe privacy policy will be added here.", effectiveDate: "2026-10-01", createdAt: "2026-10-01T00:00:00Z", accepted: false }];

export async function loadTemplates(supabase: SupabaseClient): Promise<AgreementTemplate[]> {
  const { data, error } = await supabase.from("agreement_templates").select("id, title, version, body, effective_date, created_at").order("title").order("version", { ascending: false });
  if (error) throw new Error("Could not load agreements.");
  // A version a client has accepted is locked, so the screen needs to know which ones those are.
  const { data: acc } = await supabase.from("agreements_sent").select("template_id").not("accepted_at", "is", null);
  const accepted = new Set((acc ?? []).map((r) => r.template_id as string));
  return (data ?? []).map((t) => ({ id: t.id as string, title: t.title as string, version: t.version as number, body: t.body as string, effectiveDate: t.effective_date as string, createdAt: t.created_at as string, accepted: accepted.has(t.id as string) }));
}

export async function loadSent(supabase: SupabaseClient, clientId?: string): Promise<SentAgreement[]> {
  let q = supabase.from("agreements_sent").select("id, client_id, sent_at, expires_at, accepted_at, accepted_name, agreement_templates(title, version), clients(name)").order("sent_at", { ascending: false }).limit(200);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw new Error("Could not load sent agreements.");
  const one = <T,>(v: T | T[] | null): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);
  return ((data ?? []) as unknown as { id: string; client_id: string; sent_at: string; expires_at: string; accepted_at: string | null; accepted_name: string | null; agreement_templates: { title: string; version: number } | { title: string; version: number }[] | null; clients: { name: string } | { name: string }[] | null }[]).map((r) => ({
    id: r.id, clientId: r.client_id, clientName: one(r.clients)?.name ?? "", title: one(r.agreement_templates)?.title ?? "", version: one(r.agreement_templates)?.version ?? 0,
    sentAt: r.sent_at, expiresAt: r.expires_at, acceptedAt: r.accepted_at, acceptedName: r.accepted_name,
  }));
}

export async function loadErrors(supabase: SupabaseClient, limit = 100): Promise<AppError[]> {
  const { data, error } = await supabase.from("app_errors").select("id, at, source, kind, status, client_id, resolved_at, clients(name)").order("at", { ascending: false }).limit(limit);
  if (error) throw new Error("Could not load errors.");
  return ((data ?? []) as unknown as { id: number; at: string; source: string; kind: string; status: number | null; client_id: string | null; resolved_at: string | null; clients: { name: string } | { name: string }[] | null }[]).map((r) => ({
    id: r.id, at: r.at, source: r.source, kind: r.kind, status: r.status, clientId: r.client_id, clientName: (Array.isArray(r.clients) ? r.clients[0]?.name : r.clients?.name) ?? "", resolvedAt: r.resolved_at,
  }));
}

/** Failed document indexing and recent open errors, keyed by client id. */
export async function loadClientProblems(supabase: SupabaseClient): Promise<{ failedDocs: Map<string, number>; errors: Map<string, number> }> {
  const [docs, errs] = await Promise.all([supabase.rpc("control_failed_documents"), supabase.rpc("control_error_counts")]);
  return {
    failedDocs: new Map(((docs.data ?? []) as { client_id: string; failed: number }[]).map((r) => [r.client_id, Number(r.failed)])),
    errors: new Map(((errs.data ?? []) as { client_id: string; errors: number }[]).map((r) => [r.client_id, Number(r.errors)])),
  };
}

/** What the Control center bell shows. Best effort: a failed read just means fewer alerts, never a broken page. */
export async function loadControlAlerts(supabase: SupabaseClient, clients?: ClientRecord[]): Promise<ControlAlert[]> {
  const soft = async <T,>(p: Promise<T>, empty: T): Promise<T> => { try { return await p; } catch { return empty; } };
  const [c, tickets, errors, sent] = await Promise.all([
    clients ? Promise.resolve(clients) : soft(loadClients(supabase), [] as ClientRecord[]),
    soft(loadTickets(supabase), [] as Ticket[]),
    soft(loadErrors(supabase, 100), [] as AppError[]),
    soft(loadSent(supabase), [] as SentAgreement[]),
  ]);
  return buildControlAlerts({ clients: c, tickets, errors, sent });
}

/** AdFlo's own invoices to its clients, from the database, newest first. Invoices that are not well formed are left out. */
export async function loadBillingInvoices(supabase: SupabaseClient): Promise<Invoice[]> {
  const { data } = await supabase.from("control_invoices").select("id, data").order("created_at", { ascending: false }).limit(5000);
  return ((data ?? []) as { id: string; data: unknown }[]).map((r) => ({ ...(r.data as object), id: r.id })).filter(isBillingInvoice);
}
