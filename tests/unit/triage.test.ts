import { describe, expect, it } from "vitest";
import { triageTicket } from "@/lib/control/triage";

const t = (subject: string, body = "", priority: "low" | "normal" | "high" = "normal", requesterName = "Pat Lee") => ({ subject, body, priority, requesterName });

describe("triageTicket", () => {
  it.each([
    ["Cannot sign in", "I can't log in since this morning", "cannot sign in", "sign_in"],
    ["Where did my files go", "All my documents have disappeared", "may have lost data", "documents"],
    ["Charged twice", "My card was charged twice for November", "billing problem", "billing"],
    ["App is down", "Nothing loads", "marked urgent or not working", "other"],
  ])("%j is rated high", (subject, body, reason, topic) => {
    const r = triageTicket(t(subject, body));
    expect(r.priority).toBe("high");
    expect(r.reason).toBe(reason);
    expect(r.topic).toBe(topic);
  });

  it("leaves ordinary requests alone and finds the topic", () => {
    const r = triageTicket(t("How do I add a vendor?", "I want to add my subcontractor"));
    expect(r).toMatchObject({ priority: "normal", reason: "", topic: "vendors" });
  });

  it("never lowers a priority staff set, and does not repeat a reason for one already high", () => {
    expect(triageTicket(t("Colour idea", "", "low")).priority).toBe("low");
    expect(triageTicket(t("Cannot sign in", "can't log in", "high"))).toMatchObject({ priority: "high", reason: "" });
  });

  it("drafts a reply that greets the person, asks for what is needed, and promises nothing", () => {
    const r = triageTicket(t("Cannot sign in", "I can't log in"));
    expect(r.reply).toContain("Hi Pat,");
    expect(r.reply).toContain("Forgot your password");
    expect(triageTicket(t("Question", "hello", "normal", "")).reply).toContain("Hi there,");
    for (const topic of ["billing", "documents", "invoices", "licenses", "vendors", "export", "anything"]) expect(triageTicket(t(topic, topic)).reply).not.toMatch(/will be (fixed|refunded)|we have refunded|guarantee/i);
  });
});
