import { describe, expect, it } from "vitest";
import { canOpenModule, canOpenPath, canOpenSettingsTab, moduleOfPath, parseRole } from "@/lib/roles";

describe("roles", () => {
  it("lets Owners and Admins open every service, and the assistant", () => {
    for (const role of ["owner", "admin"] as const) {
      for (const id of ["documents", "invoices", "licenses", "vendors", "crm", "projects", "forms", "reporting", "admin", "assistant", "overview"]) {
        expect(canOpenModule(role, id)).toBe(true);
      }
    }
  });
  it("limits Contributors to Home, Documents and Projects", () => {
    expect(["overview", "documents", "projects"].every((id) => canOpenModule("contributor", id))).toBe(true);
    for (const id of ["invoices", "vendors", "reporting", "licenses", "crm", "forms", "admin", "assistant"]) {
      expect(canOpenModule("contributor", id)).toBe(false);
    }
  });
  it("works out the service from a path", () => {
    expect(moduleOfPath("/app")).toBe("documents");
    expect(moduleOfPath("/app/invoices")).toBe("invoices");
    expect(moduleOfPath("/app/invoices?new=1")).toBe("invoices");
    expect(moduleOfPath("/app/contacts")).toBe("crm");
    expect(moduleOfPath("/login")).toBeNull();
  });
  it("checks paths against the role", () => {
    expect(canOpenPath("contributor", "/app/invoices")).toBe(false);
    expect(canOpenPath("contributor", "/app/projects")).toBe(true);
    expect(canOpenPath("contributor", "/app/setup")).toBe(false);
    expect(canOpenPath("admin", "/app/setup")).toBe(true);
    expect(canOpenPath("contributor", "/invoice/abc")).toBe(true);
  });
  it("keeps team settings for Owners", () => {
    expect(canOpenSettingsTab("owner", "team")).toBe(true);
    expect(canOpenSettingsTab("admin", "team")).toBe(false);
    expect(canOpenSettingsTab("admin", "profile")).toBe(true);
    expect(canOpenSettingsTab("contributor", "profile")).toBe(false);
  });
  it("treats an unknown saved role as Owner", () => {
    expect(parseRole("")).toBe("owner");
    expect(parseRole("god")).toBe("owner");
    expect(parseRole("contributor")).toBe("contributor");
  });
});
