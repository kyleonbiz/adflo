import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

export default async function AdminRoute({ searchParams }: PageProps<"/app/admin">) {
  const { new: startNew, q } = await searchParams;
  return renderAppShell("/app/admin", () => (
    <AdminPage initialQuery={typeof q === "string" ? q : ""} startNew={startNew === "1"} preview="Records live only in this browser tab. Nothing is saved and nothing is emailed." />
  ));
}
