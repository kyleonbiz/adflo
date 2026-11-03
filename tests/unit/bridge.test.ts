import { describe, expect, it } from "vitest";
import { addContactLink, fieldKey, fillLink, personFromParams, personFromSubmission, prefillFromPerson } from "@/lib/bridge";
import { PAPERWORK } from "@/lib/forms/paperwork";
import { starterForms } from "@/lib/forms/starter-forms";

const form = (id: string) => PAPERWORK.find((p) => p.form.id === id)!.form;

describe("contacts and forms", () => {
  it("fills the fields a form shares with a contact and leaves the rest", () => {
    const intake = form("pw-client-intake");
    const filled = prefillFromPerson(intake, { name: "Dana Whitfield", email: "dana@example.com", phone: "555-0100", company: "Acme" });
    const byLabel = Object.fromEntries(intake.fields.map((f) => [f.label, filled[f.id]]));
    expect(byLabel["Client name"]).toBe("Dana Whitfield");
    expect(byLabel["Email"]).toBe("dana@example.com");
    expect(byLabel["Phone"]).toBe("555-0100");
    expect(byLabel["What you need help with"]).toBeUndefined();
  });

  it("treats a company field as the company, not the person's name", () => {
    const w9 = form("pw-w9-request");
    const filled = prefillFromPerson(w9, { name: "Dana Whitfield", company: "Acme" });
    expect(w9.fields.filter((f) => fieldKey(f) === "company").map((f) => f.label)).toContain("Business name");
    expect(Object.values(filled)).toContain("Acme");
    expect(Object.values(filled)).toContain("Dana Whitfield"); // "Legal name" is the person
  });

  it("finds the person behind a submission, falling back to who filled it in", () => {
    const intake = form("pw-client-intake");
    const values = Object.fromEntries(intake.fields.map((f) => [f.id, f.label === "Email" ? "sam@x.co" : f.label === "Client name" ? "Sam Ito" : "n/a"]));
    expect(personFromSubmission(intake, values, "Kyle")).toMatchObject({ name: "Sam Ito", email: "sam@x.co" });
    const feedback = starterForms().find((f) => f.id === "form-feedback")!;
    expect(personFromSubmission(feedback, {}, "Pat Lee")?.name).toBe("Pat Lee");
    expect(personFromSubmission(feedback, {}, "Anonymous")).toBeNull();
  });

  it("builds links both ways and reads parameters back safely", () => {
    const p = { name: "Dana Whitfield", email: "dana@example.com" };
    expect(fillLink("pw-nda", p)).toBe("/app/forms?fill=pw-nda&name=Dana+Whitfield&email=dana%40example.com");
    expect(addContactLink({})).toBe("/app/contacts?add=1");
    const params = new URLSearchParams(fillLink("pw-nda", p).split("?")[1]);
    expect(personFromParams((k) => params.get(k) ?? undefined)).toEqual({ name: "Dana Whitfield", email: "dana@example.com", phone: "", company: "" });
    expect(personFromParams(() => "x".repeat(500)).name).toHaveLength(120);
    const bad = personFromParams((k) => ({ name: "Sam Ito", email: "nope", phone: "4111 1111 1111 1111" } as Record<string, string>)[k]);
    expect(bad).toEqual({ name: "Sam Ito", email: "", phone: "", company: "" });
  });
});
