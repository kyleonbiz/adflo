// One scene per module. Each scene drives the app like a person would and calls h.cap("...") when a new caption
// should appear. Caption times are measured while recording, so they always match the footage.
// h: { page, go(path, ms), wait(ms), glide(locator, ms), scroll(px, ms), type(label, text), cap(text) }

export const MODULES = [
  {
    id: "dashboard", title: "Dashboard", pain: "See what needs attention before it becomes a problem",
    async run({ page, go, wait, glide, scroll, cap }) {
      await go("/app/overview", 1500);
      cap("Your whole business at a glance");
      await wait(3000);
      cap("Overdue and expiring items surface automatically");
      await glide(page.getByText("Needs your attention").first(), 3500);
      await scroll(450, 2500);
      cap("Open work by area, and what is due this week");
      await wait(3500);
    },
  },
  {
    id: "licenses", title: "Licenses & Renewals", pain: "Never miss a license, permit or insurance renewal",
    async run({ page, go, wait, glide, scroll, cap }) {
      await go("/app/licenses", 1500);
      cap("Every license, permit and insurance policy in one place");
      await wait(3000);
      cap("Reminders go out before anything expires");
      await glide(page.getByText("Follow up today").first(), 3000);
      cap("See which documents are still missing");
      await scroll(500, 3000);
      await glide(page.getByText("General Liability Insurance").first(), 3000);
      cap("Renewal tasks keep your team on track");
      await scroll(-300, 3000);
    },
  },
  {
    id: "equipment", title: "Equipment", pain: "Know where every tool, vehicle and unit is, and who has it",
    async run({ page, go, wait, glide, type, cap }) {
      await go("/app/equipment", 1500);
      cap("Tools, vehicles, HVAC units and keys in one list");
      await wait(2500);
      const items = [
        ["Service van 3", "1FTBW2CM8GKA12345", "2026-12-20", "Sam Rivera", "Yard, bay 2"],
        ["Refrigerant recovery machine", "RRM-2201", "2020-01-15", "Jo Park", "Shop, cage A"],
      ];
      for (const [i, [name, serial, next, who, where]] of items.entries()) {
        if (i === 0) cap("Add an item with its serial number, location and owner");
        await page.getByRole("button", { name: "Add equipment" }).first().click();
        await wait(500);
        await type("Name", name);
        await type("Serial, VIN, plate or key tag", serial);
        await type("Assigned to", who);
        await type("Where it is kept", where);
        await page.getByRole("dialog").getByLabel("Next service").fill(next);
        await wait(400);
        await page.getByRole("dialog").getByRole("button", { name: "Add equipment" }).click();
        await wait(1300);
      }
      cap("Overdue service is flagged automatically");
      await glide(page.getByTestId("equipment-row").first(), 3000);
      cap("Log service in one click");
      await page.getByRole("button", { name: "Log service for Refrigerant recovery machine" }).click({ timeout: 5000 }).catch(() => {});
      await wait(3000);
    },
  },
  {
    id: "invoices", title: "Invoices", pain: "Know what you are owed and chase overdue payments",
    async run({ page, go, wait, glide, cap }) {
      await go("/app/invoices", 1500);
      cap("Track what you are owed in one view");
      await wait(3000);
      cap("Overdue invoices rise to the top");
      await glide(page.getByText("INV-1041").first(), 3000);
      cap("Mark an invoice paid in one click");
      await page.getByRole("button", { name: "Mark paid" }).nth(1).click({ timeout: 5000 });
      await wait(1800);
      await page.getByRole("dialog").getByRole("button", { name: "Mark paid" }).click({ timeout: 5000 });
      await wait(2500);
      cap("Export your invoices whenever you need them");
      await glide(page.getByRole("button", { name: /Export CSV/ }).first(), 2500);
    },
  },
  {
    id: "contacts", title: "Contacts", pain: "Keep every customer, vendor and partner in one place",
    async run({ page, go, wait, glide, cap }) {
      await go("/app/contacts", 1500);
      cap("Customers, vendors and partners in one directory");
      await wait(3000);
      cap("Find anyone in seconds");
      const search = page.getByPlaceholder(/Search name, email/);
      await search.click();
      await search.pressSequentially("maria", { delay: 120 });
      await wait(3000);
      await search.fill("");
      cap("Know who needs a follow-up");
      await glide(page.getByText("Cool Supply Co.").first(), 3500);
    },
  },
  {
    id: "vendors", title: "Vendors", pain: "Collect subcontractor paperwork and catch expiring insurance",
    async run({ page, go, wait, glide, scroll, cap }) {
      await go("/app/vendors", 1500);
      cap("Subcontractors and suppliers, with their paperwork");
      await wait(3500);
      cap("Missing documents and expired insurance are flagged");
      await glide(page.getByText("Crane & Rigging Partners").first(), 3500);
      cap("Onboarding checklists for every new vendor");
      await glide(page.getByText("Precision Electric").first(), 3500);
      await scroll(250, 2500);
    },
  },
  {
    id: "tasks", title: "Tasks & Projects", pain: "Keep every job and task moving",
    async run({ page, go, wait, glide, cap }) {
      await go("/app/projects", 1500);
      cap("Every task and job, grouped by project");
      await wait(3000);
      cap("Add a task in seconds");
      const task = page.getByLabel("New task").first();
      await task.click();
      await task.pressSequentially("Order refrigerant for Maple Ridge", { delay: 55 });
      const who = page.getByLabel("Assignee").first();
      await who.click();
      await who.pressSequentially("Sam", { delay: 90 });
      await page.getByRole("button", { name: "Add task" }).first().click();
      await wait(2500);
      cap("Overdue work is flagged, so nothing slips");
      await glide(page.getByText("Order units").first(), 3500);
    },
  },
  {
    id: "forms", title: "Forms & Paperwork", pain: "Collect the information you need without chasing it",
    async run({ page, go, wait, glide, scroll, cap }) {
      await go("/app/forms", 1500);
      cap("Build forms and send them to anyone");
      await wait(3000);
      cap("Client feedback, visitor sign-in and more, ready to use");
      await glide(page.getByText("Client feedback").first(), 3500);
      cap("Onboarding packets and signature requests");
      await scroll(450, 2500);
      await wait(3000);
    },
  },
  {
    id: "calendar", title: "Calendar", pain: "Every deadline from every part of your business, in one calendar",
    async run({ page, go, wait, glide, cap }) {
      await go("/app/calendar", 1500);
      cap("Every deadline in one calendar");
      await wait(3500);
      cap("Licenses, invoices, tasks and service dates, all together");
      await glide(page.getByText("INV-1041 due").first(), 3000);
      cap("Switch to an agenda of what is coming up");
      await page.getByRole("tab", { name: "agenda" }).click({ timeout: 5000 }).catch(() => {});
      await wait(4000);
      cap("Download it to your own calendar");
      await glide(page.getByRole("button", { name: /Download/ }).first(), 2500);
    },
  },
  {
    id: "reporting", title: "Reporting", pain: "See the state of the business without building spreadsheets",
    async run({ page, go, wait, glide, scroll, cap }) {
      await go("/app/reporting", 1500);
      cap("See where to look first");
      await wait(3500);
      cap("A report for every part of the business");
      await glide(page.getByRole("tab", { name: "Licenses & Renewals" }).first(), 1200);
      await page.getByRole("tab", { name: "Licenses & Renewals" }).first().click({ timeout: 5000 }).catch(() => {});
      await wait(3500);
      await page.getByRole("tab", { name: "Invoices" }).first().click({ timeout: 5000 }).catch(() => {});
      await wait(3500);
      cap("Export what you need for your accountant");
      await scroll(300, 3000);
    },
  },
  {
    id: "activity", title: "Activity Log", pain: "Know who did what, and when",
    async run({ page, go, wait, glide, cap }) {
      await go("/app/projects", 1000);
      const task = page.getByLabel("New task").first();
      await task.fill("Send Harbor View maintenance contract");
      await page.getByRole("button", { name: "Add task" }).first().click();
      await wait(800);
      await go("/app/invoices", 800);
      await page.getByRole("button", { name: "Mark paid" }).first().click({ timeout: 5000 });
      await wait(600);
      await page.getByRole("dialog").getByRole("button", { name: "Mark paid" }).click({ timeout: 5000 });
      await wait(800);
      await go("/app/activity", 1500);
      cap("Every change is recorded");
      await wait(3500);
      cap("Who did what, and when");
      await glide(page.getByText(/added|marked/i).first(), 3500);
      cap("Filter by area, person or date");
      await wait(3000);
    },
  },
  {
    id: "addy", title: "Addy, your assistant", pain: "Ask in plain language, then review and approve",
    async run({ page, go, wait, cap }) {
      await go("/app/assistant", 1500);
      cap("Meet Addy, your administrative assistant");
      await wait(3000);
      cap("Ask in plain language");
      const box = page.getByPlaceholder("Type a message");
      await box.click();
      await box.pressSequentially("New invoice for Harbor View Dental, $4,200 for spring maintenance", { delay: 45 });
      await wait(700);
      await box.press("Enter");
      await wait(2500);
      cap("Addy opens the form. Nothing changes until you review and save");
      await page.getByRole("link", { name: "Open a draft invoice" }).click({ timeout: 5000 });
      await page.waitForLoadState("networkidle");
      await wait(5000);
    },
  },
  {
    id: "documents", title: "Documents", pain: "Find any document in seconds",
    async run({ page, go, wait, cap }) {
      await go("/app", 1500);
      cap("Store and organize every business document");
      await wait(3000);
      cap("Upload several files at once");
      await page.getByRole("button", { name: /^\s*Upload$/ }).click();
      const names = ["Insurance_Certificate_2026.pdf", "Contractor_License_Copy.pdf", "Subcontract_Crane_Rigging.pdf", "Maple_Ridge_Proposal.pdf"];
      await page.getByRole("dialog").getByTestId("file-input").setInputFiles(
        names.map((name) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4 ${name}`) })),
      );
      await wait(3500);
      await page.getByRole("dialog").getByRole("button", { name: "Done" }).click({ timeout: 5000 }).catch(() => {});
      await wait(1500);
      cap("Search by name, tag or content");
      await page.getByPlaceholder(/Search names/).first().click();
      await page.getByPlaceholder(/Search names/).first().pressSequentially("insurance", { delay: 100 });
      await wait(3500);
    },
  },
];
