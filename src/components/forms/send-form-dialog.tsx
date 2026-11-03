"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formPath, isEmail, parseRecipients, sendMailto } from "@/lib/forms/share";
import type { FormTemplate } from "@/lib/forms/types";

const REPLY_KEY = "adflo.forms.replyTo";
const readReply = () => { try { return window.localStorage.getItem(REPLY_KEY) ?? ""; } catch { return ""; } };
const saveReply = (v: string) => { try { window.localStorage.setItem(REPLY_KEY, v); } catch { /* not remembered */ } };

function SendBody({ form, onSent }: { form: FormTemplate; onSent: (count: number) => void }) {
  const [replyTo, setReplyTo] = useState(readReply);
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);

  const replyOk = isEmail(replyTo.trim());
  const { emails, invalid } = parseRecipients(to);
  const link = replyOk ? `${window.location.origin}${formPath(form, replyTo.trim())}` : "";

  const sent = (n: number) => { saveReply(replyTo.trim()); onSent(n); };

  return (
    <div className="space-y-4 px-5 py-4">
      <div className="space-y-1.5">
        <Label htmlFor="send-reply">Send the answers to</Label>
        <Input id="send-reply" type="email" autoComplete="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="you@yourbusiness.com" aria-invalid={replyTo.trim() !== "" && !replyOk} />
        <p className="text-xs text-muted-foreground">People who fill the form in will email their answers here.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="send-to">Who is it for? (optional)</Label>
        <Input id="send-to" autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com, other@example.com" />
        {invalid.length > 0 && <p role="alert" className="text-xs text-destructive">Not an email address: {invalid.join(", ")}</p>}
      </div>

      {replyOk && (
        <div className="space-y-1.5">
          <Label htmlFor="send-link">Link to the form</Label>
          <Input id="send-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          disabled={!replyOk}
          onClick={async () => {
            try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
            sent(1);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Link copied" : "Copy link"}
        </Button>
        {replyOk && invalid.length === 0 ? (
          <Button asChild>
            <a href={sendMailto(form, link, emails)} onClick={() => sent(Math.max(1, emails.length))}><Mail /> Open email</a>
          </Button>
        ) : (
          <Button type="button" disabled><Mail /> Open email</Button>
        )}
      </div>
    </div>
  );
}

/** Send a form: a link anyone can open, optionally in a ready-written email. Nothing is sent from AdFlo itself. */
export function SendFormDialog({ form, onOpenChange, onSent }: { form: FormTemplate | null; onOpenChange: (open: boolean) => void; onSent: (form: FormTemplate, count: number) => void }) {
  return (
    <Dialog open={form !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {form && (
          <>
            <div className="border-b px-5 py-4 pr-14">
              <DialogTitle>Send &ldquo;{form.name}&rdquo;</DialogTitle>
              <DialogDescription className="mt-1">Anyone with the link can fill this form in. Their answers come back to you by email.</DialogDescription>
            </div>
            <SendBody key={form.id} form={form} onSent={(n) => onSent(form, n)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
