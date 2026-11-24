// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

describe("settings: invoice automation", () => {
  it("is off by default, and only exact values switch it on", () => {
    expect(defaultSettings().automation).toEqual({ vendorChase: false, invoiceReminders: false, recurringInvoices: "off", packetReminders: false, autoTasks: false, vendorPacket: "off" });
    expect(parseSettings(JSON.stringify({ version: 1 })).automation).toEqual({ vendorChase: false, invoiceReminders: false, recurringInvoices: "off", packetReminders: false, autoTasks: false, vendorPacket: "off" });
    for (const bad of ["true", 1, "yes", {}]) expect(parseSettings(JSON.stringify({ version: 1, automation: { invoiceReminders: bad } })).automation.invoiceReminders).toBe(false);
    for (const bad of ["Draft", "on", true, 1, null, "auto"]) expect(parseSettings(JSON.stringify({ version: 1, automation: { recurringInvoices: bad } })).automation.recurringInvoices).toBe("off");
    expect(parseSettings(JSON.stringify({ version: 1, automation: { invoiceReminders: true, recurringInvoices: "draft" } })).automation).toMatchObject({ invoiceReminders: true, recurringInvoices: "draft" });
    expect(parseSettings(JSON.stringify({ version: 1, automation: { recurringInvoices: "send" } })).automation.recurringInvoices).toBe("send");
  });
});

describe("Automations section: packets", () => {
  const packets = () => screen.getByRole("switch", { name: "Remind people about unfinished onboarding packets" });

  it("is off to start with, and says exactly when it reminds", () => {
    render(<AutomationsSection base="/app" />);
    expect(packets()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/The first reminder goes 3 days after it was sent, then 7 days apart, up to 3 times/)).toBeInTheDocument();
  });

  it("switches on and off, saves, and asks for a business email", async () => {
    render(<AutomationsSection base="/app" />);
    await userEvent.click(packets());
    expect(saved().automation.packetReminders).toBe(true);
    expect(screen.getByRole("note")).toHaveTextContent(/Add your business email/);
    await userEvent.click(packets());
    expect(saved().automation.packetReminders).toBe(false);
  });

  it("only an exact true switches it on when settings are read", () => {
    for (const bad of ["true", 1, "yes", {}, null]) expect(parseSettings(JSON.stringify({ version: 1, automation: { packetReminders: bad } })).automation.packetReminders).toBe(false);
    expect(parseSettings(JSON.stringify({ version: 1, automation: { packetReminders: true } })).automation.packetReminders).toBe(true);
  });
});

describe("Automations section: invoices", () => {
  const reminders = () => screen.getByRole("switch", { name: "Remind customers about unpaid invoices" });
  const choice = (name: RegExp) => within(screen.getByRole("radiogroup", { name: "Create recurring invoices automatically" })).getByRole("radio", { name });

  it("starts with both invoice automations off", () => {
    render(<AutomationsSection base="/app" />);
    expect(reminders()).toHaveAttribute("aria-checked", "false");
    expect(choice(/^Off/)).toHaveAttribute("aria-checked", "true");
    expect(choice(/draft for me to approve/)).toHaveAttribute("aria-checked", "false");
  });

  it("switches payment reminders on and off, and saves", async () => {
    render(<AutomationsSection base="/app" />);
    await userEvent.click(reminders());
    expect(saved().automation.invoiceReminders).toBe(true);
    await userEvent.click(reminders());
    expect(saved().automation.invoiceReminders).toBe(false);
  });

  it("chooses how recurring invoices are made, and saves", async () => {
    render(<AutomationsSection base="/app" />);
    await userEvent.click(choice(/draft for me to approve/));
    expect(saved().automation.recurringInvoices).toBe("draft");
    expect(choice(/draft for me to approve/)).toHaveAttribute("aria-checked", "true");
    await userEvent.click(choice(/send it to the customer/));
    expect(saved().automation.recurringInvoices).toBe("send");
    await userEvent.click(choice(/^Off/));
    expect(saved().automation.recurringInvoices).toBe("off");
  });

  it("asks for a business email when something that emails customers is on, but not for drafts only", async () => {
    render(<AutomationsSection base="/app" />);
    await userEvent.click(choice(/draft for me to approve/));
    expect(screen.queryByRole("note")).toBeNull(); // drafts email nobody
    await userEvent.click(choice(/send it to the customer/));
    expect(screen.getByRole("note")).toHaveTextContent(/Add your business email/);
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

describe("Automations section: follow-up tasks", () => {
  const tasks = () => screen.getByRole("switch", { name: "Add follow-up tasks for me" });

  it("is off to start with, switches on and saves, and only an exact true counts", async () => {
    render(<AutomationsSection base="/app" />);
    expect(tasks()).toHaveAttribute("aria-checked", "false");
    await userEvent.click(tasks());
    expect(saved().automation.autoTasks).toBe(true);
    for (const bad of ["true", 1, "yes", {}, null]) expect(parseSettings(JSON.stringify({ version: 1, automation: { autoTasks: bad } })).automation.autoTasks).toBe(false);
  });
});

describe("Automations section: new vendor packet", () => {
  it("is off to start with, picks start-only or start-and-email, saves, and only exact values count", async () => {
    render(<AutomationsSection base="/app" />);
    const group = screen.getByRole("radiogroup", { name: "Start the subcontractor packet for new vendors" });
    const radios = group.querySelectorAll('[role="radio"]');
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    await userEvent.click(radios[2] as HTMLElement);
    expect(saved().automation.vendorPacket).toBe("send");
    expect(screen.getByRole("note")).toHaveTextContent(/Add your business email/); // it emails vendors, so replies need a home
    await userEvent.click(radios[1] as HTMLElement);
    expect(saved().automation.vendorPacket).toBe("draft");
    for (const bad of ["Send", true, 1, "yes", null]) expect(parseSettings(JSON.stringify({ version: 1, automation: { vendorPacket: bad } })).automation.vendorPacket).toBe("off");
  });
});
