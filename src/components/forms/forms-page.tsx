"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileInput, Inbox, Plus, Search, Send } from "lucide-react";
import { useAudit } from "@/components/audit/use-audit";
import { Button } from "@/components/ui/button";
import { SplitButton } from "@/components/ui/split-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import { createSubmission, generateDocument, markDone, submissionsToCsv, summarize } from "@/lib/forms/logic";
import { textToPdf } from "@/lib/forms/pdf";
import { printText } from "@/lib/forms/print";
import { PAPERWORK, type Paperwork } from "@/lib/forms/paperwork";
import { industryForms } from "@/lib/setup/industries";
import { addContactLink, personFromSubmission, prefillFromPerson, type Person } from "@/lib/bridge";
import { starterForms } from "@/lib/forms/starter-forms";
import { e2eSeed } from "@/lib/e2e-seed";
import type { FormTemplate, Submission } from "@/lib/forms/types";
import { useSetupConfig } from "@/lib/setup/storage";
import { installedForms } from "@/lib/setup/templates";
import type { FormBuilderValues } from "@/lib/forms/validation";
import { AddResponsesDialog } from "./add-responses-dialog";
import { FillFormDialog } from "./fill-form-dialog";
import { FormBuilderDialog } from "./form-builder-dialog";
import { FormCard, type FormActions } from "./form-card";
import { SendFormDialog } from "./send-form-dialog";
import { Packets } from "./packets";
import { Signatures } from "./signatures";
import { DocumentReadyDialog } from "./document-ready-dialog";
import { PaperworkDialog } from "./paperwork-dialog";

const rid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "form";
const fileName = (f: FormTemplate, s: Submission, ext: string) => `${slug(f.name)}-${slug(s.submittedBy)}-${s.submittedOn}.${ext}`;

