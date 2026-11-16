import { describe, expect, it } from "vitest";
import { staffLoginHref, staffNext } from "@/lib/control/login";

describe("staffNext", () => {
  it("keeps a path inside the Control center", () => {
    expect(staffNext("/control/clients")).toBe("/control/clients");
    expect(staffNext("/control/clients/abc#billing")).toBe("/control/clients/abc#billing");
    expect(staffNext("/control")).toBe("/control");
  });
  it("sends everything else to the Control center home", () => {
    for (const bad of [undefined, null, "", "/app/overview", "/login", "//evil.com", "https://evil.com", "/controlx", "/control\\..\\evil", "/control/login", "javascript:alert(1)"]) {
      expect(staffNext(bad as never), String(bad)).toBe("/control");
    }
  });
});

describe("staffLoginHref", () => {
  it("encodes the return path", () => {
    expect(staffLoginHref("/control/clients/1")).toBe("/control/login?next=%2Fcontrol%2Fclients%2F1");
  });
});
