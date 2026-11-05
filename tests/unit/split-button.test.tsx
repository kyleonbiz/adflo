// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportMenu, SplitButton } from "@/components/ui/split-button";

describe("SplitButton", () => {
  it("does the usual thing from the button and the other things from the arrow", async () => {
    const main = vi.fn();
    const other = vi.fn();
    render(<SplitButton onClick={main} menuLabel="More ways to add" actions={[{ label: "From a template", onSelect: other }]}>Add</SplitButton>);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(main).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "More ways to add" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "From a template" }));
    expect(other).toHaveBeenCalledTimes(1);
    expect(main).toHaveBeenCalledTimes(1);
  });
});

describe("ExportMenu", () => {
  it("offers each format and runs the one chosen", async () => {
    const csv = vi.fn();
    const xlsx = vi.fn();
    render(<ExportMenu actions={[{ label: "CSV", onSelect: csv }, { label: "Excel", onSelect: xlsx }]} />);
    await userEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(await screen.findAllByRole("menuitem")).toHaveLength(2);
    await userEvent.click(screen.getByRole("menuitem", { name: "Excel" }));
    expect(xlsx).toHaveBeenCalledTimes(1);
    expect(csv).not.toHaveBeenCalled();
  });

  it("is disabled when there is nothing to export", () => {
    render(<ExportMenu disabled actions={[{ label: "CSV", onSelect: () => {} }]} />);
    expect(screen.getByRole("button", { name: /Export/ }).hasAttribute("disabled")).toBe(true);
  });
});
