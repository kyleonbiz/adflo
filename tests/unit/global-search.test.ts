import { describe, expect, it } from "vitest";
import { searchResults } from "@/components/modules/global-search";

describe("searchResults", () => {
  it("offers nothing for an empty box", () => {
    expect(searchResults("  ", "all")).toEqual([]);
  });

  it("lists matching services first, then a search-inside link for each service with records", () => {
    const r = searchResults("vendor", "all");
    expect(r[0]).toMatchObject({ title: "Vendors", href: "/app/vendors" });
    expect(r.find((x) => x.key === "in-vendors")?.href).toBe("/app/vendors?q=vendor");
    expect(r.find((x) => x.key === "in-crm")?.href).toBe("/app/contacts?q=vendor");
  });

  it("encodes the query in the link", () => {
    expect(searchResults("acme & co", "invoices").map((x) => x.href)).toEqual(["/app/invoices?q=acme%20%26%20co"]);
  });

  it("limits results to the chosen service", () => {
    expect(searchResults("x", "projects").map((x) => x.key)).toEqual(["in-projects"]);
  });
});
