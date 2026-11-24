"use client";

import { useState } from "react";
import { Download, FileText, Mail, PenLine, Plus, Printer, Save, ScrollText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDayShort } from "@/lib/dates";
import { textToPdf } from "@/lib/forms/pdf";
import { printText } from "@/lib/forms/print";
import { MAX_PACKET_REMINDERS, PACKETS, STALE_PACKET_DAYS, hasEmail, isComplete, isStale, outstanding, packetText, progress, startPacket, startProblem, toggleItem, wentQuiet, type Assignment, type ItemKind } from "@/lib/packets/logic";
import { useRecordsInDatabase } from "@/lib/records/storage";
import { saveAssignments, useAssignments } from "@/lib/packets/storage";

const rid = () => `pk-${Math.random().toString(36).slice(2, 10)}`;
const ICON: Record<ItemKind, typeof FileText> = { form: ScrollText, document: FileText, signature: PenLine };

/** Packets of paperwork for a new hire, vendor or client: start one for a person and tick items off as they arrive. */
export function Packets({ today, onFillForm, onSave }: { today: string; onFillForm: (formId: string) => void; onSave: (title: string, pdf: Uint8Array, fileName: string) => void }) {
  const list = useAssignments();
  const [starting, setStarting] = useState(false);
  const [templateId, setTemplateId] = useState(PACKETS[0].id);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const template = PACKETS.find((p) => p.id === templateId) ?? PACKETS[0];
  const connected = useRecordsInDatabase(); // emailing a packet needs a connected workspace
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  /** Emails the packet (or, once sent, a reminder) to the person from the server, then records on the packet that it went. */
  async function emailPacket(a: Assignment) {
    const again = !!a.sentOn;
    if (!window.confirm(`${again ? "Email a reminder about" : "Email"} the ${a.templateName} packet ${again ? "to" : "to"} ${a.recipient} (${a.email})? It lists what they still need to send or fill out.`)) return;
    setSending(a.id); setNotice(null);
    try {
      const res = await fetch("/api/packets/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: a.id }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setNotice({ ok: false, text: json?.error?.message ?? "Could not email the packet. Try again." }); return; }
      saveAssignments(list.map((x) => (x.id === a.id ? { ...x, sentOn: json.data.sentOn, remindedOn: json.data.remindedOn } : x)));
      setNotice({ ok: true, text: `${again ? "Reminder" : "Packet"} emailed to ${json.data.emailedTo}.` });
    } catch { setNotice({ ok: false, text: "Could not reach the server. Try again." }); } finally { setSending(null); }
  }

  const close = () => { setStarting(false); setName(""); setEmail(""); setError(""); };

  return (
    <section aria-labelledby="packets-heading" className="space-y-3" data-testid="packets">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="packets-heading" className="text-base font-semibold">Onboarding packets</h2>
          <p className="text-sm text-muted-foreground">One checklist of forms, documents and signatures for each new hire, vendor or client.</p>
        </div>
        <Button variant="outline" onClick={() => setStarting(true)}><Plus /> Start a packet</Button>
      </div>

      {notice && <p role={notice.ok ? "status" : "alert"} className={notice.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{notice.text}</p>}

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">No packets started. Start one for a new client, new hire, subcontractor, job closeout or someone leaving.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => {
            const p = progress(a);
            const patch = (next: typeof a) => saveAssignments(list.map((x) => (x.id === a.id ? next : x)));
            return (
              <li key={a.id} data-testid="packet" className="space-y-3 rounded-2xl border bg-card p-4 shadow-panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{a.recipient}</h3>
                    <Badge variant="muted">{a.templateName}</Badge>
                    {isComplete(a) ? <Badge variant="success">Complete</Badge> : wentQuiet(a) ? <Badge variant="danger">No reply after {MAX_PACKET_REMINDERS} reminders</Badge> : isStale(a, today) ? <Badge variant="warning">Waiting {STALE_PACKET_DAYS}+ days</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {connected && hasEmail(a) && outstanding(a).length > 0 && (
                      <Button size="sm" variant={a.sentOn ? "outline" : "default"} disabled={sending === a.id} aria-label={`${a.sentOn ? "Email a reminder to" : "Email packet to"} ${a.recipient}`} onClick={() => void emailPacket(a)}>
                        <Mail /> {sending === a.id ? "Sending…" : a.sentOn ? "Email reminder" : "Email packet"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" aria-label={`Save checklist for ${a.recipient}`} onClick={() => onSave(`${a.templateName} packet for ${a.recipient}`, textToPdf(packetText(a)), `${a.templateName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${a.recipient.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`)}><Save /> Save</Button>
                    <Button size="sm" variant="outline" aria-label={`Print checklist for ${a.recipient}`} onClick={() => printText(`${a.templateName} packet`, packetText(a))}><Printer /> Print</Button>
                    <Button size="sm" variant="outline" aria-label={`Download PDF for ${a.recipient}`} onClick={() => {
                      const url = URL.createObjectURL(new Blob([textToPdf(packetText(a)) as BlobPart], { type: "application/pdf" }));
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${a.templateName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${a.recipient.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}><Download /> PDF</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete packet for ${a.recipient}`} onClick={() => saveAssignments(list.filter((x) => x.id !== a.id))}><Trash2 /></Button>
                  </div>
                </div>
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Packet progress for ${a.recipient}`}>
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${p.percent}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.done} of {p.total} done · started {formatDayShort(a.startedOn)}{a.email && ` · ${a.email}`}{a.sentOn && ` · emailed ${formatDayShort(a.sentOn)}`}{!!a.remindedOn?.length && ` · reminded ${a.remindedOn.length} ${a.remindedOn.length === 1 ? "time" : "times"}`}</p>
                </div>
                <ul className="divide-y text-sm">
                  {a.items.map((i) => {
                    const Icon = ICON[i.kind];
                    return (
                      <li key={i.id} className="flex flex-wrap items-center gap-2 py-1.5" data-testid="packet-item">
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input type="checkbox" checked={!!i.doneOn} onChange={() => patch(toggleItem(a, i.id, today))} className="size-4 rounded border-input accent-primary" aria-label={`${i.label} for ${a.recipient}`} />
                          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className={i.doneOn ? "text-muted-foreground line-through" : undefined}>{i.label}</span>
                          {i.by === "us" && <span className="text-xs text-muted-foreground">(your step)</span>}
                        </label>
                        {i.kind === "form" && i.formId && !i.doneOn && (
                          <Button size="sm" variant="outline" aria-label={`Fill out ${i.label} for ${a.recipient}`} onClick={() => onFillForm(i.formId!)}>Fill out</Button>
                        )}
                        {i.doneOn && <span className="text-xs text-muted-foreground">Received {formatDayShort(i.doneOn)}</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={starting} onOpenChange={(o) => !o && close()}>
        <DialogContent className="p-6 max-w-md">
          <DialogTitle>Start a packet</DialogTitle>
          <DialogDescription className="mt-1">{template.blurb}</DialogDescription>
          <form
            noValidate
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const problem = startProblem(name, email);
              if (problem) return setError(problem);
              saveAssignments([startPacket(template, name, email, today, rid()), ...list]);
              close();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="packet-type">Packet</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger id="packet-type" aria-label="Packet"><SelectValue /></SelectTrigger>
                <SelectContent>{PACKETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <ul className="list-inside list-disc text-xs text-muted-foreground">{template.items.map((i) => <li key={i.id}>{i.label}{i.by === "us" ? " (your step)" : ""}</li>)}</ul>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="packet-name">Who is it for</Label>
              <Input id="packet-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="packet-email">Email (optional)</Label>
              <Input id="packet-email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" maxLength={120} />
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit">Start packet</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
