import { addDays, addMonths } from "@/lib/dates";
import type { License, RequiredDocument } from "@/lib/licenses/types";

const docs = (id: string, items: [string, boolean][]): RequiredDocument[] =>
  items.map(([label, received], i) => ({ id: `${id}-d${i}`, label, received }));

/** Sample licenses with dates relative to `today`, so every status is represented. */
export function sampleLicenses(today: string): License[] {
  return [
    {
      id: "lic-1", name: "State Business License", category: "business", issuer: "Secretary of State",
      number: "BL-2024-88213", holder: "Aurum Ventura Enterprise LLC",
      issuedOn: addMonths(today, -11), expiresOn: addDays(today, 18), renewalTermMonths: 12,
      reminderDays: [60, 30, 7], stage: "in_progress", notes: "Annual report must be filed before renewal.",
      requiredDocuments: docs("lic-1", [["Annual report", true], ["Proof of registered agent", false], ["Renewal fee receipt", false]]),
    },
    {
      id: "lic-2", name: "City Operating Permit", category: "permit", issuer: "City Clerk",
      number: "OP-5521", holder: "Aurum Ventura Enterprise LLC",
      issuedOn: addMonths(today, -13), expiresOn: addDays(today, -6), renewalTermMonths: 12,
      reminderDays: [45, 14], stage: "not_started", notes: "",
      requiredDocuments: docs("lic-2", [["Signed application", false], ["Insurance certificate", true]]),
    },
    {
      id: "lic-3", name: "General Liability Insurance", category: "insurance", issuer: "Northfield Mutual",
      number: "GL-77-140992", holder: "Aurum Ventura Enterprise LLC",
      issuedOn: addMonths(today, -4), expiresOn: addDays(today, 52), renewalTermMonths: 12,
      reminderDays: [60, 30], stage: "not_started", notes: "Broker: ask for the updated certificate of insurance.",
      requiredDocuments: docs("lic-3", [["Updated certificate of insurance", false], ["Loss run report", false]]),
    },
    {
      id: "lic-4", name: "Notary Public Commission", category: "professional", issuer: "County Recorder",
      number: "NP-30918", holder: "Kyle Fulwood",
      issuedOn: addMonths(today, -20), expiresOn: addDays(today, 410), renewalTermMonths: 48,
      reminderDays: [90, 30], stage: "not_started", notes: "",
      requiredDocuments: docs("lic-4", [["Training certificate", true], ["Bond", true]]),
    },
    {
      id: "lic-5", name: "Sales Tax Registration", category: "registration", issuer: "Department of Revenue",
      number: "ST-9920-04", holder: "Aurum Ventura Enterprise LLC",
      issuedOn: addMonths(today, -3), expiresOn: addDays(today, 262), renewalTermMonths: 24,
      reminderDays: [60, 14], stage: "not_started", notes: "",
      requiredDocuments: docs("lic-5", [["Registration certificate", true]]),
    },
  ];
}
