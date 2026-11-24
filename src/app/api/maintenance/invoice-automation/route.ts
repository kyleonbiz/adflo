import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { recordJobRun } from "@/lib/control/job-runs";
import { createNextInvoice, dueReminder, newInvoiceEmail, recurringDue, reminderEmail, withReminderSent, withoutReminderSent, type RecurringMode } from "@/lib/invoices/auto";
import { formatMoney } from "@/lib/invoices/logic";
import type { Invoice } from "@/lib/invoices/types";
import { brandedEmail } from "@/lib/mail/layout";
import { ownerEmails, replyAddress } from "@/lib/mail/reply-to";
import { reminderAddress, reminderMailReady, sendReminderEmail } from "@/lib/mail/send";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const MAX_ROWS = 2000;
/** Whatever the records say, one run never sends more than this many emails in total. */
const MAX_PER_RUN = 300;

type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f<>",;]+/g, " ").replace(/\s{2,}/g, " ").trim();
// Saved records are plain JSON that a person (or an old version of the app) wrote: skip one that lacks the shape this needs.
const goodInvoice = (r: Row): boolean => {
  const d = r.data;
  return typeof d.number === "string" && typeof d.client === "string" && typeof d.clientEmail === "string" && typeof d.description === "string"
    && Array.isArray(d.items) && d.items.every(isObj) && ["draft", "sent", "paid", "void"].includes(d.status as string) && isDay(d.issuedOn) && isDay(d.dueOn)
    && Number.isFinite(d.amountCents) && isObj(d.sender) && typeof (d.sender as Record<string, unknown>).name === "string"
    && ["none", "weekly", "monthly", "quarterly", "yearly"].includes(d.recurrence as string)
    && Array.isArray(d.reminderDays) && d.reminderDays.every((n) => Number.isInteger(n)) && Array.isArray(d.paymentMethods) && d.paymentMethods.every((p) => typeof p === "string");
};

