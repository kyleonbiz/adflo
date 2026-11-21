"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDmsError } from "@/lib/dms/errors";
import type { ShareLinkInfo } from "@/lib/dms/types";
import { formatDateTime } from "./format";

const OPTIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 60 * 24, label: "24 hours" },
  { minutes: 60 * 24 * 7, label: "7 days" },
];

export function ShareDialog({
  open,
  fileName,
  onOpenChange,
  onCreate,
  loadLinks,
  onRevoke,
}: {
  open: boolean;
  fileName: string;
  onOpenChange: (open: boolean) => void;
  onCreate: (ttlMinutes: number, opts?: { emailTo?: string; message?: string }) => Promise<{ url: string; expiresAt: string; emailedTo?: string; emailError?: string }>;
  loadLinks: () => Promise<ShareLinkInfo[]>;
  onRevoke: (linkId: string) => Promise<void>;
}) {
  const [ttl, setTtl] = useState(String(OPTIONS[1].minutes));
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [message, setMessage] = useState("");
  const [emailNote, setEmailNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<ShareLinkInfo[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const refreshLinks = useCallback(async () => {
    try {
      setLinks(await loadLinks());
    } catch (e) {
      setLinks([]);
      setError(toDmsError(e).message);
    }
  }, [loadLinks]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinks(null);
      void refreshLinks();
    }
  }, [open, refreshLinks]);

  function reset(next: boolean) {
    if (!next) {
      setLink(null);
      setError("");
      setCopied(false);
      setEmailTo("");
      setMessage("");
      setEmailNote("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent variant="alert">
        <DialogTitle className="flex items-center gap-2">
          <Link2 className="size-5 text-brand-purple" aria-hidden /> Share securely
        </DialogTitle>
        <DialogDescription className="mt-1 break-words">
          Email a link to “{fileName}”, or copy it. The person opens the link and downloads the file. It stops working automatically.
        </DialogDescription>

        {!link ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="share-ttl" className="text-sm font-medium">
                Link expires after
              </label>
              <Select value={ttl} onValueChange={setTtl}>
                <SelectTrigger id="share-ttl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPTIONS.map((o) => (
                    <SelectItem key={o.minutes} value={String(o.minutes)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="share-email" className="text-sm font-medium">
                Email the link to <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input id="share-email" type="email" autoComplete="off" placeholder="name@example.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
            </div>
            {emailTo.trim() && (
              <div className="space-y-1.5">
                <label htmlFor="share-note" className="text-sm font-medium">
                  Add a note <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea id="share-note" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full rounded-lg border border-input field-glass px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Anyone with the link can download this file until it expires. Treat it like a password.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => reset(false)}>
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  const to = emailTo.trim();
                  if (to && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(to)) { setError("Enter a valid email address, or leave it empty to copy the link."); return; }
                  setBusy(true);
                  setError("");
                  try {
                    const made = await onCreate(Number(ttl), to ? { emailTo: to, message: message.trim() || undefined } : undefined);
                    setLink({ url: made.url, expiresAt: made.expiresAt });
                    setEmailNote(made.emailedTo ? `Emailed to ${made.emailedTo}. They can open the link and download the file.` : made.emailError ?? "");
                    void refreshLinks();
                  } catch (e) {
                    setError(toDmsError(e).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? (emailTo.trim() ? "Sending…" : "Creating…") : emailTo.trim() ? "Create link and email it" : "Create link"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={link.url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.url);
                    setCopied(true);
                  } catch {
                    setError("Copy failed. Select the link and copy it manually.");
                  }
                }}
              >
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            {emailNote && <p role="status" className="text-sm">{emailNote}</p>}
            <p className="text-xs text-muted-foreground">Expires {formatDateTime(link.expiresAt)}</p>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <Button onClick={() => reset(false)}>Done</Button>
            </div>
          </div>
        )}

        <section aria-labelledby="active-links-heading" className="mt-5 border-t pt-4">
          <h4 id="active-links-heading" className="mb-2 text-sm font-semibold">
            Active links
          </h4>
          {links === null ? (
            <p className="text-xs text-muted-foreground" role="status">Loading…</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active links for this document.</p>
          ) : (
            <ul className="divide-y rounded-xl border" data-testid="share-links">
              {links.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">Created {formatDateTime(l.createdAt)}</span>
                    <span className="text-muted-foreground">
                      Expires {formatDateTime(l.expiresAt)}
                      {l.createdByName ? ` · ${l.createdByName}` : ""}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoking === l.id}
                    aria-label={`Revoke link created ${formatDateTime(l.createdAt)}`}
                    onClick={async () => {
                      setRevoking(l.id);
                      try {
                        await onRevoke(l.id);
                        await refreshLinks();
                      } catch (e) {
                        setError(toDmsError(e).message);
                      } finally {
                        setRevoking(null);
                      }
                    }}
                    className="text-destructive hover:bg-red-50"
                  >
                    <Trash2 /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            The full link is only shown once, when it is created. Revoking stops it working immediately.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
