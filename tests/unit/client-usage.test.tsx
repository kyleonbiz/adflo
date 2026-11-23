// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientUsage } from "@/components/control/client-usage";
import type { ClientRecord } from "@/lib/control/types";

const base: ClientRecord = {
  id: "c1", name: "Acme Roofing", status: "active", plan: "adflo", seatsLimit: 1, ownerName: "", ownerEmail: "", notes: "", workspaceId: "w1",
  startedOn: null, createdAt: "2026-11-10T00:00:00Z", priceOverrideCents: null, priceNote: "", seatsUsed: 1, lastActive: null, checklist: [],
};

describe("ClientUsage", () => {
  it("shows used of limit for an AdFlo client", () => {
    render(<ClientUsage client={{ ...base, usage: { aiActions: 200, tokens: 1_200_000, ocrReads: 12, quickActions: 340 } }} />);
    expect(screen.getByText("200 of 250")).toBeTruthy();
    expect(screen.getByText("12 of 200")).toBeTruthy();
    expect(screen.getByText("1,200,000 of 3,000,000")).toBeTruthy();
    expect(screen.getByText("340")).toBeTruthy();
  });
  it("says so when there is no usage to read, and when the plan has no limits", () => {
    render(<ClientUsage client={{ ...base, plan: "standard", usage: null }} />);
    expect(screen.getByText(/no usage limits/i)).toBeTruthy();
    expect(screen.getByText(/No usage to show/i)).toBeTruthy();
  });
});
