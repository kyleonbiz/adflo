import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntry, ClientRecord, ClientStatus, Plan, StaffMember, StaffRole } from "./types";

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
  const { data, error } = await supabase.from("plans").select("id, name, price_cents, seats_included, active").order("price_cents");
  if (error) throw new Error("Could not load plans.");
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string, priceCents: p.price_cents as number, seatsIncluded: p.seats_included as number, active: p.active as boolean }));
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
  { id: "plan-1", name: "standard", priceCents: 9900, seatsIncluded: 3, active: true },
  { id: "plan-2", name: "pro", priceCents: 24900, seatsIncluded: 10, active: true },
];
