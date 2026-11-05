import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIERS } from "./tiers";
import type { AuditEntry, ClientRecord, ClientStatus, DirectoryEntry, Plan, StaffMember, StaffRole, Ticket, TicketNote, TimelineEvent, AgreementTemplate, SentAgreement, AppError } from "./types";

interface ClientRow {
  id: string; name: string; status: ClientStatus; plan: string; seats_limit: number; owner_name: string;
  owner_email: string; notes: string; workspace_id: string | null; started_on: string | null; created_at: string;
  price_override_cents: number | null; price_note: string;
}

export const CLIENT_COLUMNS = "id, name, status, plan, seats_limit, owner_name, owner_email, notes, workspace_id, started_on, created_at, price_override_cents, price_note";

export const toClient = (r: ClientRow): ClientRecord => ({
  id: r.id, name: r.name, status: r.status, plan: r.plan, seatsLimit: r.seats_limit, ownerName: r.owner_name,
  ownerEmail: r.owner_email, notes: r.notes, workspaceId: r.workspace_id, startedOn: r.started_on, createdAt: r.created_at,
  priceOverrideCents: r.price_override_cents, priceNote: r.price_note, seatsUsed: null, lastActive: null, checklist: [],
});

export async function loadClients(supabase: SupabaseClient): Promise<ClientRecord[]> {
  const { data, error } = await supabase.from("clients").select(CLIENT_COLUMNS).order("name");
  if (error) throw new Error("Could not load clients.");
  const clients = (data as ClientRow[]).map(toClient);
  // Seats in use and last sign-in come from a function that exposes only those figures; the checklist is a plain table.
  const [usage, steps] = await Promise.all([supabase.rpc("control_client_usage"), supabase.from("client_checklist").select("client_id, step")]);
  type Usage = { client_id: string; seats_used: number; last_active: string | null };
  const u = new Map<string, Usage>(((usage.data ?? []) as Usage[]).map((x) => [x.client_id, x]));
  for (const c of clients) {
    const row = u.get(c.id);
    if (row && c.workspaceId) { c.seatsUsed = Number(row.seats_used); c.lastActive = row.last_active; }
    c.checklist = (steps.data ?? []).filter((s: { client_id: string }) => s.client_id === c.id).map((s: { step: string }) => s.step);
  }
  return clients;
}

export async function loadPlans(supabase: SupabaseClient): Promise<Plan[]> {
  const { data, error } = await supabase.from("plans").select("id, name, price_cents, seats_included, active, features").order("price_cents");
  if (error) throw new Error("Could not load plans.");
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string, priceCents: p.price_cents as number, seatsIncluded: p.seats_included as number, active: p.active as boolean, features: (p.features as string[] | null) ?? null }));
}

/** Owner only: other staff see just their own row. */
export async function loadStaff(supabase: SupabaseClient): Promise<StaffMember[]> {
  const { data, error } = await supabase.from("staff_members").select("user_id, role, display_name, email, active").order("created_at");
  if (error) throw new Error("Could not load the team.");
  return (data ?? []).map((s) => ({ userId: s.user_id as string, role: s.role as StaffRole, displayName: s.display_name as string, email: s.email as string, active: s.active as boolean }));
}

/** Owner-only: RLS returns nothing to anyone else. */
export async function loadAudit(supabase: SupabaseClient, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from("staff_audit_log").select("id, staff_email, action, entity, entity_id, detail, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Could not load the audit log.");
  return (data ?? []).map((r) => ({ id: r.id as number, staffEmail: r.staff_email as string, action: r.action as string, entity: r.entity as string, entityId: r.entity_id as string, detail: (r.detail ?? {}) as Record<string, unknown>, createdAt: r.created_at as string }));
}

/** Labelled examples for the development preview, so the screens show what they will hold. */
export const SAMPLE_CLIENTS: ClientRecord[] = [
  { id: "sample-1", name: "Sample: Acme Roofing", status: "active", plan: "standard", seatsLimit: 5, ownerName: "Pat Example", ownerEmail: "pat@example.com", notes: "", workspaceId: null, startedOn: "2026-09-01", createdAt: "2026-09-01T00:00:00Z", priceOverrideCents: null, priceNote: "", seatsUsed: 4, lastActive: "2026-11-02T15:00:00Z", checklist: ["workspace", "owner_invited", "agreement_sent", "plan_set", "first_login"] },
  { id: "sample-2", name: "Sample: Birch & Co", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "Lee Example", ownerEmail: "lee@example.com", notes: "", workspaceId: null, startedOn: "2026-10-20", createdAt: "2026-10-20T00:00:00Z", priceOverrideCents: 4900, priceNote: "Intro rate", seatsUsed: 1, lastActive: "2026-11-03T09:00:00Z", checklist: ["workspace", "owner_invited"] },
];

