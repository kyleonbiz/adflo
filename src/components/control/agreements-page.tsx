"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgreementText } from "./agreement-text";
import { agreementState, type AgreementTemplate, type SentAgreement } from "@/lib/control/types";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
const todayUtc = () => new Date().toISOString().slice(0, 10);
const STATE = { accepted: ["success", "Accepted"], waiting: ["warning", "Waiting"], expired: ["muted", "Expired"] } as const;

function SentList({ sent, showClient, canDelete }: { sent: SentAgreement[]; showClient?: boolean; canDelete?: boolean }) {
  if (sent.length === 0) return <p className="text-sm text-muted-foreground">Nothing sent yet.</p>;
  return <ul className="divide-y">{sent.map((a) => <SentRow key={a.id} a={a} showClient={showClient} canDelete={!!canDelete} />)}</ul>;
}

/** One sent agreement. Unless the client accepted it, staff can withdraw it (two-step); its link then stops working. */
function SentRow({ a, showClient, canDelete }: { a: SentAgreement; showClient?: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [variant, label] = STATE[agreementState(a)];
  async function remove() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/control/agreements/sent/${a.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { router.refresh(); return; }
      setError(json?.error?.message ?? "Could not delete it. Try again."); setConfirm(false);
    } catch { setError("Could not reach the server. Try again."); setConfirm(false); } finally { setBusy(false); }
  }
  return (
    <li className="py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">{showClient && <Link href={`/control/clients/${a.clientId}`} className="font-medium hover:underline">{a.clientName} · </Link>}{a.title} <span className="text-muted-foreground">v{a.version} · sent {day(a.sentAt)}{a.acceptedAt ? ` · accepted by ${a.acceptedName} on ${day(a.acceptedAt)}` : ""}</span></span>
        <span className="flex items-center gap-2">
          <Badge variant={variant}>{label}</Badge>
          {canDelete && !a.acceptedAt && !confirm && <Button type="button" variant="ghost" size="sm" onClick={() => { setConfirm(true); setError(""); }} aria-label={`Delete ${a.title} version ${a.version} sent ${day(a.sentAt)}`}>Delete</Button>}
        </span>
      </div>
      {confirm && (
        <p className="mt-2 flex flex-wrap items-center gap-2">Delete this sent agreement? Its link stops working. The agreement itself stays published.
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete it"}</Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirm(false)}>Keep</Button></p>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </li>
  );
}

/** Send an agreement to one client and copy the link. */
export function SendAgreement({ clientId, templates, sent, canEdit, ownerEmail = "" }: { clientId: string; templates: AgreementTemplate[]; sent: SentAgreement[]; canEdit: boolean; ownerEmail?: string }) {
  const router = useRouter();
  const latest = templates.filter((t) => !templates.some((o) => o.title === t.title && o.version > t.version));
  const [templateId, setTemplateId] = useState(latest[0]?.id ?? "");
  const [link, setLink] = useState("");
  const [links, setLinks] = useState<{ id: string; title: string; link: string }[]>([]);
  const [copiedId, setCopiedId] = useState("");
  const [emailIt, setEmailIt] = useState(!!ownerEmail);
  const [emailNote, setEmailNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setLink(""); setLinks([]); setCopied(false); setEmailNote("");
    try {
      const res = await fetch("/api/control/agreements/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, templateId, email: emailIt && !!ownerEmail }) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.link) { setLink(json.link); setEmailNote(json.emailedTo ? `Emailed to ${json.emailedTo} from onboarding@adflo.pro.` : json.emailError ?? ""); router.refresh(); } else setError(json?.error?.message ?? "Could not create the link. Try again.");
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  async function sendAll() {
    setBusy(true); setError(""); setLink(""); setLinks([]); setCopiedId(""); setEmailNote("");
    try {
      const res = await fetch("/api/control/agreements/send-all", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, templateIds: latest.map((t) => t.id), email: emailIt && !!ownerEmail }) });
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.items)) { setLinks(json.items); setEmailNote(json.emailedTo ? `Emailed to ${json.emailedTo} from onboarding@adflo.pro.` : json.emailError ?? ""); router.refresh(); } else setError(json?.error?.message ?? "Could not create the links. Try again.");
    } catch { setError("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  async function copyOne(id: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopiedId(id); } catch { setCopiedId(""); }
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
          {ownerEmail && <label className="flex w-full items-center gap-2 text-sm"><input type="checkbox" checked={emailIt} onChange={(e) => setEmailIt(e.target.checked)} /> Also email it to {ownerEmail} from onboarding@adflo.pro</label>}
          <Button type="submit" variant="outline" disabled={busy || !templateId}>{busy ? "Working…" : emailIt && ownerEmail ? "Create link and email it" : "Create link"}</Button>
          {latest.length >= 2 && <Button type="button" disabled={busy} onClick={sendAll}>{busy ? "Working…" : emailIt && ownerEmail ? `Send all ${latest.length} in one email` : `Create all ${latest.length} links`}</Button>}
        </form>
      ))}
      {link && (
        <div className="mt-3 space-y-2 rounded-xl bg-accent p-3 text-sm">
          <p className="font-medium">{emailNote.startsWith("Emailed") ? "The client has the link by email. You can also copy it here." : "Send this link to the client."} It is shown only once and works for 30 days.</p>
          {emailNote && <p role="status" className="text-muted-foreground">{emailNote}</p>}
          <div className="flex flex-wrap items-center gap-2"><Input readOnly aria-label="Agreement link" value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 font-mono text-xs" /><Button type="button" size="sm" onClick={copy}>{copied ? "Copied" : "Copy"}</Button></div>
        </div>
      )}
      {links.length > 0 && (
        <div className="mt-3 space-y-2 rounded-xl bg-accent p-3 text-sm">
          <p className="font-medium">{emailNote.startsWith("Emailed") ? "The client has the links by email. You can also copy them here." : "Send these links to the client."} They are shown only once and work for 30 days.</p>
          {emailNote && <p role="status" className="text-muted-foreground">{emailNote}</p>}
          {links.map((l) => (
            <div key={l.id} className="space-y-1">
              <span className="text-xs font-medium">{l.title}</span>
              <div className="flex flex-wrap items-center gap-2"><Input readOnly aria-label={`${l.title} link`} value={l.link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 font-mono text-xs" /><Button type="button" size="sm" onClick={() => copyOne(l.id, l.link)}>{copiedId === l.id ? "Copied" : "Copy"}</Button></div>
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-4"><SentList sent={sent} canDelete={canEdit} /></div>
    </section>
  );
}

/** One published version, with its text and (Owner) a two-step delete. */
function TemplateRow({ t, canDelete }: { t: AgreementTemplate; canDelete: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/control/agreements/${t.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { router.refresh(); return; }
      setError(json?.error?.message ?? "Could not delete it. Try again."); setConfirm(false);
    } catch { setError("Could not reach the server. Try again."); setConfirm(false); } finally { setBusy(false); }
  }
  return (
    <li className="py-2.5 text-sm">
      <details>
        <summary className="cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-medium">{t.title}</span> <span className="text-muted-foreground">v{t.version} · effective {day(t.effectiveDate)}</span></summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-muted p-3"><AgreementText body={t.body} /></div>
      </details>
      {canDelete && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!confirm ? <Button type="button" variant="ghost" size="sm" onClick={() => { setConfirm(true); setError(""); }} aria-label={`Delete ${t.title} version ${t.version}`}>Delete</Button> : (
            <span className="flex flex-wrap items-center gap-2 text-sm">Delete {t.title} v{t.version}? This cannot be undone. Links sent from it that nobody has accepted stop working.
              <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete it"}</Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirm(false)}>Keep</Button></span>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </li>
  );
}

/** The Agreements screen: published versions, publishing (Owner), and everything sent. */
export function AgreementsPage({ templates, sent, canPublish, sample }: { templates: AgreementTemplate[]; sent: SentAgreement[]; canPublish: boolean; sample?: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ title: "", body: "", effectiveDate: todayUtc() });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function publish(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrors({}); setMessage("");
    try {
      const res = await fetch("/api/control/agreements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json().catch(() => null);
      if (res.ok) { setF({ title: "", body: "", effectiveDate: todayUtc() }); router.refresh(); } else { setErrors(json?.error?.fields ?? {}); setMessage(json?.error?.message ?? "Could not save. Try again."); }
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold tracking-tight">Agreements</h1><p className="text-sm text-muted-foreground">Terms and agreements you send to clients. A change is a new version; published versions never change.</p></div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview with sample agreements.</p>}
      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Published">
        <h2 className="font-semibold">Published</h2>
        {templates.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing published yet.</p> : (
          <ul className="mt-2 divide-y">{templates.map((t) => <TemplateRow key={t.id} t={t} canDelete={canPublish && !sample} />)}</ul>
        )}
      </section>
      {canPublish && !sample && (
        <form onSubmit={publish} className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel" noValidate>
          <h2 className="font-semibold">Publish an agreement or a new version</h2>
          <p className="text-xs text-muted-foreground">Use the same title as an existing agreement to publish its next version.</p>
          <div className="space-y-1.5"><Label htmlFor="ap-title">Title</Label><Input id="ap-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-invalid={!!errors.title} />{errors.title && <p role="alert" className="text-xs text-destructive">{errors.title}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="ap-date">Effective date</Label><Input id="ap-date" type="date" value={f.effectiveDate} onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} aria-invalid={!!errors.effectiveDate} className="sm:max-w-48" />{errors.effectiveDate && <p role="alert" className="text-xs text-destructive">{errors.effectiveDate}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="ap-body">Text</Label><p className="text-xs text-muted-foreground">Formatting: # Heading, ## Subheading, - bullet, 1. numbered item. Leave a blank line between paragraphs.</p><textarea id="ap-body" rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />{errors.body && <p role="alert" className="text-xs text-destructive">{errors.body}</p>}</div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish"}</Button>
        </form>
      )}
      <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-label="Sent"><h2 className="mb-2 font-semibold">Sent to clients</h2><SentList sent={sent} showClient /></section>
    </div>
  );
}
