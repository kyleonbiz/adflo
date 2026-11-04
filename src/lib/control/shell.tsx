import { AppTopBar } from "@/components/app-header";
import { AppFrame } from "@/components/modules/app-frame";
import { controlDemoEnabled, requireStaff, type Staff } from "./gate";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ControlContext = { mode: "live"; staff: Staff; supabase: SupabaseClient } | { mode: "preview" };

/** Every Control Center page renders through this: the staff gate, then the same frame as the app. */
export async function renderControlShell(nextPath: string, content: (ctx: ControlContext) => React.ReactNode | Promise<React.ReactNode>): Promise<React.ReactNode> {
  const access = await requireStaff(nextPath);
  const body = await content(access);
  const topRight = access.mode === "live"
    ? <AppTopBar userLabel={access.staff.name} workspaceName={`Staff · ${access.staff.role}`} />
    : <AppTopBar badge={controlDemoEnabled() ? "Demo · sample data, nothing saved" : "Preview"} />;
  return <AppFrame base="/control" variant="control" topRight={topRight}>{body}</AppFrame>;
}
