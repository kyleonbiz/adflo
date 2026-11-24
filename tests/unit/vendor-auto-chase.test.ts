import { describe, expect, it } from "vitest";
import { MAX_CHASES_PER_WORKSPACE, chaseEmail, chaseTargets, logAutoChase, withoutNote } from "@/lib/vendors/auto-chase";
import { followUpState } from "@/lib/vendors/follow-up";
import type { Vendor, VendorDocument, VendorNote } from "@/lib/vendors/types";

const TODAY = "2026-11-24";
const day = (n: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const doc = (o: Partial<VendorDocument> = {}): VendorDocument => ({ id: "d", type: "Certificate of insurance", required: true, receivedOn: "2026-01-01", expiresOn: day(300), ...o });
const vendor = (o: Partial<Vendor> = {}): Vendor => ({
  id: "v1", name: "Northwind Supply", category: "Supplies", contactName: "Sam Lee", email: "sam@northwind.test", phone: "", taxId: "", notes: "",
  status: "active", createdOn: "2026-01-01", documents: [doc({ expiresOn: day(10) })], ...o,
});
const reminder = (on: string, id = on): VendorNote => ({ id, on, kind: "reminder", text: "r", by: "x" });

describe("chaseTargets", () => {
  it("picks a vendor whose certificate is expiring, expired or missing", () => {
    for (const d of [doc({ expiresOn: day(10) }), doc({ expiresOn: day(-3) }), doc({ receivedOn: null, expiresOn: null })]) {
      expect(chaseTargets([vendor({ documents: [d] })], TODAY)).toHaveLength(1);
    }
  });

  it("leaves alone a vendor who owes nothing, is inactive, or has no usable email", () => {
    expect(chaseTargets([vendor({ documents: [doc({ expiresOn: day(300) })] })], TODAY)).toHaveLength(0);
    expect(chaseTargets([vendor({ status: "inactive" })], TODAY)).toHaveLength(0);
    expect(chaseTargets([vendor({ email: "" }), vendor({ email: "not an email" }), vendor({ email: "a@b" })], TODAY)).toHaveLength(0);
  });

  it("waits a week between emails, and stops at three unanswered ones", () => {
    expect(chaseTargets([vendor({ activity: [reminder(day(-3))] })], TODAY)).toHaveLength(0); // too soon
    expect(chaseTargets([vendor({ activity: [reminder(day(-8))] })], TODAY)).toHaveLength(1); // a week has passed
    const quiet = vendor({ activity: [reminder(day(-30)), reminder(day(-23)), reminder(day(-16))] });
    expect(followUpState(quiet, TODAY)).toBe("ghosted");
    expect(chaseTargets([quiet], TODAY)).toHaveLength(0); // gone quiet: up to the person now
  });

  it("starts over after the vendor replies", () => {
    const replied = vendor({ activity: [reminder(day(-30)), reminder(day(-23)), reminder(day(-16)), { id: "r", on: day(-14), kind: "reply", text: "will send", by: "x" }] });
    expect(chaseTargets([replied], TODAY)).toHaveLength(1);
  });

  it("never returns more than the per-workspace cap", () => {
    const many = Array.from({ length: MAX_CHASES_PER_WORKSPACE + 10 }, (_, i) => vendor({ id: `v${i}`, name: `Vendor ${i}` }));
    expect(chaseTargets(many, TODAY)).toHaveLength(MAX_CHASES_PER_WORKSPACE);
  });
});

describe("chaseEmail", () => {
  it("says what is needed and why, in the business's name, and where to reply", () => {
    const m = chaseEmail(vendor(), TODAY, { business: "Acme Roofing" });
    expect(m.subject).toBe("Documents Acme Roofing still needs from Northwind Supply");
    expect(m.text).toContain("Hi Sam Lee,");
    expect(m.text).toContain("Acme Roofing keeps a file on each vendor");
    expect(m.text).toContain("Certificate of insurance: Expires");
    expect(m.text).toContain("Your reply goes straight to Acme Roofing");
    expect(m.text).toContain("Sent by AdFlo on behalf of Acme Roofing.");
    expect(m.html).toContain("Documents we still need");
    expect(m.html).toContain("Certificate of insurance");
  });

  it("describes each document's state", () => {
    const m = chaseEmail(vendor({ documents: [doc({ expiresOn: day(-3) }), doc({ id: "w9", type: "W-9", receivedOn: null, expiresOn: null })] }), TODAY, { business: "Acme" });
    expect(m.text).toMatch(/Certificate of insurance: Expired /);
    expect(m.text).toContain("W-9: Not received yet");
  });

  it("gets firmer with each unanswered email", () => {
    const first = chaseEmail(vendor(), TODAY, { business: "Acme" });
    const second = chaseEmail(vendor({ activity: [reminder(day(-8))] }), TODAY, { business: "Acme" });
    const third = chaseEmail(vendor({ activity: [reminder(day(-15)), reminder(day(-8))] }), TODAY, { business: "Acme" });
    expect(first.subject.startsWith("Reminder:")).toBe(false);
    expect(second.subject.startsWith("Reminder:")).toBe(true);
    expect(second.text).toContain("A friendly follow-up");
    expect(third.text).toContain("This is our third request");
  });

  it("cannot be used to add mail headers or markup through a name", () => {
    const m = chaseEmail(vendor({ name: "Evil\r\nBcc: spy@x.test", contactName: "Sam\r\nTo: x@y.test" }), TODAY, { business: "Acme\nBcc: z@z.test" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text.split("\n").some((l) => /^Bcc:|^To:/.test(l))).toBe(false);
    const html = chaseEmail(vendor({ contactName: "<script>alert(1)</script>" }), TODAY, { business: "Acme" }).html;
    expect(html).not.toContain("<script>");
  });
});

describe("the vendor's file", () => {
  it("records each automatic email, counting up, and the next waits a week", () => {
    const v1 = logAutoChase(vendor(), TODAY, "n1");
    expect(v1.activity).toEqual([{ id: "n1", on: TODAY, kind: "reminder", text: "Reminder 1 sent automatically for: Certificate of insurance.", by: "AdFlo (automatic)" }]);
    expect(chaseTargets([v1], TODAY)).toHaveLength(0);
    expect(chaseTargets([v1], day(7))).toHaveLength(1);
    expect(logAutoChase(v1, day(7), "n2").activity![1].text).toContain("Reminder 2");
  });

  it("can take a note back off, so a failed send is tried again", () => {
    const logged = logAutoChase(vendor(), TODAY, "n1");
    expect(withoutNote(logged, "n1").activity).toEqual([]);
    expect(chaseTargets([withoutNote(logged, "n1")], TODAY)).toHaveLength(1);
  });
});
