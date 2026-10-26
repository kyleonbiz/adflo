"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Paperclip, Pencil, Plus, Power, RotateCcw, Send, Trash2, X, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayLong } from "@/lib/dates";
import { FILE_EXTENSIONS, approvalBlockers, docState, onboardingProgress, vendorAlerts } from "@/lib/vendors/logic";
import type { Vendor, VendorDocument } from "@/lib/vendors/types";
import { cn } from "@/lib/utils";
import { DOC_BADGE, DOC_LABEL, SEVERITY_BADGE, STATUS_BADGE, STATUS_LABEL } from "./status";

export interface VendorActions {
  onEdit: (v: Vendor) => void;
  onDelete: (v: Vendor) => void;
  onSubmit: (v: Vendor) => void;
  onDecide: (v: Vendor, decision: "approved" | "rejected", comment: string) => void;
  onReopen: (v: Vendor) => void;
  onActive: (v: Vendor, active: boolean) => void;
  onSetDocument: (v: Vendor, d: VendorDocument, dates: { receivedOn: string | null; expiresOn: string | null }) => void;
  onAddDocument: (v: Vendor, type: string, required: boolean) => void;
  onRemoveDocument: (v: Vendor, d: VendorDocument) => void;
  onAttachFile: (v: Vendor, d: VendorDocument, file: File) => void;
  onClearFile: (v: Vendor, d: VendorDocument) => void;
}

const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function DocumentRow({ vendor, d, today, actions }: { vendor: Vendor; d: VendorDocument; today: string; actions: VendorActions }) {
  const state = docState(d, today);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (change: Partial<{ receivedOn: string | null; expiresOn: string | null }>) =>
    actions.onSetDocument(vendor, d, { receivedOn: d.receivedOn, expiresOn: d.expiresOn, ...change });
  return (
    <li className="grid items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-muted/50 sm:grid-cols-[1fr_auto_9.5rem_9.5rem_auto]" data-testid="vendor-doc">
      <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="truncate font-medium">{d.type}</span>
        {!d.required && <Badge variant="outline">Optional</Badge>}
        {d.file && (
          <span className="flex min-w-0 max-w-full items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="size-3 shrink-0" aria-hidden />
            <a href={d.file.url} target="_blank" rel="noreferrer" className="truncate text-primary underline-offset-2 hover:underline">{d.file.name}</a>
            <span className="shrink-0">({fileSize(d.file.size)})</span>
            <button type="button" aria-label={`Remove file from ${d.type}`} onClick={() => actions.onClearFile(vendor, d)} className="shrink-0 rounded p-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3" aria-hidden /></button>
          </span>
        )}
      </span>
      <span className="flex flex-col items-start gap-0.5">
        <Badge variant={DOC_BADGE[state]}>{DOC_LABEL[state]}</Badge>
        {!d.receivedOn && d.expiresOn && <span className="text-[11px] text-muted-foreground">Add a received date</span>}
      </span>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="shrink-0">Received</span>
        <Input type="date" max={today} value={d.receivedOn ?? ""} onChange={(e) => set({ receivedOn: e.target.value || null })} aria-label={`${d.type} received on`} className="h-8 text-xs" />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="shrink-0">Expires</span>
        <Input type="date" value={d.expiresOn ?? ""} onChange={(e) => set({ expiresOn: e.target.value || null })} aria-label={`${d.type} expires on`} className="h-8 text-xs" />
      </label>
      <span className="flex items-center gap-1">
        <input
          ref={fileInput}
          type="file"
          hidden
          accept={FILE_EXTENSIONS.map((e) => `.${e}`).join(",")}
          aria-label={`${d.type} file`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) actions.onAttachFile(vendor, d, file);
            e.target.value = "";
          }}
        />
        <Button size="icon-sm" variant="ghost" className="size-10 sm:size-8" aria-label={`${d.file ? "Replace" : "Attach"} file for ${d.type}`} onClick={() => fileInput.current?.click()}><Paperclip /></Button>
        <Button size="icon-sm" variant="ghost" className="size-10 sm:size-8" aria-label={`Remove ${d.type}`} onClick={() => actions.onRemoveDocument(vendor, d)}><X /></Button>
      </span>
    </li>
  );
}

