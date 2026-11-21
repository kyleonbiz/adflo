import type { Metadata } from "next";
import { EquipmentPage } from "@/components/equipment/equipment-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Equipment" };
export const dynamic = "force-dynamic";

export default function EquipmentRoute() {
  return renderAppShell("/app/equipment", (mode) => (
    <EquipmentPage preview={mode === "preview" ? "Records are saved in this browser only, not shared with other people or devices." : undefined} />
  ));
}
