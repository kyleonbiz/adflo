"use client";

import { useState } from "react";
import { Database } from "lucide-react";
import { useToday } from "@/components/modules/use-today";
import { Button } from "@/components/ui/button";
import { useStoredRecords, type RecordKind } from "@/lib/records/storage";
import { SAMPLE_SETS, type SampleSetId } from "@/lib/samples/data";
import { clearAllRecords, loadSample, useLoadedSample } from "@/lib/samples/storage";

const KINDS: RecordKind[] = ["invoices", "licenses", "vendors", "contacts", "projects"];

/** True when any service has saved records of its own (a record count of zero after deleting everything does not count). */
function useHasSavedRecords(): boolean {
  const lists = [
    useStoredRecords<unknown>(KINDS[0]!), useStoredRecords<unknown>(KINDS[1]!), useStoredRecords<unknown>(KINDS[2]!),
    useStoredRecords<unknown>(KINDS[3]!), useStoredRecords<unknown>(KINDS[4]!),
  ];
  return lists.some((l) => l !== null && l.length > 0);
}

function Picker({ today, hasRecords, heading }: { today: string; hasRecords: boolean; heading: string }) {
  // Loading replaces what is saved, so when there is something to lose it takes a second press.
  const [confirming, setConfirming] = useState<SampleSetId | null>(null);
  return (
    <div>
      <h3 className="text-base font-semibold">{heading}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {SAMPLE_SETS.map((s) => (
          <div key={s.id} className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4" data-testid={`sample-${s.id}`}>
            <div>
              <p className="font-medium">{s.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
            </div>
            {confirming === s.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-amber-700">This replaces the records you have saved.</span>
                <Button size="sm" onClick={() => { loadSample(s.id, today); setConfirming(null); }}>Replace my records</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => (hasRecords ? setConfirming(s.id) : loadSample(s.id, today))}>Load {s.label.toLowerCase()} sample</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The first thing on an empty Dashboard: try AdFlo with sample data, or start blank. Once a sample is loaded it
 * becomes a one-line reminder with a way to clear it. Shows nothing until the browser has answered, so the
 * server's first paint never flashes it.
 */
export function SampleDataBanner() {
  const today = useToday();
  const loaded = useLoadedSample();
  const hasRecords = useHasSavedRecords();
  if (!today) return null;
  if (loaded) {
    const label = SAMPLE_SETS.find((s) => s.id === loaded)?.label ?? "Sample";
    return (
      <div role="note" data-testid="sample-loaded" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
        <span>You are looking at sample data ({label.toLowerCase()}). Nothing here is real.</span>
        <Button size="sm" variant="outline" onClick={clearAllRecords}>Clear sample data</Button>
      </div>
    );
  }
  if (hasRecords) return null;
  return (
    <section aria-label="Try with sample data" data-testid="sample-picker" className="rounded-2xl border bg-card p-4 shadow-panel">
      <Picker today={today} hasRecords={false} heading="See AdFlo with sample data" />
      <p className="mt-3 text-sm text-muted-foreground">Or start with a blank workspace and add your own records. You can clear sample data any time in Settings.</p>
    </section>
  );
}

/** Settings > Demo data: load either sample set, or clear everything back to a blank start. */
export function DemoDataSection() {
  const today = useToday();
  const loaded = useLoadedSample();
  const hasRecords = useHasSavedRecords();
  const [confirmClear, setConfirmClear] = useState(false);
  if (!today) return null;
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel">
        <Picker today={today} hasRecords={hasRecords} heading="Load sample data" />
        <p className="text-sm text-muted-foreground">Dates in the sample are worked out from today, so some invoices are late and some licenses are close to expiring. It is saved in this browser only.</p>
      </section>
      <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Clear records">
        <h3 className="flex items-center gap-2 text-base font-semibold"><Database className="size-4" aria-hidden /> Start blank</h3>
        <p className="text-sm text-muted-foreground">
          {loaded ? "Removes the sample data from every service." : "Removes every invoice, license, vendor, contact and project saved in this browser."} Documents, forms and settings are not touched.
        </p>
        {confirmClear ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-amber-700">This cannot be undone.</span>
            <Button variant="destructive" onClick={() => { clearAllRecords(); setConfirmClear(false); }}>Yes, clear everything</Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" disabled={!loaded && !hasRecords} onClick={() => setConfirmClear(true)}>{loaded ? "Clear sample data" : "Clear all records"}</Button>
        )}
      </section>
    </div>
  );
}
