/** A saved record: the services all give their records a string `id`. */
export type Rec = { id: string } & Record<string, unknown>;

const savable = (r: unknown): r is Rec => !!r && typeof r === "object" && typeof (r as Rec).id === "string" && (r as Rec).id.length > 0 && (r as Rec).id.length <= 80;

/** What to write so the saved copy matches `next`: records that are new or changed, and the ids that are gone. */
export function diffRecords(prev: readonly unknown[] | null, next: readonly unknown[]): { upserts: Rec[]; deletes: string[] } {
  const before = new Map<string, string>();
  for (const r of prev ?? []) if (savable(r)) before.set(r.id, JSON.stringify(r));
  const upserts: Rec[] = [];
  const seen = new Set<string>();
  for (const r of next) {
    if (!savable(r)) continue; // a record with no usable id cannot be stored
    seen.add(r.id);
    if (before.get(r.id) !== JSON.stringify(r)) upserts.push(r);
  }
  const deletes = [...before.keys()].filter((id) => !seen.has(id));
  return { upserts, deletes };
}

export const sameRecords = (a: readonly unknown[] | null, b: readonly unknown[] | null): boolean =>
  a === b || (a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b));
