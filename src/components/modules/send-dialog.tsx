"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { composeMailto, parseRecipients, type Draft } from "@/lib/send";

const TEXTAREA = "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

function Body({ draft, note, onClose, onSent }: { draft: Draft; note?: string; onClose: () => void; onSent?: (recipients: number) => void }) {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const { emails, invalid } = parseRecipients(to);
  const ready = emails.length > 0 && invalid.length === 0;

  return (
    <div className="space-y-4 px-5 py-4">
      {note && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{note}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="send-to">To</Label>
        <Input id="send-to" autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com, other@example.com" aria-invalid={invalid.length > 0} />
        {invalid.length > 0 && <p role="alert" className="text-xs text-destructive">Not an email address: {invalid.join(", ")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="send-subject">Subject</Label>
        <Input id="send-subject" autoComplete="off" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="send-message">Message</Label>
        <textarea id="send-message" rows={10} className={TEXTAREA} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try { await navigator.clipboard.writeText(`${subject}\n\n${message}`); setCopied(true); } catch { setCopied(false); }
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy message"}
        </Button>
        {ready ? (
          <Button asChild>
            <a href={composeMailto(emails, subject, message)} onClick={() => { onSent?.(emails.length); onClose(); }}><Mail /> Open email</a>
          </Button>
        ) : (
          <Button type="button" disabled><Mail /> Open email</Button>
        )}
      </div>
    </div>
  );
}

/**
 * Review a message, then open it in your email app. AdFlo does not send the email itself, so what you
 * see here is exactly what your email app opens with. Email only.
 */
export function SendDialog({ open, title, draft, note, onOpenChange, onSent }: {
  open: boolean;
  title: string;
  /** Something to know before sending, shown above the form. */
  note?: string;
  draft: Draft | null;
  onOpenChange: (open: boolean) => void;
  onSent?: (recipients: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <div className="border-b px-5 py-4 pr-14">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-1">Check the message, then open it in your email app to send.</DialogDescription>
        </div>
        {open && draft && <Body draft={draft} note={note} onClose={() => onOpenChange(false)} onSent={onSent} />}
      </DialogContent>
    </Dialog>
  );
}
