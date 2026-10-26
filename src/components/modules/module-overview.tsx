import { Dashboard } from "@/components/modules/dashboard";
import { SetupStatus } from "@/components/setup/setup-status";

/** The signed-in home: a dashboard of where things stand and what needs attention. Services are reached from the sidebar. */
export function ModuleOverview({ base }: { base: "/app" }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your back office dashboard</h1>
        <p className="text-sm text-muted-foreground">Where things stand today, and what needs you next.</p>
      </div>
      <SetupStatus base={base} />
      <Dashboard base={base} />
    </div>
  );
}
