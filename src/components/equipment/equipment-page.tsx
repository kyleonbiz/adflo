"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Download, Pencil, Plus, Search, Trash2, Wrench } from "lucide-react";
import { useAudit } from "@/components/audit/use-audit";
import { EmptyState } from "@/components/modules/empty-state";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { Badge } from "@/components/ui/badge";
import { BulkBar, SelectBox, useSelection } from "@/components/ui/bulk-bar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreviewNote } from "@/components/ui/preview-note";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadText } from "@/components/import/csv-source";
import { equipmentAlerts, equipmentToCsv, logService, statusLabel, summarize, typeLabel, validateEquipment } from "@/lib/equipment/logic";
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES, type Equipment, type EquipmentStatus, type EquipmentType } from "@/lib/equipment/types";
import { formatDayLong } from "@/lib/dates";
import { useRecordsLoading, useRecordsState } from "@/lib/records/storage";

const rid = () => `eq-${Math.random().toString(36).slice(2, 10)}`;
const SEVERITY_BADGE = { critical: "danger", warning: "warning", info: "muted" } as const;

interface FormState {
  name: string; type: EquipmentType; identifier: string; location: string; assignedTo: string; status: EquipmentStatus;
  purchasedOn: string; warrantyEndsOn: string; nextServiceOn: string; serviceEveryDays: string; nextInspectionOn: string; serviceVendor: string; notes: string;
}
const EMPTY: FormState = { name: "", type: "tool", identifier: "", location: "", assignedTo: "", status: "in_service", purchasedOn: "", warrantyEndsOn: "", nextServiceOn: "", serviceEveryDays: "", nextInspectionOn: "", serviceVendor: "", notes: "" };
const fromEquipment = (e: Equipment): FormState => ({
  name: e.name, type: e.type, identifier: e.identifier, location: e.location, assignedTo: e.assignedTo, status: e.status,
  purchasedOn: e.purchasedOn ?? "", warrantyEndsOn: e.warrantyEndsOn ?? "", nextServiceOn: e.nextServiceOn ?? "", serviceEveryDays: e.serviceEveryDays ? String(e.serviceEveryDays) : "",
  nextInspectionOn: e.nextInspectionOn ?? "", serviceVendor: e.serviceVendor, notes: e.notes,
});

