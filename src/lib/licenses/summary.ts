import { formatDayLong } from "@/lib/dates";
import { csvCell } from "@/lib/csv";
import { compliance, daysLeft, expiryText, licenseStatus, missingDocuments } from "./logic";
import type { License } from "./types";

const STATUS_TEXT = { active: "Active", renewal_window: "Renewal window", expiring: "Expiring soon", expired: "Expired" } as const;

/** A plain-text compliance summary for an auditor, insurer or client: every license with its number, issuer, dates and standing. Soonest expiry first. */
export function licenseSummaryText(licenses: License[], today: string, business = ""): string {
  const std = compliance(licenses, today);
  const rows = [...licenses].sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  const lines = [
    `${business ? `${business}: ` : ""}Licenses and renewals summary`,
    `As of ${formatDayLong(today)}`,
    `${std.total} tracked, ${std.inGoodStanding} in good standing (${std.percent}%)`,
    "",
  ];
  for (const l of rows) {
    const missing = l.requiredDocuments.filter((d) => !d.received).map((d) => d.label);
    lines.push(
      `${l.name} [${STATUS_TEXT[licenseStatus(l, today)]}]`,
      `  Issuer: ${l.issuer || "n/a"}   Number: ${l.number || "n/a"}   Holder: ${l.holder || "n/a"}`,
      `  Expires ${formatDayLong(l.expiresOn)} (${expiryText(daysLeft(l, today)).toLowerCase()})`,
      ...(missingDocuments(l) > 0 ? [`  Missing documents: ${missing.join(", ")}`] : []),
      "",
    );
  }
  if (rows.length === 0) lines.push("No licenses are tracked yet.");
  return lines.join("\n").trimEnd() + "\n";
}

export function licensesToCsv(licenses: License[], today: string): string {
  const head = ["Name", "Category", "Issuer", "Number", "Holder", "Issued", "Expires", "Days left", "Status", "Stage", "Missing documents"];
  const rows = licenses.map((l) => [l.name, l.category, l.issuer, l.number, l.holder, l.issuedOn, l.expiresOn, daysLeft(l, today), STATUS_TEXT[licenseStatus(l, today)], l.stage, missingDocuments(l)]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