function download(text: string | Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text as BlobPart], { type: typeof text === "string" ? `${type};charset=utf-8` : type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Forms & Paperwork. Forms and submissions live in this component's state (starting empty)
 * until the database is connected, so nothing here is saved between visits and no notifications are sent.
 */
export function FormsPage({ preview, initialQuery = "", initialFill }: { preview?: string; initialQuery?: string; initialFill?: { formId: string; person: Partial<Person> } }) {
  const today = useToday();
  const audit = useAudit();
  const [editedForms, setEditedForms] = useState<FormTemplate[] | null>(null);
  const [editedSubs, setEditedSubs] = useState<Submission[] | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [builderFor, setBuilderFor] = useState<FormTemplate | "new" | null>(null);
  // A link from a contact opens its form straight away, with the contact's details in.
  const fromLink = initialFill ? [...starterForms(), ...PAPERWORK.map((p) => p.form)].find((f) => f.id === initialFill.formId) ?? null : null;
  const [filling, setFilling] = useState<FormTemplate | null>(fromLink);
  const [choosing, setChoosing] = useState(false);
  const [ready, setReady] = useState<{ form: FormTemplate; sub: Submission } | null>(null);
  const [sending, setSending] = useState<FormTemplate | null>(null);
  const [adding, setAdding] = useState<FormTemplate | null>(null);
  const [deleting, setDeleting] = useState<FormTemplate | null>(null);
  const [notice, setNotice] = useState("");

  const setup = useSetupConfig();
  // Forms installed by Settings (only once setup is finished) sit alongside your own records.
  const forms = useMemo(() => {
    if (editedForms) return editedForms;
    const own = [...starterForms(), ...installedForms(setup?.completedOn ? setup.templates : [])];
    const base = [...own, ...industryForms(setup).filter((f) => !own.some((o) => o.name.toLowerCase() === f.name.toLowerCase()))];
    return fromLink && !base.some((f) => f.id === fromLink.id) ? [...base, fromLink] : base;
  }, [editedForms, setup, fromLink]);
  const subs = useMemo(() => editedSubs ?? e2eSeed<Submission>("submissions") ?? [], [editedSubs]);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const actions: FormActions = {
    onSend: (f) => setSending(f),
    onFill: (f) => setFilling(f),
    onAddResponses: (f) => setAdding(f),
    onEdit: (f) => setBuilderFor(f),
    onDelete: (f) => setDeleting(f),
    onMarkDone: (_f, s, done) => {
      setEditedSubs(subs.map((x) => (x.id === s.id ? markDone(x, done) : x)));
      audit(done ? "marked done a response to" : "reopened a response to", _f.name, "Forms", "/app/forms");
      setNotice(`Response by ${s.submittedBy} ${done ? "marked done" : "reopened"}.`);
    },
    onDocument: (f, s) => download(generateDocument(f, s), fileName(f, s, "txt"), "text/plain"),
    onPdf: (f, s) => download(textToPdf(generateDocument(f, s)), fileName(f, s, "pdf"), "application/pdf"),
    onPrint: (f, s) => printText(f.name, generateDocument(f, s)),
    onExport: (f, list) => download(submissionsToCsv(f, list), `${slug(f.name)}-submissions-${today}.csv`, "text/csv"),
    onDeleteSubmission: (_f, s) => {
      audit("deleted a response to", _f.name, "Forms", "/app/forms");
      setEditedSubs(subs.filter((x) => x.id !== s.id));
      setNotice(`Response by ${s.submittedBy} deleted.`);
    },
  };

  const saveForm = (v: FormBuilderValues) => {
    const fields = v.fields.map((f) => ({ ...f, type: f.type as FormTemplate["fields"][number]["type"] }));
    const next = { name: v.name, description: v.description, fields, documentTemplate: v.documentTemplate };
    if (builderFor && builderFor !== "new") {
      const id = builderFor.id;
      setEditedForms(forms.map((f) => (f.id === id ? { ...f, ...next } : f)));
      audit("edited the form", v.name, "Forms", "/app/forms");
      setNotice(`${v.name} updated.`);
    } else {
      setEditedForms([...forms, { ...next, id: rid("form"), sentCount: 0 }]);
      audit("created the form", v.name, "Forms", "/app/forms");
      setNotice(`${v.name} created.`);
    }
  };

  const summary = summarize(forms, subs);
  const q = query.trim().toLowerCase();
  const visible = forms.filter((f) => !q || [f.name, f.description].some((x) => x.toLowerCase().includes(q)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms &amp; Paperwork</h1>
          <p className="text-sm text-muted-foreground">Build the forms you need, send them to anyone and collect the answers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SplitButton
            onClick={() => setBuilderFor("new")}
            menuLabel="More ways to start a form"
            actions={[{ label: "Choose paperwork", onSelect: () => setChoosing(true) }]}
          >
            <Plus /> New form
          </SplitButton>
        </div>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={FileInput} label="Forms" value={summary.forms} tone="text-primary" />
        <SummaryTile icon={Send} label="Times sent" value={summary.sent} tone="text-sky-600" />
        <SummaryTile icon={Inbox} label="Responses" value={summary.responses} tone="text-emerald-600" />
        <SummaryTile icon={CheckCircle2} label="New responses" value={summary.unread} tone="text-amber-600" />
      </section>

      <section aria-label="Forms" className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search forms" aria-label="Search forms" className="pl-9" />
        </div>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {forms.length === 0 ? "No forms yet. Create your first one." : "No forms match your search."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((f) => <FormCard key={f.id} form={f} submissions={subs.filter((s) => s.formId === f.id)} actions={actions} />)}
          </ul>
        )}
      </section>

      <Packets
        today={today}
        onFillForm={(formId) => {
          const form = forms.find((x) => x.id === formId) ?? PAPERWORK.find((p) => p.form.id === formId)?.form;
          if (!form) return;
          if (!forms.some((x) => x.id === form.id)) setEditedForms([...forms, form]);
          setFilling(form);
        }}
      />

      <Signatures
        today={today}
        by="You"
        submissions={subs.flatMap((s) => {
          const f = forms.find((x) => x.id === s.formId);
          return f ? [{ id: s.id, label: `${f.name}, ${s.submittedBy}, ${formatDayLong(s.submittedOn)}`, text: generateDocument(f, s) }] : [];
        })}
      />

      <PaperworkDialog
        open={choosing}
        onOpenChange={setChoosing}
        onPick={(p: Paperwork) => {
          setChoosing(false);
          // The form joins your list the first time you use it, so repeating paperwork stays one click away.
          if (!forms.some((x) => x.id === p.form.id)) setEditedForms([...forms, p.form]);
          setFilling(p.form);
        }}
      />

      <DocumentReadyDialog
        open={ready !== null}
        title={ready?.form.name ?? ""}
        contact={ready ? (() => { const p = personFromSubmission(ready.form, ready.sub.values, ready.sub.submittedBy); return p ? { name: p.name, href: addContactLink(p) } : null; })() : null}
        onOpenChange={(o) => !o && setReady(null)}
        onPrint={() => ready && printText(ready.form.name, generateDocument(ready.form, ready.sub))}
        onPdf={() => ready && download(textToPdf(generateDocument(ready.form, ready.sub)), fileName(ready.form, ready.sub, "pdf"), "application/pdf")}
        onText={() => ready && download(generateDocument(ready.form, ready.sub), fileName(ready.form, ready.sub, "txt"), "text/plain")}
      />

      <FormBuilderDialog
        open={builderFor !== null}
        form={builderFor && builderFor !== "new" ? builderFor : undefined}
        onOpenChange={(o) => !o && setBuilderFor(null)}
        onSave={saveForm}
      />

      <FillFormDialog
        key={filling?.id ?? "none"}
        open={filling !== null}
        form={filling}
        initialValues={filling && initialFill && filling.id === initialFill.formId ? prefillFromPerson(filling, initialFill.person) : undefined}
        initialBy={filling && initialFill && filling.id === initialFill.formId ? initialFill.person.name : undefined}
        onOpenChange={(o) => !o && setFilling(null)}
        onSubmit={(values, by) => {
          if (!filling) return;
          const s = createSubmission(filling, values, by, today, rid("s"));
          setEditedSubs([...subs, s]);
          setReady({ form: filling, sub: s });
          audit("filled in", filling.name, "Forms", "/app/forms");
          setNotice("Response added.");
        }}
      />

      <SendFormDialog
        form={sending}
        onOpenChange={(o) => !o && setSending(null)}
        onSent={(f, count) => {
          setEditedForms(forms.map((x) => (x.id === f.id ? { ...x, sentCount: x.sentCount + count } : x)));
          audit("sent", `${f.name} to ${count} ${count === 1 ? "person" : "people"}`, "Forms", "/app/forms");
          setNotice(`${f.name} sent.`);
        }}
      />

      <AddResponsesDialog
        form={adding}
        onOpenChange={(o) => !o && setAdding(null)}
        onAdd={(f, responses) => {
          const have = new Set(subs.filter((x) => x.formId === f.id).map((x) => JSON.stringify([x.submittedBy, x.values])));
          const fresh = responses
            .map((r) => createSubmission(f, r.values, r.submittedBy, today, rid("s")))
            .filter((s) => !have.has(JSON.stringify([s.submittedBy, s.values])));
          if (fresh.length > 0) {
            setEditedSubs([...subs, ...fresh]);
            setNotice(`Added ${fresh.length} response${fresh.length === 1 ? "" : "s"} to ${f.name}.`);
          }
          return fresh.length;
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete form?</DialogTitle>
          <DialogDescription className="mt-1">{deleting?.name} and all of its responses will be removed.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  setEditedForms(forms.filter((f) => f.id !== deleting.id));
                  setEditedSubs(subs.filter((s) => s.formId !== deleting.id));
                  audit("deleted the form", deleting.name, "Forms", "/app/forms");
                  setNotice(`${deleting.name} deleted.`);
                }
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
