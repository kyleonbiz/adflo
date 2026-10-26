import { describe, expect, it } from "vitest";
import { buildReports, emptySources, type ReportSources } from "@/lib/reporting/logic";
import type { DocumentRecord } from "@/lib/dms/types";
import { starterForms } from "@/lib/forms/starter-forms";
import { sampleRequests, sampleRoutines } from "../support/admin-sample-data";
import { sampleContacts } from "../support/contacts-sample-data";
import { sampleSubmissions } from "../support/forms-sample-data";
import { sampleInvoices } from "../support/invoices-sample-data";
import { sampleLicenses } from "../support/licenses-sample-data";
import { sampleProjects } from "../support/projects-sample-data";
import { sampleVendors } from "../support/vendors-sample-data";

const TODAY = "2026-10-25";

const doc = (over: Partial<DocumentRecord>): DocumentRecord => ({
  id: "d1", workspaceId: "w", folderId: null, originalName: "a.pdf", displayName: "a.pdf", storageKey: "k", mimeType: "application/pdf",
  sizeBytes: 1024, category: "contract", tags: [], uploadedBy: "u", uploadedByName: "Dana", createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z",
  expiresAt: null, starred: false, status: "ready", deletedAt: null, currentVersion: 1, contentStatus: "indexed", contentReason: null, ...over,
} as DocumentRecord);

const full = (): ReportSources => ({
  invoices: sampleInvoices(TODAY), licenses: sampleLicenses(TODAY), projects: sampleProjects(TODAY), vendors: sampleVendors(TODAY),
  requests: sampleRequests(TODAY), routines: sampleRoutines(TODAY), contacts: sampleContacts(TODAY), forms: starterForms(),
  submissions: sampleSubmissions(TODAY),
  documents: [
    doc({ id: "d1", category: "contract", sizeBytes: 2048, expiresAt: "2026-11-05T00:00:00Z" }),
    doc({ id: "d2", category: "tax", sizeBytes: 1024, expiresAt: "2026-10-01T00:00:00Z" }),
    doc({ id: "d3", category: "tax", sizeBytes: 1024 }),
    doc({ id: "d4", deletedAt: "2026-10-02T00:00:00Z" }),
    doc({ id: "d5", status: "pending" }),
  ],
});

const by = (reports: ReturnType<typeof buildReports>, id: string) => reports.find((r) => r.id === id)!;
const sum = (rows: { value: number }[]) => rows.reduce((n, r) => n + r.value, 0);

describe("buildReports", () => {
  it("makes one report per service that holds records, in catalogue order, each linking to its page", () => {
    const reports = buildReports(full(), TODAY);
    expect(reports.map((r) => r.id)).toEqual(["documents", "invoices", "licenses", "vendors", "crm", "projects", "forms", "admin"]);
    expect(reports.map((r) => r.href)).toEqual(["/app", "/app/invoices", "/app/licenses", "/app/vendors", "/app/contacts", "/app/projects", "/app/forms", "/app/admin"]);
    expect(reports.map((r) => r.name)).toContain("CRM & Data");
  });

  it("reports zero records everywhere when nothing is stored yet", () => {
    for (const r of buildReports(emptySources(), TODAY)) {
      expect(r.count, r.id).toBe(0);
      expect(r.table.rows, r.id).toEqual([]);
      expect(r.metrics.length, r.id).toBeGreaterThan(0);
    }
  });

  it("counts every record, and keeps table rows and breakdowns consistent with them", () => {
    const src = full();
    const reports = buildReports(src, TODAY);
    expect(by(reports, "invoices").count).toBe(src.invoices.length);
    expect(by(reports, "invoices").table.rows).toHaveLength(src.invoices.length);
    expect(sum(by(reports, "invoices").breakdowns[0].rows)).toBe(src.invoices.length); // by status covers each invoice once
    expect(sum(by(reports, "licenses").breakdowns[0].rows)).toBe(src.licenses.length);
    expect(sum(by(reports, "vendors").breakdowns[0].rows)).toBe(src.vendors.length);
    expect(sum(by(reports, "projects").breakdowns[0].rows)).toBe(src.projects.length);
    expect(sum(by(reports, "admin").breakdowns[0].rows)).toBe(src.requests.length);
    expect(by(reports, "crm").count).toBe(src.contacts.length);
    expect(by(reports, "forms").count).toBe(src.submissions.length);
    for (const r of reports) for (const row of r.table.rows) expect(row, r.id).toHaveLength(r.table.headers.length);
  });

  it("matches the numbers each service shows for itself", () => {
    const reports = buildReports(full(), TODAY);
    const metric = (id: string, label: string) => by(reports, id).metrics.find((m) => m.label === label)!;
    expect(metric("invoices", "Outstanding").value).toMatch(/^\$/);
    expect(Number(metric("invoices", "Overdue").value)).toBeGreaterThan(0);
    expect(metric("invoices", "Overdue").tone).toBe("danger");
    expect(metric("invoices", "Overdue").note).toMatch(/^\$/);
    expect(by(reports, "licenses").metrics.map((m) => m.label)).toEqual(["Licenses", "Expired", "Expiring soon", "Missing documents"]);
    expect(metric("forms", "Waiting for approval").value).toBe("2"); // s-1 and s-3 in the sample
  });

  it("totals documents, leaving out deleted and unfinished uploads, and flags expiry", () => {
    const docs = by(buildReports(full(), TODAY), "documents");
    expect(docs.count).toBe(3);
    expect(docs.metrics.find((m) => m.label === "Storage used")!.value).toBe("4.0 KB");
    expect(docs.metrics.find((m) => m.label === "Expiring in 30 days")!.value).toBe("1");
    expect(docs.metrics.find((m) => m.label === "Expired")!.value).toBe("1");
    expect(docs.breakdowns[0].rows).toEqual([{ label: "Tax Document", value: 2 }, { label: "Contract", value: 1 }]);
  });

  it("billed-by-client sums money, biggest first, leaving out voided invoices", () => {
    const rows = by(buildReports(full(), TODAY), "invoices").breakdowns[1].rows;
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value);
    expect(rows[0].display).toMatch(/^\$/);
  });

  it("ignores forms that no longer exist when counting submissions", () => {
    const src = { ...full(), forms: starterForms().filter((f) => f.id !== "form-vendor") };
    expect(by(buildReports(src, TODAY), "forms").count).toBe(3);
  });
});