function EquipmentDialog({ open, item, onClose, onSave }: { open: boolean; item: Equipment | null; onClose: () => void; onSave: (v: FormState) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seen, setSeen] = useState<string | null>(null);
  const key = open ? (item?.id ?? "new") : null;
  if (key !== seen) { setSeen(key); if (key) { setForm(item ? fromEquipment(item) : EMPTY); setErrors({}); } }
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const field = (id: keyof FormState, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`eq-${id}`}>{label}</Label>
      <Input id={`eq-${id}`} value={form[id]} onChange={(e) => set(id, e.target.value as never)} aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `eq-${id}-err` : undefined} {...props} />
      {errors[id] && <p id={`eq-${id}-err`} role="alert" className="text-xs text-destructive">{errors[id]}</p>}
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-6">
        <DialogTitle>{item ? "Edit equipment" : "Add equipment"}</DialogTitle>
        <DialogDescription className="mt-1">Tools, vehicles, appliances, HVAC units and keys, with the dates that matter.</DialogDescription>
        <form
          noValidate className="mt-4 space-y-4"
          onSubmit={(e) => { e.preventDefault(); const errs = validateEquipment(form); setErrors(errs); if (Object.keys(errs).length === 0) onSave(form); }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {field("name", "Name", { maxLength: 120, placeholder: "Ford F-150, rooftop unit 2, shop keys" })}
            <div className="space-y-1.5">
              <Label htmlFor="eq-type">Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as EquipmentType)}>
                <SelectTrigger id="eq-type"><SelectValue /></SelectTrigger>
                <SelectContent>{EQUIPMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {field("identifier", "Serial, VIN, plate or key tag", { maxLength: 80 })}
            <div className="space-y-1.5">
              <Label htmlFor="eq-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as EquipmentStatus)}>
                <SelectTrigger id="eq-status"><SelectValue /></SelectTrigger>
                <SelectContent>{EQUIPMENT_STATUSES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {field("location", "Where it is kept", { maxLength: 80 })}
            {field("assignedTo", "Assigned to", { maxLength: 80 })}
            {field("purchasedOn", "Purchased", { type: "date" })}
            {field("warrantyEndsOn", "Warranty ends", { type: "date" })}
            {field("nextServiceOn", "Next service", { type: "date" })}
            {field("serviceEveryDays", "Repeat service every (days)", { inputMode: "numeric", placeholder: "Optional, like 90" })}
            {field("nextInspectionOn", "Next inspection", { type: "date" })}
            {field("serviceVendor", "Serviced by", { maxLength: 80, placeholder: "Shop or vendor" })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-notes">Notes</Label>
            <textarea id="eq-notes" value={form.notes} maxLength={1000} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{item ? "Save changes" : "Add equipment"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Equipment and assets: tools, vehicles, appliances, HVAC units and keys, with service, inspection and warranty dates that feed the calendar and dashboard. */
export function EquipmentPage({ preview }: { preview?: string }) {
  const today = useToday();
  const loading = useRecordsLoading();
  const audit = useAudit();
  const [saved, setSaved] = useRecordsState<Equipment>("equipment");
  const list = useMemo(() => saved ?? [], [saved]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | EquipmentType>("all");
  const [status, setStatus] = useState<"all" | EquipmentStatus | "attention">("all");
  const [editing, setEditing] = useState<Equipment | "new" | null>(null);
  const [deleting, setDeleting] = useState<Equipment | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null);
  const sel = useSelection();

  if (!today || loading) {
    return <div className="space-y-4" aria-busy="true"><Skeleton className="h-10 w-64" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  }

  const say = (text: string, before?: Equipment[]) => setNotice({ text, undo: before ? () => { setSaved(before); setNotice({ text: "Restored." }); } : undefined });
  const q = query.trim().toLowerCase();
  const summary = summarize(list, today);
  const visible = list
    .filter((e) => type === "all" || e.type === type)
    .filter((e) => status === "all" || (status === "attention" ? equipmentAlerts(e, today).some((a) => a.severity !== "info") : e.status === status))
    .filter((e) => !q || [e.name, e.identifier, e.location, e.assignedTo, e.serviceVendor].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const save = (v: FormState) => {
    const fields = {
      name: v.name.trim(), type: v.type, identifier: v.identifier.trim(), location: v.location.trim(), assignedTo: v.assignedTo.trim(), status: v.status,
      purchasedOn: v.purchasedOn || null, warrantyEndsOn: v.warrantyEndsOn || null, nextServiceOn: v.nextServiceOn || null,
      serviceEveryDays: v.serviceEveryDays ? Number(v.serviceEveryDays) : null, nextInspectionOn: v.nextInspectionOn || null, serviceVendor: v.serviceVendor.trim(), notes: v.notes.trim(),
    };
    if (editing && editing !== "new") {
      setSaved(list.map((e) => (e.id === editing.id ? { ...e, ...fields } : e)));
      audit("updated", fields.name, "Equipment", "/app/equipment");
      say(`${fields.name} updated.`);
    } else {
      setSaved([{ id: rid(), ...fields, createdOn: today }, ...list]);
      audit("added", fields.name, "Equipment", "/app/equipment");
      say(`${fields.name} added.`);
    }
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipment</h1>
          <p className="text-sm text-muted-foreground">Keep track of tools, vehicles, appliances, HVAC units and keys, and never miss a service, inspection or warranty date.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={visible.length === 0} onClick={() => downloadText(equipmentToCsv(visible, today), `equipment-${today}.csv`, "text/csv")}><Download /> Export CSV</Button>
          <Button onClick={() => setEditing("new")}><Plus /> Add equipment</Button>
        </div>
      </div>

      {preview && <PreviewNote>{preview}</PreviewNote>}
      <p role="status" aria-live="polite" className={notice ? "flex items-center gap-2 text-sm text-muted-foreground" : "sr-only"}>
        {notice?.text}
        {notice?.undo && <Button size="sm" variant="outline" className="h-7" onClick={notice.undo}>Undo</Button>}
      </p>

      {list.length === 0 ? (
        <EmptyState
          icon={Wrench} title="Add your first piece of equipment"
          description="Keep each tool, vehicle, appliance, HVAC unit and key in one place, with who has it and when it needs attention."
          points={["Service and inspection dates show on your calendar and dashboard", "Warranty end dates are flagged before they pass", "Know who has what, and where it is kept"]}
        >
          <Button onClick={() => setEditing("new")}><Plus /> Add equipment</Button>
        </EmptyState>
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile icon={Wrench} label="Items tracked" value={summary.total} tone="text-primary" onClick={() => setStatus("all")} pressed={status === "all"} />
            <SummaryTile icon={AlertTriangle} label="Needs attention" value={summary.attention} tone="text-red-600" onClick={() => setStatus("attention")} pressed={status === "attention"} />
            <SummaryTile icon={CalendarClock} label="Due in 30 days" value={summary.dueSoon} tone="text-amber-600" onClick={() => setStatus("attention")} />
            <SummaryTile icon={Wrench} label="In repair" value={summary.inRepair} tone="text-sky-600" onClick={() => setStatus("in_repair")} pressed={status === "in_repair"} />
          </section>

          <section aria-label="Equipment list" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, serial, location or person" aria-label="Search equipment" className="pl-9" />
              </div>
              <div className="sm:w-40">
                <Select value={type} onValueChange={(v) => setType(v as "all" | EquipmentType)}>
                  <SelectTrigger aria-label="Filter by type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {EQUIPMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:w-44">
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="attention">Needs attention</SelectItem>
                    {EQUIPMENT_STATUSES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <BulkBar count={sel.size} total={visible.length} onSelectAll={() => sel.set(visible.map((e) => e.id))} onClear={sel.clear}>
              <Button size="sm" variant="outline" onClick={() => downloadText(equipmentToCsv(list.filter((e) => sel.has(e.id)), today), `equipment-selected-${today}.csv`, "text/csv")}><Download /> Export</Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDelete(true)}>Delete</Button>
            </BulkBar>

            {visible.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">No equipment matches these filters.</div>
            ) : (
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-panel">
                {visible.map((e) => {
                  const alerts = equipmentAlerts(e, today);
                  return (
                    <li key={e.id} data-testid="equipment-row" className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <SelectBox checked={sel.has(e.id)} onChange={() => sel.toggle(e.id)} label={`Select ${e.name}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{e.name}</span>
                          <Badge variant="muted">{typeLabel(e.type)}</Badge>
                          {e.status !== "in_service" && <Badge variant={e.status === "retired" ? "outline" : "warning"}>{statusLabel(e.status)}</Badge>}
                          {alerts.filter((a) => a.message !== "In repair").map((a) => <Badge key={a.message} variant={SEVERITY_BADGE[a.severity]}>{a.message}</Badge>)}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {[e.identifier, e.location && `Kept at ${e.location}`, e.assignedTo && `With ${e.assignedTo}`, e.nextServiceOn && `Next service ${formatDayLong(e.nextServiceOn)}`].filter(Boolean).join(" · ") || "No details yet"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(e.status === "in_service" || e.status === "in_repair") && (
                          <Button size="sm" variant="outline" aria-label={`Log service for ${e.name}`} onClick={() => { setSaved(list.map((x) => (x.id === e.id ? logService(x, today) : x))); audit("logged service on", e.name, "Equipment", "/app/equipment"); say(`Service logged for ${e.name}.${e.serviceEveryDays ? ` Next one in ${e.serviceEveryDays} days.` : ""}`, list); }}><Wrench /> Log service</Button>
                        )}
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e)}><Pencil /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${e.name}`} onClick={() => setDeleting(e)}><Trash2 /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <EquipmentDialog open={editing !== null} item={editing && editing !== "new" ? editing : null} onClose={() => setEditing(null)} onSave={save} />
      <ConfirmDialog
        open={!!deleting} title="Delete equipment?" description={<>{deleting?.name} will be removed. Mark it retired instead to keep the record.</>}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting) { const before = list; setSaved(list.filter((e) => e.id !== deleting.id)); audit("deleted", deleting.name, "Equipment", "/app/equipment"); say(`${deleting.name} deleted.`, before); } setDeleting(null); }}
      />
      <ConfirmDialog
        open={bulkDelete} title={`Delete ${sel.size} item${sel.size === 1 ? "" : "s"}?`} description="They will be removed. You can undo right after."
        onCancel={() => setBulkDelete(false)}
        onConfirm={() => { const before = list; setSaved(list.filter((e) => !sel.has(e.id))); audit("deleted", `${sel.size} equipment items`, "Equipment", "/app/equipment"); say(`${sel.size} items deleted.`, before); sel.clear(); setBulkDelete(false); }}
      />
    </div>
  );
}
