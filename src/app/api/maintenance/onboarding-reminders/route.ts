import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { AUTO_REMIND_MAX, autoRemindDays, autoRemindEnabled, dueAutoReminders, type AutoInput } from "@/lib/control/auto-reminders";
import { signupReminderEmail } from "@/lib/control/reminder-emails";
import { hashToken, newToken } from "@/lib/control/token";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";
import { agreementsEmail } from "@/lib/mail/onboarding-email";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

type ClientRow = { id: string; name: string; status: string; owner_name: string; owner_email: string; workspace_id: string | null };

/**
 * Daily job (Vercel Cron): reminds clients who have sat for 3 days (ONBOARDING_REMIND_AFTER_DAYS) without signing up or accepting
 * an agreement. Same emails as the tracker's Remind button, sent from the onboarding@ alias; at most 3 automatic reminders per
 * client (then staff decide); logged like manual ones. Protected by CRON_SECRET. `?dry=1` only counts who is due.
 * Switch off with ONBOARDING_AUTO_REMIND=off. Needs SMTP_USER, SMTP_PASSWORD and SUPABASE_SERVICE_ROLE_KEY.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  if (!autoRemindEnabled()) return reply({ ok: true, enabled: false }, 200);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  if (!dry && !onboardingMailReady()) return reply({ ok: false, error: "Email is not set up (SMTP_USER and SMTP_PASSWORD)." }, 503);

  const { data: clientRows, error } = await admin.from("clients").select("id, name, status, owner_name, owner_email, workspace_id").in("status", ["trial", "active"]);
  if (error) return reply({ ok: false, error: "Could not load clients." }, 500);
  const clients = (clientRows ?? []) as ClientRow[];
  const ids = clients.map((c) => c.id);
  const wsIds = clients.map((c) => c.workspace_id).filter((w): w is string => !!w);
  if (ids.length === 0) return reply({ ok: true, due: 0, sent: 0, failed: 0 }, 200);
  const [members, steps, waiting, reminders] = await Promise.all([
    wsIds.length ? admin.from("workspace_members").select("workspace_id").in("workspace_id", wsIds) : Promise.resolve({ data: [] }),
    admin.from("client_checklist").select("client_id, step, done_at").in("client_id", ids).in("step", ["welcome_sent", "owner_invited"]),
    admin.from("agreements_sent").select("id, client_id, template_id, sent_at").in("client_id", ids).is("accepted_at", null),
    admin.from("client_reminders").select("client_id, sent_at, auto").in("client_id", ids),
  ]);
  const count: Record<string, number> = {};
  for (const m of (members.data ?? []) as { workspace_id: string }[]) count[m.workspace_id] = (count[m.workspace_id] ?? 0) + 1;
  const welcomeAt: Record<string, string> = {};
  for (const s of (steps.data ?? []) as { client_id: string; done_at: string }[]) if (!welcomeAt[s.client_id] || s.done_at > welcomeAt[s.client_id]) welcomeAt[s.client_id] = s.done_at;
  const waitingRows = (waiting.data ?? []) as { id: string; client_id: string; template_id: string; sent_at: string }[];
  const input: AutoInput = {
    clients: clients.map((c) => ({ id: c.id, status: c.status, ownerEmail: c.owner_email ?? "", workspaceId: c.workspace_id })),
    members: count,
    welcomeAt,
    waiting: waitingRows.map((w) => ({ clientId: w.client_id, sentAt: w.sent_at })),
    reminders: ((reminders.data ?? []) as { client_id: string; sent_at: string; auto: boolean }[]).map((r) => ({ clientId: r.client_id, sentAt: r.sent_at, auto: r.auto })),
  };
  const due = dueAutoReminders(input, new Date(), autoRemindDays());
  if (dry) return reply({ ok: true, dry: true, due: due.length, signup: due.filter((d) => d.kind === "signup").length, agreement: due.filter((d) => d.kind === "agreement").length, maxPerClient: AUTO_REMIND_MAX }, 200);

  const origin = siteOrigin(req.url);
  let sent = 0, failed = 0;
  for (const d of due) {
    const c = clients.find((x) => x.id === d.clientId)!;
    const to = c.owner_email.trim();
    try {
      if (d.kind === "signup") {
        await sendOnboardingEmail({ to, ...signupReminderEmail({ clientName: c.name, ownerName: c.owner_name ?? "", ownerEmail: to, origin }) });
      } else {
        const old = waitingRows.filter((w) => w.client_id === c.id);
        const templateIds = [...new Set(old.map((w) => w.template_id))];
        const { data: templates } = await admin.from("agreement_templates").select("id, title").in("id", templateIds);
        const titleOf = new Map((templates ?? []).map((t) => [String(t.id), String(t.title)]));
        const items: { title: string; link: string }[] = [];
        for (const templateId of templateIds) {
          const token = newToken();
          const { error: e } = await admin.from("agreements_sent").insert({ client_id: c.id, template_id: templateId, token_hash: hashToken(token) });
          if (e) throw e;
          items.push({ title: titleOf.get(templateId) ?? "Agreement", link: `${origin}/agreement/${token}` });
        }
        await sendOnboardingEmail({ to, ...agreementsEmail({ clientName: c.name, ownerName: c.owner_name ?? "", items, reminder: true }) });
        await admin.from("agreements_sent").delete().in("id", old.map((w) => w.id)); // the fresh links replace the old unaccepted ones
      }
      await admin.from("client_reminders").insert({ client_id: c.id, kind: d.kind, auto: true });
      sent++;
    } catch { failed++; }
  }
  // Counts only: no names or addresses are returned or logged.
  return reply({ ok: true, due: due.length, sent, failed }, 200);
}

export const GET = run;
export const POST = run;
