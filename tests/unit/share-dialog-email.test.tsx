// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareDialog } from "@/components/dms/share-dialog";

const made = { url: "https://www.adflo.pro/share/abc", expiresAt: "2026-11-25T15:00:00Z" };
function setup(result: Record<string, unknown> = made) {
  const onCreate = vi.fn(async () => ({ ...made, ...result }));
  render(<ShareDialog open fileName="W-9.pdf" onOpenChange={() => {}} onCreate={onCreate} loadLinks={async () => []} onRevoke={async () => {}} />);
  return onCreate;
}

describe("ShareDialog: email the link", () => {
  it("creates a plain link when no address is given", async () => {
    const onCreate = setup();
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));
    expect(onCreate).toHaveBeenCalledWith(60 * 24, undefined);
    expect(await screen.findByLabelText("Share link")).toHaveValue(made.url);
  });

  it("sends the address and note, and says who it went to", async () => {
    const onCreate = setup({ emailedTo: "pat@acme.com" });
    await userEvent.type(screen.getByLabelText(/Email the link to/), "pat@acme.com");
    await userEvent.type(await screen.findByLabelText(/Add a note/), "Here you go");
    await userEvent.click(screen.getByRole("button", { name: "Create link and email it" }));
    expect(onCreate).toHaveBeenCalledWith(60 * 24, { emailTo: "pat@acme.com", message: "Here you go" });
    expect(await screen.findByRole("status")).toHaveTextContent("Emailed to pat@acme.com");
    expect(screen.getByLabelText("Share link")).toHaveValue(made.url); // still there to copy
  });

  it("refuses a bad address before anything is created", async () => {
    const onCreate = setup();
    await userEvent.type(screen.getByLabelText(/Email the link to/), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Create link and email it" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email address");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("shows the link and the reason when the email could not be sent", async () => {
    setup({ emailError: "The link was created but the email could not be sent. Copy the link and send it yourself." });
    await userEvent.type(screen.getByLabelText(/Email the link to/), "pat@acme.com");
    await userEvent.click(screen.getByRole("button", { name: "Create link and email it" }));
    expect(await screen.findByRole("status")).toHaveTextContent("could not be sent");
    expect(screen.getByLabelText("Share link")).toHaveValue(made.url);
  });
});
