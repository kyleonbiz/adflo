// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SendFormDialog } from "@/components/forms/send-form-dialog";
import type { FormTemplate } from "@/lib/forms/types";

const form: FormTemplate = { id: "f1", name: "Site visit", description: "", fields: [], documentTemplate: "", sentCount: 0 } as unknown as FormTemplate;

describe("SendFormDialog", () => {
  it("says the form is saved when it was just made", () => {
    render(<SendFormDialog form={form} justCreated onOpenChange={() => {}} onSent={() => {}} />);
    expect(screen.getByTestId("send-just-created").textContent).toContain("Your form is saved");
  });

  it("leaves that line out when sending an existing form", () => {
    render(<SendFormDialog form={form} onOpenChange={() => {}} onSent={() => {}} />);
    expect(screen.queryByTestId("send-just-created")).toBeNull();
    expect(screen.getByText(/Anyone with the link can fill this form in/)).toBeTruthy();
  });

  it("shows nothing without a form", () => {
    render(<SendFormDialog form={null} justCreated onOpenChange={() => {}} onSent={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
