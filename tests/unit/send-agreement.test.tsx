// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendAgreement } from "@/components/control/agreements-page";
import type { AgreementTemplate } from "@/lib/control/types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); refresh.mockClear(); });

const privacy: AgreementTemplate = { id: "11111111-1111-4111-8111-111111111111", title: "Privacy Policy", version: 2, body: "# Privacy\n\n[Insert email]", effectiveDate: "2026-11-20", createdAt: "2026-11-20T00:00:00Z", accepted: false };
const terms: AgreementTemplate = { id: "22222222-2222-4222-8222-222222222222", title: "Terms & Agreements", version: 1, body: "# Terms", effectiveDate: "2026-11-18", createdAt: "2026-11-18T00:00:00Z", accepted: true };

describe("editing an agreement before sending it", () => {
  it("shows Edit to the Owner for a version nobody has accepted, and not for an accepted one or other staff", () => {
    const { unmount } = render(<SendAgreement clientId="c" templates={[privacy, terms]} sent={[]} canEdit isOwner />);
    expect(screen.getByRole("button", { name: "Edit Privacy Policy version 2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edit Terms/ })).toBeNull();
    unmount();
    render(<SendAgreement clientId="c" templates={[privacy, terms]} sent={[]} canEdit />);
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
  });

  it("opens the text and effective date, and saves both to the agreement", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<SendAgreement clientId="c" templates={[privacy, terms]} sent={[]} canEdit isOwner />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Privacy Policy version 2" }));
    const text = screen.getByLabelText("Text") as HTMLTextAreaElement;
    expect(text.value).toContain("[Insert email]");
    await userEvent.clear(text);
    await userEvent.type(text, "Final text");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/control/agreements/${privacy.id}`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ body: "Final text", effectiveDate: "2026-11-20" });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByLabelText("Text")).toBeNull(); // the editor closes after saving
  });

  it("does not send anything to the client just by editing, and still sends only what is ticked", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, link: "https://x/y" }), { status: 200 }));
    render(<SendAgreement clientId="c" templates={[privacy, terms]} sent={[]} canEdit isOwner />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Privacy Policy version 2" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Choose an agreement" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
