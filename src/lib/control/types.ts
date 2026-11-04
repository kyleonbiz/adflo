export const CLIENT_STATUSES = ["trial", "active", "suspended", "cancelled"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const STAFF_ROLES = ["owner", "support", "billing"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STATUS_LABEL: Record<ClientStatus, string> = {
  trial: "Trial", active: "Active", suspended: "Suspended", cancelled: "Cancelled",
};

export const ROLE_LABEL: Record<StaffRole, string> = { owner: "Owner", support: "Support", billing: "Billing" };

/** Owner and support can change clients; billing can only look. */
export const canEditClients = (role: StaffRole) => role === "owner" || role === "support";

export interface ClientRecord {
  id: string;
  name: string;
  status: ClientStatus;
  plan: string;
  seatsLimit: number;
  ownerName: string;
  ownerEmail: string;
  notes: string;
  workspaceId: string | null;
  startedOn: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  staffEmail: string;
  action: string;
  entity: string;
  entityId: string;
  detail: Record<string, unknown>;
  createdAt: string;
}
