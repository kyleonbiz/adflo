import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { draftFromParams } from "@/lib/assistant/guardrails";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

export default async function AdminRoute({ searchParams }: PageProps<"/app/admin">) {
  const params = await searchParams;
  const { new: startNew, q } = params;
  const draft = startNew === "1" ? draftFromParams("admin", (k) => (typeof params[k] === "string" ? (params[k] as string) : undefined)) : undefined;
  return renderAppShell("/app/admin", () => (
    <AdminPage draft={draft} initialQuery={typeof q === "string" ? q : ""} startNew={startNew === "1"} preview="Records live only in this browser tab. Nothing is saved and nothing is emailed." />
  ));
}
