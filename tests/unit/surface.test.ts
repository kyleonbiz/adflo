import { describe, expect, it } from "vitest";
import { cookieOptionsFor, STAFF_COOKIE, surfaceOfPath } from "@/lib/supabase/surface";

describe("sessions are separate for the Control center and the client app", () => {
  it("staff pages and the staff API are the control surface", () => {
    for (const p of ["/control", "/control/", "/control/clients", "/control/login", "/api/control", "/api/control/clients/abc/welcome"]) expect(surfaceOfPath(p)).toBe("control");
  });
  it("everything else is the client app", () => {
    for (const p of ["/", "/app", "/app/overview", "/login", "/signup", "/invite/abc", "/auth/callback", "/api/dms/bootstrap", "/api/assistant"]) expect(surfaceOfPath(p)).toBe("app");
  });
  it("look-alike paths are not the control surface", () => {
    for (const p of ["/controlled", "/control-room", "/api/controller", "/app/control", "/x/control/y"]) expect(surfaceOfPath(p)).toBe("app");
  });
  it("staff get their own cookie and the client app keeps the default one, so existing client sessions stay valid", () => {
    expect(cookieOptionsFor("control")).toEqual({ name: STAFF_COOKIE });
    expect(cookieOptionsFor("app")).toBeUndefined();
    expect(STAFF_COOKIE).not.toMatch(/^sb-/);
  });
});
