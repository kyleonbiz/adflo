import { addDays, formatDayLong } from "@/lib/dates";
import { reminderId, setReminder, type Reminder } from "@/lib/reminders/logic";
import { addTodo, hasOpenTodo, MAX_TITLE, pruneTodos, toggleTodo, todaysTodos, type Todo } from "@/lib/todos/logic";
import { explainAll, explainReport } from "@/lib/reporting/explain";
import { buildReports, type ReportSources } from "@/lib/reporting/logic";
import { looksSensitive } from "./guardrails";

/**
 * The few things Addy does by itself instead of opening a form. Each one only touches the owner's own to-do
 * list or reminders, can be undone with one tap, and never saves, deletes, approves, pays, sends or signs
 * anything in a service.
 */
export type DirectAction =
  | { kind: "todo"; title: string }
  | { kind: "remind"; title: string; days: number }
  | { kind: "done"; query: string }
  | { kind: "report"; topic: string; mode: "summary" | "explain" | "export" };

export const MAX_REMIND_DAYS = 60;

const clean = (s: string): string => s.replace(/^["'“”‘’\s]+|["'“”‘’\s.!?]+$/g, "").replace(/\s+/g, " ").trim();

/** Reads a plain request such as "add call the accountant to my to-do list" or "remind me to renew the permit in 3 days". */
export function parseDirect(input: string): DirectAction | null {
  const text = input.trim().replace(/^please\s+/i, "");
  let m: RegExpMatchArray | null;

  if ((m = text.match(/^remind me\s+(?:to|about|of)\s+(.+?)(?:\s+(tomorrow|next week|in a week|in (\d{1,2}) days?))?\s*[.!]*$/i))) {
    const title = clean(m[1]);
    const when = (m[2] ?? "").toLowerCase();
    const days = when === "next week" || when === "in a week" ? 7 : m[3] ? Number(m[3]) : 1;
    return title ? { kind: "remind", title, days: Math.min(Math.max(days, 1), MAX_REMIND_DAYS) } : null;
  }
  if ((m = text.match(/^(?:add|put)\s+(.+?)\s+(?:to|on|onto)\s+(?:my|the|today'?s)?\s*(?:to-?do(?:s)?(?:\s+list)?|task\s+list|list|today)\s*[.!]*$/i))) {
    const title = clean(m[1]);
    return title ? { kind: "todo", title } : null;
  }
  if ((m = text.match(/^(?:add|create)\s+(?:a\s+)?(?:to-?do|task)\s*(?:to|:|-)?\s*(.+)$/i))) {
    const title = clean(m[1]);
    return title ? { kind: "todo", title } : null;
  }
  if ((m = text.match(/^(?:mark|tick(?:\s+off)?|check\s+off|complete|finish)\s+(.+?)\s+(?:as\s+)?(?:done|complete(?:d)?)\s*[.!]*$/i))) {
    const query = clean(m[1]);
    return query ? { kind: "done", query } : null;
  }
  if ((m = text.match(/^(?:export|download)\s+(?:me\s+)?(?:a|an|the|my|all)?\s*(.+?)(?:\s+reports?)?(?:\s+(?:to|as|in|into)\s+(?:a\s+)?(?:csv|excel|xlsx|spreadsheet))?\s*[.!?]*$/i))) {
    const topic = clean(m[1]).toLowerCase();
    return isReportTopic(topic) ? { kind: "report", topic, mode: "export" } : null;
  }
  if ((m = text.match(/^(?:explain|summari[sz]e|break\s+down|walk\s+me\s+through)\s+(?:me\s+)?(?:a|an|the|my|all)?\s*(.*?)\s*(?:reports?|numbers|figures)?\s*[.!?]*$/i))) {
    const topic = clean(m[1]).toLowerCase();
    if (topic ? !isReportTopic(topic) : !/report|numbers|figures/i.test(text)) return null;
    return { kind: "report", topic, mode: "explain" };
  }
  if (/^how\s+(?:are\s+we|is\s+(?:the\s+)?business)\s+doing\s*[.!?]*$/i.test(text)) return { kind: "report", topic: "", mode: "explain" };
  if ((m = text.match(/^(?:run|show|give|pull(?:\s+up)?|generate|build|create)\s+(?:me\s+)?(?:a|an|the|my|all)?\s*(.*?)\s*reports?(?:\s+(?:on|for|about|of)\s+(.+?))?\s*[.!?]*$/i))
    || (m = text.match(/^report\s+on()\s+(.+?)\s*[.!?]*$/i))) {
    return { kind: "report", topic: clean(m[2] || m[1] || "").toLowerCase(), mode: "summary" };
  }
  return null;
}

/** Words people use for each service in a report request. */
const REPORT_TOPICS: Record<string, RegExp> = {
  invoices: /invoice|billing|payment|receivable/, licenses: /licen[sc]e|renewal|permit|compliance/, vendors: /vendor|supplier/,
  crm: /contact|client|customer/, projects: /project|task/, forms: /form|paperwork|submission/, documents: /document|file|record/,
};

const isReportTopic = (t: string) => Object.values(REPORT_TOPICS).some((re) => re.test(t));

export interface DirectContext {
  todos: Todo[]; reminders: Reminder[]; today: string; newId: () => string;
  /** The records Reporting reads. Only the report action needs them. */
  sources?: ReportSources;
}

/** What happened: the sentence to show, the new saved lists (when something changed), and how to put it back. */
export interface DirectResult {
  text: string;
  link?: { label: string; href: string };
  /** A table the owner can save as CSV or Excel. Built from their own records; nothing is sent anywhere. */
  download?: { name: string; headers: string[]; rows: (string | number)[][] };
  todos?: Todo[];
  reminders?: Reminder[];
  undo?: { todos?: Todo[]; reminders?: Reminder[] };
}

/** Carries out one direct action against the saved lists. Pure: the caller saves what comes back. */
export function runDirect(action: DirectAction, ctx: DirectContext): DirectResult {
  const { todos, reminders, today } = ctx;

  if (action.kind === "todo" || action.kind === "remind") {
    if (action.title.length < 2) return { text: "What should it say? Tell me a few words about the task." };
    if (action.title.length > MAX_TITLE) return { text: `That is too long for a to-do. Keep it under ${MAX_TITLE} characters.` };
    if (looksSensitive(action.title)) return { text: "That looks like a card number, Social Security number or password, so I will not write it down. Leave those out and try again." };
  }

  if (action.kind === "todo") {
    if (hasOpenTodo(todos, action.title, today)) return { text: `"${action.title}" is already on your list for today.`, link: { label: "Open today", href: "/app/overview" } };
    const next = pruneTodos(addTodo(todos, action.title, today, ctx.newId()), today);
    return {
      text: `Added "${action.title}" to your to-do list for today.`,
      link: { label: "Open today", href: "/app/overview" },
      todos: next, undo: { todos },
    };
  }

  if (action.kind === "remind") {
    const on = addDays(today, action.days);
    const next = setReminder(reminders, { id: reminderId("task", `addy-${ctx.newId()}`), text: action.title, area: "Tasks", href: "/app/calendar" }, today, action.days);
    return {
      text: `I will remind you on ${formatDayLong(on)}: ${action.title}. It will show in the bell, on the Dashboard and on the calendar.`,
      link: { label: "Open calendar", href: "/app/calendar" },
      reminders: next, undo: { reminders },
    };
  }

  if (action.kind === "report") return runReport(action.topic, action.mode, ctx);

  const q = action.query.toLowerCase();
  const open = todaysTodos(todos, today).filter((t) => !t.done && t.title.toLowerCase().includes(q));
  if (open.length === 0) return { text: `I could not find an open to-do for today that matches "${action.query}".`, link: { label: "Open today", href: "/app/overview" } };
  if (open.length > 1) return { text: `More than one to-do matches "${action.query}": ${open.slice(0, 4).map((t) => `"${t.title}"`).join(", ")}. Say a little more of the one you mean.` };
  return { text: `Ticked off "${open[0].title}".`, link: { label: "Open today", href: "/app/overview" }, todos: toggleTodo(todos, open[0].id), undo: { todos } };
}

/** Read-only: summarizes the same reports the Reporting page shows. Changes nothing, so there is nothing to undo. */
function runReport(topic: string, mode: "summary" | "explain" | "export", ctx: DirectContext): DirectResult {
  const base = { label: "Open Reporting", href: "/app/reporting" };
  if (!ctx.sources) return { text: "I cannot read your records right now. Open Reporting to see them.", link: base };
  const reports = buildReports(ctx.sources, ctx.today).filter((r) => r.count > 0);
  const line = (r: (typeof reports)[number]) =>
    `${r.name} (${r.count} ${r.count === 1 ? r.noun.replace(/s$/, "") : r.noun}): ${r.metrics.slice(0, 4).map((x) => `${x.label} ${x.value}${x.tone === "neutral" ? "" : " ⚠"}`).join(", ")}`;

  const id = Object.keys(REPORT_TOPICS).find((k) => REPORT_TOPICS[k].test(topic));
  if (topic && !id) return { text: "I can report on invoices, licenses, vendors, contacts, projects, forms and documents. Which one do you want?", link: base };
  if (mode === "export" && !id) return { text: "Which report should I export? Say, for example, \"export invoices to Excel\".", link: base };

  const r = id ? reports.find((x) => x.id === id) : undefined;
  if (id && !r) return { text: "There are no records in that service yet, so there is nothing to report. Add some and ask again.", link: base };

  if (mode === "export" && r) {
    if (r.table.rows.length === 0) return { text: `The ${r.name} report has no rows to export.`, link: base };
    const name = `${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${ctx.today}`;
    return {
      text: `The ${r.name} report is ready: ${r.table.rows.length} row${r.table.rows.length === 1 ? "" : "s"}. Pick a format to save it. The file is made in your browser and goes nowhere else.`,
      link: { label: `Open ${r.name} report`, href: `/app/reporting?view=${r.id}` },
      download: { name, headers: r.table.headers, rows: r.table.rows },
    };
  }
  if (mode === "explain") return { text: r ? explainReport(r) : explainAll(reports), link: r ? { label: `Open ${r.name} report`, href: `/app/reporting?view=${r.id}` } : base };
  if (r) return { text: line(r), link: { label: `Open ${r.name} report`, href: `/app/reporting?view=${r.id}` } };
  if (reports.length === 0) return { text: "There are no records in any service yet, so there is nothing to report. This fills in as you add records.", link: base };
  return { text: `Here is where things stand. ⚠ marks something to look at.\n${reports.map(line).join("\n")}`, link: base };
}

/** Plain-language list of what Addy may do by itself, for the model's instructions and the help text. */
export const DIRECT_ABILITIES = [
  "add something to the owner's to-do list for today",
  "set a reminder for the owner (from tomorrow up to 60 days away)",
  "tick off one of the owner's to-dos for today",
  "run a read-only report on the owner's records, explain it in plain language, and offer it as a CSV or Excel download",
] as const;


