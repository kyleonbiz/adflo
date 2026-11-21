import type { Metadata } from "next";
import { EquipmentPage } from "@/components/equipment/equipment-page";
import { draftFromParams } from "@/lib/assistant/guardrails";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Equipment" };
export const dynamic = "force-dynamic";

export default async function EquipmentRoute({ searchParams }: PageProps<"/app/equipment">) {
  const params = await searchParams;
  const draft = params.new === "1" ? draftFromParams("equipment", (k) => (typeof params[k] === "string" ? (params[k] as string) : undefined)) : undefined;
  return renderAppShell("/app/equipment", (mode) => (
    <EquipmentPage draft={draft} startNew={params.new === "1"} preview={mode === "preview" ? "Records are saved in this browser only, not shared with other people or devices." : undefined} />
  ));
}
