import { describe, expect, it } from "vitest";
import { PARTNER_TYPES, parsePartnerRequest } from "@/lib/marketing/partner-request";

describe("parsePartnerRequest", () => {
  const ok = { name: "A B", email: "a@b.co", organization: "Trade Group", type: PARTNER_TYPES[0], message: "Hi" };
  it("accepts a complete request", () => expect(parsePartnerRequest(ok).ok).toBe(true));
  it("rejects bad email, missing org and unknown type", () => {
    const r = parsePartnerRequest({ ...ok, email: "x", organization: "", type: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "organization", "type"]);
  });
  it("strips line breaks from single-line fields", () => {
    const r = parsePartnerRequest({ ...ok, name: "A\r\nBcc: x@y.z" });
    expect(r.ok && r.value.name).toBe("A Bcc: x@y.z");
  });
});
