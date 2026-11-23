// Fictional contractor data for the demo videos. Nothing here is real customer data.
export const COMPANY_NAME = "Summit Comfort HVAC LLC";
const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const COMPANY = COMPANY_NAME;

const docs = (id, items) => items.map(([label, received], i) => ({ id: `${id}-d${i}`, label, received }));
const lic = (id, name, category, issuer, number, issuedAgo, expiresIn, term, stage, reqs) => ({
  id, name, category, issuer, number, holder: COMPANY, issuedOn: addDays(-issuedAgo), expiresOn: addDays(expiresIn),
  renewalTermMonths: term, reminderDays: [60, 30, 7], stage, notes: "", requiredDocuments: docs(id, reqs),
});
const licenses = [
  lic("l1", "State Contractor License", "professional", "State Licensing Board", "HVAC-448210", 300, 21, 12, "in_progress", [["Renewal application", true], ["Continuing education proof", false]]),
  lic("l2", "General Liability Insurance", "insurance", "Northfield Mutual", "GL-77-140992", 330, 9, 12, "not_started", [["Updated certificate of insurance", false]]),
  lic("l3", "EPA 608 Technician Certification", "professional", "EPA", "608-55120", 700, 240, 0, "not_started", [["Certificate copy", true]]),
  lic("l4", "City Business License", "business", "City Clerk", "BL-2026-3321", 120, 245, 12, "not_started", [["Signed application", true]]),
  lic("l5", "Workers' Compensation Policy", "insurance", "Keystone Insurance", "WC-90412", 200, 160, 12, "not_started", [["Certificate", true]]),
];
const inv = (id, number, client, desc, cents, issued, due, status) => ({
  id, number, client, description: desc, items: [{ description: desc, qty: 1, rateCents: cents }], amountCents: cents,
  issuedOn: addDays(issued), dueOn: addDays(due), status, paidOn: status === "paid" ? addDays(-2) : null, recurrence: "none",
  reminderDays: [7, 1], notes: "", clientEmail: "", taxRate: 0, paymentMethods: ["Check"],
  sender: { name: COMPANY, address: "Nashville, TN", phone: "", email: "" },
});
const invoices = [
  inv("i1", "INV-1041", "Maple Ridge Apartments", "Rooftop unit replacement", 1_850_000, -35, -5, "sent"),
  inv("i2", "INV-1042", "Harbor View Dental", "Spring maintenance contract", 420_000, -20, 10, "sent"),
  inv("i3", "INV-1043", "Greenway Property Group", "Boiler service, 6 units", 960_000, -9, 21, "sent"),
  inv("i4", "INV-1040", "Oakline Church", "Duct cleaning", 310_000, -50, -20, "paid"),
];
const c = (id, name, email, phone, company, category, ago, contacted) => ({ id, name, email, phone, company, category, notes: "", lastContacted: addDays(-contacted), createdOn: addDays(-ago) });
const contacts = [
  c("c1", "Maria Alvarez", "maria@mapleridge.example", "(555) 010-1100", "Maple Ridge Apartments", "Customer", 200, 4),
  c("c2", "Tom Becker", "tom@harborviewdental.example", "(555) 010-2200", "Harbor View Dental", "Customer", 150, 12),
  c("c3", "Lena Ortiz", "lena@coolsupply.example", "(555) 010-3300", "Cool Supply Co.", "Vendor", 300, 30),
  c("c4", "Ray Dunn", "ray@northfield.example", "(555) 010-4400", "Northfield Mutual", "Partner", 400, 20),
];
const t = (id, title, assignee, due, over = {}) => ({ id, title, assignee, dueOn: due === null ? null : addDays(due), repeat: "none", done: false, doneOn: null, followUpId: null, ...over });
const projects = [{
  id: "p1", name: "Maple Ridge: rooftop replacements", client: "Maple Ridge Apartments", description: "Replace four rooftop units.",
  status: "active", startOn: addDays(-14), dueOn: addDays(20),
  tasks: [
    t("t1", "Permit application", "Sam", -10, { done: true, doneOn: addDays(-11) }),
    t("t2", "Order units", "Sam", -2),
    t("t3", "Crane scheduling", "Jo", 3),
    t("t4", "Final inspection", "Jo", 18),
  ],
}];
export const seed = { licenses, invoices, contacts, projects, vendors: [], submissions: [] };


const vd = (id, type, required, receivedAgo, expiresIn = null) => ({ id, type, required, receivedOn: receivedAgo === null ? null : addDays(-receivedAgo), expiresOn: expiresIn === null ? null : addDays(expiresIn) });
const vnd = (o) => ({ contactName: "", email: "", phone: "", taxId: "", notes: "", createdOn: addDays(-90), ...o });
seed.vendors = [
  vnd({ id: "v1", name: "Cool Supply Co.", category: "Parts supplier", status: "active", contactName: "Lena Ortiz", email: "lena@coolsupply.example", phone: "(555) 010-3300", taxId: "123456789",
    documents: [vd("vd1", "W-9", true, 200), vd("vd2", "Certificate of insurance", true, 335, 12)] }),
  vnd({ id: "v2", name: "Crane & Rigging Partners", category: "Subcontractor", status: "active", contactName: "Eli Marsh", email: "eli@craneandrigging.example", phone: "(555) 010-5500",
    documents: [vd("vd3", "W-9", true, 120), vd("vd4", "Certificate of insurance", true, 370, -5), vd("vd5", "Signed subcontract", true, 120)] }),
  vnd({ id: "v3", name: "Precision Electric", category: "Subcontractor", status: "onboarding", createdOn: addDays(-6), contactName: "Dee Park", email: "dee@precisionelectric.example", phone: "(555) 010-4400",
    documents: [vd("vd6", "W-9", true, null), vd("vd7", "Certificate of insurance", true, null), vd("vd8", "Trade license", true, 3, 300)] }),
];
