import { describe, expect, it } from "vitest";
import { blankDocument, layoutTemplate } from "@/lib/forms/layout";
import { PAPERWORK } from "@/lib/forms/paperwork";
import { starterForms } from "@/lib/forms/starter-forms";
import { FIELD_TYPES } from "@/lib/forms/types";
import { invoiceToPdf } from "@/lib/invoices/pdf";
import { projectsReportCsv } from "@/lib/projects/logic";
import { PROJECT_TEMPLATES } from "@/lib/projects/templates";
import { parseReminders, reminderId, setReminderOn } from "@/lib/reminders/logic";

describe("invoice PDF", () => {
  it("builds a laid-out PDF: positioned text for the title, parties, items and totals, not one run of text", () => {
    const pdf = new TextDecoder("latin1").decode(invoiceToPdf({
      number: "INV-1", client: "Acme", clientEmail: "a@b.co", items: [{ description: "Work", qty: 2, rateCents: 5000 }], taxRate: 0,
      sender: { name: "Me", address: "1 Main St", phone: "", email: "" }, paymentMethods: ["Cash"], issuedOn: "2026-01-01", dueOn: "2026-02-01", status: "sent", paidOn: null, notes: "Thanks",
    }));
    expect(pdf.startsWith("%PDF-")).toBe(true);
    for (const text of ["(INVOICE)", "(INV-1)", "(Issue date: 2026-01-01)", "(Acme)", "(Work)", "($100.00)", "(Total)", "(Thanks)", "(- Cash)"]) expect(pdf).toContain(text);
    expect(pdf).not.toContain("?"); // no stand-ins for line breaks
  });
  it("starts a new page when the items run past the first", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ description: `Line ${i + 1}`, qty: 1, rateCents: 100 }));
    const pdf = new TextDecoder("latin1").decode(invoiceToPdf({
      number: "INV-2", client: "Acme", clientEmail: "", items, taxRate: 0, sender: { name: "Me", address: "", phone: "", email: "" },
      paymentMethods: [], issuedOn: "2026-01-01", dueOn: "2026-02-01", status: "draft", paidOn: null, notes: "",
    }));
    expect(pdf).toMatch(/\/Count 2\b/);
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
