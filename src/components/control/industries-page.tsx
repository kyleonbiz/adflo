"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { INDUSTRIES, toggleError, type Industry } from "@/lib/setup/types";

/** Which industries are open to new sign-ups. Only the Owner can switch them; everyone else sees the list. */
export function IndustriesPage({ live: initial, canEdit, sample }: { live: Industry[]; canEdit: boolean; sample?: boolean }) {
  const router = useRouter();
  const [live, setLive] = useState<Industry[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function flip(industry: Industry, on: boolean) {
    const problem = toggleError(live, industry, on);
    if (problem) { setMessage(problem); return; }
    setBusy(industry); setMessage("");
    try {
      const res = await fetch("/api/control/industries", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ industry, live: on }) });
      const json = await res.json().catch(() => null);
      if (res.ok) { setLive(json.data.live); router.refresh(); }
      else setMessage(json?.error?.message ?? "Could not save. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Industries</h1>
        <p className="text-sm text-muted-foreground">
          Every industry is built. Switch one on to offer it to new sign-ups in setup, Settings and Addy; switch it off to stop offering it.
          Accounts already set to an industry keep it either way.
        </p>
      </div>
      {sample && <p role="note" className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Sample view: with a database connected, the Owner can switch industries here.</p>}
      {message && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</p>}
      <ul className="divide-y rounded-2xl border bg-card shadow-panel" aria-label="Industries" data-testid="industry-list">
        {INDUSTRIES.map((i) => {
          const on = live.includes(i);
          return (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3" data-testid="industry-row">
              <span className="flex items-center gap-2 text-sm font-medium">{i}{on && <Badge variant="muted">Open</Badge>}</span>
              <Switch checked={on} disabled={!canEdit || busy !== null} onCheckedChange={(v) => flip(i, v)} aria-label={`${i} open to new sign-ups`} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
