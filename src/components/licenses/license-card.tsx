"use client";

import { useState } from "react";
import { BellRing, CheckCircle2, ChevronDown, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { daysLeft, licenseAlerts, licenseStatus, missingDocuments, nextReminder } from "@/lib/licenses/logic";
import { formatDayLong } from "@/lib/dates";
import { LICENSE_CATEGORIES, RENEWAL_STAGES, type License, type RenewalStage } from "@/lib/licenses/types";
import { cn } from "@/lib/utils";
import { SEVERITY_BADGE, STATUS_BADGE, STATUS_LABEL } from "./status";
import { titleCase } from "@/lib/text";

export interface LicenseActions {
  onEdit: (license: License) => void;
  onRenew: (license: License) => void;
  onDelete: (license: License) => void;
  onStage: (license: License, stage: RenewalStage) => void;
  onToggleDocument: (license: License, documentId: string) => void;
  onAddDocument: (license: License, label: string) => void;
  onRemoveDocument: (license: License, documentId: string) => void;
}

function expiryText(left: number): string {
  if (left < 0) return `${-left} day${left === -1 ? "" : "s"} overdue`;
  if (left === 0) return "Expires today";
  return `${left} day${left === 1 ? "" : "s"} left`;
}

export function LicenseCard({ license, today, actions }: { license: License; today: string; actions: LicenseActions }) {
  const [open, setOpen] = useState(false);
  const [newDoc, setNewDoc] = useState("");
  const status = licenseStatus(license, today);
  const left = daysLeft(license, today);
  const alerts = licenseAlerts(license, today);
  const reminder = nextReminder(license, today);
  const missing = missingDocuments(license);
  const received = license.requiredDocuments.length - missing;
  const category = LICENSE_CATEGORIES.find((c) => c.value === license.category)?.label ?? license.category;
  const panelId = `lic-docs-${license.id}`;

  return (
    <li className="rounded-2xl border bg-card shadow-panel" data-testid="license-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{license.name}</h3>
            <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
            <Badge variant="muted">{category}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[license.issuer, license.number && `#${license.number}`, license.holder].filter(Boolean).join(" · ") || "No details added"}
          </p>
          <p className="text-sm">
            <span className="font-medium">Expires {formatDayLong(license.expiresOn)}</span>
            <span className={cn("ml-2", left < 0 ? "text-destructive" : "text-muted-foreground")}>{expiryText(left)}</span>
          </p>
          {alerts.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Alerts">
              {alerts.map((a) => <li key={a.message}><Badge variant={SEVERITY_BADGE[a.severity]}>{a.message}</Badge></li>)}
            </ul>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BellRing className="size-3.5" aria-hidden />
            {reminder
              ? `Next reminder ${formatDayLong(reminder.on)} (${reminder.daysBefore} day${reminder.daysBefore === 1 ? "" : "s"} before expiry)`
              : "All reminders have been sent"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <div className="w-52">
            <Select value={license.stage} onValueChange={(v) => actions.onStage(license, v as RenewalStage)}>
              <SelectTrigger aria-label={`Renewal stage for ${license.name}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RENEWAL_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>Renewal: {titleCase(s.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={() => actions.onRenew(license)}>
            <RefreshCw /> Mark renewed
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${license.name}`} onClick={() => actions.onEdit(license)}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${license.name}`} onClick={() => actions.onDelete(license)}><Trash2 /></Button>
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
          <span className="flex items-center gap-2">
            <CheckCircle2 className={cn("size-4", missing === 0 ? "text-emerald-600" : "text-muted-foreground")} aria-hidden />
            Required documents
            <span className="text-muted-foreground">
              {license.requiredDocuments.length === 0 ? "none listed" : `${received} of ${license.requiredDocuments.length} received`}
            </span>
          </span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div id={panelId} className="space-y-3 px-4 pb-4">
            {license.requiredDocuments.length > 0 && (
              <ul className="space-y-1">
                {license.requiredDocuments.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/50">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={d.received}
                        onChange={() => actions.onToggleDocument(license, d.id)}
                        className="size-4 rounded border-input accent-primary"
                      />
                      <span className={cn("truncate", d.received && "text-muted-foreground line-through")}>{d.label}</span>
                    </label>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${d.label}`} onClick={() => actions.onRemoveDocument(license, d.id)}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const label = newDoc.trim();
                if (!label) return;
                actions.onAddDocument(license, label);
                setNewDoc("");
              }}
            >
              <Input
                value={newDoc}
                onChange={(e) => setNewDoc(e.target.value)}
                maxLength={120}
                placeholder="Add a required document"
                aria-label={`Add a required document for ${license.name}`}
                className="h-9"
              />
              <Button type="submit" size="sm" variant="outline" disabled={!newDoc.trim()}><Plus /> Add</Button>
            </form>
            {license.notes && <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{license.notes}</p>}
          </div>
        )}
      </div>
    </li>
  );
}
