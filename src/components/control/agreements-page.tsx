"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { agreementState, type AgreementTemplate, type SentAgreement } from "@/lib/control/types";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
const STATE = { accepted: ["success", "Accepted"], waiting: ["warning", "Waiting"], expired: ["muted", "Expired"] } as const;

export function SentList({ sent, showClient }: { sent: SentAgreement[]; showClient?: boolean }) {
  if (sent.length === 0) return <p className="text-sm text-muted-foreground">Nothing sent yet.</p>;
  return (
    <ul className="divide-y">
      {sent.map((a) => {
        const [variant, label] = STATE[agreementState(a)];
        return (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span className="min-w-0">{showClient && <Link href={`/control/clients/${a.clientId}`} className="font-medium hover:underline">{a.clientName} · </Link>}{a.title} <span className="text-muted-foreground">v{a.version} · sent {day(a.sentAt)}{a.acceptedAt ? ` · accepted by ${a.acceptedName} on ${day(a.acceptedAt)}` : ""}</span></span>
            <Badge variant={variant}>{label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

/** Send an agreement to one client and copy the link. */
export function SendAgreement({ clientId, templates, sent, canEdit }: { clientId: string; templates: AgreementTemplate[]; sent: SentAgreement[]; canEdit: boolean }) {
  const router = useRouter();
  const latest = templates.filter((t) => !templates.some((o) => o.title === t.title && o.version > t.version));
  const [templateId, setTemplateId] = useState(latest[0]?.id ?? "");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setLink(""); setCopied(false);
    try {
      const res = await fetch("/api/control/agreements/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, templateId }) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.link) { setLink(json.link); router.refresh(); } else setError(json?.error?.message ?? "Could not create the link. Try again.");
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Agreements">
      <h2 className="font-semibold">Terms and agreements</h2>
      {canEdit && (latest.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No agreements are published yet. The Owner can add one under Agreements.</p> : (
        <form onSubmit={send} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1.5"><Label htmlFor="ag-template">Agreement</Label><select id="ag-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30">{latest.map((t) => <option key={t.id} value={t.id}>{t.title} (v{t.version})</option>)}</select></div>
          <Button type="submit" variant="outline" disabled={busy || !templateId}>{busy ? "Creating…" : "Create link"}</Button>
        </form>
      ))}
      {link && (
        <div className="mt-3 space-y-2 rounded-xl bg-accent p-3 text-sm">
          <p className="font-medium">Send this link to the client. It is shown only once and works for 30 days.</p>
          <div className="flex flex-wrap items-center gap-2"><Input readOnly aria-label="Agreement link" value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 font-mono text-xs" /><Button type="button" size="sm" onClick={copy}>{copied ? "Copied" : "Copy"}</Button></div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-4"><SentList sent={sent} /></div>
    </section>
  );
}

/** The Agreements screen: published versions, publishing (Owner), and everything sent. */
export function AgreementsPage({ templates, sent, canPublish, sample }: { templates: AgreementTemplate[]; sent: SentAgreement[]; canPublish: boolean; sample?: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ title: "", body: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function publish(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrors({}); setMessage("");
    try {
      const res = await fetch("/api/control/agreements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json().catch(() => null);
      if (res.ok) { setF({ title: "", body: "" }); router.refresh(); } else { setErrors(json?.error?.fields ?? {}); setMessage(json?.error?.message ?? "Could not save. Try again."); }
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold tracking-tight">Agreements</h1><p className="text-sm text-muted-foreground">Terms and agreements you send to clients. A change is a new version; published versions never change.</p></div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview with sample agreements.</p>}
      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Published">
        <h2 className="font-semibold">Published</h2>
        {templates.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing published yet.</p> : (
          <ul className="mt-2 divide-y">{templates.map((t) => (<li key={t.id} className="py-2.5 text-sm"><details><summary className="cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-medium">{t.title}</span> <span className="text-muted-foreground">v{t.version} · {day(t.createdAt)}</span></summary><p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{t.body}</p></details></li>))}</ul>
        )}
      </section>
      {canPublish && !sample && (
        <form onSubmit={publish} className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel" noValidate>
          <h2 className="font-semibold">Publish an agreement or a new version</h2>
          <p className="text-xs text-muted-foreground">Use the same title as an existing agreement to publish its next version.</p>
          <div className="space-y-1.5"><Label htmlFor="ap-title">Title</Label><Input id="ap-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-invalid={!!errors.title} />{errors.title && <p role="alert" className="text-xs text-destructive">{errors.title}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="ap-body">Text</Label><textarea id="ap-body" rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />{errors.body && <p role="alert" className="text-xs text-destructive">{errors.body}</p>}</div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish"}</Button>
        </form>
      )}
      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Sent"><h2 className="mb-2 font-semibold">Sent to clients</h2><SentList sent={sent} showClient /></section>
    </div>
  );
}
