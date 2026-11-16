"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GUIDE } from "@/lib/control/onboarding-guide";
import { CHECKLIST_STEPS, type ChecklistStep, type ClientRecord } from "@/lib/control/types";
import { cn } from "@/lib/utils";

const firstUndone = (done: string[], after?: ChecklistStep): ChecklistStep | null => {
  const from = after ? CHECKLIST_STEPS.findIndex((s) => s.key === after) + 1 : 0;
  const ordered = [...CHECKLIST_STEPS.slice(from), ...CHECKLIST_STEPS.slice(0, from)];
  return ordered.find((s) => !done.includes(s.key))?.key ?? null;
};

/** How to onboard a client, step by step. Each step says how to do it, links to the right place, and is ticked off here. */
export function OnboardingGuide({ client, canEdit, onEdit }: { client: ClientRecord; canEdit: boolean; onEdit: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState<ChecklistStep | null>(() => firstUndone(client.checklist));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const total = CHECKLIST_STEPS.length;
  const done = CHECKLIST_STEPS.filter((s) => client.checklist.includes(s.key)).length;
  const next = firstUndone(client.checklist);

  async function toggle(step: ChecklistStep, on: boolean) {
    setBusy(step); setError("");
    try {
      const res = await fetch(`/api/control/clients/${client.id}/checklist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step, done: on }) });
      if (!res.ok) { setError((await res.json().catch(() => null))?.error?.message ?? "Could not save that step."); return; }
      // Ticking a step moves you on to the next one that is still to do.
      if (on) setOpen(firstUndone([...client.checklist, step], step));
      router.refresh();
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(null); }
  }

  return (
    <section id="onboarding" className="scroll-mt-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Onboarding">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Onboarding guide</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{done} of {total} done</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Work down the steps. Open one to see how to do it, and tick it off when it is done.</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(done / total) * 100}%` }} /></div>

      <ol className="mt-4 divide-y rounded-xl border">
        {CHECKLIST_STEPS.map((s, i) => {
          const on = client.checklist.includes(s.key);
          const isOpen = open === s.key;
          const g = GUIDE[s.key];
          return (
            <li key={s.key} className="px-3 py-2.5">
              <div className="flex items-start gap-3">
                <button type="button" role="checkbox" aria-checked={on} aria-label={`${s.label}: mark ${on ? "not done" : "done"}`} disabled={!canEdit || busy === s.key} onClick={() => toggle(s.key, !on)}
                  className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default", on ? "border-emerald-500 bg-emerald-500 text-white" : "border-input bg-card enabled:hover:border-primary")}>
                  {on && <Check className="size-4" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" aria-expanded={isOpen} aria-controls={`guide-${s.key}`} onClick={() => setOpen(isOpen ? null : s.key)}
                    className="flex w-full items-center justify-between gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="min-w-0">
                      <span className="mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Step {i + 1}</span>
                      <span className={cn("text-sm font-medium", on && "text-muted-foreground line-through")}>{s.label}</span>
                      {next === s.key && !on && <Badge variant="default" className="ml-2 align-middle">Next</Badge>}
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </button>
                  {isOpen && (
                    <div id={`guide-${s.key}`} className="mt-2 space-y-3 pb-1 text-sm">
                      <p className="text-muted-foreground">{g.why}</p>
                      <ol className="list-decimal space-y-1.5 pl-5">{g.how.map((line) => <li key={line}>{line}</li>)}</ol>
                      {g.auto && <p className="flex items-center gap-1.5 text-xs text-emerald-700"><Zap className="size-3.5" aria-hidden /> {g.auto} You can also tick it yourself.</p>}
                      <div className="flex flex-wrap gap-2">
                        {g.actions.map((a) => a.kind === "edit"
                          ? (canEdit ? <Button key={a.label} variant="outline" size="sm" onClick={onEdit}>{a.label}</Button> : null)
                          : a.kind === "jump"
                            ? <Button key={a.label} asChild variant="outline" size="sm"><a href={a.to!(client.id)}>{a.label}</a></Button>
                            : <Button key={a.label} asChild variant="outline" size="sm"><Link href={a.to!(client.id)}>{a.label}</Link></Button>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {done === total && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Every step is done. This client is fully set up.</p>}
    </section>
  );
}
