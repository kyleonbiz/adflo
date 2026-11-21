import { formatDayLong } from "@/lib/dates";
import { docState } from "./logic";
import type { Vendor } from "./types";

const DOC_TEXT = { missing: "Missing", valid: "On file", expiring: "Expiring soon", expired: "Expired" } as const;

/** A plain-text vendor compliance packet: each vendor with its required documents and their state. Vendors with problems come first. */
export function vendorSummaryText(vendors: Vendor[], today: string, business = ""): string {
  const problems = (v: Vendor) => v.documents.filter((d) => d.required && ["missing", "expired"].includes(docState(d, today))).length;
  const rows = [...vendors].sort((a, b) => problems(b) - problems(a) || a.name.localeCompare(b.name));
  const lines = [`${business ? `${business}: ` : ""}Vendor compliance summary`, `As of ${formatDayLong(today)}`, `${vendors.length} vendors, ${rows.filter((v) => problems(v) > 0).length} with missing or expired documents`, ""];
  for (const v of rows) {
    lines.push(`${v.name} [${v.status}]${v.email ? `  ${v.email}` : ""}`);
    for (const d of v.documents.filter((x) => x.required)) {
      const state = docState(d, today);
      lines.push(`  - ${d.type}: ${DOC_TEXT[state]}${d.expiresOn && state !== "missing" ? ` (expires ${formatDayLong(d.expiresOn)})` : ""}`);
    }
    if (v.documents.every((d) => !d.required)) lines.push("  - No required documents");
    lines.push("");
  }
  if (rows.length === 0) lines.push("No vendors yet.");
  return lines.join("\n").trimEnd() + "\n";
}
