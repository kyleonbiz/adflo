import type { Metadata } from "next";
import { InvoicesPage } from "@/components/invoices/invoices-page";
import { draftFromParams } from "@/lib/assistant/guardrails";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesRoute({ searchParams }: PageProps<"/app/invoices">) {
  const params = await searchParams;
  const { new: startNew, q } = params;
  const draft = startNew === "1" ? draftFromParams("invoices", (k) => (typeof params[k] === "string" ? (params[k] as string) : undefined)) : undefined;
  return renderAppShell("/app/invoices", (mode) => (
    <InvoicesPage live={mode === "live"} draft={draft} initialQuery={typeof q === "string" ? q : ""} startNew={startNew === "1"} preview={mode === "preview" ? "Records are saved in this browser only, not shared with other people or devices. No emails are sent." : undefined} />
  ));
}
