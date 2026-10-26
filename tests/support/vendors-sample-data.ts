import { addDays } from "@/lib/dates";
import type { Vendor, VendorDocument } from "@/lib/vendors/types";

let seq = 0;
/** Sample vendors with dates relative to `today`, so every document state and duplicate reason is represented. */
export function sampleVendors(today: string): Vendor[] {
  seq = 0;
  const d = (type: string, required: boolean, receivedAgo: number | null, expiresIn: number | null = null): VendorDocument => ({
    id: `vd-${++seq}`, type, required,
    receivedOn: receivedAgo === null ? null : addDays(today, -receivedAgo),
    expiresOn: expiresIn === null ? null : addDays(today, expiresIn),
  });
  const v = (over: Partial<Vendor> & Pick<Vendor, "id" | "name" | "category" | "status" | "documents">): Vendor => ({
    contactName: "", email: "", phone: "", taxId: "", notes: "", createdOn: addDays(today, -90),
    decidedBy: null, decidedOn: null, comment: "", ...over,
  });
  const approved = { decidedBy: "Operations manager", decidedOn: addDays(today, -60), comment: "" };
  return [
    v({ id: "v-1", name: "Acme Office Supply", category: "Supplies", status: "approved", ...approved,
      contactName: "Dana Whitfield", email: "orders@acme-office.example", phone: "(555) 010-2200", taxId: "123456789",
      documents: [d("W-9", true, 200), d("Certificate of insurance", true, 335, 15)] }),
    v({ id: "v-2", name: "Globex Software", category: "Software", status: "approved", ...approved,
      contactName: "Hank Scorpio", email: "sales@globex.example", phone: "(555) 010-3300",
      documents: [d("W-9", true, 120), d("Certificate of insurance", true, 370, -5), d("Master services agreement", true, 120), d("Security questionnaire", false, 100, 200)] }),
    v({ id: "v-3", name: "Initech Staffing LLC", category: "Professional services", status: "onboarding", createdOn: addDays(today, -6),
      contactName: "Peter Gibbons", email: "ap@initech.example", phone: "(555) 010-4400",
      documents: [d("W-9", true, null), d("Certificate of insurance", true, null), d("Signed contract", true, 2), d("Business license", true, 3, 300)] }),
    v({ id: "v-4", name: "Hooli Logistics", category: "Logistics", status: "pending_approval", createdOn: addDays(today, -20),
      contactName: "Gavin Belson", email: "vendors@hooli.example", phone: "(555) 010-5500", taxId: "987654321",
      documents: [d("W-9", true, 10), d("Certificate of insurance", true, 12, 340), d("Signed contract", true, 8), d("Carrier permit", true, 9, 200)] }),
    v({ id: "v-5", name: "Acme Office Supplies Inc.", category: "Supplies", status: "onboarding", createdOn: addDays(today, -1),
      contactName: "Dana W.", email: "dana@acme-office.example",
      documents: [d("W-9", true, null), d("Certificate of insurance", true, null)] }),
    v({ id: "v-6", name: "Wingtip Couriers", category: "Logistics", status: "inactive", ...approved,
      contactName: "Sherry Wingtip", email: "dispatch@wingtip.example",
      documents: [d("W-9", true, 400), d("Certificate of insurance", true, 400, -200)] }),
  ];
}
