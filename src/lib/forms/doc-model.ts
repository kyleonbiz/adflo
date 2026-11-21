import { formatDayLong, isDay } from "@/lib/dates";
import { layoutTemplate } from "./layout";
import type { FormField, FormTemplate, Submission } from "./types";

/** Who the document is from: printed as a letterhead under the title. Every part is optional. */
export interface DocBusiness { name?: string; address?: string; phone?: string; email?: string; license?: string }

export interface DocCell { label: string; value?: string; weight?: number }

/** One piece of a laid-out page. Both the PDF and the print view are drawn from the same list of blocks. */
export type DocBlock =
  | { t: "cells"; cells: DocCell[]; sign?: boolean }
  | { t: "heading"; text: string }
  | { t: "box"; text: string; min?: number; grow?: boolean }
  | { t: "rows"; rows: [string, string][] }
  | { t: "checks"; items: { label: string; checked: boolean }[] }
  | { t: "terms"; text: string }
  | { t: "para"; text: string };

export interface Doc { title: string; subtitle?: string; business?: DocBusiness; blocks: DocBlock[] }

/* ---------- What each kind of paperwork says and who signs it ---------- */

type Kind = "agreement" | "request" | "report" | "log" | "checklist" | "consent" | "intake";

interface KindStyle { terms?: string; sign: string[]; checks?: string }

const KINDS: Record<Kind, KindStyle> = {
  agreement: {
    sign: ["Authorized signature", "Acceptance signature"], checks: "Confirmations",
    terms: "The prices, specifications and conditions above are accepted and are hereby authorized. Any change that adds cost or time will be agreed in writing before the work is carried out. Both parties keep a signed copy.",
  },
  request: { sign: ["Requested by", "Approved by"], checks: "Confirmations" },
  report: { sign: ["Reported by", "Reviewed by"], checks: "Confirmations", terms: "Keep this report on file. Complete it as soon as possible after the event, while the details are fresh." },
  log: { sign: ["Completed by", "Reviewed by"], checks: "Checks completed" },
  checklist: { sign: ["Completed by", "Reviewed by"], checks: "Checklist" },
  consent: { sign: ["Signature"], checks: "Acknowledgment" },
  intake: { sign: ["Completed by"], checks: "Confirmations" },
};

/** Which kind each built-in paperwork is. Anything not listed gets a request-style page when it names an approver, otherwise intake. */
const KIND_OF: Record<string, Kind> = {
  "proposal-contract": "agreement", "change-order": "agreement", "lien-waiver": "agreement", "engagement": "agreement", "tax-engagement": "agreement", 
  "time-off": "request",
  "incident": "report", "accident": "report", "injury-report": "report", "ncr": "report", "jsa": "report", "conflict-check": "report",
  "temp-log": "log", "equipment-log": "log", "sanitation-log": "log", "patch-test": "log",
  "inspection": "checklist", "opening-checklist": "checklist", "safety-walk": "checklist", "move-in": "checklist", "doc-checklist": "checklist",
  "nda": "consent", "hipaa-ack": "consent", "client-consent": "consent", "pickup-auth": "consent",
};

/** Wording for particular forms where a generic line would be wrong. */
const TERMS: Record<string, string> = {
  "proposal-contract": "All materials are guaranteed to be as specified and the work will be completed in a professional manner, to industry-standard practice. Any change from the specification that adds cost will be carried out only on written authorization and will be charged beyond the estimate. This agreement is subject to delays beyond our control, such as strikes, accidents, weather or material shortages. The owner is responsible for keeping appropriate insurance on the property.",
  "toolbox-talk": "Everyone listed was present for the briefing and had the chance to ask questions. Keep this record with the project's safety file.",
  "jsa": "Work does not start until the crew has read the hazards and controls above and the supervisor has signed. Stop and re-assess if conditions change.",
  "completion": "The owner confirms the work described is complete except for any items listed, which the contractor will finish. The warranty period begins on the date shown.",
  "warranty": "The contractor will repair defects in the work covered that appear during the warranty period and are reported in writing. Normal wear, misuse, and damage caused by others are not covered.",
  "sub-agreement": "The subcontractor confirms the details above are correct and will keep the insurance shown in force while on the job. Send a new certificate before any policy expires.",
  "change-order": "This change order adjusts the original agreement. The contract sum and completion date are changed as shown, and all other terms stay as agreed.",
  "lien-waiver": "Use your state's statutory waiver form where one is required. This record shows the payment that was received and the period it covers.",
  "engagement": "By signing, the client confirms the scope and fee above and agrees that work begins once this page is returned.",
  "tax-engagement": "By signing, the client confirms the services and fee above, and that the information provided is complete and accurate to the best of their knowledge.",
  "nda": "The person signing agrees to keep the information shared with them private and to use it only for the purpose it was given.",
  "hipaa-ack": "The patient confirms they were offered the notice of privacy practices and had the chance to ask questions about it.",
  "client-consent": "The client has described any allergies or sensitivities above, understands the service, and agrees to proceed.",
  "pickup-auth": "Only the people listed may collect the child. Photo identification will be checked each time.",
  "incident": "Keep this report on file. Complete it as soon as possible after the incident, while the details are fresh.",
  "injury-report": "A parent or guardian is told the same day. Keep a copy in the child's file.",
  "accident": "Keep this report with the vehicle's records and give a copy to your insurer.",
  "w9-request": "Return this page with a signed W-9. Tax details are kept private and used only for reporting payments.",
};

