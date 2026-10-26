import { addDays, addMonths, daysBetween } from "@/lib/dates";
import type { License, LicenseAlert, LicenseStatus, RenewalTask } from "./types";

/** Within this many days of expiry a license counts as "expiring". */
export const EXPIRING_DAYS = 30;
/** Within this many days (or expired) the missing-document alert becomes critical. */
export const CRITICAL_DAYS = 14;

export function daysLeft(license: License, today: string): number {
  return daysBetween(today, license.expiresOn);
}

/** The largest reminder lead time; the renewal window opens this many days before expiry. */
export function renewalWindowDays(license: License): number {
  return Math.max(EXPIRING_DAYS, ...license.reminderDays);
}

export function licenseStatus(license: License, today: string): LicenseStatus {
  const left = daysLeft(license, today);
  if (left < 0) return "expired";
  if (left <= EXPIRING_DAYS) return "expiring";
  if (left <= renewalWindowDays(license)) return "renewal_window";
  return "active";
}

export function missingDocuments(license: License): number {
  return license.requiredDocuments.filter((d) => !d.received).length;
}

/** The next reminder date on or after `today`, or null when every reminder has already fired. */
export function nextReminder(license: License, today: string): { on: string; daysBefore: number } | null {
  const upcoming = [...new Set(license.reminderDays)]
    .map((daysBefore) => ({ daysBefore, on: addDays(license.expiresOn, -daysBefore) }))
    .filter((r) => r.on >= today)
    .sort((a, b) => (a.on < b.on ? -1 : 1));
  return upcoming[0] ?? null;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "12 days left", "Expires today" or "3 days overdue". */
export function expiryText(left: number): string {
  if (left < 0) return `${plural(-left, "day")} overdue`;
  if (left === 0) return "Expires today";
  return `${plural(left, "day")} left`;
}

/**
 * Alerts that apply today, most severe first. Once a renewal is submitted the ball is in the issuer's
 * court, so expiry alerts calm down and missing documents no longer nag.
 */
export function licenseAlerts(license: License, today: string): LicenseAlert[] {
  const left = daysLeft(license, today);
  const missing = missingDocuments(license);
  const submitted = license.stage === "submitted";
  const alerts: LicenseAlert[] = [];

  if (left < 0) {
    alerts.push(submitted
      ? { severity: "warning", message: `Expired ${plural(-left, "day")} ago. Renewal submitted, waiting on the issuer.` }
      : { severity: "critical", message: `Expired ${plural(-left, "day")} ago. Renew immediately.` });
  } else if (left <= EXPIRING_DAYS || left <= renewalWindowDays(license)) {
    const text = left === 0 ? "Expires today." : left <= EXPIRING_DAYS ? `Expires in ${plural(left, "day")}.` : `Renewal window is open (${plural(left, "day")} left).`;
    if (submitted) alerts.push({ severity: "info", message: `${text} Renewal submitted, waiting on the issuer.` });
    else if (left <= 7) alerts.push({ severity: "critical", message: text });
    else if (left <= EXPIRING_DAYS) alerts.push({ severity: "warning", message: text });
    else alerts.push({ severity: "info", message: text });
  }

  if (!submitted && missing > 0 && left <= renewalWindowDays(license)) {
    alerts.push({
      severity: left <= CRITICAL_DAYS ? "critical" : "warning",
      message: `${plural(missing, "required document")} still missing.`,
    });
  }
  if (license.datesConfirmed === false) {
    alerts.push({ severity: "warning", message: "Placeholder dates. Enter the real number and expiry." });
  }
  const order = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Renewal tasks are derived, not stored: one per license that is inside its renewal window or expired. */
export function renewalTasks(licenses: License[], today: string): RenewalTask[] {
  const order = { critical: 0, warning: 1, info: 2 } as const;
  return licenses
    .filter((l) => licenseStatus(l, today) !== "active")
    .map((l) => ({
      licenseId: l.id,
      title: `Renew ${l.name}`,
      dueOn: l.expiresOn,
      daysLeft: daysLeft(l, today),
      severity: licenseAlerts(l, today)[0]?.severity ?? "info",
      stage: l.stage,
    }))
    .sort((a, b) => order[a.severity] - order[b.severity] || a.daysLeft - b.daysLeft);
}

export interface RenewalInput {
  /** The expiry the issuer actually granted; defaults to one renewal term past the old expiry (or today when lapsed). */
  expiresOn?: string;
  number?: string;
}

/** The expiry a renewal gets when the issuer's date isn't known: a term from the old expiry, or from today when it already lapsed. */
export function suggestedExpiry(license: License, today: string): string {
  const from = license.expiresOn >= today ? license.expiresOn : today;
  return addMonths(from, license.renewalTermMonths);
}

/**
 * Marks a license renewed: the new term ends on `expiresOn` (or the suggested date), the renewal stage
 * resets, the required documents must be collected again and the renewal is added to its history.
 */
export function renewLicense(license: License, today: string, input: RenewalInput = {}): License {
  const expiresOn = input.expiresOn ?? suggestedExpiry(license, today);
  return {
    ...license,
    number: input.number ?? license.number,
    issuedOn: today,
    expiresOn,
    stage: "not_started",
    datesConfirmed: true,
    requiredDocuments: license.requiredDocuments.map((d) => ({ ...d, received: false })),
    renewals: [...(license.renewals ?? []), { on: today, previousExpiresOn: license.expiresOn, newExpiresOn: expiresOn }],
  };
}

export interface LicenseSummary {
  total: number;
  active: number;
  /** Inside the renewal window but more than `EXPIRING_DAYS` out. */
  renewalWindow: number;
  expiring: number;
  expired: number;
  missingDocuments: number;
}

export function summarize(licenses: License[], today: string): LicenseSummary {
  const s: LicenseSummary = { total: licenses.length, active: 0, renewalWindow: 0, expiring: 0, expired: 0, missingDocuments: 0 };
  for (const l of licenses) {
    const status = licenseStatus(l, today);
    if (status === "expired") s.expired++;
    else if (status === "expiring") s.expiring++;
    else if (status === "renewal_window") s.renewalWindow++;
    else s.active++;
    s.missingDocuments += missingDocuments(l);
  }
  return s;
}
