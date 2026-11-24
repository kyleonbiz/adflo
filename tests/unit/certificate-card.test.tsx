// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CertificateCard } from "@/components/dms/certificate-card";
import type { DmsApi } from "@/lib/dms/client/api";
import type { CertificateRead, DocumentRecord } from "@/lib/dms/types";
import type { License } from "@/lib/licenses/types";
import type { Vendor } from "@/lib/vendors/types";

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const inDays = (n: number) => iso(new Date(today.getTime() + n * 86_400_000));

const certificate = {
  insured: "Acme Roofing LLC", holder: "Northwind Properties", producer: null,
  policies: [
    { kind: "General liability", insurer: "Travelers", policyNumber: "GL-4471920", effectiveOn: inDays(-300), expiresOn: inDays(120) },
    { kind: "Workers' compensation", insurer: "Liberty Mutual", policyNumber: "WC-5521908", effectiveOn: inDays(-300), expiresOn: inDays(12) },
  ],
};

const doc = (over: Partial<DocumentRecord> = {}) => ({ id: "d1", displayName: "Acme COI.pdf", category: "insurance", currentVersion: 1, ...over }) as DocumentRecord;
const apiFor = (read: CertificateRead | Error) => ({ readCertificate: vi.fn(async () => { if (read instanceof Error) throw read; return read; }) }) as unknown as DmsApi;
const saved = <T,>(kind: string) => JSON.parse(window.localStorage.getItem(`adflo.records.${kind}.v1`) ?? "[]") as T[];

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { window.localStorage.clear(); });

describe("CertificateCard", () => {
  it("shows what the certificate says, with each policy's standing", async () => {
    render(<CertificateCard doc={doc()} api={apiFor({ status: "found", certificate })} />);
    expect(await screen.findByText("Acme Roofing LLC")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Policies on this certificate" });
    expect(list).toHaveTextContent("General liability");
    expect(list).toHaveTextContent("Travelers · Policy GL-4471920");
    expect(list).toHaveTextContent("Expires in 12 days"); // the workers' comp policy is close to ending
  });

  it("tracks the policies as insurance records only when asked, and never twice", async () => {
    render(<CertificateCard doc={doc()} api={apiFor({ status: "found", certificate })} />);
    await userEvent.click(await screen.findByRole("button", { name: "Track these policies" }));
    await waitFor(() => expect(saved<License>("licenses")).toHaveLength(2));
    const [gl] = saved<License>("licenses");
    expect(gl).toMatchObject({ name: "General liability insurance", category: "insurance", number: "GL-4471920", holder: "Acme Roofing LLC", expiresOn: certificate.policies[0].expiresOn });
    expect(gl.verifiedOn).toBeUndefined();
    expect(await screen.findByRole("status")).toHaveTextContent("Tracking 2 policies");
  });

  it("does not duplicate policies that are already tracked", async () => {
    window.localStorage.setItem("adflo.records.licenses.v1", JSON.stringify([{ id: "x", name: "General liability insurance", category: "insurance", number: "GL-4471920", expiresOn: certificate.policies[0].expiresOn, issuer: "", holder: "", issuedOn: "", renewalTermMonths: 12, reminderDays: [30], stage: "not_started", requiredDocuments: [], notes: "" }]));
    render(<CertificateCard doc={doc()} api={apiFor({ status: "found", certificate })} />);
    await userEvent.click(await screen.findByRole("button", { name: "Track these policies" }));
    await waitFor(() => expect(saved<License>("licenses")).toHaveLength(2)); // the original plus only the new workers' comp policy
    expect(saved<License>("licenses").filter((l) => l.number === "GL-4471920")).toHaveLength(1);
  });

  it("offers to update the vendor's certificate when the insured is one of your vendors", async () => {
    const vendor = { id: "v1", name: "Acme Roofing", category: "Construction & trades", contactName: "", email: "", phone: "", taxId: "", notes: "", status: "active", createdOn: "2026-01-01", documents: [{ id: "vd1", type: "Certificate of insurance", required: true, receivedOn: null, expiresOn: null }] };
    window.localStorage.setItem("adflo.records.vendors.v1", JSON.stringify([vendor]));
    render(<CertificateCard doc={doc()} api={apiFor({ status: "found", certificate })} />);
    await userEvent.click(await screen.findByRole("button", { name: /Update Acme Roofing's certificate/ }));
    await waitFor(() => expect(saved<Vendor>("vendors")[0].documents[0].expiresOn).toBe(inDays(12))); // the earliest policy end
    expect(saved<Vendor>("vendors")[0].documents[0].receivedOn).toBeTruthy();
    expect(saved<License>("licenses")).toHaveLength(0);
  });

  it("explains an unreadable file, says nothing is certificate-like when it is not, and ignores other documents", async () => {
    const { unmount } = render(<CertificateCard doc={doc()} api={apiFor({ status: "unreadable" })} />);
    expect(await screen.findByText(/no readable text/)).toBeInTheDocument();
    unmount();
    const second = render(<CertificateCard doc={doc()} api={apiFor({ status: "no_certificate" })} />);
    expect(await screen.findByText(/does not look like a certificate/)).toBeInTheDocument();
    second.unmount();
    const api = apiFor({ status: "not_insurance" });
    const { container } = render(<CertificateCard doc={doc({ category: "invoice" })} api={api} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says so when reading fails", async () => {
    render(<CertificateCard doc={doc()} api={apiFor(new Error("boom"))} />);
    expect(await screen.findByText(/Could not read this document/)).toBeInTheDocument();
  });
});
