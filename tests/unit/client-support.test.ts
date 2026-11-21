import { describe, expect, it } from "vitest";
import { parseClientReply, parseClientRequest, parseNote } from "@/lib/control/validation";
import { newRequestEmail, replyEmail } from "@/lib/mail/support-email";

describe("parseClientRequest", () => {
  it("accepts a request and trims it", () => {
    expect(parseClientRequest({ subject: "  Cannot upload ", body: " PDF fails ", urgent: true })).toEqual({ ok: true, value: { subject: "Cannot upload", body: "PDF fails", urgent: true } });
  });
  it("is not urgent unless it is exactly true", () => {
    expect(parseClientRequest({ subject: "a", body: "b", urgent: "yes" })).toEqual({ ok: true, value: { subject: "a", body: "b", urgent: false } });
  });
  it("needs a subject and details, within limits", () => {
    expect(parseClientRequest({ subject: " ", body: "" })).toEqual({ ok: false, errors: { subject: expect.any(String), body: expect.any(String) } });
    expect(parseClientRequest({ subject: "x".repeat(201), body: "ok" }).ok).toBe(false);
    expect(parseClientRequest({ subject: "ok", body: "x".repeat(5001) }).ok).toBe(false);
    expect(parseClientRequest(null).ok).toBe(false);
  });
});

describe("parseClientReply", () => {
  it("accepts a message and refuses an empty or huge one", () => {
    expect(parseClientReply({ body: " thanks " })).toEqual({ ok: true, value: { body: "thanks" } });
    expect(parseClientReply({ body: "  " }).ok).toBe(false);
    expect(parseClientReply({ body: "x".repeat(5001) }).ok).toBe(false);
  });
});

describe("parseNote audience", () => {
  it("is internal unless toClient is exactly true", () => {
    expect(parseNote({ body: "hi", toClient: true })).toEqual({ ok: true, value: { body: "hi", toClient: true } });
    expect(parseNote({ body: "hi", toClient: "true" })).toEqual({ ok: true, value: { body: "hi", toClient: false } });
  });
});

describe("support emails", () => {
  it("announces a request to the team with a link, urgent first in the subject", () => {
    const m = newRequestEmail({ clientName: "Acme\r\nBcc: x", requesterEmail: "pat@acme.com", subject: "Cannot <b>upload</b>", body: "PDF fails", urgent: true, ticketId: "t-1" });
    expect(m.subject).toBe("[Urgent] Support request from Acme Bcc: x: Cannot <b>upload</b>");
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text).toContain("/control/support/t-1");
    expect(m.html).not.toContain("<b>upload</b>");
  });
  it("sends the client the reply with a way back into AdFlo", () => {
    const m = replyEmail({ subject: "Cannot upload", reply: "Try again now" });
    expect(m.subject).toBe("Re: Cannot upload");
    expect(m.text).toContain("Try again now");
    expect(m.text).toContain("/app/help");
  });
});
