import { formatDayLong } from "@/lib/dates";
import type { ModuleReport } from "@/lib/reporting/logic";
import { HEALTH_TEXT, progress, projectHealth, taskState } from "@/lib/projects/logic";
import type { Project } from "@/lib/projects/types";
import type { Block, TextRun } from "./parse";
import type { DocumentSpec, Letterhead } from "./types";

const t = (s: string | number, b = false): TextRun[] => [{ kind: "text", text: String(s), ...(b ? { bold: true } : {}) }];
const MAX_ROWS = 500;

/** One service's report body: a measures table, each breakdown as its own small table, then the records themselves. */
function reportBlocks(r: ModuleReport, level: 1 | 2): Block<TextRun>[] {
  const out: Block<TextRun>[] = [];
  if (r.count === 0) return [{ kind: "paragraph", lines: [t("No records yet.")] }];
  if (r.metrics.length) out.push({ kind: "table", header: [t("Measure", true), t("Value", true)], rows: r.metrics.map((m) => [t(m.label), t(m.note ? `${m.value} (${m.note})` : m.value, true)]) });
  for (const b of r.breakdowns) {
    out.push({ kind: "heading", level: (level + 1) as 2 | 3, runs: t(b.title) });
    out.push({ kind: "table", header: [t("Item", true), t("Count", true)], rows: b.rows.map((x) => [t(x.label), t(x.display ?? x.value)]) });
  }
  if (r.table.rows.length) {
    out.push({ kind: "heading", level: (level + 1) as 2 | 3, runs: t("Records") });
    out.push({ kind: "table", header: r.table.headers.map((h) => t(h, true)), rows: r.table.rows.slice(0, MAX_ROWS).map((row) => row.map((c) => t(c))) });
    if (r.table.rows.length > MAX_ROWS) out.push({ kind: "paragraph", lines: [t(`Showing the first ${MAX_ROWS} of ${r.table.rows.length} records. Download the spreadsheet for all of them.`)] });
  }
  return out;
}

export function reportDocument(r: ModuleReport, today: string, letterhead: Letterhead): DocumentSpec {
  return { title: `${r.name} Report`, letterhead, meta: [["As of", formatDayLong(today)], ["Records", `${r.count} ${r.noun}`]], blocks: reportBlocks(r, 1) };
}

/** Every service's report in one document. */
export function overviewDocument(reports: ModuleReport[], today: string, letterhead: Letterhead): DocumentSpec {
  const blocks = reports.flatMap((r): Block<TextRun>[] => [
    { kind: "heading", level: 1, runs: t(`${r.name} (${r.count} ${r.noun})`) },
    ...reportBlocks({ ...r, table: { headers: [], rows: [] } }, 1),
  ]);
  return { title: "Business Summary", letterhead, meta: [["As of", formatDayLong(today)], ["Services", String(reports.length)]], blocks };
}

const STATE = { done: "Done", overdue: "Overdue", due_today: "Due today", due_soon: "Due soon", open: "Open", unscheduled: "No date" } as const;

/** The project status report: each project with its details, then its tasks in a table. */
export function projectsDocument(projects: Project[], today: string, letterhead: Letterhead): DocumentSpec {
  const blocks: Block<TextRun>[] = [];
  for (const p of projects) {
    const { done, total, percent } = progress(p);
    blocks.push({ kind: "heading", level: 1, runs: t(p.name) });
    blocks.push({ kind: "table", header: null, rows: [
      [t("Client", true), t(p.client || "n/a")],
      [t("Status", true), t(`${p.status.replace("_", " ")} · ${HEALTH_TEXT[projectHealth(p, today)]}`)],
      [t("Dates", true), t(`${formatDayLong(p.startOn)} to ${formatDayLong(p.dueOn)}`)],
      [t("Progress", true), t(`${done} of ${total} tasks complete (${percent}%)`)],
    ] });
    if (p.tasks.length) {
      blocks.push({ kind: "table", header: [t("Task", true), t("Assignee", true), t("Due", true), t("Status", true)], rows: p.tasks.map((k) => [
        t(k.title), t(k.assignee || "—"), t(k.done ? `Done ${formatDayLong(k.doneOn ?? today)}` : k.dueOn ? formatDayLong(k.dueOn) : "—"), t(STATE[taskState(k, today) as keyof typeof STATE] ?? "Open", true),
      ]) });
    }
  }
  if (!projects.length) blocks.push({ kind: "paragraph", lines: [t("No projects yet.")] });
  return { title: "Project Status Report", letterhead, meta: [["As of", formatDayLong(today)], ["Projects", String(projects.length)]], blocks };
}
