"use client";

import { useState } from "react";
import { Download, PenLine, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDayLong } from "@/lib/dates";
import { textToPdf } from "@/lib/forms/pdf";
import { MAX_SIGNERS, parseSigners, sha256Hex, sign, signedCopyText, status, type SigningRequest } from "@/lib/signing/logic";
import { saveRequests, useSigningRequests } from "@/lib/signing/storage";

const textarea = "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";
const rid = () => `sg-${Math.random().toString(36).slice(2, 10)}`;
const STATUS = { waiting: ["Waiting", "muted"], partly: ["Partly signed", "warning"], signed: ["Signed", "success"] } as const;
const MAX_FILE = 10 * 1024 * 1024;

export interface SignableSubmission { id: string; label: string; text: string }

function download(data: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function RequestDialog({ open, onOpenChange, submissions, today, by }: { open: boolean; onOpenChange: (o: boolean) => void; submissions: SignableSubmission[]; today: string; by: string }) {
  const list = useSigningRequests();
  const [source, setSource] = useState<"text" | "submission" | "file">("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [signers, setSigners] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setSource("text"); setTitle(""); setText(""); setSubmissionId(""); setFile(null); setSigners(""); setError(""); };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (name.length < 2) return setError("Give the document a title.");
    const parsed = parseSigners(signers, rid);
    if ("error" in parsed) return setError(parsed.error);
    let body = "";
    let hash = "";
    let fileName: string | undefined;
    setBusy(true);
    try {
      if (source === "text") {
        body = text.trim();
        if (!body) return setError("Write or paste the text to be signed.");
        hash = await sha256Hex(body);
      } else if (source === "submission") {
        const sub = submissions.find((s) => s.id === submissionId);
        if (!sub) return setError("Choose a submission.");
        body = sub.text;
        hash = await sha256Hex(body);
      } else {
        if (!file) return setError("Choose a file.");
        if (file.size > MAX_FILE) return setError("That file is over 10 MB.");
        fileName = file.name;
        hash = await sha256Hex(new Uint8Array(await file.arrayBuffer()));
      }
    } finally { setBusy(false); }
    const request: SigningRequest = { id: rid(), title: name, source, text: body, fileName, hash, signers: parsed.signers, createdOn: today, createdBy: by };
    saveRequests([request, ...list]);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Request signatures</DialogTitle>
        <DialogDescription className="mt-1">Choose what needs signing and who signs it. Each signer types their name and agrees; the signed copy carries a fingerprint of the document. This is not a certified e-signature service; use one where the law or the other party requires it.</DialogDescription>
        <form onSubmit={create} noValidate className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sign-title">Title</Label>
            <Input id="sign-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sign-source">What is being signed</Label>
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger id="sign-source" aria-label="What is being signed"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text I write or paste</SelectItem>
                <SelectItem value="submission" disabled={submissions.length === 0}>A filled-in form</SelectItem>
                <SelectItem value="file">A file from my computer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {source === "text" && (
            <div className="space-y-1.5">
              <Label htmlFor="sign-text">Text</Label>
              <textarea id="sign-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} className={textarea} />
            </div>
          )}
          {source === "submission" && (
            <div className="space-y-1.5">
              <Label htmlFor="sign-submission">Filled-in form</Label>
              <Select value={submissionId} onValueChange={setSubmissionId}>
                <SelectTrigger id="sign-submission" aria-label="Filled-in form"><SelectValue placeholder="Choose one" /></SelectTrigger>
                <SelectContent>{submissions.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {source === "file" && (
            <div className="space-y-1.5">
              <Label htmlFor="sign-file">File</Label>
              <Input id="sign-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">The file itself stays on your computer. Only its name and fingerprint are kept.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="sign-signers">Signers (one per line, up to {MAX_SIGNERS})</Label>
            <textarea id="sign-signers" rows={3} value={signers} onChange={(e) => setSigners(e.target.value)} placeholder={"Dana Whitfield <dana@company.com>\nPat Lee"} className={textarea} />
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>Create request</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SignDialog({ target, onClose }: { target: { request: SigningRequest; signerId: string } | null; onClose: () => void }) {
  const list = useSigningRequests();
  const [typed, setTyped] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const signer = target?.request.signers.find((s) => s.id === target.signerId);
  const close = () => { setTyped(""); setAgreed(false); setError(""); onClose(); };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        {target && signer && (
          <>
            <DialogTitle>Sign as {signer.name}</DialogTitle>
            <DialogDescription className="mt-1">{target.request.title}</DialogDescription>
            {target.request.text && <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{target.request.text}</pre>}
            <form
              noValidate
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const r = sign(target.request, target.signerId, typed, agreed, new Date().toISOString());
                if ("error" in r) return setError(r.error);
                saveRequests(list.map((x) => (x.id === r.request.id ? r.request : x)));
                close();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="sign-typed">Type your full name to sign</Label>
                <Input id="sign-typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={signer.name} />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 rounded border-input accent-primary" />
                I have read this and agree to sign it.
              </label>
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button type="submit"><PenLine /> Sign</Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Documents out for signature. Saved in this browser; a typed name and an explicit agreement count as the signature. */
export function Signatures({ submissions, today, by }: { submissions: SignableSubmission[]; today: string; by: string }) {
  const list = useSigningRequests();
  const [requesting, setRequesting] = useState(false);
  const [signing, setSigning] = useState<{ request: SigningRequest; signerId: string } | null>(null);

  return (
    <section aria-labelledby="signatures-heading" className="space-y-3" data-testid="signatures">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="signatures-heading" className="text-base font-semibold">Signatures</h2>
          <p className="text-sm text-muted-foreground">Get a document signed by one person or several, and keep the signed copy.</p>
        </div>
        <Button variant="outline" onClick={() => setRequesting(true)}><Plus /> Request signatures</Button>
      </div>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">Nothing out for signature.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const [label, variant] = STATUS[status(r)];
            return (
              <li key={r.id} data-testid="signing-request" className="space-y-2 rounded-2xl border bg-card p-4 shadow-panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{r.title}</h3>
                    <Badge variant={variant}>{label}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" aria-label={`Download signed copy of ${r.title}`} onClick={() => download(textToPdf(signedCopyText(r)), `${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-signed.pdf`)}><Download /> Signed copy</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete signing request ${r.title}`} onClick={() => saveRequests(list.filter((x) => x.id !== r.id))}><Trash2 /></Button>
                  </div>
                </div>
                <ul className="divide-y text-sm">
                  {r.signers.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5" data-testid="signer-row">
                      <span className="min-w-0 flex-1"><span className="font-medium">{s.name}</span>{s.email && <span className="text-muted-foreground"> · {s.email}</span>}</span>
                      {s.signedAt ? <span className="text-xs text-muted-foreground">Signed {formatDayLong(s.signedAt.slice(0, 10))}</span> : (
                        <Button size="sm" variant="outline" aria-label={`Sign as ${s.name}`} onClick={() => setSigning({ request: r, signerId: s.id })}><PenLine /> Sign</Button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="break-all text-xs text-muted-foreground">Fingerprint (SHA-256): {r.hash}</p>
              </li>
            );
          })}
        </ul>
      )}
      <RequestDialog open={requesting} onOpenChange={setRequesting} submissions={submissions} today={today} by={by} />
      <SignDialog target={signing} onClose={() => setSigning(null)} />
    </section>
  );
}
