"use client";

import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordsInDatabase } from "@/lib/records/storage";

type Api = { ok: true; data: { on?: boolean; createdAt?: string | null; url?: string } } | { ok: false; error: { message: string } };

async function call(method: "GET" | "POST" | "DELETE"): Promise<Api> {
  try {
    const res = await fetch("/api/calendar/feed", { method, headers: { accept: "application/json" } });
    return (await res.json()) as Api;
  } catch {
    return { ok: false, error: { message: "Could not reach AdFlo. Check your connection and try again." } };
  }
}

/**
 * "Add to your own calendar": a private link that Google, Apple or Outlook Calendar subscribe to, so due dates, expiries and tasks
 * show there and stay current. The link is shown once when it is made (only a hash is kept), and replacing it cuts off the old one.
 */
export function CalendarFeedCard() {
  const inDatabase = useRecordsInDatabase();
  const [on, setOn] = useState<boolean | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inDatabase) return;
    let live = true;
    void call("GET").then((r) => { if (live) setOn(r.ok ? r.data.on === true : false); });
    return () => { live = false; };
  }, [inDatabase]);

  if (!inDatabase) return null;

  const make = async () => {
    setBusy(true); setError(""); setCopied(false);
    const r = await call("POST");
    setBusy(false);
    if (r.ok && r.data.url) { setUrl(r.data.url); setOn(true); } else setError(r.ok ? "Could not make the link." : r.error.message);
  };
  const turnOff = async () => {
    setBusy(true); setError("");
    const r = await call("DELETE");
    setBusy(false);
    if (r.ok) { setUrl(null); setOn(false); } else setError(r.error.message);
  };
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setError("Could not copy. Select the link and copy it by hand."); }
  };

  return (
    <section aria-label="Add to your own calendar" className="space-y-3 rounded-2xl border bg-card p-4 shadow-panel">
      <div className="flex items-start gap-3">
        <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Add to your own calendar</h2>
          <p className="text-sm text-muted-foreground">Get a private link, add it to Google, Apple or Outlook Calendar once, and your due dates, expiries and tasks appear there and stay current.</p>
        </div>
      </div>

      {url && (
        <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
          <p className="text-xs font-medium">Your calendar link. Copy it now: it is not shown again.</p>
          <div className="flex gap-2">
            <input readOnly value={url} aria-label="Calendar link" onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={copy}><Copy /> {copied ? "Copied" : "Copy"}</Button>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li><strong className="font-medium text-foreground">Google Calendar:</strong> Other calendars, From URL, paste the link.</li>
            <li><strong className="font-medium text-foreground">Apple Calendar:</strong> File, New Calendar Subscription, paste the link.</li>
            <li><strong className="font-medium text-foreground">Outlook:</strong> Add calendar, Subscribe from web, paste the link.</li>
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Anyone with the link can read the titles on this calendar, including customer names. Share it only with yourself and your team. Replace the link to cut off the old one. Calendar apps refresh it every few hours.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {on === null ? null : on ? (
          <>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={make}>Replace the link</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={turnOff}>Turn off</Button>
          </>
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={make}>Get my calendar link</Button>
        )}
      </div>
    </section>
  );
}
