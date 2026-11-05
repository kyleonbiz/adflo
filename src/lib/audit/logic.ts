/** One line in the activity log: who did what, and when. Records live in the browser until a database is connected. */
export const AUDIT_AREAS = ["Invoices", "Licenses", "Contacts", "Vendors", "Tasks", "Forms", "Documents"] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

export interface AuditEntry {
  id: string;
  /** The person's full name, as it shows in the app. */
  by: string;
  /** What they did, in the past tense: "created", "marked as paid", "uploaded". */
  verb: string;
  /** What it was done to: "invoice INV-12", "the Food permit license". */
  what: string;
  area: AuditArea;
  /** Where the record lives, so the line can link to it. */
  href: string;
  /** When, as an ISO timestamp. */
  at: string;
}

export const MAX_ENTRIES = 1000;

/** Adds an entry at the top (newest first), keeping the log to a sensible size. */
export function addEntry(list: AuditEntry[], entry: AuditEntry): AuditEntry[] {
  return [entry, ...list].slice(0, MAX_ENTRIES);
}

/** "Kyle Fulwood Jr created invoice INV-12" */
export const describe = (e: Pick<AuditEntry, "by" | "verb" | "what">): string => `${e.by} ${e.verb} ${e.what}`;

/** "Nov 4, 2026, 4:12 PM", in the viewer's own time zone. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function parseAudit(raw: string): AuditEntry[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((e): e is AuditEntry =>
        !!e && typeof e.id === "string" && typeof e.by === "string" && typeof e.verb === "string" && typeof e.what === "string" &&
        (AUDIT_AREAS as readonly string[]).includes(e.area) && typeof e.href === "string" && e.href.startsWith("/app") &&
        typeof e.at === "string" && !Number.isNaN(new Date(e.at).getTime()))
      .slice(0, MAX_ENTRIES);
  } catch { return []; }
}
