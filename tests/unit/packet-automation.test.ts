import { describe, expect, it } from "vitest";
import { PAPERWORK } from "@/lib/forms/paperwork";
import { packetEmail } from "@/lib/packets/email";
import { MAX_PACKET_REMINDERS, PACKETS, hasEmail, outstanding, reminderDue, startPacket, theirItems, toggleItem, wentQuiet, type Assignment } from "@/lib/packets/logic";

const day = (base: string, n: number) => new Date(Date.parse(`${base}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const T0 = "2026-11-02";
const template = (id: string) => PACKETS.find((p) => p.id === id)!;
const hire = (o: Partial<Assignment> = {}): Assignment => ({ ...startPacket(template("pk-hire"), "Jordan Cruz", "jordan@example.com", T0, "a1"), ...o });
const link = (formId: string) => `https://www.adflo.pro/form/${formId}`;

describe("the new packets", () => {
  it("add a new hire, a new subcontractor and an offboarding packet, after the existing two", () => {
    expect(PACKETS.map((p) => p.id)).toEqual(["pk-client", "pk-closeout", "pk-hire", "pk-sub", "pk-offboard"]);
    expect(PACKETS.map((p) => p.audience)).toEqual(["Client", "Customer", "Employee", "Subcontractor", "Employee"]);
  });

  it("point only at forms that exist, and keep payroll and tax forms out of the new hire packet", () => {
    const ids = new Set(PAPERWORK.map((p) => p.form.id));
    for (const p of PACKETS) for (const i of p.items) if (i.kind === "form") expect(ids.has(i.formId!), `${p.id}/${i.id}`).toBe(true);
    const labels = template("pk-hire").items.map((i) => i.label.toLowerCase()).join(" | ");
    expect(labels).not.toMatch(/w-?4|i-?9|payroll|direct deposit|tax/);
  });

  it("mark the business's own steps, which are never asked of the person", () => {
    const off = startPacket(template("pk-offboard"), "Jordan Cruz", "jordan@example.com", T0, "a2");
    expect(theirItems(off).map((i) => i.label)).toEqual(["Return of company property", "Exit acknowledgment"]);
    expect(startPacket(template("pk-closeout"), "Acme", "a@b.co", T0, "a3").items.filter((i) => i.by === "us").map((i) => i.label)).toEqual(["Final inspection sign-off", "Permit closed out"]);
  });
});

describe("reminderDue", () => {
  const sent = (o: Partial<Assignment> = {}) => hire({ sentOn: T0, ...o });

  it("waits three days after the packet was emailed, then a week between reminders", () => {
    expect(reminderDue(sent(), day(T0, 2))).toBe(false);
    expect(reminderDue(sent(), day(T0, 3))).toBe(true);
    expect(reminderDue(sent({ remindedOn: [day(T0, 3)] }), day(T0, 9))).toBe(false);
    expect(reminderDue(sent({ remindedOn: [day(T0, 3)] }), day(T0, 10))).toBe(true);
  });

  it("stops after three reminders, and says the person has gone quiet", () => {
    const three = sent({ remindedOn: [day(T0, 3), day(T0, 10), day(T0, 17)] });
    expect(MAX_PACKET_REMINDERS).toBe(3);
    expect(reminderDue(three, day(T0, 40))).toBe(false);
    expect(wentQuiet(three)).toBe(true);
    expect(wentQuiet(sent({ remindedOn: [day(T0, 3)] }))).toBe(false);
  });

  it("only goes to a packet that was emailed, to a usable address, with something of theirs still out", () => {
    expect(reminderDue(hire(), day(T0, 30))).toBe(false); // never emailed
    for (const email of ["", "not an email", "a@b"]) expect(reminderDue(sent({ email }), day(T0, 30))).toBe(false);
    let done = sent();
    for (const i of theirItems(done)) done = toggleItem(done, i.id, day(T0, 1));
    expect(outstanding(done)).toHaveLength(0);
    expect(reminderDue(done, day(T0, 30))).toBe(false);
  });

  it("ignores steps that are the business's own: the packet is not waiting on the person", () => {
    let off = startPacket(template("pk-offboard"), "Jordan Cruz", "jordan@example.com", T0, "a2");
    off = { ...off, sentOn: T0 };
    for (const i of theirItems(off)) off = toggleItem(off, i.id, day(T0, 1));
    expect(off.items.some((i) => !i.doneOn)).toBe(true); // our steps are not done...
    expect(reminderDue(off, day(T0, 30))).toBe(false);   // ...but nothing is owed by them
  });

  it("stops the moment an item is ticked and the rest are in", () => {
    let a = sent();
    expect(reminderDue(a, day(T0, 4))).toBe(true);
    for (const i of theirItems(a)) a = toggleItem(a, i.id, day(T0, 4));
    expect(reminderDue(a, day(T0, 4))).toBe(false);
  });

  it("recognizes a usable email", () => {
    expect(hasEmail({ email: " jordan@example.com " })).toBe(true);
    expect(hasEmail({ email: "jordan@" })).toBe(false);
  });
});

describe("packetEmail", () => {
  const ctx = { business: "Acme Roofing", formLink: link };

  it("asks for everything of theirs: forms with links, documents by reply, things to sign", () => {
    const m = packetEmail(hire(), "first", 0, ctx);
    expect(m.subject).toBe("Acme Roofing: paperwork to complete");
    expect(m.text).toContain("Hi Jordan,");
    expect(m.text).toContain("Safety orientation acknowledgment: https://www.adflo.pro/form/pw-safety-orientation");
    expect(m.text).toContain("Documents to send back:");
    expect(m.text).toContain("Copy of any license or certification the job needs");
    expect(m.text).toContain("To sign:");
    expect(m.text).toContain("Employee handbook acknowledgment");
    expect(m.text).toContain("Replies go straight to Acme Roofing.");
    expect(m.html).toContain("Fill out the form");
  });

  it("lists only what is still outstanding in a reminder, firmer each time", () => {
    let a = hire({ sentOn: T0 });
    a = toggleItem(a, "h1", day(T0, 1)); a = toggleItem(a, "h2", day(T0, 1));
    const first = packetEmail(a, "reminder", 1, ctx);
    expect(first.text).not.toContain("Safety orientation acknowledgment");
    expect(first.text).toContain("Emergency contact");
    expect(first.subject).toBe("Reminder: paperwork for Acme Roofing");
    expect(first.text).toContain("A friendly reminder");
    expect(packetEmail(a, "reminder", 2, ctx).text).toContain("A second reminder");
    const last = packetEmail(a, "reminder", 3, ctx);
    expect(last.text).toContain("A final reminder");
    expect(last.subject).toBe("Final reminder: paperwork for Acme Roofing");
  });

  it("never asks a person to do the business's own steps", () => {
    const off = startPacket(template("pk-offboard"), "Jordan Cruz", "j@example.com", T0, "a2");
    const text = packetEmail(off, "first", 0, ctx).text;
    expect(text).toContain("Return of company property");
    expect(text).not.toContain("Accounts and access removed");
    expect(text).not.toContain("Keys, codes and equipment accounted for");
  });

  it("says to ask for the link when a form has none, rather than leaving a broken one", () => {
    const m = packetEmail(hire(), "first", 0, { business: "Acme", formLink: () => null });
    expect(m.text).toContain("Emergency contact: ask us for the link");
    expect(m.html).not.toContain("Fill out the form");
  });

  it("cannot add mail headers or markup through names", () => {
    const evil = hire({ recipient: "Sam\r\nBcc: spy@x.test", templateName: "New hire\nBcc: z@z.test" });
    const m = packetEmail(evil, "first", 0, { business: "Acme\r\nBcc: q@q.test", formLink: link });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text.split("\n").some((l) => /^Bcc:/.test(l))).toBe(false);
    expect(packetEmail(hire({ recipient: "<script>x</script>" }), "first", 0, ctx).html).not.toContain("<script>");
  });
});
