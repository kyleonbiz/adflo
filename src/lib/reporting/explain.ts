import type { ModuleReport } from "./logic";

/**
 * A plain-language reading of one report: what is wrong, how much, and where to start. Built only from the
 * report's own numbers (nothing is guessed or invented), so it always agrees with the Reporting page.
 */
export function explainReport(report: ModuleReport): string {
  if (report.count === 0) return `${report.name}: no records yet, so there is nothing to explain. This fills in as you add ${report.noun}.`;

  const danger = report.metrics.filter((m) => m.tone === "danger");
  const warning = report.metrics.filter((m) => m.tone === "warning");
  const say = (m: ReportMetric) => `${m.label.toLowerCase()} is ${m.value}${m.note ? ` (${m.note})` : ""}`;
  const parts = [`${report.name}: ${report.count} ${report.count === 1 ? report.noun.replace(/s$/, "") : report.noun} tracked.`];

  if (danger.length === 0 && warning.length === 0) {
    parts.push("Nothing needs attention right now.");
  } else {
    if (danger.length > 0) parts.push(`Urgent: ${danger.map(say).join("; ")}. Start here.`);
    if (warning.length > 0) parts.push(`Worth a look: ${warning.map(say).join("; ")}.`);
  }

  // The last breakdown is the "by client / type / category" view when there is one, so say who leads it.
  const group = report.breakdowns[report.breakdowns.length - 1];
  const top = group?.rows[0];
  if (group && top && report.breakdowns.length > 1) parts.push(`${group.title}: ${top.label} leads with ${top.display ?? top.value}.`);

  return parts.join(" ");
}

type ReportMetric = ModuleReport["metrics"][number];

/** The explanation for every service that has records, one paragraph each. */
export function explainAll(reports: ModuleReport[]): string {
  const used = reports.filter((r) => r.count > 0);
  if (used.length === 0) return "There are no records in any service yet, so there is nothing to explain. This fills in as you add records.";
  const urgent = used.filter((r) => r.metrics.some((m) => m.tone === "danger")).map((r) => r.name);
  const head = urgent.length > 0 ? `Most urgent: ${urgent.join(", ")}.` : "Nothing is urgent right now.";
  return [head, ...used.map(explainReport)].join("\n\n");
}
