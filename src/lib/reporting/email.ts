import { brandedEmail } from "@/lib/mail/layout";
import { formatDayLong } from "@/lib/dates";
import type { ModuleReport } from "./logic";
import { OVERVIEW_ID, overviewText, reportText } from "./schedule";

const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim();
const MAX_PANEL = 40;

/**
 * The email for a scheduled report: the report as a short panel of figures, and the same report in full as plain text. `reports` are
 * the workspace's module reports; the "overview" is every report that has records in it.
 */
export function reportEmail(reportId: string, reports: ModuleReport[], ctx: { business: string; today: string; appUrl: string }): { subject: string; text: string; html: string } | null {
  const overview = reportId === OVERVIEW_ID;
  const picked = overview ? reports.filter((r) => r.count > 0) : reports.filter((r) => r.id === reportId);
  if (picked.length === 0) return null;
  const business = oneLine(ctx.business) || "Your business";
  const name = overview ? "Business summary" : picked[0].name;
  const text = overview ? overviewText(picked, ctx.today) : reportText(picked[0], ctx.today);

  const panel: [string, string][] = [];
  for (const r of picked) {
    if (overview) panel.push([r.name.toUpperCase(), `${r.count} ${r.noun}`]);
    for (const m of r.metrics) panel.push([oneLine(m.label), `${oneLine(m.value)}${m.note ? ` (${oneLine(m.note)})` : ""}`]);
    if (!overview) for (const b of r.breakdowns) {
      panel.push([oneLine(b.title).toUpperCase(), ""]);
      for (const row of b.rows) panel.push([oneLine(row.label), oneLine(row.display ?? String(row.value))]);
    }
  }
  return {
    subject: `${business}: ${name} for ${formatDayLong(ctx.today)}`,
    text: [`${name} for ${business}`, "", text, `Open Reporting: ${ctx.appUrl}`, "", "You get this because the report is scheduled in Reporting."].join("\n"),
    html: brandedEmail({
      preheader: `${name} as of ${formatDayLong(ctx.today)}`,
      headline: name,
      intro: [`Here is the ${name.toLowerCase()} for ${business}, as of ${formatDayLong(ctx.today)}.`],
      panel: panel.slice(0, MAX_PANEL),
      buttons: [{ label: "Open Reporting", url: ctx.appUrl }],
      fine: [panel.length > MAX_PANEL ? "The full report is in the plain-text version of this email and in Reporting." : "", "You get this because the report is scheduled in Reporting."].filter(Boolean),
    }),
  };
}
