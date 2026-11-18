import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { invoiceEmail, parseSendInvoice } from "@/lib/control/billing";
import { logAppError } from "@/lib/control/errors";
import { sendBillingEmail, onboardingMailReady } from "@/lib/mail/onboarding";

export const dynamic = "force-dynamic";

/**
 * Emails one invoice to the client's owner. The address is read from the client record, never taken from the request, so a
 * staff account cannot use this to mail an arbitrary address. Invoices themselves live in the browser, so this only sends;
 * the page marks the invoice sent when it gets `ok`.
 */
export function POST(req: Request) {
  return staffRoute(req, async ({ supabase }) => {
    const parsed = parseSendInvoice(await req.json().catch(() => null));
    if (!parsed.ok) return fail(400, "invalid", parsed.message);
    const { data: client } = await supabase.from("clients").select("name, owner_name, owner_email").eq("id", parsed.value.clientId).maybeSingle();
    if (!client) return fail(404, "not_found", "Client not found.");
    const to = typeof client.owner_email === "string" ? client.owner_email.trim() : "";
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(to)) return fail(409, "no_owner_email", "This client has no owner email on file. Add it to the client first.");
    if (!onboardingMailReady()) return fail(503, "mail_off", "Email is not switched on yet (SMTP_USER and SMTP_PASSWORD are not set). Copy the invoice as text and send it yourself.");
    const invoice = { ...parsed.value, clientName: String(client.name ?? "") };
    try {
      await sendBillingEmail({ to, ...invoiceEmail(invoice, String(client.owner_name ?? "")) });
    } catch (e) {
      await logAppError("POST /api/control/invoices/send", e, { status: 502 });
      return fail(502, "mail_failed", "The email could not be sent. Copy the invoice as text and send it yourself.");
    }
    return NextResponse.json({ ok: true, emailedTo: to });
  }, "billing");
}