/**
 * Daily job (Vercel Cron). For each workspace that has switched them on in Settings (both off until then):
 *  - Payment reminders: emails the client before the due date, on it, and weekly once overdue (three times), until paid or voided.
 *  - Recurring invoices: creates the next invoice of a series on its issue date, as a draft for approval or sent straight away,
 *    and tells the workspace's owners what it made.
 * Emails go out in the business's name with replies to the invoice's own "from" email (else the business email in Settings, else the
 * owner). Each change is saved to the invoice first, so a failed save can never cause a repeat, and taken back if the email fails.
 * Suspended and cancelled clients are skipped. Protected by CRON_SECRET. `?dry=1` counts and changes nothing.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  if (!dry && !reminderMailReady()) return reply({ ok: false, error: "Email is not set up (RESEND_API_KEY, or SMTP_USER and SMTP_PASSWORD)." }, 503);

  const today = new Date().toISOString().slice(0, 10);
  const origin = siteOrigin(req.url);
  const { data: clients, error } = await admin.from("clients").select("name, workspace_id").in("status", ["trial", "active"]).not("workspace_id", "is", null);
  if (error) { await recordJobRun("invoice-automation", false, "could not load clients"); return reply({ ok: false, error: "Could not load clients." }, 500); }

  let on = 0, reminded = 0, created = 0, sentNew = 0, failed = 0, skippedNoReply = 0;
  let emails = 0;
  for (const c of (clients ?? []) as { name: string; workspace_id: string }[]) {
    if (emails >= MAX_PER_RUN) break;
    try {
      const wsId = c.workspace_id;
      const load = async (kind: string): Promise<Row[]> => {
        const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", wsId).eq("kind", kind).limit(MAX_ROWS);
        return ((data ?? []) as Row[]).filter((r) => isObj(r.data));
      };
      const settings = (await load("settings"))[0]?.data;
      const auto = isObj(settings?.automation) ? (settings!.automation as Record<string, unknown>) : {};
      const remindersOn = auto.invoiceReminders === true;
      const mode: RecurringMode | null = auto.recurringInvoices === "draft" || auto.recurringInvoices === "send" ? auto.recurringInvoices : null;
      if (!remindersOn && !mode) continue;
      on++;

      const business = oneLine(c.name) || "Your business";
      const rows = (await load("invoices")).filter(goodInvoice);
      const all: Invoice[] = rows.map((r) => ({ ...r.data, id: r.id }) as unknown as Invoice);
      const rowOf = new Map(rows.map((r) => [r.id, r]));
      const madeToday = new Set<string>();
      const makeSend = async (inv: Invoice, mail: { subject: string; text: string; html: string }) => {
        const replyTo = await replyAddress(admin, wsId, settings, inv.sender.email);
        if (!replyTo) { skippedNoReply++; return false; }
        const from = `${oneLine(inv.sender.name) || business} via AdFlo <${reminderAddress()}>`;
        await sendReminderEmail({ to: inv.clientEmail.trim(), ...mail, from, replyTo });
        return true;
      };
      const save = (id: string, data: Record<string, unknown>) =>
        admin.from("workspace_records").update({ data, updated_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("kind", "invoices").eq("id", id);

      // 1. Recurring invoices: the next one in each series that is due today.
      const made: Invoice[] = [];
      if (mode) {
        for (const src of recurringDue(all, today)) {
          if (emails >= MAX_PER_RUN) break;
          const id = `inv-auto-${Math.random().toString(36).slice(2, 10)}`;
          const next = createNextInvoice(src, all, id, mode, today);
          if (!next) continue;
          created++;
          if (dry) { all.push(next); continue; }
          const ins = await admin.from("workspace_records").insert({ workspace_id: wsId, kind: "invoices", id, data: next, updated_at: new Date().toISOString() });
          if (ins.error) { failed++; created--; continue; }
          all.push(next); madeToday.add(id); made.push(next);
          if (next.status === "sent") {
            emails++;
            try {
              if (await makeSend(next, newInvoiceEmail(next, { origin, business }))) sentNew++;
              else await admin.from("workspace_records").update({ data: { ...next, status: "draft" }, updated_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("kind", "invoices").eq("id", id);
            } catch {
              failed++;
              // It could not be sent, so it is kept as a draft for the owner to send by hand.
              await admin.from("workspace_records").update({ data: { ...next, status: "draft" }, updated_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("kind", "invoices").eq("id", id);
            }
          }
        }
      }

      // 2. Payment reminders to clients.
      if (remindersOn) {
        for (const inv of all) {
          if (emails >= MAX_PER_RUN) break;
          if (madeToday.has(inv.id) || !rowOf.has(inv.id)) continue;
          const point = dueReminder(inv, today);
          if (!point) continue;
          if (dry) { reminded++; continue; }
          const row = rowOf.get(inv.id)!;
          const recorded = withReminderSent(inv, point);
          // Recorded on the invoice first: if this save fails nothing is sent, and if the email fails the record is taken back.
          const saved = await save(inv.id, { ...row.data, remindersSent: recorded.remindersSent });
          if (saved.error) { failed++; continue; }
          emails++;
          try {
            if (await makeSend(inv, reminderEmail(inv, point, today, { origin, business }))) reminded++;
            else await save(inv.id, { ...row.data, remindersSent: withoutReminderSent(recorded, point).remindersSent ?? [] });
          } catch {
            failed++;
            await save(inv.id, { ...row.data, remindersSent: withoutReminderSent(recorded, point).remindersSent ?? [] });
          }
        }
      }

      // 3. Tell the owners what was made, so a draft is never a surprise.
      if (made.length > 0 && !dry) {
        const owners = await ownerEmails(admin, wsId, 3);
        const sentOnes = made.filter((i) => i.status === "sent");
        const drafts = made.filter((i) => i.status === "draft");
        const mail = {
          subject: `${made.length} recurring invoice${made.length === 1 ? "" : "s"} created for ${business}`,
          intro: [
            drafts.length ? `${drafts.length === 1 ? "A draft was" : `${drafts.length} drafts were`} created. Review and send ${drafts.length === 1 ? "it" : "them"} from Invoices when ready.` : "",
            sentOnes.length ? `${sentOnes.length === 1 ? "One invoice was" : `${sentOnes.length} invoices were`} sent to your customers automatically.` : "",
          ].filter(Boolean),
        };
        const panel = made.slice(0, 12).map((i): [string, string] => [`${oneLine(i.number)} · ${oneLine(i.client)}`, `${formatMoney(i.amountCents)} · ${i.status === "sent" ? "sent" : "draft"}`]);
        for (const to of owners) {
          try {
            await sendReminderEmail({
              to, subject: mail.subject,
              text: [...mail.intro, "", ...panel.map(([a, b]) => `- ${a}: ${b}`), "", `Open Invoices: ${origin}/app/invoices`].join("\n"),
              html: brandedEmail({ headline: "Recurring invoices", intro: mail.intro, panel, buttons: [{ label: "Open Invoices", url: `${origin}/app/invoices` }], fine: ["You get this because automatic recurring invoices are on for your workspace. You can change that in Settings, Automations."] }),
            });
          } catch { /* the invoices exist either way; a missed notice must not stop the run */ }
        }
      }
    } catch {
      failed++; // never log the records or the error text: it can hold client data
    }
  }
  if (!dry) await recordJobRun("invoice-automation", failed === 0, `${reminded} reminders, ${created} recurring (${sentNew} sent), ${failed} failed, ${on} workspace${on === 1 ? "" : "s"} on${skippedNoReply ? `, ${skippedNoReply} without a reply address` : ""}`);
  return reply({ ok: true, dry, workspacesOn: on, reminded, created, sentNew, failed, skippedNoReply }, 200);
}

export const GET = run;
export const POST = run;
