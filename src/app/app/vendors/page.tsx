import type { Metadata } from "next";
import { VendorsPage } from "@/components/vendors/vendors-page";
import { draftFromParams } from "@/lib/assistant/guardrails";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

export default async function VendorsRoute({ searchParams }: PageProps<"/app/vendors">) {
  const params = await searchParams;
  const startNew = params.new === "1";
  const draft = startNew ? draftFromParams("vendors", (k) => (typeof params[k] === "string" ? (params[k] as string) : undefined)) : undefined;
  return renderAppShell("/app/vendors", () => (
    <VendorsPage startNew={startNew} draft={draft} preview="Records are saved in this browser only, not shared with other people or devices. No notifications are sent." />
  ));
}
