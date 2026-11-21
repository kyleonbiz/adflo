"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

/** A set of selected record ids, for the bulk-action bar. */
export function useSelection() {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((id: string) => setIds((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const set = useCallback((all: string[]) => setIds(new Set(all)), []);
  const clear = useCallback(() => setIds(new Set()), []);
  return { ids, toggle, set, clear, has: (id: string) => ids.has(id), size: ids.size };
}

/** The checkbox on a row. */
export function SelectBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox" checked={checked} onChange={onChange} aria-label={label}
      className="size-4 shrink-0 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

/** "3 selected" with the actions that apply to them. Shown only while something is selected. */
export function BulkBar({ count, total, onSelectAll, onClear, children, noun = "selected" }: {
  count: number; total: number; onSelectAll: () => void; onClear: () => void; children: React.ReactNode; noun?: string;
}) {
  if (count === 0) return null;
  return (
    <div role="region" aria-label="Bulk actions" data-testid="bulk-bar" className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm shadow-panel">
      <span className="font-medium" aria-live="polite">{count} {noun}</span>
      {count < total && <Button size="sm" variant="ghost" onClick={onSelectAll}>Select all {total}</Button>}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
    </div>
  );
}
