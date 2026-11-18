import type { SupabaseClient } from "@supabase/supabase-js";
import { autoRemindDays, autoRemindEnabled, dueAutoReminders, type AutoInput } from "./auto-reminders";
import type { ReminderKind } from "./reminders";
import type { ClientRecord } from "./types";

export interface AutoStatus {
  /** False when ONBOARDING_AUTO_REMIND=off. */
  enabled: boolean;
  days: number;
  /** Clients the next daily run would remind, and about what. */
  due: Record<string, ReminderKind>;
}

/**
 * What the daily job would do right now, worked out with the signed-in staff member's own access (no secret needed), so the
 * Onboarding page can show it. The job itself reads the same tables with the service key.
 */
export async function loadAutoStatus(supabase: SupabaseClient, clients: ClientRecord[], now: Date = new Date()): Promise<AutoStatus> {
  const enabled = autoRemindEnabled();
  const days = autoRemindDays();
  if (!enabled) return { enabled, days, due: {} };
  const ids = clients.map((c) => c.id);
  const [steps, waiting, reminders] = await Promise.all([
    supabase.from("client_checklist").select("client_id, done_at").in("client_id", ids).in("step", ["welcome_sent", "owner_invited"]),
    supabase.from("agreements_sent").select("client_id, sent_at").in("client_id", ids).is("accepted_at", null),
    supabase.from("client_reminders").select("client_id, sent_at, auto").in("client_id", ids),
  ]);
  const welcomeAt: Record<string, string> = {};
  for (const s of (steps.data ?? []) as { client_id: string; done_at: string }[]) if (!welcomeAt[s.client_id] || s.done_at > welcomeAt[s.client_id]) welcomeAt[s.client_id] = s.done_at;
  const input: AutoInput = {
    clients: clients.map((c) => ({ id: c.id, status: c.status, ownerEmail: c.ownerEmail, workspaceId: c.workspaceId })),
    members: Object.fromEntries(clients.filter((c) => c.workspaceId).map((c) => [c.workspaceId as string, c.seatsUsed ?? 0])),
    welcomeAt,
    waiting: ((waiting.data ?? []) as { client_id: string; sent_at: string }[]).map((w) => ({ clientId: w.client_id, sentAt: w.sent_at })),
    reminders: ((reminders.data ?? []) as { client_id: string; sent_at: string; auto: boolean }[]).map((r) => ({ clientId: r.client_id, sentAt: r.sent_at, auto: r.auto })),
  };
  return { enabled, days, due: Object.fromEntries(dueAutoReminders(input, now, days).map((d) => [d.clientId, d.kind])) };
}
