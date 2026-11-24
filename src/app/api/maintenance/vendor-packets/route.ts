import { secretMatches } from "@/app/api/maintenance/cleanup-uploads/route";
import { logAutomation } from "@/lib/audit/server";
import { recordJobRun } from "@/lib/control/job-runs";
import { reminderMailReady } from "@/lib/mail/send";
import { sendPacketEmail } from "@/lib/packets/server";
import { addNote } from "@/lib/vendors/follow-up";
import { AUTO_PACKET_BY, packetNoteId, packetTargets, vendorPacket } from "@/lib/vendors/auto-packet";
import type { Vendor } from "@/lib/vendors/types";
import { siteOrigin } from "@/lib/site-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const MAX_ROWS = 2000;
const MAX_PER_RUN = 100;

type Row = { id: string; data: Record<string, unknown> };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
// Saved records are plain JSON that a person (or an old version of the app) wrote: skip one that lacks the shape this needs.
const goodVendor = (d: Record<string, unknown>) => typeof d.name === "string" && typeof d.email === "string" && typeof d.contactName === "string" && typeof d.status === "string" && isDay(d.createdOn)
  && Array.isArray(d.documents) && d.documents.every(isObj) && (d.activity === undefined || (Array.isArray(d.activity) && d.activity.every(isObj)));
const goodPacket = (d: Record<string, unknown>) => typeof d.email === "string" && typeof d.recipient === "string";

/**
 * Weekday job (Vercel Cron). For each workspace that has chosen "Start the subcontractor packet for new vendors" in Settings (off until
 * then): a vendor added in the last two weeks that has an email gets the "New subcontractor" packet started in Forms & Paperwork, and
 * with "send" it is also emailed to them in the business's name. Once per vendor (a note on its file remembers it). Everything is
 * recorded before it is sent, so a failed save can never cause a repeat, and a failed email leaves the packet as a draft to send by hand.
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
  const mailReady = reminderMailReady();

  const today = new Date().toISOString().slice(0, 10);
  const origin = siteOrigin(req.url);
  const { data: clients, error } = await admin.from("clients").select("name, workspace_id").in("status", ["trial", "active"]).not("workspace_id", "is", null);
  if (error) { await recordJobRun("vendor-packets", false, "could not load clients"); return reply({ ok: false, error: "Could not load clients." }, 500); }

  let on = 0, started = 0, sent = 0, failed = 0, handled = 0;
  for (const c of (clients ?? []) as { name: string; workspace_id: string }[]) {
    if (handled >= MAX_PER_RUN) break;
    try {
      const ws = c.workspace_id;
      const load = async (kind: string): Promise<Row[]> => {
        const { data } = await admin.from("workspace_records").select("id, data").eq("workspace_id", ws).eq("kind", kind).limit(MAX_ROWS);
        return ((data ?? []) as Row[]).filter((r) => isObj(r.data));
      };
      const settings = (await load("settings"))[0]?.data;
      const mode = isObj(settings?.automation) ? (settings!.automation as Record<string, unknown>).vendorPacket : undefined;
      if (mode !== "draft" && mode !== "send") continue;
      on++;

      const vendorRows = (await load("vendors")).filter((r) => goodVendor(r.data));
      const vendors = vendorRows.map((r) => ({ ...r.data, id: r.id }) as unknown as Vendor);
      const packets = (await load("packets")).filter((r) => goodPacket(r.data)).map((r) => ({ email: String(r.data.email) }));
      const targets = packetTargets(vendors, packets, today);
      for (const v of targets) {
        if (handled >= MAX_PER_RUN) break;
        handled++;
        if (dry) { started++; continue; }
        const row = vendorRows.find((r) => r.id === v.id)!;
        const noted = addNote(v, { id: packetNoteId(v), on: today, kind: "note", text: `Onboarding packet started automatically${mode === "send" ? " and emailed" : ""}.`, by: AUTO_PACKET_BY });
        const saveVendor = (activity: unknown) => admin.from("workspace_records").update({ data: { ...row.data, activity }, updated_at: new Date().toISOString() }).eq("workspace_id", ws).eq("kind", "vendors").eq("id", row.id);
        // The vendor's file is marked first, so nothing can start twice; the mark is taken back if the packet could not be saved.
        if ((await saveVendor(noted.activity)).error) { failed++; continue; }
        const a = vendorPacket(v, today);
        const { id, ...data } = a;
        const ins = await admin.from("workspace_records").insert({ workspace_id: ws, kind: "packets", id, data, updated_at: new Date().toISOString() });
        if (ins.error) { failed++; await saveVendor(v.activity ?? []); continue; }
        started++;
        await logAutomation(admin, ws, today, [{ job: "vendor-packets", key: `start-${v.id}`, verb: "started the subcontractor packet for", what: v.name, area: "Forms", href: "/app/forms" }]);
        if (mode !== "send" || !mailReady) continue;
        const saveSent = (d: Record<string, unknown>) => admin.from("workspace_records").update({ data: d, updated_at: new Date().toISOString() }).eq("workspace_id", ws).eq("kind", "packets").eq("id", id);
        if ((await saveSent({ ...data, sentOn: today })).error) { failed++; continue; }
        try {
          const res = await sendPacketEmail(admin, { workspaceId: ws, business: c.name, origin, settings, assignment: { ...a, sentOn: today }, kind: "first", n: 0 });
          if (res.ok) {
            sent++;
            await logAutomation(admin, ws, today, [{ job: "vendor-packets", key: `send-${v.id}`, verb: "emailed the subcontractor packet to", what: v.name, area: "Forms", href: "/app/forms" }]);
          } else await saveSent(data); // left as a draft: no reply address, say
        } catch {
          failed++;
          await saveSent(data);
        }
      }
    } catch {
      failed++; // never log the records or the error text: it can hold client data
    }
  }
  if (!dry) await recordJobRun("vendor-packets", failed === 0, `${started} started, ${sent} emailed, ${failed} failed, ${on} workspace${on === 1 ? "" : "s"} on`);
  return reply({ ok: true, dry, workspacesOn: on, started, sent, failed }, 200);
}

export const GET = run;
export const POST = run;
