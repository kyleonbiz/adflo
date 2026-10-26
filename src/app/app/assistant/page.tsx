import type { Metadata } from "next";
import { AssistantPage } from "@/components/assistant/assistant-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "AI Assistant" };
export const dynamic = "force-dynamic";

export default function AssistantRoute() {
  return renderAppShell("/app/assistant", () => <AssistantPage />);
}
