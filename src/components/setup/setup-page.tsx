"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, CircleX, ExternalLink, Rocket, Sparkles } from "lucide-react";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { AVAILABLE_MODULE_IDS, IMPORTABLE, canFinish, recommendModules, runSetupChecks, setupScore } from "@/lib/setup/logic";
import { clearConfig, saveConfig, useSetupConfig } from "@/lib/setup/storage";
import { TEMPLATES, templateById, templatesFor } from "@/lib/setup/templates";
import { INDUSTRIES, STEPS, TEAM_SIZES, emptyConfig, type CheckStatus, type Industry, type SetupConfig, type TeamSize } from "@/lib/setup/types";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/text";

const STATUS_ICON: Record<CheckStatus, typeof CheckCircle2> = { pass: CheckCircle2, warn: CircleAlert, fail: CircleX };
const STATUS_TONE: Record<CheckStatus, string> = { pass: "text-emerald-600", warn: "text-amber-600", fail: "text-red-600" };
const KIND_LABEL = { form: "Form", routine: "Recurring task", license: "License records" } as const;

const moduleName = (id: string) => MODULES.find((m) => m.id === id)?.name ?? id;
const moduleSummary = (id: string) => MODULES.find((m) => m.id === id)?.summary ?? "";

function Wizard({ initial, today, base }: { initial: SetupConfig; today: string; base: "/app" }) {
  const [config, setConfig] = useState<SetupConfig>(initial);

  /** Every change is saved straight away, so leaving to import data and coming back loses nothing. */
  const update = (change: (c: SetupConfig) => SetupConfig) => {
    const next = change(config);
    setConfig(next);
    saveConfig(next);
  };
  const goTo = (step: number) => update((c) => ({ ...c, step }));

  const recs = recommendModules(config.business.industry, config.business.teamSize);
  const recById = new Map(recs.map((r) => [r.id, r.reason]));
  const checks = runSetupChecks(config);
  const score = setupScore(checks);
  const chosen = config.modules;
  const profileDone = config.business.name.trim().length >= 2 && config.business.industry !== "" && config.business.teamSize !== "";
  const done = config.completedOn !== null;

  const next = () => {
    update((c) => {
      let n = { ...c, step: Math.min(4, c.step + 1), completedOn: null };
      // Entering Modules for the first time: start from the recommendations.
      if (c.step === 0 && c.modules.length === 0) n = { ...n, modules: recs.map((r) => r.id) };
      // Entering Templates: drop templates of modules that were switched off; install all if none chosen yet.
      if (c.step === 1) {
        const kept = c.templates.filter((id) => c.modules.includes(templateById(id)?.module ?? ""));
        n = { ...n, templates: kept.length > 0 ? kept : TEMPLATES.filter((t) => c.modules.includes(t.module)).map((t) => t.id) };
      }
      return n;
    });
  };
  const toggle = (list: "modules" | "templates" | "importsDone", id: string) =>
    update((c) => ({ ...c, completedOn: null, [list]: c[list].includes(id) ? c[list].filter((x) => x !== id) : [...c[list], id] }));

  if (done) {
    const installed = config.templates.map(templateById).filter((t) => t !== undefined);
    return (
      <section aria-label="Setup complete" className="space-y-4 rounded-2xl border bg-card p-6 shadow-panel" data-testid="setup-complete">
        <div className="flex items-start gap-3">
          <Rocket className="mt-1 size-6 text-primary" aria-hidden />
          <div>
            <h2 className="text-xl font-semibold">{config.business.name.trim()} is set up</h2>
            <p className="text-sm text-muted-foreground">{chosen.length} services, {installed.length} templates installed, {score}% of setup checks passed.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={Rocket} label="Services" value={chosen.length} tone="text-primary" />
          <SummaryTile icon={Sparkles} label="Templates installed" value={installed.length} tone="text-sky-600" />
          <SummaryTile icon={CheckCircle2} label="Checks passed" value={`${score}%`} tone="text-emerald-600" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Your services</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {chosen.map((id) => {
              const m = MODULES.find((x) => x.id === id);
              const href = m ? moduleHref(m, base) : null;
              return href ? <li key={id}><Link href={href} className="inline-flex h-9 items-center rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted">{moduleName(id)}</Link></li> : null;
            })}
          </ul>
        </div>
        {installed.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Installed</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground" data-testid="installed-list">
              {installed.map((t) => <li key={t.id}>{t.name} ({KIND_LABEL[t.kind]}, in {moduleName(t.module)})</li>)}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Saved in this browser until the database is connected. Installed templates now show up inside their services. Editing the setup takes it back to a draft until you finish it again.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => update((c) => ({ ...c, step: 0, completedOn: null }))}>Edit setup</Button>
          <Button variant="ghost" onClick={() => { clearConfig(); setConfig(emptyConfig()); }}>Start over</Button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="Setup steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === config.step ? "step" : undefined}
              className={cn("flex h-9 items-center gap-2 rounded-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === config.step ? "border-primary bg-accent font-medium text-primary" : "bg-card text-muted-foreground hover:text-foreground")}
            >
              <span className={cn("flex size-5 items-center justify-center rounded-full text-xs", i === config.step ? "bg-primary text-primary-foreground" : "bg-muted")}>{i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <section aria-label={STEPS[config.step]} className="space-y-4 rounded-2xl border bg-card p-5 shadow-panel">
        {config.step === 0 && (
          <>
            <div><h2 className="text-lg font-semibold">Tell us about your business</h2><p className="text-sm text-muted-foreground">We use this to recommend the right services.</p></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="biz-name">Business Name</Label>
                <Input id="biz-name" autoComplete="organization" maxLength={80} value={config.business.name} onChange={(e) => update((c) => ({ ...c, completedOn: null, business: { ...c.business, name: e.target.value } }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-industry">Industry</Label>
                <Select value={config.business.industry || undefined} onValueChange={(v) => update((c) => ({ ...c, completedOn: null, business: { ...c.business, industry: v as Industry } }))}>
                  <SelectTrigger id="biz-industry"><SelectValue placeholder="Choose one" /></SelectTrigger>
                  <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{titleCase(i)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-size">Team Size</Label>
                <Select value={config.business.teamSize || undefined} onValueChange={(v) => update((c) => ({ ...c, completedOn: null, business: { ...c.business, teamSize: v as TeamSize } }))}>
                  <SelectTrigger id="biz-size"><SelectValue placeholder="Choose one" /></SelectTrigger>
                  <SelectContent>{TEAM_SIZES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {config.step === 1 && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h2 className="text-lg font-semibold">Choose your services</h2><p className="text-sm text-muted-foreground">Recommended for {config.business.industry || "your business"}. Change anything.</p></div>
              <Button size="sm" variant="outline" onClick={() => update((c) => ({ ...c, completedOn: null, modules: recs.map((r) => r.id) }))}><Sparkles /> Use recommended</Button>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="module-choices">
              {AVAILABLE_MODULE_IDS.map((id) => (
                <li key={id}>
                  <label className={cn("flex h-full cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-muted/40", chosen.includes(id) && "border-primary/50 bg-accent/40")}>
                    <input type="checkbox" checked={chosen.includes(id)} onChange={() => toggle("modules", id)} aria-label={moduleName(id)} className="mt-1 size-4 shrink-0 rounded border-input accent-primary" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{moduleName(id)}{recById.has(id) && <Badge variant="success">Recommended</Badge>}</span>
                      <span className="block text-xs text-muted-foreground">{recById.get(id) ?? moduleSummary(id)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        {config.step === 2 && (
          <>
            <div><h2 className="text-lg font-semibold">Install templates</h2><p className="text-sm text-muted-foreground">Ready-made forms, recurring tasks and records. They appear inside their services when you finish.</p></div>
            {chosen.length === 0 && <p className="text-sm text-muted-foreground">Choose services first.</p>}
            {chosen.map((id) => {
              const list = templatesFor(id);
              return (
                <div key={id} className="space-y-2" data-testid="template-group">
                  <h3 className="text-sm font-semibold">{moduleName(id)}</h3>
                  {list.length === 0 ? <p className="text-xs text-muted-foreground">Nothing to install. It is ready to use as it is.</p> : (
                    <ul className="space-y-2">
                      {list.map((t) => (
                        <li key={t.id}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm hover:bg-muted/40">
                            <input type="checkbox" checked={config.templates.includes(t.id)} onChange={() => toggle("templates", t.id)} aria-label={t.name} className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary" />
                            <span><span className="flex flex-wrap items-center gap-2 font-medium">{t.name}<Badge variant="muted">{KIND_LABEL[t.kind]}</Badge></span><span className="block text-xs text-muted-foreground">{t.description}</span></span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </>
        )}

        {config.step === 3 && (
          <>
            <div><h2 className="text-lg font-semibold">Bring in your existing data</h2><p className="text-sm text-muted-foreground">Open a service to import, then come back and tick it off. Your setup is saved as you go.</p></div>
            {chosen.filter((id) => IMPORTABLE[id]).length === 0 && <p className="text-sm text-muted-foreground">None of your services have data to bring in.</p>}
            <ul className="space-y-2" data-testid="data-list">
              {chosen.filter((id) => IMPORTABLE[id]).map((id) => {
                const m = MODULES.find((x) => x.id === id)!;
                const href = moduleHref(m, base);
                return (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
                    <span><span className="font-medium">{m.name}</span><span className="block text-xs text-muted-foreground">{IMPORTABLE[id]}</span></span>
                    <span className="flex items-center gap-3">
                      {href && <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open <ExternalLink className="size-3.5" aria-hidden /></Link>}
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={config.importsDone.includes(id)} onChange={() => toggle("importsDone", id)} aria-label={`${m.name} data is done`} className="size-4 rounded border-input accent-primary" /> Done</label>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {config.step === 4 && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h2 className="text-lg font-semibold">Review and finish</h2><p className="text-sm text-muted-foreground">Automatic checks on your setup.</p></div>
              <p className="text-2xl font-semibold tabular-nums" data-testid="score">{score}%</p>
            </div>
            <ul className="divide-y" data-testid="checks">
              {checks.map((c) => {
                const Icon = STATUS_ICON[c.status];
                return (
                  <li key={c.id} className="flex items-start gap-3 py-2.5 text-sm" data-testid="check" data-status={c.status}>
                    <Icon className={cn("mt-0.5 size-4 shrink-0", STATUS_TONE[c.status])} aria-hidden />
                    <span className="min-w-0 flex-1"><span className="font-medium">{c.title}</span><span className="block text-xs text-muted-foreground">{c.detail}</span></span>
                    {c.status !== "pass" && <Button size="sm" variant="ghost" onClick={() => goTo(c.step)} aria-label={`Fix ${c.title}`}>Fix</Button>}
                  </li>
                );
              })}
            </ul>
            {!canFinish(checks) && <p role="alert" className="text-sm text-destructive">Fix the items marked with a cross to finish.</p>}
          </>
        )}
      </section>

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={config.step === 0} onClick={() => goTo(config.step - 1)}><ArrowLeft /> Back</Button>
        {config.step < 4 ? (
          <Button onClick={next} disabled={(config.step === 0 && !profileDone) || (config.step === 1 && chosen.length === 0)}>Next <ArrowRight /></Button>
        ) : (
          <Button disabled={!canFinish(checks)} onClick={() => update((c) => ({ ...c, completedOn: today }))}><Rocket /> Finish setup</Button>
        )}
      </div>
    </div>
  );
}

/**
 * Settings. The choices are saved in this browser (not a database), so nothing leaves the
 * device. Templates installed here appear inside Forms, Admin Support and Licenses once setup is finished.
 */
export function SetupPage({ base, preview }: { base: "/app"; preview?: string }) {
  const today = useToday();
  const stored = useSetupConfig();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Five short steps to get your services, templates and checks in place.</p>
      </div>
      {preview && <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>}
      {!today ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-64" /></div>
      ) : (
        <Wizard initial={stored ?? emptyConfig()} today={today} base={base} />
      )}
    </div>
  );
}
