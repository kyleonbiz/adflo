// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Overview } from "@/components/reporting/overview";
import { buildReports, type ReportSources } from "@/lib/reporting/logic";
import { starterForms } from "@/lib/forms/starter-forms";
import { sampleInvoices } from "../support/invoices-sample-data";
import { sampleLicenses } from "../support/licenses-sample-data";
import { todayLocal } from "@/lib/dates";

const today = todayLocal();
const empty: ReportSources = { invoices: [], licenses: [], projects: [], vendors: [], contacts: [], submissions: [], forms: starterForms(), documents: [] } as unknown as ReportSources;
const withData = { ...empty, invoices: sampleInvoices(today), licenses: sampleLicenses(today) } as ReportSources;

describe("reporting overview", () => {
  it("leads with the headline numbers and gives every service a row", () => {
    const reports = buildReports(withData, today);
    render(<Overview reports={reports} attention={[]} onOpen={() => {}} />);
    const summary = screen.getByTestId("overview-summary");
    expect(within(summary).getByText("Records tracked")).toBeTruthy();
    expect(screen.getAllByTestId("service-row")).toHaveLength(reports.length);
    expect(screen.getByText("Nothing needs attention right now.")).toBeTruthy();
  });

  it("opens a service's report from its row", async () => {
    const onOpen = vi.fn();
    const reports = buildReports(withData, today);
    render(<Overview reports={reports} attention={[]} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "View Invoices report" }));
    expect(onOpen).toHaveBeenCalledWith("invoices");
  });

  it("says so, and marks every service as having no records, when nothing has been added", () => {
    const reports = buildReports(empty, today);
    render(<Overview reports={reports} attention={[]} onOpen={() => {}} />);
    expect(screen.getByTestId("attention-empty").textContent).toContain("Nothing to report yet");
    expect(screen.getByText("No records in any service yet.")).toBeTruthy();
    expect(screen.getAllByText("No records yet")).toHaveLength(reports.length);
  });
});
