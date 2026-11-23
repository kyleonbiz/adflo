import { equipmentAlerts } from "@/lib/equipment/logic";
import type { Equipment } from "@/lib/equipment/types";
import { daysLeft, licenseAlerts } from "@/lib/licenses/logic";
import type { License } from "@/lib/licenses/types";
import { vendorAlerts } from "@/lib/vendors/logic";
import type { Vendor } from "@/lib/vendors/types";
import { brandedEmail } from "@/lib/mail/layout";

/**
 * The renewal and expiry email. A daily job looks at each workspace's saved licenses, vendors and equipment and builds
 * this message, so a deadline reaches the owner's inbox instead of waiting in the app. Pure functions: the job loads
 * the records and sends the mail; everything decided here is covered by unit tests.
 *
 * When something is sent:
 *  - **Threshold day.** A license that is exactly one of its reminder lead times away (for example 60, 30 or 7 days)
 *    triggers an email that day.
 *  - **Monday roundup.** Every Monday, if anything is overdue or due soon, one email lists all of it.
 *  - Never more than one email per workspace per day, and nothing at all when nothing needs attention.
 */

export type DigestSeverity = "critical" | "warning";
export type DigestKind = "license" | "vendor" | "equipment";

export interface DigestItem {
  kind: DigestKind;
  name: string;
  message: string;
  severity: DigestSeverity;
  /** Lower sorts first: overdue and soonest-due items lead. */
  rank: number;
}

export interface DigestInput {
  licenses: License[];
  vendors: Vendor[];
  equipment: Equipment[];
}

export interface Digest {
  /** Why it is going out today: a license hit a reminder day, it is Monday, or both. */
  reasons: ("threshold" | "weekly")[];
  items: DigestItem[];
}

/** Monday as a calendar day string (`YYYY-MM-DD`), in the same calendar the app uses for `today`. */
export const isMonday = (today: string): boolean => new Date(`${today}T00:00:00Z`).getUTCDay() === 1;

const KIND_LABEL: Record<DigestKind, string> = { license: "License", vendor: "Vendor", equipment: "Equipment" };
const severityRank = { critical: 0, warning: 1 } as const;

function collect(input: DigestInput, today: string): DigestItem[] {
  const items: DigestItem[] = [];
  for (const l of input.licenses) {
    const left = daysLeft(l, today);
    for (const a of licenseAlerts(l, today)) {
      if (a.kind === "review" || a.severity === "info") continue;
      items.push({ kind: "license", name: l.name, message: a.message, severity: a.severity, rank: left });
    }
  }
  for (const v of input.vendors) {
    for (const a of vendorAlerts(v, today)) {
      if (a.severity === "info") continue;
      items.push({ kind: "vendor", name: v.name, message: a.message, severity: a.severity, rank: a.severity === "critical" ? -1000 : 0 });
    }
  }
  for (const e of input.equipment) {
    for (const a of equipmentAlerts(e, today)) {
      if (a.severity === "info") continue;
      items.push({ kind: "equipment", name: e.name, message: a.message, severity: a.severity, rank: a.severity === "critical" ? -1000 : 0 });
    }
  }
  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.rank - b.rank || a.name.localeCompare(b.name));
}

/** Licenses whose days left equal one of their reminder lead times today (or are 0). Submitted renewals are with the issuer, so they are left alone. */
export function thresholdLicenses(licenses: License[], today: string): License[] {
  return licenses.filter((l) => {
    if (l.stage === "submitted") return false;
    const left = daysLeft(l, today);
    return left >= 0 && (l.reminderDays.includes(left) || left === 0);
  });
}

/** What to email today, or null when there is nothing to say. */
export function buildDigest(input: DigestInput, today: string): Digest | null {
  const items = collect(input, today);
  if (items.length === 0) return null;
  const reasons: Digest["reasons"] = [];
  if (thresholdLicenses(input.licenses, today).length > 0) reasons.push("threshold");
  if (isMonday(today)) reasons.push("weekly");
  if (reasons.length === 0) return null;
  return { reasons, items };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const MAX_ROWS = 15;

/** The subject line: leads with the most urgent thing so it reads well in an inbox. */
export function digestSubject(d: Digest): string {
  const critical = d.items.filter((i) => i.severity === "critical").length;
  const rest = d.items.length - critical;
  if (critical > 0) return `${plural(critical, "item")} need${critical === 1 ? "s" : ""} attention now${rest > 0 ? `, ${rest} more coming up` : ""}`;
  return `${plural(d.items.length, "item")} coming up in AdFlo`;
}

/** The email itself: branded HTML and a plain-text copy. `appUrl` links to the app; `team` is the business name. */
export function digestEmail(d: Digest, o: { team: string; appUrl: string }): { subject: string; text: string; html: string } {
  const team = o.team.replace(/[\r\n\u0000-\u001f]+/g, " ").trim() || "your team";
  const shown = d.items.slice(0, MAX_ROWS);
  const more = d.items.length - shown.length;
  const subject = digestSubject(d);
  const lead = d.items.some((i) => i.severity === "critical")
    ? "Some items are overdue or due within days. Here is what to deal with first."
    : "Nothing is overdue, but these are coming up soon.";
  const row = (i: DigestItem): [string, string] => [`${KIND_LABEL[i.kind]}: ${i.name}`, i.message];
  return {
    subject,
    html: brandedEmail({
      preheader: lead,
      headline: "Your renewals and deadlines",
      intro: [`Hi, this is your AdFlo summary for ${team}.`, lead],
      panel: [...shown.map(row), ...(more > 0 ? [["And more", `${plural(more, "more item")} in AdFlo`] as [string, string]] : [])],
      buttons: [{ label: "Open AdFlo", url: o.appUrl }],
      fine: ["You get this because renewal reminders are on for your workspace. You can turn them off in Settings, Notifications."],
    }),
    text: [
      `Hi, this is your AdFlo summary for ${team}.`,
      "",
      lead,
      "",
      ...shown.map((i) => `- ${KIND_LABEL[i.kind]}: ${i.name}. ${i.message}`),
      ...(more > 0 ? [`- And ${plural(more, "more item")} in AdFlo.`] : []),
      "",
      `Open AdFlo: ${o.appUrl}`,
      "",
      "You get this because renewal reminders are on for your workspace. You can turn them off in Settings, Notifications.",
    ].join("\n"),
  };
}