/** `focusKey` changes whenever the page wants this card shown: it opens the documents and scrolls to the card. */
export function VendorCard({ vendor, today, actions, focusKey }: { vendor: Vendor; today: string; actions: VendorActions; focusKey?: number }) {
  // Onboarding is mostly collecting documents, so start with them in view.
  const [open, setOpen] = useState(() => vendor.status === "onboarding" && approvalBlockers(vendor, today).length > 0);
  const ref = useRef<HTMLLIElement>(null);
  const [seenFocus, setSeenFocus] = useState(focusKey);
  if (focusKey !== seenFocus) {
    setSeenFocus(focusKey);
    if (focusKey !== undefined) setOpen(true);
  }
  useEffect(() => {
    if (focusKey !== undefined) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusKey]);
  const [comment, setComment] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const alerts = vendorAlerts(vendor, today);
  const { done, total } = onboardingProgress(vendor, today);
  const blockers = approvalBlockers(vendor, today);
  const panelId = `vendor-docs-${vendor.id}`;

  return (
    <li ref={ref} className="scroll-mt-4 rounded-2xl border bg-card shadow-panel" data-testid="vendor-card">
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{vendor.name}</h3>
            <Badge variant={STATUS_BADGE[vendor.status]}>{STATUS_LABEL[vendor.status]}</Badge>
            <Badge variant="muted">{vendor.category}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[vendor.contactName, vendor.email, vendor.phone].filter(Boolean).join(" · ")}
          </p>
          <p className="text-sm">{total === 0 ? "No required documents" : `${done} of ${total} required documents in`}</p>
          {alerts.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Alerts">
              {alerts.map((a) => <li key={a.message}><Badge variant={SEVERITY_BADGE[a.severity]}>{a.message}</Badge></li>)}
            </ul>
          )}
          {vendor.decidedBy && vendor.decidedOn && (vendor.status === "approved" || vendor.status === "rejected") && (
            <p className="text-xs text-muted-foreground">
              {vendor.status === "approved" ? "Approved" : "Rejected"} by {vendor.decidedBy} on {formatDayLong(vendor.decidedOn)}{vendor.comment && `: ${vendor.comment}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {vendor.status === "onboarding" && (
              <Button size="sm" variant="outline" disabled={blockers.length > 0} onClick={() => actions.onSubmit(vendor)}><Send /> Submit for approval</Button>
            )}
            {vendor.status === "pending_approval" && (
              <>
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" aria-label={`Comment on ${vendor.name}`} className="h-8 w-44 text-xs" maxLength={200} />
                <Button size="sm" variant="outline" aria-label={`Approve ${vendor.name}`} onClick={() => { actions.onDecide(vendor, "approved", comment); setComment(""); }}><CheckCircle2 /> Approve</Button>
                <Button size="sm" variant="outline" aria-label={`Reject ${vendor.name}`} onClick={() => { actions.onDecide(vendor, "rejected", comment); setComment(""); }}><XCircle /> Reject</Button>
              </>
            )}
            {vendor.status === "rejected" && <Button size="sm" variant="outline" onClick={() => actions.onReopen(vendor)}><RotateCcw /> Reopen</Button>}
            {vendor.status === "approved" && <Button size="sm" variant="outline" onClick={() => actions.onActive(vendor, false)}><Power /> Deactivate</Button>}
            {vendor.status === "inactive" && <Button size="sm" variant="outline" onClick={() => actions.onActive(vendor, true)}><Power /> Reactivate</Button>}
            <Button size="icon-sm" variant="ghost" className="size-10 sm:size-8" aria-label={`Edit ${vendor.name}`} onClick={() => actions.onEdit(vendor)}><Pencil /></Button>
            <Button size="icon-sm" variant="ghost" className="size-10 sm:size-8" aria-label={`Delete ${vendor.name}`} onClick={() => actions.onDelete(vendor)}><Trash2 /></Button>
          </div>
          {vendor.status === "onboarding" && blockers.length > 0 && (
            <p className="max-w-sm text-xs text-muted-foreground lg:text-right">Before approval: {blockers.join(", ")}.</p>
          )}
        </div>
      </div>

      <div className="border-t">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-muted/50"
        >
          <span>Documents <span className="font-normal text-muted-foreground">{vendor.documents.length}</span></span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div id={panelId} className="space-y-3 px-4 pb-4">
            {vendor.documents.length > 0 && (
              <ul className="space-y-1">
                {vendor.documents.map((d) => <DocumentRow key={d.id} vendor={vendor} d={d} today={today} actions={actions} />)}
              </ul>
            )}
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const type = newDoc.trim();
                if (!type) return;
                actions.onAddDocument(vendor, type, newRequired);
                setNewDoc("");
              }}
            >
              <Input value={newDoc} onChange={(e) => setNewDoc(e.target.value)} maxLength={80} placeholder="Add a document" aria-label={`Add a document for ${vendor.name}`} className="h-9 max-w-xs" />
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} className="size-4 rounded border-input accent-primary" />
                Required
              </label>
              <Button type="submit" size="sm" variant="outline" disabled={!newDoc.trim()}><Plus /> Add</Button>
            </form>
            {vendor.notes && <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{vendor.notes}</p>}
          </div>
        )}
      </div>
    </li>
  );
}
