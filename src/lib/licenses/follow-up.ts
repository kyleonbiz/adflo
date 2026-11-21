import { daysBetween, formatDayLong } from "@/lib/dates";
import { daysLeft, expiryText, licenseStatus, missingDocuments } from "./logic";
import type { License } from "./types";

/** A license that is still unrenewed is chased again after this many days. */
export const LICENSE_REMINDER_GAP_DAYS = 7;

/** Licenses to chase today: inside their renewal window (or expired), not yet submitted for renewal, and not reminded in the last week. Most urgent first. */
export function dueLicenseFollowUps(licenses: License[], today: string): { license: License; sent: number; left: number }[] {
  return licenses
    .filter((l) => licenseStatus(l, today) !== "active" && l.stage !== "submitted")
    .filter((l) => {
      const last = (l.remindedOn ?? []).at(-1);
      return !last || daysBetween(last, today) >= LICENSE_REMINDER_GAP_DAYS;
    })
    .map((license) => ({ license, sent: (license.remindedOn ?? []).length, left: daysLeft(license, today) }))
    .sort((a, b) => a.left - b.left || a.license.name.localeCompare(b.license.name));
}

/** The reminder to send to whoever handles the renewal, worded a little firmer each time. `to` is left blank: the person sending fills it in. */
export function licenseReminderEmail(l: License, today: string): { to: string; subject: string; body: string } {
  const n = (l.remindedOn ?? []).length;
  const left = daysLeft(l, today);
  const missing = l.requiredDocuments.filter((d) => !d.received).map((d) => `  - ${d.label}`);
  const opener = left < 0 ? `${l.name} expired on ${formatDayLong(l.expiresOn)} and has not been renewed.`
    : n === 0 ? `${l.name} expires on ${formatDayLong(l.expiresOn)} (${expiryText(left).toLowerCase()}).`
    : `A follow-up: ${l.name} still needs renewing. It expires on ${formatDayLong(l.expiresOn)} (${expiryText(left).toLowerCase()}).`;
  return {
    to: "",
    subject: `${left < 0 ? "Expired" : "Renewal needed"}: ${l.name}`,
    body: [
      "Hi,", "", opener,
      ...(l.issuer ? [`Issuer: ${l.issuer}`] : []),
      ...(l.number ? [`Number: ${l.number}`] : []),
      ...(missingDocuments(l) > 0 ? ["", "Still needed for the renewal:", ...missing] : []),
      "", "Please let me know when this has been submitted.", "", "Thank you",
    ].join("\n"),
  };
}

/** Records that a reminder was prepared today. */
export const logLicenseReminder = (l: License, today: string): License => ({ ...l, remindedOn: [...(l.remindedOn ?? []), today].slice(-20) });
