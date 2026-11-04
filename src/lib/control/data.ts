import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntry, ClientRecord, ClientStatus } from "./types";

interface ClientRow {
  id: string; name: string; status: ClientStatus; plan: string; seats_limit: number; owner_name: string;
  owner_email: string; notes: string; workspace_id: string | null; started_on: string | null; created_at: string;
}

export const CLIENT_COLUMNS = "id, name, status, plan, seats_limit, owner_name, owner_email, notes, workspace_id, started_on, created_at";

export const toClient = (r: ClientRow): ClientRecord => ({
  id: r.id, name: r.name, status: r.status, plan: r.plan, seatsLimit: r.seats_limit, ownerName: r.owner_name,
  ownerEmail: r.owner_email, notes: r.notes, workspaceId: r.workspace_id, startedOn: r.started_on, createdAt: r.created_at,
});

export async function loadClients(supabase: SupabaseClient): Promise<ClientRecord[]> {
  const { data, error } = await supabase.from("clients").select(CLIENT_COLUMNS).order("name");
  if (error) throw new Error("Could not load clients.");
  return (data as ClientRow[]).map(toClient);
}

/** Owner-only: RLS returns nothing to anyone else. */
export async function loadAudit(supabase: SupabaseClient, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from("staff_audit_log").select("id, staff_email, action, entity, entity_id, detail, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Could not load the audit log.");
  return (data ?? []).map((r) => ({ id: r.id as number, staffEmail: r.staff_email as string, action: r.action as string, entity: r.entity as string, entityId: r.entity_id as string, detail: (r.detail ?? {}) as Record<string, unknown>, createdAt: r.created_at as string }));
}

/** Labelled examples for the development preview, so the screens show what they will hold. */
export const SAMPLE_CLIENTS: ClientRecord[] = [
  { id: "sample-1", name: "Sample: Acme Roofing", status: "active", plan: "standard", seatsLimit: 5, ownerName: "Pat Example", ownerEmail: "pat@example.com", notes: "", workspaceId: null, startedOn: "2026-09-01", createdAt: "2026-09-01T00:00:00Z" },
  { id: "sample-2", name: "Sample: Birch & Co", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "Lee Example", ownerEmail: "lee@example.com", notes: "", workspaceId: null, startedOn: "2026-10-20", createdAt: "2026-10-20T00:00:00Z" },
];
