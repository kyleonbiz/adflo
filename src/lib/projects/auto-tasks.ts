import { addDays, daysBetween } from "@/lib/dates";
import { equipmentEvents } from "@/lib/equipment/logic";
import type { Equipment } from "@/lib/equipment/types";
import type { Invoice } from "@/lib/invoices/types";
import type { License } from "@/lib/licenses/types";
import { wentQuiet, type Assignment } from "@/lib/packets/logic";
import { followUpState, unansweredReminders } from "@/lib/vendors/follow-up";
import type { Vendor } from "@/lib/vendors/types";
import type { Project, Task } from "./types";

/** The one project the automatic follow-up tasks live in. */
export const AUTO_PROJECT_ID = "auto-follow-ups";
export const AUTO_PROJECT_NAME = "Renewals and follow-ups";
/** A sent invoice this many days past due gets a follow-up task. */
export const INVOICE_LATE_DAYS = 14;
/** Equipment service and inspection dates get a task this many days ahead. */
export const EQUIPMENT_LEAD_DAYS = 14;
/** Something that was due longer ago than this is old news: no task is made for it. */
export const STALE_DAYS = 60;
/** One run adds at most this many tasks to a workspace, so turning this on never floods the list. */
export const MAX_NEW_PER_RUN = 25;
/** The ledger keeps this many keys. */
const LEDGER_MAX = 2000;

export interface AutoSources {
  licenses: License[];
  invoices: Invoice[];
  vendors: Vendor[];
  equipment: Equipment[];
  packets: Assignment[];
}
export interface AutoTask { key: string; title: string; dueOn: string }

const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 120);

/** Every follow-up that is called for today, whether or not it was already made. The key says which situation it is: the same
 * situation always gets the same key, and a new cycle (a license renewed to a new date, a new overdue invoice) gets a new one. */
export function followUps(src: AutoSources, today: string): AutoTask[] {
  const out: AutoTask[] = [];
  const fresh = (day: string) => daysBetween(day, today) <= STALE_DAYS;

  for (const l of src.licenses) {
    if (l.stage === "submitted") continue;
    const window = Math.min(90, Math.max(30, ...(l.reminderDays ?? [])));
    if (l.expiresOn > addDays(today, window) || !fresh(l.expiresOn)) continue;
    out.push({ key: `lic:${l.id}:${l.expiresOn}`, title: `Renew ${oneLine(l.name)}`, dueOn: addDays(l.expiresOn, -14) > today ? addDays(l.expiresOn, -14) : today });
  }
  for (const e of equipmentEvents(src.equipment, today)) {
    if (e.id.endsWith("-war") || e.day > addDays(today, EQUIPMENT_LEAD_DAYS) || !fresh(e.day)) continue;
    out.push({ key: `eq:${e.id}:${e.day}`, title: oneLine(e.title), dueOn: e.day < today ? today : e.day });
  }
  for (const i of src.invoices) {
    if (i.status !== "sent" || daysBetween(i.dueOn, today) < INVOICE_LATE_DAYS) continue;
    out.push({ key: `inv:${i.id}`, title: `Follow up on ${oneLine(i.number)}: ${oneLine(i.client)}`, dueOn: today });
  }
  for (const v of src.vendors) {
    if (followUpState(v, today) !== "ghosted") continue;
    const last = unansweredReminders(v).at(-1);
    out.push({ key: `vendor:${v.id}:${last?.on ?? ""}`, title: `Call ${oneLine(v.name)} about missing documents`, dueOn: today });
  }
  for (const a of src.packets) {
    if (!wentQuiet(a)) continue;
    out.push({ key: `packet:${a.id}`, title: `Follow up with ${oneLine(a.recipient)} on ${oneLine(a.templateName)}`, dueOn: today });
  }
  return out;
}

const taskId = (key: string) => `auto-${key.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 70)}`;

/**
 * The follow-up project with what is new added. A key already in the ledger is never added again, even if its task was finished or
 * deleted, and at most MAX_NEW_PER_RUN are added. Returns null when there is nothing to change.
 */
export function withNewTasks(existing: Project | null, wanted: AutoTask[], today: string): { project: Project; added: AutoTask[] } | null {
  const seen = new Set(existing?.autoCreated ?? []);
  const added = wanted.filter((w) => !seen.has(w.key)).slice(0, MAX_NEW_PER_RUN);
  if (added.length === 0) return null;
  const base: Project = existing ?? {
    id: AUTO_PROJECT_ID, name: AUTO_PROJECT_NAME, client: "", description: "Tasks AdFlo adds for you when a renewal window opens, equipment comes due, or an invoice, vendor or packet needs a nudge. Finish or delete them freely: they are never added twice.",
    status: "active", startOn: today, dueOn: addDays(today, 365), tasks: [], autoCreated: [],
  };
  const tasks: Task[] = added.map((w) => ({ id: taskId(w.key), title: w.title, assignee: "", dueOn: w.dueOn, repeat: "none", done: false, doneOn: null, followUpId: null }));
  const have = new Set(base.tasks.map((t) => t.id));
  return { project: { ...base, tasks: [...base.tasks, ...tasks.filter((t) => !have.has(t.id))], autoCreated: [...(base.autoCreated ?? []), ...added.map((a) => a.key)].slice(-LEDGER_MAX) }, added };
}
