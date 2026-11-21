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

/** Which kind each built-in paperwork is. Anything not listed is guessed from its name, then falls back to intake. */
const KIND_OF: Record<string, Kind> = {
  "proposal-contract": "agreement", "completion": "agreement", "warranty": "agreement", "scope-confirmation": "agreement", "scope-of-services": "agreement",
  "incident": "report", "accident": "report", "injury-report": "report", "ncr": "report", "sharps-log": "report", "conflict-check": "report",
  "jsa": "report",
  "temp-log": "log", "thermometer-calibration": "log", "cleaning-log": "log", "pest-control-log": "log", "equipment-log": "log", "sanitation-log": "log",
  "pedicure-log": "log", "patch-test": "log", "medication-log": "log", "drill-log": "log", "refused-sale": "log", "records-destruction": "log",
  "toolbox-talk": "log", "meeting-minutes": "log", "board-minutes": "log",
  "site-inspection": "checklist", "food-safety-inspection": "checklist", "inspection": "checklist", "hazwaste-inspection": "checklist", "store-safety": "checklist",
  "safety-walk": "checklist", "loto-inspection": "checklist", "security-review": "checklist", "move-in": "checklist",
  "nda": "consent", "hipaa-ack": "consent", "client-consent": "consent", "pickup-auth": "consent", "medication-auth": "consent", "field-trip": "consent",
  "volunteer-agreement": "consent", "lead-paint": "consent", "coi-disclosure": "consent",
  "client-intake": "intake", "matter-intake": "intake", "sub-compliance": "intake", "notice-to-enter": "intake", "recall-record": "intake", "file-closing": "intake",
};

/** Wording for particular forms where a generic line would be wrong. */
const TERMS: Record<string, string> = {
  "proposal-contract": "All materials are guaranteed to be as specified and the work will be completed in a professional manner, to industry-standard practice. Any change from the specification that adds cost will be carried out only on written authorization and will be charged beyond the estimate. This agreement is subject to delays beyond our control, such as strikes, accidents, weather or material shortages. The owner is responsible for keeping appropriate insurance on the property.",
  "toolbox-talk": "Everyone listed was present for the briefing and had the chance to ask questions. Keep this record with the project's safety file.",
  "jsa": "Work does not start until the crew has read the hazards and controls above and the supervisor has signed. Stop and re-assess if conditions change.",
  "completion": "The owner confirms the work described is complete except for any items listed, which the contractor will finish. The warranty period begins on the date shown.",
  "warranty": "The contractor will repair defects in the work covered that appear during the warranty period and are reported in writing. Normal wear, misuse, and damage caused by others are not covered.",
  "nda": "The person signing agrees to keep the information shared with them private and to use it only for the purpose it was given.",
  "hipaa-ack": "The patient confirms they were offered the notice of privacy practices and had the chance to ask questions about it.",
  "client-consent": "The client has described any allergies or sensitivities above, understands the service, and agrees to proceed.",
  "pickup-auth": "Only the people listed may collect the child. Photo identification will be checked each time.",
  "incident": "Keep this report on file. Complete it as soon as possible after the incident, while the details are fresh.",
  "injury-report": "A parent or guardian is told the same day. Keep a copy in the child's file.",
  "accident": "Keep this report with the vehicle's records and give a copy to your insurer.",
  "sub-compliance": "The subcontractor confirms the details above are correct and will keep the insurance shown in force while on the job. Send a new certificate before any policy expires.",
  "site-inspection": "Record what was found and who will fix it, with a date. Keep inspection records with the project's safety file.",
  "thermometer-calibration": "Check thermometers on a regular schedule and whenever one is dropped. Replace any that cannot be adjusted to read true.",
  "cleaning-log": "Keep cleaning records where an inspector can see them.",
  "food-safety-inspection": "Use this to find problems before an inspection does. Your local health department's requirements come first.",
  "pest-control-log": "Keep each service report with this log.",
  "inspection": "The driver signs the report. If a defect is listed, a mechanic or manager signs once it is repaired or confirmed not needed, before the vehicle goes out again. Keep reports for at least three months.",
  "hazwaste-inspection": "Inspect storage areas as often as your state requires (weekly in many states) and keep these records with your waste manifests. Your state's rules decide how long to keep them.",
  "scope-confirmation": "By signing, the client confirms the scope and deliverables above and that anything not listed is not included. Changes are agreed in writing before work on them begins.",
  "scope-of-services": "By signing, the client confirms the services above and what is not included, and agrees to provide the information listed.",
  "move-in": "Both parties confirm the condition recorded above. Use the same record at move-out so the two can be compared, and give the tenant a copy.",
  "lead-paint": "Federal law requires this disclosure before a lease begins for housing built before 1978. Keep the signed copy for at least three years.",
  "notice-to-enter": "Notice periods and allowed reasons depend on your state and city. Confirm yours before relying on this notice.",
  "equipment-log": "Keep sterilization monitoring results with the cleaning record, and follow up on any failed test.",
  "sharps-log": "Keep the injured person's identity private. Record each injury soon after it happens.",
  "pedicure-log": "Keep each tub or basin's log available for clients and inspectors. Rules differ by state.",
  "medication-auth": "Staff give only the medication listed here, as directed. Record each dose on the medication administration log.",
  "medication-log": "Record each dose when it is given.",
  "drill-log": "Keep drill records for your licensing inspector. Run drills as often as your state requires.",
  "field-trip": "The parent or guardian gives permission for this trip only. Staff will call the emergency number above if there is a problem.",
  "loto-inspection": "Done at least once a year for each procedure, by an authorized person other than the employee using it. Fix any deficiency and note the correction.",
  "conflict-check": "Complete before any advice is given or an engagement letter is signed.",
  "file-closing": "Retention periods are set by your bar rules and firm policy. A closing letter helps show the relationship has ended.",
  "security-review": "Review the firm's written information security plan at least once a year and whenever systems or operations change. Keep this record with the plan.",
  "records-destruction": "Destroy records only after the retention period ends and any hold is lifted. Keep this log as proof of when and how they were destroyed.",
  "refused-sale": "Keep this log with your age-restricted sales policy.",
  "recall-record": "Keep this record with the recall notice for your files.",
  "store-safety": "Fix problems found and note who did it and when.",
  "coi-disclosure": "Disclose any interest that could conflict with the organization's, and step out of any vote on the matter. Review this at least once a year.",
  "board-minutes": "Minutes record the discussion, each action taken, and any conflict declared. Keep them permanently with the organization's records.",
  "volunteer-agreement": "This is a general form. Have a lawyer review the release wording for your state, especially for minors and photo use.",
  "meeting-minutes": "Minutes are approved at the next meeting and kept with the organization's records.",
};