/** Who signs, where the generic pair would be wrong for a contractor's paperwork. */
const SIGNERS: Record<string, string[]> = {
  "proposal-contract": ["Contractor signature", "Owner acceptance"],
  "change-order": ["Contractor", "Owner approval"],
  "lien-waiver": ["Claimant signature"],
  "sub-agreement": ["Subcontractor", "Contractor"],
  "completion": ["Contractor", "Owner acceptance"],
  "warranty": ["Contractor"],
  "toolbox-talk": ["Led by", "Reviewed by"],
  "jsa": ["Supervisor", "Safety lead"],
};

const NO_SIGN_LINES = new Set(["temp-log"]);

const idKey = (form: FormTemplate) => form.id.replace(/^(pw|tpl)-/, "").replace(/^form-/, "");

function kindFor(form: FormTemplate): Kind {
  const key = idKey(form);
  if (KIND_OF[key]) return KIND_OF[key];
  const n = form.name.toLowerCase();
  if (/log|record/.test(n)) return "log";
  if (/checklist|inspection/.test(n)) return "checklist";
  if (/request|reimbursement|claim|time-off/.test(n)) return "request";
  if (/report|incident/.test(n)) return "report";
  if (/proposal|contract|agreement|estimate|engagement/.test(n)) return "agreement";
  return "intake";
}

/* ---------- Building a document from a form ---------- */

const MONEY = /cost|amount|fee|total|price|refund|spend|sum|deposit/i;
const WIDE = /architect|address|description|name of|what|where|reason|item|project|company|client|property|work|scope|details/i;
const SIGNATURE_LINE = /^Signature:/;

const money = (raw: string) => {
  const n = Number(raw);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : raw;
};

function shown(f: FormField, raw: string | undefined, filled: boolean): string {
  if (!filled) return "";
  const v = (raw ?? "").trim();
  if (f.type === "checkbox") return v === "true" ? "Yes" : "No";
  if (f.type === "date") return isDay(v) ? formatDayLong(v) : v;
  if (f.type === "number" && MONEY.test(f.label) && v) return money(v);
  return v;
}

/** True when the template is just `Label: {{Field}}` lines (the standard layout), not hand-written wording. */
function isStandardLayout(form: FormTemplate): boolean {
  const t = form.documentTemplate.trim();
  if (!t || t === layoutTemplate(form.description, form.fields).trim()) return true;
  return t.split(/\r?\n/).every((line) => {
    const l = line.trim();
    return l === "" || /^-+$/.test(l) || SIGNATURE_LINE.test(l) || l === form.description || /^[^{}]*:\s*(\{\{[^{}]+\}\})?$/.test(l) || /^\{\{[^{}]+\}\}$/.test(l);
  });
}

function fillTemplate(form: FormTemplate, values: Record<string, string>, filled: boolean): string {
  const byLabel = new Map(form.fields.map((f) => [f.label.toLowerCase(), f]));
  return form.documentTemplate.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, label: string) => {
    const f = byLabel.get(label.toLowerCase());
    return f ? shown(f, values[f.id], filled) : "";
  }).trim();
}

/** Packs short fields into rows of up to three cells; wide ones take two shares of a row. */
function cellRows(fields: FormField[], valueOf: (f: FormField) => string): DocBlock[] {
  const rows: DocBlock[] = [];
  let row: DocCell[] = [], used = 0;
  const flush = () => { if (row.length) rows.push({ t: "cells", cells: row }); row = []; used = 0; };
  for (const f of fields) {
    const value = valueOf(f);
    const weight = WIDE.test(f.label) || value.length > 28 ? 2 : 1;
    if (used + weight > 3) flush();
    row.push({ label: f.label, value, weight });
    used += weight;
    if (used >= 3) flush();
  }
  flush();
  return rows;
}

