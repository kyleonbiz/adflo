import type { Metadata } from "next";
import { Appearance } from "@/components/settings/appearance";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Appearance · Control Center" };
export const dynamic = "force-dynamic";

export default function AppearanceRoute() {
  return renderControlShell("/control/appearance", () => (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
        <p className="text-sm text-muted-foreground">Choose a bright Day view or a darker Night view. The Control Center starts in Day. Your choice is saved in this browser and also applies to the AdFlo app.</p>
      </div>
      <div className="max-w-xl"><Appearance /></div>
    </div>
  ));
}