/** Who signs, where the generic pair for the kind would be wrong. */
const SIGNERS: Record<string, string[]> = {
  "proposal-contract": ["Contractor signature", "Owner acceptance"],
  "completion": ["Contractor", "Owner acceptance"], "warranty": ["Contractor"],
  "jsa": ["Supervisor", "Safety lead"], "toolbox-talk": ["Led by", "Reviewed by"], "site-inspection": ["Inspected by", "Superintendent"],
  "sub-compliance": ["Verified by", "Project manager"],
  "food-safety-inspection": ["Inspected by", "Manager"], "hazwaste-inspection": ["Inspected by", "Manager"],
  "inspection": ["Driver", "Mechanic or manager"], "accident": ["Driver", "Reviewed by"],
  "scope-confirmation": ["Client", "Provider"], "scope-of-services": ["Client", "Firm"],
  "move-in": ["Tenant", "Property manager"], "lead-paint": ["Lessor or agent", "Tenant"], "notice-to-enter": ["Issued by"],
  "hipaa-ack": ["Patient or guardian"], "equipment-log": ["Reviewed by"], "sharps-log": ["Recorded by", "Reviewed by"],
  "client-consent": ["Client"], "pickup-auth": ["Parent or guardian"], "injury-report": ["Staff member", "Parent or guardian"],
  "medication-auth": ["Parent or guardian", "Staff member"], "drill-log": ["Conducted by", "Reviewed by"], "field-trip": ["Parent or guardian"],
  "loto-inspection": ["Inspector", "Supervisor"], "conflict-check": ["Checked by", "Approved by"], "file-closing": ["Responsible attorney"],
  "security-review": ["Reviewed by", "Firm owner"], "records-destruction": ["Performed by", "Approved by"],
  "store-safety": ["Inspected by", "Manager"], "recall-record": ["Completed by", "Manager"],
  "coi-disclosure": ["Disclosing person", "Board chair"], "board-minutes": ["Secretary", "Board chair"],
  "volunteer-agreement": ["Volunteer", "Parent or guardian (if under 18)"], "meeting-minutes": ["Recorded by", "Approved by"],
};

/** Logs where every entry already carries the name or initials of whoever made it, so no separate signature is wanted. */
const NO_SIGN_LINES = new Set(["temp-log", "thermometer-calibration", "cleaning-log", "pedicure-log", "medication-log", "refused-sale", "sanitation-log", "patch-test"]);

const idKey = (form: FormTemplate) => form.id.replace(/^(pw|tpl)-/, "").replace(/^form-/, "");

function kindFor(form: FormTemplate): Kind {
  const key = idKey(form);
  if (KIND_OF[key]) return KIND_OF[key];
  const n = form.name.toLowerCase();
  if (/log|record/.test(n)) return "log";
  if (/checklist|inspection/.test(n)) return "checklist";
  if (/request/.test(n)) return "request";
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
    const crowded = fields.filter((f) => f.type === "checkbox").length >= 6; // a long checklist leaves less room for the writing areas
    let i = 0;
    while (i < fields.length) {
      const f = fields[i]!;
      if (f.type === "longtext") {
        blocks.push({ t: "heading", text: f.label });
        blocks.push({ t: "box", text: val(f), min: filled ? (agreement ? 130 : 46) : crowded ? 56 : longCount === 1 ? 150 : longCount === 2 ? 100 : longCount === 3 ? 70 : 52, grow: growLast && !filled && i === lastLong });
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