function build(form: FormTemplate, values: Record<string, string>, filled: boolean, business?: DocBusiness): Doc {
  const key = idKey(form);
  const kind = kindFor(form), style = KINDS[kind], agreement = kind === "agreement";
  const blocks: DocBlock[] = [];
  const val = (f: FormField) => shown(f, values[f.id], filled);

  /** Lays fields out one after another: short ones share rows, checkboxes become a list, long answers a box. */
  const walk = (fields: FormField[], growLast: boolean) => {
    const lastLong = fields.map((f) => f.type).lastIndexOf("longtext");
    const longCount = fields.filter((f) => f.type === "longtext").length;
    let i = 0;
    while (i < fields.length) {
      const f = fields[i]!;
      if (f.type === "longtext") {
        blocks.push({ t: "heading", text: f.label });
        blocks.push({ t: "box", text: val(f), min: filled ? (agreement ? 130 : 46) : longCount === 1 ? 150 : longCount === 2 ? 100 : longCount === 3 ? 70 : 52, grow: growLast && !filled && i === lastLong });
        i++;
      } else {
        const isCheck = f.type === "checkbox";
        const run: FormField[] = [];
        while (i < fields.length && fields[i]!.type !== "longtext" && (fields[i]!.type === "checkbox") === isCheck) run.push(fields[i++]!);
        if (isCheck) {
          blocks.push({ t: "heading", text: style.checks ?? "Confirmations" });
          blocks.push({ t: "checks", items: run.map((c) => ({ label: c.label, checked: filled && values[c.id] === "true" })) });
        } else blocks.push(...cellRows(run, val));
      }
    }
  };

  if (isStandardLayout(form)) {
    // The page follows the form field by field, in the same order and under the same labels, so what a client
    // fills in is exactly what the template shows. Edit the form and the page changes with it.
    walk(form.fields, true);
  } else {
    // Hand-written wording is kept as written, with the answers filled in. A field the wording does not mention
    // (one added later) is still printed below it, so nothing a client is asked for goes missing.
    const used = new Set([...form.documentTemplate.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1]!.toLowerCase()));
    const unused = form.fields.filter((f) => !used.has(f.label.toLowerCase()));
    blocks.push({ t: "heading", text: form.description || form.name });
    blocks.push({ t: "box", text: fillTemplate(form, values, filled), min: filled ? 80 : 180, grow: !filled && unused.length === 0 });
    walk(unused, true);
  }

  const terms = TERMS[key] ?? style.terms;
  if (terms) blocks.push({ t: "terms", text: terms });
  if (!NO_SIGN_LINES.has(key)) {
    blocks.push({ t: "cells", sign: true, cells: (SIGNERS[key] ?? style.sign).flatMap((s) => [{ label: s, weight: 3 }, { label: "Date", weight: 1 }]) });
  }
  return { title: form.name, subtitle: form.description || undefined, business, blocks };
}

/** A filled-in form as a finished document. */
export function formDocument(form: FormTemplate, s: Pick<Submission, "values">, business?: DocBusiness): Doc {
  return build(form, s.values, true, business);
}

/** The same page with every answer left empty, to print and fill in by hand. */
export function blankFormDocument(form: FormTemplate, business?: DocBusiness): Doc {
  return build(form, {}, false, business);
}

/* ---------- Plain text (reports, packets, signed copies) as a document ---------- */

const KEY_VALUE = /^\s*([^:\[\]]{1,60}?):\s+(.+)$/;
const isHeading = (l: string) => /^==\s*.+\s*==$/.test(l) || (l.length <= 48 && /[A-Z]/.test(l) && l === l.toUpperCase() && !/[:\[]/.test(l));

/** Lays out the plain-text documents the app writes: title, details, labelled rows, check lists and paragraphs. */
export function plainDocument(text: string, business?: DocBusiness): Doc {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length && lines[0]!.trim() === "") lines.shift();
  const title = (lines.shift() ?? "").replace(/^==\s*|\s*==$/g, "").trim();
  const blocks: DocBlock[] = [];
  const subtitle: string[] = [];
  // Short lines straight under the title ("As of ...", "For ...") are its subtitle; anything longer is the body.
  while (subtitle.length < 2 && lines.length && lines[0]!.trim() !== "" && lines[0]!.trim().length <= 90 && !KEY_VALUE.test(lines[0]!) && !/^\s*\[/.test(lines[0]!)) subtitle.push(lines.shift()!.trim());

  const paragraphs: string[][] = [[]];
  for (const l of lines) { if (l.trim() === "") { if (paragraphs.at(-1)!.length) paragraphs.push([]); } else paragraphs.at(-1)!.push(l); }
  for (const p of paragraphs.filter((x) => x.length)) {
    let rest = p;
    const first = p[0]!.trim();
    if (isHeading(first) || (p.length > 1 && !KEY_VALUE.test(first) && !/^\[/.test(first) && p.slice(1).every((l) => KEY_VALUE.test(l) && /^\s/.test(l)))) {
      blocks.push({ t: "heading", text: first.replace(/^==\s*|\s*==$/g, "") });
      rest = p.slice(1);
    }
    if (!rest.length) continue;
    if (rest.every((l) => /^\s*\[( |x)\]\s/i.test(l))) {
      blocks.push({ t: "checks", items: rest.map((l) => ({ label: l.replace(/^\s*\[( |x)\]\s*/i, ""), checked: /^\s*\[x\]/i.test(l) })) });
    } else if (rest.every((l) => KEY_VALUE.test(l))) {
      blocks.push({ t: "rows", rows: rest.map((l) => { const m = KEY_VALUE.exec(l)!; return [m[1]!.trim(), m[2]!.trim()] as [string, string]; }) });
    } else {
      blocks.push({ t: "para", text: rest.join("\n") });
    }
  }
  return { title, subtitle: subtitle.join("  |  ") || undefined, business, blocks };
}
