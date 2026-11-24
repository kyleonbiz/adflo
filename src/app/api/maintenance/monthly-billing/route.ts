import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { monthLabel, monthlyDrafts } from "@/lib/control/billing";
import { isBillingInvoice, toRow } from "@/lib/control/billing-db";
import { recordJobRun } from "@/lib/control/job-runs";
import { formatMoney, type ClientRecord, type Plan } from "@/lib/control/types";
import type { Invoice } from "@/lib/invoices/types";
import { brandedEmail } from "@/lib/mail/layout";
import { onboardingMailReady, sendOnboardingEmail } from "@/lib/mail/onboarding";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
/** Drafts are only made in the first days of a month: a run later than that would bill for a month that is mostly over. */
const LAST_DAY = 3;
const MAX_CLIENTS = 2000;
const MAX_LISTED = 15;

type ClientRow = { id: string; name: string; status: string; plan: string; owner_email: string | null; seats_limit: number | null; price_override_cents: number | null; stripe_subscription_id: string | null };
type PlanRow = { id: string; name: string; price_cents: number; seats_included: number; active: boolean };

/**
 * Monthly job (Vercel Cron, run daily): on the first days of a month, makes a DRAFT subscription invoice for each active client that
 * AdFlo invoices itself (a price set, and not paying through a Stripe subscription), skipping any client that already has one for the
 * month. The drafts wait in the Control center's Billing for a person to review and send: nothing is ever sent to a client from here.
 * The owner and Billing staff get one email listing what was made. It does its work once a month: after a successful run, later
 * days skip. Protected by CRON_SECRET. `?dry=1` counts and changes nothing. `?force=1` ignores the first-days-of-the-month rule.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return reply({ ok: false, error: "Not configured." }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer ?? req.headers.get("x-cron-secret"), secret)) return reply({ ok: false, error: "Unauthorized." }, 401);
  const admin = createServiceSupabase();
  if (!admin) return reply({ ok: false, error: "Not configured." }, 503);
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";

  const today = new Date().toISOString().slice(0, 10);
  if (!force && Number(today.slice(8)) > LAST_DAY) return reply({ ok: true, skipped: "not the start of the month" }, 200);
  if (!force) {
    const { data: last } = await admin.from("job_runs").select("ran_at, ok").eq("job", "monthly-billing").maybeSingle();
    if (last?.ok && String(last.ran_at).slice(0, 7) === today.slice(0, 7)) return reply({ ok: true, skipped: "already done this month" }, 200);
  }

  const [clientsRes, plansRes, existingRes] = await Promise.all([
    admin.from("clients").select("id, name, status, plan, owner_email, seats_limit, price_override_cents, stripe_subscription_id").eq("status", "active").limit(MAX_CLIENTS),
    admin.from("plans").select("id, name, price_cents, seats_included, active"),
    admin.from("control_invoices").select("id, data").limit(10000),
  ]);
  if (clientsRes.error || plansRes.error || existingRes.error) { await recordJobRun("monthly-billing", false, "could not load clients, plans or invoices"); return reply({ ok: false, error: "Could not load billing records." }, 500); }

  // Clients paying through their own Stripe subscription are billed by Stripe, not here.
  const clients = ((clientsRes.data ?? []) as ClientRow[]).filter((c) => !c.stripe_subscription_id).map((c) => ({
    id: c.id, name: c.name, status: "active", plan: c.plan, ownerEmail: c.owner_email ?? "", seatsLimit: c.seats_limit ?? 0, priceOverrideCents: c.price_override_cents,
  })) as unknown as ClientRecord[];
  const plans = ((plansRes.data ?? []) as PlanRow[]).map((p) => ({ id: p.id, name: p.name, priceCents: p.price_cents, seatsIncluded: p.seats_included, active: p.active })) as Plan[];
  const existing = ((existingRes.data ?? []) as { id: string; data: unknown }[]).map((r) => ({ ...(r.data as object), id: r.id })).filter(isBillingInvoice) as Invoice[];

  const drafts = monthlyDrafts(clients, plans, existing, today);
  if (dry || drafts.length === 0) {
    if (!dry) await recordJobRun("monthly-billing", true, `0 drafts, ${clients.length} clients checked`);
    return reply({ ok: true, dry, drafts: drafts.length, checked: clients.length }, 200);
  }

  // The id is made from the client and the month, so a rerun can never make a second one.
  const { error } = await admin.from("control_invoices").upsert(drafts.map(toRow), { onConflict: "id", ignoreDuplicates: true });
  if (error) { await recordJobRun("monthly-billing", false, "could not save the drafts"); return reply({ ok: false, error: "Could not save the drafts." }, 500); }

  let emailed = 0;
  if (onboardingMailReady()) {
    const { data: staff } = await admin.from("staff_members").select("email, role").eq("active", true).in("role", ["owner", "billing"]);
    const to = [...new Set(((staff ?? []) as { email: string }[]).map((s) => s.email?.trim()).filter((e): e is string => !!e && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(e)))].slice(0, 5);
    const month = monthLabel(today);
    const total = drafts.reduce((t, d) => t + d.amountCents, 0);
    const listed = drafts.slice(0, MAX_LISTED);
    const panel = listed.map((d): [string, string] => [d.client.replace(/[\r\n\u0000-\u001f]+/g, " ").slice(0, 60), formatMoney(d.amountCents)]);
    if (drafts.length > listed.length) panel.push(["And more", `${drafts.length - listed.length} more`]);
    const link = `${siteOrigin(req.url)}/control/billing`;
    const intro = [`${drafts.length} draft invoice${drafts.length === 1 ? " was" : "s were"} made for ${month}, ${formatMoney(total)} in all.`, "Nothing has been sent to any client. Review them in Billing and send each when you are ready."];
    for (const addr of to) {
      try {
        await sendOnboardingEmail({ to: addr, subject: `${month} invoices are ready to review (${drafts.length})`, text: [...intro, "", ...panel.map(([a, b]) => `- ${a}: ${b}`), "", `Open Billing: ${link}`].join("\n"), html: brandedEmail({ headline: `${month} invoices`, intro, panel, buttons: [{ label: "Open Billing", url: link }] }) });
        emailed++;
      } catch { /* the drafts exist either way; a missed notice must not undo them */ }
    }
  }
  await recordJobRun("monthly-billing", true, `${drafts.length} drafts, ${emailed} notified, ${clients.length} clients checked`);
  return reply({ ok: true, dry, drafts: drafts.length, checked: clients.length, emailed }, 200);
}

export const GET = run;
export const POST = run;
