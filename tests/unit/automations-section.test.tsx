// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutomationsSection } from "@/components/settings/automations-section";
import { SETTINGS_KEY, parseSettings } from "@/lib/settings/storage";
import { defaultSettings } from "@/lib/settings/types";

const saved = () => JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null");
beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("settings: automation", () => {
  it("is off by default, and only a real true switches it on", () => {
    expect(defaultSettings().automation.vendorChase).toBe(false);
    expect(parseSettings("").automation.vendorChase).toBe(false);
    expect(parseSettings(JSON.stringify({ version: 1 })).automation.vendorChase).toBe(false); // settings saved before this existed
    for (const bad of ["true", 1, "yes", null, {}]) expect(parseSettings(JSON.stringify({ version: 1, automation: { vendorChase: bad } })).automation.vendorChase).toBe(false);
    expect(parseSettings(JSON.stringify({ version: 1, automation: { vendorChase: true } })).automation.vendorChase).toBe(true);
  });
});

describe("Automations section", () => {
  const toggle = () => screen.getByRole("switch", { name: "Ask vendors for missing or expiring documents" });

  it("starts off and explains exactly what it would do", () => {
    render(<AutomationsSection base="/app" />);
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/Up to 3 emails, 7 days apart/)).toBeInTheDocument();
    expect(screen.getByText(/replies come to you/)).toBeInTheDocument();
  });

  it("switches on and off, and saves each choice", async () => {
    render(<AutomationsSection base="/app" />);
    await userEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(saved().automation.vendorChase).toBe(true);
    await userEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(saved().automation.vendorChase).toBe(false);
  });

  it("asks for a business email when it is on without one, and shows where replies go once there is one", async () => {
    render(<AutomationsSection base="/app" />);
    await userEvent.click(toggle());
    expect(screen.getByRole("note")).toHaveTextContent(/Add your business email/);
    expect(screen.getByRole("link", { name: "Business profile" })).toHaveAttribute("href", "/app/setup?tab=profile");
  });

  it("names the business email that replies go to", () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), details: { ...defaultSettings().details, email: "office@acme.test" }, automation: { vendorChase: true } }));
    render(<AutomationsSection base="/app" />);
    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/to office@acme.test/)).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });
});
