import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PAPERWORK } from "@/lib/forms/paperwork";
import { decodeForm, encodeForm } from "@/lib/forms/share";
import type { FormTemplate } from "@/lib/forms/types";
import { replyAddress } from "@/lib/mail/reply-to";
import { reminderAddress, sendReminderEmail } from "@/lib/mail/send";
import { packetEmail, type PacketEmailKind } from "./email";
import { hasEmail, type Assignment } from "./logic";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f<>",;]+/g, " ").replace(/\s{2,}/g, " ").trim();

/**
 * Turns a form id into the link a person uses to fill it out: the workspace's own copy of the form if it has one, otherwise the
 * standard one from the paperwork library. A form that cannot be packed into a working link gives null (the email then says to ask).
 */
export async function formLinker(db: SupabaseClient, workspaceId: string, origin: string, replyTo: string): Promise<(formId: string) => string | null> {
  const { data } = await db.from("workspace_records").select("id, data").eq("workspace_id", workspaceId).eq("kind", "forms").limit(500);
  const own = new Map<string, FormTemplate>();
  for (const r of (data ?? []) as { id: string; data: unknown }[]) {
    if (isObj(r.data) && typeof r.data.name === "string" && Array.isArray(r.data.fields)) own.set(r.id, { ...(r.data as unknown as FormTemplate), id: r.id });
  }
  const standard = new Map(PAPERWORK.map((p) => [p.form.id, p.form]));
  return (formId) => {
    const form = own.get(formId) ?? standard.get(formId);
    if (!form) return null;
    const token = encodeForm(form, replyTo);
    return decodeForm(token) ? `${origin}/form/${token}` : null;
  };
}

export type PacketSendResult = { ok: true; emailedTo: string } | { ok: false; code: "no_email" | "no_reply_address" | "nothing_to_send"; message: string };

/**
 * Emails a packet (or a reminder about it) to the person, in the business's name, with replies going to the business: the invoice-style
 * order of the business email in Settings, then the workspace's first owner or admin. Only sends. Recording that it went out is the
 * caller's job, and happens before this is called, so a failed save can never cause a repeat.
 */
export async function sendPacketEmail(db: SupabaseClient, o: {
  workspaceId: string; business: string; origin: string; settings: Record<string, unknown> | undefined; assignment: Assignment; kind: PacketEmailKind; n: number;
}): Promise<PacketSendResult> {
  const a = o.assignment;
  if (!hasEmail(a)) return { ok: false, code: "no_email", message: "This packet has no email address for the person." };
  const replyTo = await replyAddress(db, o.workspaceId, o.settings);
  if (!replyTo) return { ok: false, code: "no_reply_address", message: "Add your business email in Settings, Business profile, so replies have somewhere to go." };
  const business = oneLine(o.business) || "Your business";
  const mail = packetEmail(a, o.kind, o.n, { business, formLink: await formLinker(db, o.workspaceId, o.origin, replyTo) });
  await sendReminderEmail({ to: a.email.trim(), ...mail, from: `${business} via AdFlo <${reminderAddress()}>`, replyTo });
  return { ok: true, emailedTo: a.email.trim() };
}
