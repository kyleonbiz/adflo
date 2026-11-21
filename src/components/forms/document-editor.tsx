"use client";

import { useMemo, useRef } from "react";
import { Bold, FileText, Heading1, Heading2, Italic, List, ListOrdered, Minus, PenLine, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DOCUMENT_CSS, documentToHtml } from "@/lib/documents/html";
import { applyFormat, type FormatAction } from "@/lib/documents/edit";
import { parseDocument, resolveBlocks } from "@/lib/documents/parse";
import type { Letterhead } from "@/lib/documents/types";
import { layoutTemplate } from "@/lib/forms/layout";
import type { FormField } from "@/lib/forms/types";

const TEXTAREA = "block w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs leading-relaxed shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

const TOOLS: { action: FormatAction; label: string; icon: typeof Bold }[] = [
  { action: "h1", label: "Heading", icon: Heading1 },
  { action: "h2", label: "Subheading", icon: Heading2 },
  { action: "bold", label: "Bold", icon: Bold },
  { action: "italic", label: "Italic", icon: Italic },
  { action: "bullet", label: "Bulleted list", icon: List },
  { action: "numbered", label: "Numbered list", icon: ListOrdered },
  { action: "table", label: "Table", icon: Table2 },
  { action: "rule", label: "Divider line", icon: Minus },
  { action: "signatures", label: "Signature lines", icon: PenLine },
  { action: "pagebreak", label: "Page break", icon: FileText },
];

/**
 * The editor for a form's document: a formatting toolbar, the text, a menu to drop in the form's fields, and a live preview of
 * the finished page. Leave it empty to use the form's default layout.
 */
export function DocumentEditor({ id, value, onChange, title, description, fields, letterhead }: {
  id: string; value: string; onChange: (v: string) => void; title: string; description: string; fields: Pick<FormField, "label">[]; letterhead: Letterhead;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const labels = fields.map((f) => f.label.trim()).filter(Boolean);

  function run(action: FormatAction) {
    const el = ref.current;
    const edit = applyFormat(value, el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length, action);
    onChange(edit.value);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(edit.start, edit.end); });
  }

  const html = useMemo(() => {
    const source = value.trim() ? value : layoutTemplate(description, fields.map((f, i) => ({ id: String(i), label: f.label.trim() || `Field ${i + 1}`, type: "text", required: false, options: [] })));
    const blocks = resolveBlocks(parseDocument(source), (label) => `«${label}»`);
    return documentToHtml({ title: title.trim() || "Untitled form", letterhead, meta: [["Submitted by", "Name"], ["Date", "Nov 19, 2026"]], blocks });
  }, [value, title, description, fields, letterhead]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Document (optional)</Label>
      <p className="text-xs text-muted-foreground">Write the document that each response produces. Use the toolbar for headings, lists, tables and signature lines, and insert fields to fill in each answer. Leave it empty for a ready-made layout.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1">
            {TOOLS.map((t) => (
              <Button key={t.label} type="button" size="icon-sm" variant="ghost" title={t.label} aria-label={t.label} onClick={() => run(t.action)}><t.icon /></Button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 pr-1 text-xs text-muted-foreground">
              <span className="sr-only sm:not-sr-only">Insert field</span>
              <select aria-label="Insert field" value="" onChange={(e) => { if (e.target.value) run({ field: e.target.value }); }} className="h-8 max-w-40 rounded-md border border-input bg-card px-2 text-xs text-foreground">
                <option value="">Choose…</option>
                {labels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </div>
          <textarea id={id} ref={ref} rows={16} value={value} onChange={(e) => onChange(e.target.value)} className={TEXTAREA}
            placeholder={"# Title of a section\n\nWrite the document here. Drop in {{Field label}} to fill in each answer.\n\n| Item | Details |\n| --- | --- |\n| Name | {{Name}} |\n\n[signatures: Signature | Date]"} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Preview</p>
          <div data-testid="document-preview" className="max-h-[26rem] overflow-auto rounded-lg border bg-white p-5 shadow-inner">
            <style>{DOCUMENT_CSS}</style>
            <div style={{ zoom: 0.72 }} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>
    </div>
  );
}