export const SAMPLE_PLANS: Plan[] = [
  ...TIERS.map((t, i) => ({ id: `plan-${i + 1}`, name: t.name, priceCents: 0, seatsIncluded: t.seatsIncluded, active: true, features: [...t.features] as string[] })),
  { id: "plan-0", name: "standard", priceCents: 9900, seatsIncluded: 3, active: true, features: null },
];

interface TicketRow { id: string; client_id: string | null; subject: string; body: string; status: Ticket["status"]; priority: Ticket["priority"]; assignee: string | null; created_at: string; updated_at: string; clients: { name: string } | { name: string }[] | null }
const TICKET_COLUMNS = "id, client_id, subject, body, status, priority, assignee, created_at, updated_at, clients(name)";
const toTicket = (r: TicketRow): Ticket => ({
  id: r.id, clientId: r.client_id, clientName: (Array.isArray(r.clients) ? r.clients[0]?.name : r.clients?.name) ?? "", subject: r.subject, body: r.body,
  status: r.status, priority: r.priority, assignee: r.assignee, createdAt: r.created_at, updatedAt: r.updated_at,
});

/** Newest first, open ones before closed. Pass `clientId` for one client's tickets. */
export async function loadTickets(supabase: SupabaseClient, clientId?: string): Promise<Ticket[]> {
  let q = supabase.from("support_tickets").select(TICKET_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw new Error("Could not load tickets.");
  const rank = { open: 0, pending: 1, closed: 2 } as const;
  return (data as unknown as TicketRow[]).map(toTicket).sort((a, b) => rank[a.status] - rank[b.status]);
}

export async function loadTicket(supabase: SupabaseClient, id: string): Promise<{ ticket: Ticket; notes: TicketNote[] } | null> {
  const { data, error } = await supabase.from("support_tickets").select(TICKET_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the ticket.");
  if (!data) return null;
  const { data: notes } = await supabase.from("ticket_notes").select("id, author_email, body, created_at").eq("ticket_id", id).order("created_at");
  return { ticket: toTicket(data as unknown as TicketRow), notes: (notes ?? []).map((n) => ({ id: n.id as string, authorEmail: n.author_email as string, body: n.body as string, createdAt: n.created_at as string })) };
}

export async function loadDirectory(supabase: SupabaseClient): Promise<DirectoryEntry[]> {
  const { data } = await supabase.rpc("control_staff_directory");
  return ((data ?? []) as { user_id: string; display_name: string; role: StaffRole }[]).map((d) => ({ userId: d.user_id, displayName: d.display_name, role: d.role }));
}

export async function loadTimeline(supabase: SupabaseClient, clientId: string): Promise<TimelineEvent[]> {
  const { data } = await supabase.rpc("control_client_timeline", { p_client: clientId });
  return ((data ?? []) as { at: string; staff_email: string; action: string; detail: Record<string, unknown> }[]).map((e) => ({ at: e.at, staffEmail: e.staff_email, action: e.action, detail: e.detail ?? {} }));
}

export const SAMPLE_TICKETS: Ticket[] = [
  { id: "sample-t1", clientId: "sample-1", clientName: "Sample: Acme Roofing", subject: "Cannot upload a PDF", body: "", status: "open", priority: "high", assignee: null, createdAt: "2026-11-03T14:00:00Z", updatedAt: "2026-11-03T14:00:00Z" },
  { id: "sample-t2", clientId: "sample-2", clientName: "Sample: Birch & Co", subject: "Add a seat for a new hire", body: "", status: "pending", priority: "normal", assignee: null, createdAt: "2026-11-02T10:00:00Z", updatedAt: "2026-11-02T10:00:00Z" },
];

export async function loadTemplates(supabase: SupabaseClient): Promise<AgreementTemplate[]> {
  const { data, error } = await supabase.from("agreement_templates").select("id, title, version, body, created_at").order("title").order("version", { ascending: false });
  if (error) throw new Error("Could not load agreements.");
  return (data ?? []).map((t) => ({ id: t.id as string, title: t.title as string, version: t.version as number, body: t.body as string, createdAt: t.created_at as string }));
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
