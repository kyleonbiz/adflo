import { describe, expect, it } from "vitest";
import { blankDocument, layoutTemplate } from "@/lib/forms/layout";
import { PAPERWORK } from "@/lib/forms/paperwork";
import { starterForms } from "@/lib/forms/starter-forms";
import { FIELD_TYPES } from "@/lib/forms/types";
import { invoiceText } from "@/lib/invoices/share";
import { projectsReportCsv } from "@/lib/projects/logic";
import { PROJECT_TEMPLATES } from "@/lib/projects/templates";
import { parseReminders, reminderId, setReminderOn } from "@/lib/reminders/logic";
import { textToPdf } from "@/lib/forms/pdf";

describe("invoice PDF", () => {
  it("builds a real PDF from the invoice text", () => {
    const text = invoiceText({
      number: "INV-1", client: "Acme", clientEmail: "a@b.co", items: [{ description: "Work", qty: 2, rateCents: 5000 }], taxRate: 0,
      sender: { name: "Me", address: "", phone: "", email: "" }, paymentMethods: [], issuedOn: "2026-01-01", dueOn: "2026-02-01", status: "sent", paidOn: null, notes: "",
    });
    expect(text).toContain("INV-1");
    expect(text).toContain("TOTAL: $100.00");
    expect(new TextDecoder().decode(textToPdf(text).slice(0, 5))).toBe("%PDF-");
  });
});

describe("capitalisation", () => {
  const title = (s: string) => s.split(" ").every((w) => w[0] === w[0].toUpperCase());
  it("capitalises every word of project template names", () => PROJECT_TEMPLATES.forEach((t) => expect(title(t.name), t.name).toBe(true)));
  it("capitalises form field types", () => FIELD_TYPES.forEach((t) => expect(title(t.label), t.label).toBe(true)));
});

describe("form layouts", () => {
  it("gives every built-in form a ready-made layout with its fields as placeholders", () => {
    for (const f of [...starterForms(), ...PAPERWORK.map((p) => p.form)]) {
      expect(f.documentTemplate, f.name).toContain("{{");
      for (const field of f.fields) expect(f.documentTemplate, `${f.name}: ${field.label}`).toContain(`{{${field.label}}}`);
    }
  });
  it("leaves answers blank for a printable copy", () => {
    const t = layoutTemplate("Purpose", [{ id: "a", label: "Name", type: "text", required: true, options: [] }]);
    const blank = blankDocument("My form", t);
    expect(blank).toContain("MY FORM");
    expect(blank).not.toContain("{{");
    expect(blank).toContain("Signature:");
  });
});

describe("custom reminders", () => {
  it("sets a document reminder on a chosen day and survives parsing", () => {
    const list = setReminderOn([], { id: reminderId("document", "d1"), text: "Check it", area: "Documents", href: "/app" }, "2026-05-01");
    expect(list[0].on).toBe("2026-05-01");
    expect(parseReminders(JSON.stringify(list))).toEqual(list);
    expect(setReminderOn(list, list[0], "2026-06-01")).toHaveLength(1);
  });
});

describe("status report CSV", () => {
  it("has a row per task with its project alongside", () => {
    const csv = projectsReportCsv([{
      id: "p", name: "Alpha", client: "C", description: "", status: "active", startOn: "2026-01-01", dueOn: "2026-02-01", tasks: [
        { id: "t", title: "Do it", assignee: "Sam", dueOn: "2026-01-10", repeat: "none", done: false, doneOn: null, followUpId: null },
      ],
    } as never], "2026-01-05");
    expect(csv.split("\r\n")[0]).toBe("Project,Client,Project status,Starts,Due,Task,Assignee,Task due,Task state");
    expect(csv).toContain("Alpha,C,active,2026-01-01,2026-02-01,Do it,Sam,2026-01-10");
  });
});
