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
  return renderAppShell("/app/vendors", (_mode, user) => (
    <VendorsPage startNew={startNew} draft={draft} approver={user?.name} preview="Records live only in this browser tab. Nothing is saved and no notifications are sent." />
  ));
}
