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
  /** The Owner's own price for this client, in cents; null means the plan price applies. */
  priceOverrideCents: number | null;
  priceNote: string;
  /** Filled from the usage function; null in the preview or when the client has no workspace yet. */
  seatsUsed: number | null;
  lastActive: string | null;
  /** Onboarding steps that are done. */
  checklist: string[];
}

export const CHECKLIST_STEPS = [
  { key: "workspace", label: "Workspace created" },
  { key: "owner_invited", label: "Owner invited" },
  { key: "agreement_sent", label: "Terms and agreement sent" },
  { key: "plan_set", label: "Plan and seats confirmed" },
  { key: "first_login", label: "First sign-in completed" },
] as const;
export type ChecklistStep = (typeof CHECKLIST_STEPS)[number]["key"];

export interface Plan { id: string; name: string; priceCents: number; seatsIncluded: number; active: boolean;
  /** Feature keys the plan includes (see tiers.ts); null means everything. */
  features?: string[] | null }
export interface StaffMember { userId: string; role: StaffRole; displayName: string; email: string; active: boolean }

export const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** What a client pays per month: their own price when set, otherwise the plan's. */
export function effectivePriceCents(c: Pick<ClientRecord, "plan" | "priceOverrideCents">, plans: Plan[]): number | null {
  if (c.priceOverrideCents != null) return c.priceOverrideCents;
  return plans.find((p) => p.name.toLowerCase() === c.plan.toLowerCase())?.priceCents ?? null;
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

export const TICKET_STATUSES = ["open", "pending", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ["low", "normal", "high"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = { open: "Open", pending: "Waiting on client", closed: "Closed" };

export interface Ticket {
  id: string; clientId: string | null; clientName: string; subject: string; body: string;
  status: TicketStatus; priority: TicketPriority; assignee: string | null; createdAt: string; updatedAt: string;
}
export interface TicketNote { id: string; authorEmail: string; body: string; createdAt: string }
export interface DirectoryEntry { userId: string; displayName: string; role: StaffRole }
export interface TimelineEvent { at: string; staffEmail: string; action: string; detail: Record<string, unknown> }

export interface AgreementTemplate { id: string; title: string; version: number; body: string; createdAt: string }
export interface SentAgreement {
  id: string; clientId: string; clientName: string; title: string; version: number;
  sentAt: string; expiresAt: string; acceptedAt: string | null; acceptedName: string | null;
}
/** Where a sent agreement stands. */
export function agreementState(a: Pick<SentAgreement, "acceptedAt" | "expiresAt">, now = Date.now()): "accepted" | "expired" | "waiting" {
  if (a.acceptedAt) return "accepted";
  return Date.parse(a.expiresAt) < now ? "expired" : "waiting";
}

export interface AppError { id: number; at: string; source: string; kind: string; status: number | null; clientId: string | null; clientName: string; resolvedAt: string | null }
export type HealthLevel = "ok" | "warn" | "down";
export interface HealthCheck { name: string; level: HealthLevel; detail: string }

/** A client is quiet when nobody has signed in for this many days. */
export const QUIET_DAYS = 30;
export function isQuiet(c: Pick<ClientRecord, "status" | "lastActive" | "workspaceId">, now = Date.now()): boolean {
  if (c.status !== "active" || !c.workspaceId) return false;
  return !c.lastActive || now - Date.parse(c.lastActive) > QUIET_DAYS * 86_400_000;
}
