"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import type { DmsApi } from "@/lib/dms/client/api";
import type { DocumentRecord } from "@/lib/dms/types";
import { formatDayShort } from "@/lib/dates";

/** "Looks like a copy of ...": other documents with the same size and name, so a file uploaded twice is noticed. Nothing is removed. */
export function DuplicateNote({ doc, api, onOpen }: { doc: DocumentRecord; api: DmsApi; onOpen: (id: string) => void }) {
  const key = `${doc.id}:${doc.currentVersion}`;
  const [found, setFound] = useState<{ key: string; list: DocumentRecord[] } | null>(null);
  useEffect(() => {
    let live = true;
    api.findDuplicates(doc.id).then((list) => live && setFound({ key, list })).catch(() => undefined);
    return () => { live = false; };
  }, [api, doc.id, key]);
  const list = found?.key === key ? found.list : [];
  if (list.length === 0) return null;
  return (
    <section aria-label="Possible duplicates" data-testid="duplicate-note" className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-2 text-sm font-medium"><Copy className="size-4 shrink-0 text-amber-600" aria-hidden /> Looks like a copy of {list.length === 1 ? "another file" : `${list.length} other files`}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {list.map((d) => (
          <li key={d.id}><button type="button" onClick={() => onOpen(d.id)} className="rounded text-left font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{d.displayName}</button> <span className="text-xs text-muted-foreground">added {formatDayShort(d.createdAt.slice(0, 10))}{d.deletedAt ? " (in trash)" : ""}</span></li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Same size and name. Delete the one you do not need; nothing is removed automatically.</p>
    </section>
  );
}
