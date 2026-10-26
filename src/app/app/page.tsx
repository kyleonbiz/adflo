import type { Metadata } from "next";
import { LiveWorkspace } from "@/components/dms/live-workspace";
import { DemoWorkspace } from "@/components/marketing/demo-workspace";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function AppPage({ searchParams }: PageProps<"/app">) {
  const { upload } = await searchParams;
  const startUpload = upload === "1";
  return renderAppShell("/app", (mode) => (mode === "preview" ? <DemoWorkspace startUpload={startUpload} /> : <LiveWorkspace mode="live" startUpload={startUpload} />));
}
