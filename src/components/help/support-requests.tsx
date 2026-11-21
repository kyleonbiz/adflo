"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MyRequest { id: string; subject: string; body: string; status: "open" | "pending" | "closed"; createdAt: string; replies: number }
interface Message { id: string; fromClient: boolean; author: string; body: string; createdAt: string }

const STATUS_TEXT = { open: "With AdFlo support", pending: "Waiting on you", closed: "Closed" } as const;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
const FIELD = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

async function call(url: string, body?: unknown) {
  const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json };
}

/** Ask AdFlo support for help, see where each request stands, and answer back, all inside the app. */
export function SupportRequests({ requests }: { requests: MyRequest[] }) {
  const router = useRouter();
  const [f, setF] = useState({ subject: "", body: "", urgent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrors({}); setMessage(""); setSent(false);
    try {
      const { ok, json } = await call("/api/support/tickets", f);
      if (ok) { setF({ subject: "", body: "", urgent: false }); setSent(true); router.refresh(); return; }
      setErrors(json?.error?.fields ?? {}); setMessage(json?.error?.message ?? "Could not send. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(false); }
  }

  return (
    <>
      <section aria-label="Contact support" className="rounded-2xl border bg-card p-6 shadow-panel">
        <h2 className="text-base font-semibold">Contact support</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tell us what you need. We reply by email within one business day (weekdays, 9am to 5pm Eastern), and the conversation stays here.</p>
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="support-subject">Subject</Label>
            <Input id="support-subject" value={f.subject} maxLength={200} onChange={(e) => setF({ ...f, subject: e.target.value })} aria-invalid={!!errors.subject} aria-describedby={errors.subject ? "support-subject-err" : undefined} />
            {errors.subject && <p id="support-subject-err" className="text-xs text-destructive">{errors.subject}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-body">What do you need help with?</Label>
            <textarea id="support-body" rows={5} value={f.body} maxLength={5000} onChange={(e) => setF({ ...f, body: e.target.value })} className={FIELD} aria-invalid={!!errors.body} aria-describedby={errors.body ? "support-body-err" : undefined} />
            {errors.body && <p id="support-body-err" className="text-xs text-destructive">{errors.body}</p>}
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={f.urgent} onChange={(e) => setF({ ...f, urgent: e.target.checked })} /><span>This is urgent <span className="text-muted-foreground">(you cannot sign in, or your records look wrong or missing)</span></span></label>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
          {sent && <p role="status" className="text-sm text-emerald-700">Sent. We will reply by email, and you can follow it below.</p>}
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        </form>
      </section>

      <section aria-label="Your requests" className="rounded-2xl border bg-card p-6 shadow-panel">
        <h2 className="text-base font-semibold">Your requests</h2>
        {requests.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing yet. Requests you send show up here with our replies.</p> : (
          <ul className="mt-3 divide-y">{requests.map((r) => <RequestRow key={r.id} r={r} />)}</ul>
        )}
      </section>
    </>
  );
}

function RequestRow({ r }: { r: MyRequest }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { ok, json } = await call(`/api/support/tickets/${r.id}`);
    if (ok) setMessages(json.messages); else setError(json?.error?.message ?? "Could not load the conversation.");
  }
  async function toggle() {
    const next = !open; setOpen(next);
    if (next && !messages) { try { await load(); } catch { setError("Could not reach the server. Try again."); } }
  }
  async function reply(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const { ok, json } = await call(`/api/support/tickets/${r.id}/reply`, { body: text });
      if (ok) { setText(""); await load(); router.refresh(); } else setError(json?.error?.message ?? "Could not send. Try again.");
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(false); }
  }

  return (
    <li className="py-3">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0"><span className="block truncate text-sm font-medium">{r.subject}</span><span className="block text-xs text-muted-foreground">Sent {day(r.createdAt)}{r.replies > 0 ? ` · ${r.replies} ${r.replies === 1 ? "reply" : "replies"} from AdFlo` : ""}</span></span>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${r.status === "pending" ? "border-amber-300 bg-amber-50 text-amber-900" : "text-muted-foreground"}`}>{STATUS_TEXT[r.status]}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3">{r.body}</p>
          {messages?.map((m) => (
            <div key={m.id} className={`rounded-xl border p-3 ${m.fromClient ? "bg-card" : "border-primary/30 bg-accent"}`}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{m.author} · {day(m.createdAt)}</p>
            </div>
          ))}
          <form onSubmit={reply} className="space-y-2">
            <label htmlFor={`reply-${r.id}`} className="sr-only">Your message</label>
            <textarea id={`reply-${r.id}`} rows={3} value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder={r.status === "closed" ? "Write here to reopen this request" : "Write a message"} className={FIELD} />
            <Button type="submit" size="sm" disabled={busy || !text.trim()}>Send message</Button>
          </form>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </li>
  );
}
