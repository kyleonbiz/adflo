import { REMIND_COOLDOWN_HOURS, nextReminder, type ReminderKind } from "./reminders";

/** Days a client may sit without acting before the daily job reminds them (override with ONBOARDING_REMIND_AFTER_DAYS). */
const AUTO_REMIND_AFTER_DAYS = 3;
/** The job stops after this many automatic reminders per client; staff can still remind by hand. */
export const AUTO_REMIND_MAX = 3;
/** At most this many emails per run, so one bad day cannot flood anyone. */
const AUTO_REMIND_RUN_LIMIT = 25;

export interface AutoClient { id: string; status: string; ownerEmail: string; workspaceId: string | null }
export interface AutoInput {
  clients: AutoClient[];
  /** People who have joined each client's workspace (workspace id -> count). */
  members: Record<string, number>;
  /** When the welcome (or the owner invite) went out, per client. */
  welcomeAt: Record<string, string>;
  /** Agreements sent and not accepted yet. */
  waiting: { clientId: string; sentAt: string }[];
  reminders: { clientId: string; sentAt: string; auto: boolean }[];
}
interface DueReminder { clientId: string; kind: ReminderKind }

export const autoRemindDays = (env: Record<string, string | undefined> = process.env): number => {
  const n = Number(env.ONBOARDING_REMIND_AFTER_DAYS);
  return Number.isFinite(n) && n >= 1 && n <= 60 ? Math.floor(n) : AUTO_REMIND_AFTER_DAYS;
};
export const autoRemindEnabled = (env: Record<string, string | undefined> = process.env): boolean => (env.ONBOARDING_AUTO_REMIND ?? "").trim().toLowerCase() !== "off";

const ms = (iso: string | undefined | null) => { const t = iso ? Date.parse(iso) : NaN; return Number.isNaN(t) ? null : t; };

/**
 * Which clients are due an automatic reminder: in service or on trial, with something outstanding (the owner has not signed up,
 * or an agreement is waiting), who were last contacted (welcome, agreement or reminder) at least `days` ago, and who have not
 * already had `AUTO_REMIND_MAX` automatic reminders. A client who was never contacted about the step is left alone.
 */
export function dueAutoReminders(input: AutoInput, now: Date, days: number = AUTO_REMIND_AFTER_DAYS): DueReminder[] {
  const out: DueReminder[] = [];
  const need = Math.max(days * 86_400_000, REMIND_COOLDOWN_HOURS * 3_600_000);
  for (const c of input.clients) {
    if (c.status !== "trial" && c.status !== "active") continue;
    const waiting = input.waiting.filter((w) => w.clientId === c.id);
    const next = nextReminder({ ownerEmail: c.ownerEmail, workspaceId: c.workspaceId, seatsUsed: c.workspaceId ? input.members[c.workspaceId] ?? 0 : null, agreementsWaiting: waiting.length });
    if (!next) continue;
    const mine = input.reminders.filter((r) => r.clientId === c.id);
    if (mine.filter((r) => r.auto).length >= AUTO_REMIND_MAX) continue;
    const contacts = [
      ...mine.map((r) => ms(r.sentAt)),
      ...(next.kind === "signup" ? [ms(input.welcomeAt[c.id])] : waiting.map((w) => ms(w.sentAt))),
    ].filter((t): t is number => t !== null);
    const hadContactAboutThis = next.kind === "signup" ? ms(input.welcomeAt[c.id]) !== null || mine.length > 0 : waiting.length > 0;
    if (!hadContactAboutThis || contacts.length === 0) continue;
    if (now.getTime() - Math.max(...contacts) >= need) out.push({ clientId: c.id, kind: next.kind });
  }
  return out.slice(0, AUTO_REMIND_RUN_LIMIT);
}
