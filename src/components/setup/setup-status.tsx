"use client";

import Link from "next/link";
import { CheckCircle2, Rocket } from "lucide-react";
import { useToday } from "@/components/modules/use-today";
import { Button } from "@/components/ui/button";
import { runSetupChecks, setupScore } from "@/lib/setup/logic";
import { useSetupConfig } from "@/lib/setup/storage";
import { STEPS } from "@/lib/setup/types";

/** The call to action (or progress) for Back Office Setup, shown above the module list. */
export function SetupStatus({ base }: { base: "/app" | "/demo" }) {
  const ready = useToday() !== null; // the saved setup is only known in the browser
  const config = useSetupConfig();
  if (!ready) return null;

  const started = config && (config.business.name.trim() !== "" || config.modules.length > 0);
  const href = `${base}/setup`;

  if (config?.completedOn) {
    return (
      <section aria-label="Setup status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" data-testid="setup-status" data-state="complete">
        <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-5" aria-hidden /> <span><strong>{config.business.name.trim()}</strong> is set up: {config.modules.length} modules, {setupScore(runSetupChecks(config))}% of checks passed.</span></p>
        <Button asChild size="sm" variant="outline"><Link href={href}>View setup</Link></Button>
      </section>
    );
  }
  return (
    <section aria-label="Setup status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-panel" data-testid="setup-status" data-state={started ? "started" : "new"}>
      <p className="flex items-center gap-2 text-sm"><Rocket className="size-5 text-primary" aria-hidden /> <span>{started ? <>Setup in progress: step {config!.step + 1} of {STEPS.length} ({STEPS[config!.step]}).</> : <><strong>New here?</strong> Set up your back office in five short steps.</>}</span></p>
      <Button asChild size="sm"><Link href={href}>{started ? "Continue setup" : "Start setup"}</Link></Button>
    </section>
  );
}
