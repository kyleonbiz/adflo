// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { OnboardingPage } from "@/components/control/onboarding-page";
import { onboardingRows } from "@/lib/control/onboarding";
import { CHECKLIST_STEPS, type ClientRecord } from "@/lib/control/types";

const client = (o: Partial<ClientRecord>): ClientRecord => ({ id: "c1", name: "Fresh Co", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "Pat", ownerEmail: "pat@fresh.test", notes: "", workspaceId: null, startedOn: "2026-11-17", createdAt: "2026-11-17T00:00:00Z", priceOverrideCents: null, priceNote: "", seatsUsed: null, lastActive: null, checklist: [], ...o } as ClientRecord);
const TODAY = "2026-11-19";

describe("the New area on the Onboarding page", () => {
  it("lists a new, unfinished client under New with a New badge and its next step", () => {
    const rows = onboardingRows([client({}), client({ id: "c2", name: "Old Co", startedOn: "2026-09-01", checklist: ["details"], seatsUsed: 2 })], TODAY);
    render(<OnboardingPage rows={rows} canAdd={false} />);
    const area = screen.getByRole("region", { name: "New clients to onboard" });
    expect(within(area).getByText("New clients to onboard (1)")).toBeInTheDocument();
    expect(within(area).getByText("Fresh Co")).toBeInTheDocument();
    expect(within(area).getAllByText("New").length).toBeGreaterThan(0);
    expect(within(area).getByText(/Next:/)).toBeInTheDocument();
    expect(within(area).queryByText("Old Co")).toBeNull();
    expect(screen.getByText("Old Co")).toBeInTheDocument();
  });

  it("shows no New area when nobody is new, and a client leaves it once the owner has signed in", () => {
    const done = client({ checklist: CHECKLIST_STEPS.map((s) => s.key), seatsUsed: 1 });
    render(<OnboardingPage rows={onboardingRows([done], TODAY)} canAdd={false} />);
    expect(screen.queryByRole("region", { name: "New clients to onboard" })).toBeNull();
  });
});
