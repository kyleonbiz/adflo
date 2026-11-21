"use client";

import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import type { DmsApi } from "@/lib/dms/client/api";
import { daysUntil, formatDate } from "./format";

const SOON_DAYS = 60;

/** Documents whose expiration date has passed or is within 60 days, read from the workspace (up to 1,000 documents). Shows nothing when there are none. */
export function ExpiringDocuments({ api, version, onOpen }: { api: DmsApi; version: number; onOpen: (id: string) => void }) {
  const [docs, setDocs] = useState<{ id: string; name: string; expiresAt: string; days: number }[]>([]);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const found: typeof docs = [];
        for (let page = 1; page <= 10; page++) {
          const r = await api.listDocuments({ view: "all", folderId: null, search: "", category: null, fileType: null, tag: null, sort: "newest", page, pageSize: 100 });
          for (const d of r.items) {
            if (!d.expiresAt) continue;
            const days = daysUntil(d.expiresAt);
            if (days <= SOON_DAYS) found.push({ id: d.id, name: d.displayName, expiresAt: d.expiresAt, days });
          }
          if (page * r.pageSize >= r.total) break;
        }
        if (!off) setDocs(found.sort((a, b) => a.days - b.days));
      } catch { /* the page works without this list */ }
    })();
    return () => { off = true; };
  }, [api, version]);

  if (docs.length === 0) return null;
  return (
    <section aria-labelledby="expiring-docs-heading" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950" data-testid="expiring-documents">
      <h3 id="expiring-docs-heading" className="flex items-center gap-2 text-sm font-semibold"><AlarmClock className="size-4" aria-hidden /> Expiring documents ({docs.length})</h3>
      <ul className="mt-2 divide-y divide-amber-200 text-sm">
        {docs.slice(0, 6).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <button type="button" onClick={() => onOpen(d.id)} className="min-w-0 truncate rounded text-left font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring">{d.name}</button>
            <span className="text-xs">{d.days < 0 ? `Expired ${formatDate(d.expiresAt)}` : d.days === 0 ? "Expires today" : `Expires ${formatDate(d.expiresAt)} (${d.days} day${d.days === 1 ? "" : "s"})`}</span>
          </li>
        ))}
      </ul>
      {docs.length > 6 && <p className="mt-1 text-xs">and {docs.length - 6} more. Open a document to change its expiration date.</p>}
    </section>
  );
}
