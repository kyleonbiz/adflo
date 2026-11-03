import { describe, expect, it } from "vitest";
import { MAX_SIGNERS, parseSigners, sha256Hex, sign, signedCopyText, status, type SigningRequest } from "@/lib/signing/logic";

const ids = () => { let n = 0; return () => `s${++n}`; };
const base = async (): Promise<SigningRequest> => {
  const parsed = parseSigners("Dana Whitfield <dana@example.com>\nPat Lee", ids());
  if ("error" in parsed) throw new Error(parsed.error);
  return { id: "r1", title: "Lease", source: "text", text: "The tenant agrees to pay rent.", hash: await sha256Hex("The tenant agrees to pay rent."), signers: parsed.signers, createdOn: "2026-10-26", createdBy: "Kyle" };
};

describe("signing", () => {
  it("hashes text the same way every time and differently when it changes", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(await sha256Hex("abc"));
    expect(await sha256Hex("abd")).not.toBe(await sha256Hex("abc"));
  });

  it("parses signers with or without an email and refuses bad input", () => {
    const ok = parseSigners("Dana Whitfield <dana@example.com>\nPat Lee, pat@example.com\nSam Ito", ids());
    expect("signers" in ok && ok.signers.map((s) => [s.name, s.email])).toEqual([["Dana Whitfield", "dana@example.com"], ["Pat Lee", "pat@example.com"], ["Sam Ito", ""]]);
    expect(parseSigners("", ids())).toHaveProperty("error");
    expect(parseSigners("A", ids())).toHaveProperty("error");
    expect(parseSigners("Dana Lee <nope>", ids())).toHaveProperty("error");
    expect(parseSigners("Dana Lee\ndana lee", ids())).toHaveProperty("error");
    expect(parseSigners(Array.from({ length: MAX_SIGNERS + 1 }, (_, i) => `Person ${i}`).join("\n"), ids())).toHaveProperty("error");
  });

  it("needs agreement and the exact name, and each person signs once", async () => {
    const r = await base();
    const id = r.signers[0].id;
    expect(sign(r, id, "Dana Whitfield", false, "2026-10-26T10:00:00Z")).toHaveProperty("error");
    expect(sign(r, id, "Someone Else", true, "2026-10-26T10:00:00Z")).toHaveProperty("error");
    expect(sign(r, "nope", "Dana Whitfield", true, "2026-10-26T10:00:00Z")).toHaveProperty("error");
    const first = sign(r, id, "dana whitfield", true, "2026-10-26T10:00:00Z");
    if (!("request" in first)) throw new Error("should sign");
    expect(status(first.request)).toBe("partly");
    expect(sign(first.request, id, "Dana Whitfield", true, "2026-10-26T11:00:00Z")).toHaveProperty("error");
    const second = sign(first.request, r.signers[1].id, "Pat Lee", true, "2026-10-26T12:00:00Z");
    if (!("request" in second)) throw new Error("should sign");
    expect(status(second.request)).toBe("signed");
    expect(status(r)).toBe("waiting");
  });

  it("writes a signed copy with the document, every signature and the fingerprint", async () => {
    const r = await base();
    const signed = sign(r, r.signers[0].id, "Dana Whitfield", true, "2026-10-26T10:05:00Z");
    if (!("request" in signed)) throw new Error("should sign");
    const text = signedCopyText(signed.request);
    expect(text).toContain("LEASE");
    expect(text).toContain("The tenant agrees to pay rent.");
    expect(text).toContain("Dana Whitfield  (Dana Whitfield, dana@example.com) signed");
    expect(text).toContain("Pat Lee: not signed yet");
    expect(text).toContain(r.hash);
  });
});
