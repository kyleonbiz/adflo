"use client";

import { useEffect, useState } from "react";
import { Meter } from "@/components/control/client-usage";
import type { Usage } from "@/lib/control/usage";

interface Data {
  plan: string | null; usage: Usage;
  seats: { used: number; limit: number | null } | null;
  storage: { usedBytes: number; quotaBytes: number } | null;
  limits: { aiActions: number; ocrPerMonth: number; tokenBackstop: number | null } | null;
}

const gb = (bytes: number) => Math.round((bytes / 1_073_741_824) * 10) / 10;

/** The workspace's own usage this month: seats, storage, Claude actions and photo reads. Hidden when it cannot be read (the preview, or signed out). */
export function UsagePanel() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/usage").then(async (res) => {
      const body = await res.json().catch(() => null);
      if (live && res.ok && body?.ok) setData(body.data as Data);
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!data) return null;
  const { usage, limits, seats, storage } = data;
  return (
    <section aria-label="Your usage" className="rounded-2xl border bg-card p-6 shadow-panel">
      <h2 className="text-base font-semibold">Your usage</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Claude actions and photo reads reset on the 1st of each month (UTC). Quick actions are unlimited.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {seats && <Meter label="Seats (including invites waiting)" used={seats.used} limit={seats.limit} />}
        {storage && storage.quotaBytes > 0 && <Meter label="Storage (GB)" used={gb(storage.usedBytes)} limit={gb(storage.quotaBytes)} />}
        <Meter label="Claude actions this month" used={usage.aiActions} limit={limits?.aiActions ?? null} />
        <Meter label="Photo reads (OCR) this month" used={usage.ocrReads} limit={limits?.ocrPerMonth ?? null} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Need more seats, storage or Claude actions? Use Manage billing above to add seats, or email support@adflo.pro.</p>
    </section>
  );
}
