// One scene per module. Each scene drives the app like a person would. step(title, body, target) shows a caption
// that explains what is on screen and highlights the target. Caption times are measured while recording, so they
// always match the footage, and each caption stays up long enough to read.
// h: { page, go, wait, scroll, type, step, spot, unspot }

export const MODULES = [
  {
    id: "dashboard", title: "Dashboard", pain: "See what needs attention before it becomes a problem",
    async run({ page, go, wait, scroll, step }) {
      await go("/app/overview", 1500);
      await step("Start every day here", "The dashboard shows your outstanding invoices, open tasks and everything that needs attention, updated as you work.", page.getByText("Outstanding invoices").locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await wait(800);
      await step("Late or expiring items are flagged for you", "Overdue invoices, late tasks and licenses nearing expiry collect in “Needs your attention”, so nothing slips through.", page.getByText("Needs your attention").locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await step("Focus on one area at a time", "Use the filters to show only invoices, licenses or tasks.", page.getByText(/^Licenses \(\d+\)$/));
      await page.getByText(/^Licenses \(\d+\)$/).first().click({ timeout: 3000 }).catch(() => {});
      await step("See where the work is piling up", "Open work by area compares invoices, licenses, vendors and tasks, and shows how much of each needs attention.", page.getByText("Open work by area").locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await step("Know what is due this week", "The seven-day view shows what is coming due, day by day, so you can plan ahead.", page.getByText("Due in the next 7 days").locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await wait(500);
    },
  },
  {
    id: "licenses", title: "Licenses & Renewals", pain: "Never miss a license, permit or insurance renewal",
    async run({ page, go, wait, scroll, step }) {
      await go("/app/licenses", 1500);
      await step("Every license, permit and policy in one place", "Track contractor licenses, insurance, registrations and certifications, each with its issuer, number and expiry date.");
      await wait(1200);
      await step("See your compliance at a glance", "These tiles show what is active, what expires within 30 days, what has expired, and how many required documents are still missing.", page.getByText("Documents missing").locator("xpath=ancestor::*[contains(@class,'grid')][1]"));
      await step("Follow up before it is too late", "“Follow up today” lists renewals that need a nudge. Send a reminder in one click.", page.getByText("Follow up today").locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await step("Renewal tasks keep the team on track", "Every renewal has a stage, such as Not started or In progress, and a due date with the days left.", page.getByText("Renewal tasks").locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await step("Search and filter", "Find a license by name, issuer or number. Filter by status or category, or sort by soonest expiry.", page.getByPlaceholder(/Search name, issuer/));
      await step("Check which documents are missing", "Open a license to see the documents it requires, such as an updated certificate of insurance, and tick each one off when it arrives.", page.getByText("General Liability Insurance").first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await wait(500);
    },
  },
  {
    id: "equipment", title: "Equipment", pain: "Know where every tool, vehicle and unit is, and who has it",
    async run({ page, go, wait, type, step }) {
      await go("/app/equipment", 1500);
      await step("Track every tool, vehicle and unit", "Keep tools, vehicles, appliances, HVAC units and keys in one list, with the dates that matter.");
      await wait(1200);
      const items = [
        ["Service van 3", "1FTBW2CM8GKA12345", "2026-12-20", "Sam Rivera", "Yard, bay 2"],
        ["Refrigerant recovery machine", "RRM-2201", "2020-01-15", "Jo Park", "Shop, cage A"],
      ];
      for (const [i, [name, serial, next, who, where]] of items.entries()) {
        await page.getByRole("button", { name: "Add equipment" }).first().click();
        await wait(500);
        if (i === 0) await step("Add an item in under a minute", "Enter the name and the serial number, VIN, plate or key tag. Say where it is kept and who has it.");
        await type("Name", name);
        await type("Serial, VIN, plate or key tag", serial);
        await type("Assigned to", who);
        await type("Where it is kept", where);
        if (i === 0) await step("Set the next service date", "Add the next service or inspection date, and an optional repeat interval, so maintenance is never forgotten.");
        await page.getByRole("dialog").getByLabel("Next service").fill(next);
        await wait(500);
        await page.getByRole("dialog").getByRole("button", { name: "Add equipment" }).click();
        await wait(1300);
      }
      await step("Overdue service is flagged automatically", "Anything past its service date is marked, and the summary tiles count what needs attention.", page.getByTestId("equipment-row").first());
      await step("Log service in one click", "Choose Log service and AdFlo records it. If you set a repeat interval, the next date is worked out for you.", page.getByRole("button", { name: "Log service for Refrigerant recovery machine" }));
      await page.getByRole("button", { name: "Log service for Refrigerant recovery machine" }).click({ timeout: 4000 }).catch(() => {});
      await wait(1500);
      await step("Service dates show up where you plan", "Service and inspection dates appear on your calendar and dashboard, next to your licenses and invoices.");
      await wait(500);
    },
  },
  {
    id: "invoices", title: "Invoices", pain: "Know what you are owed and chase overdue payments",
    async run({ page, go, wait, step }) {
      await go("/app/invoices", 1500);
      await step("See what you are owed", "Totals for outstanding, overdue, due in the next 7 days, and paid this month, at the top of the page.", page.getByText("Outstanding").first().locator("xpath=ancestor::*[contains(@class,'grid')][1]"));
      await step("Overdue invoices rise to the top", "Invoices are grouped by status and sorted by urgency, with the number of days overdue shown.", page.getByText("INV-1041").first().locator("xpath=ancestor::*[self::li or self::div][contains(@class,'border') or contains(@class,'rounded')][1]"));
      await step("Chase payment with a reminder", "Each overdue invoice has a Remind button, so following up takes one click.");
      await step("Record a payment in seconds", "Choose Mark paid, confirm the date, and your totals update straight away.", page.getByRole("button", { name: "Mark paid" }).nth(1));
      await page.getByRole("button", { name: "Mark paid" }).nth(1).click({ timeout: 5000 });
      await wait(1500);
      await page.getByRole("dialog").getByRole("button", { name: "Mark paid" }).click({ timeout: 5000 });
      await wait(1500);
      await step("Hand the numbers to your accountant", "Download any invoice, or export the list as a CSV. AdFlo works alongside your accounting software and does not replace it.", page.getByRole("button", { name: /Export CSV/ }).first());
      await wait(500);
    },
  },
  {
    id: "contacts", title: "Contacts", pain: "Keep every customer, vendor and partner in one place",
    async run({ page, go, wait, step }) {
      await go("/app/contacts", 1500);
      await step("One directory for everyone you work with", "Customers, vendors and partners, with company, email, phone and the date you last got in touch.");
      await wait(1000);
      await step("Spot gaps and duplicates", "The tiles flag possible duplicates and contacts missing an email or phone number, so your records stay clean.", page.getByText("Possible duplicates").first().locator("xpath=ancestor::*[contains(@class,'grid')][1]"));
      await step("Find anyone in seconds", "Search by name, email, phone, company or notes.", page.getByPlaceholder(/Search name, email/));
      const search = page.getByPlaceholder(/Search name, email/);
      await search.click();
      await search.pressSequentially("maria", { delay: 130 });
      await wait(1500);
      await step("Know who needs a follow-up", "Each contact shows how long ago you last got in touch. Choose Log today to record a new contact.", page.getByText("Maria Alvarez").first().locator("xpath=ancestor::tr[1]"));
      await wait(500);
    },
  },
  {
    id: "vendors", title: "Vendors", pain: "Collect subcontractor paperwork and catch expiring insurance",
    async run({ page, go, wait, scroll, step }) {
      await go("/app/vendors", 1500);
      await step("Subcontractor and supplier paperwork, organized", "Each vendor has a checklist of the documents you require, such as a W-9, a certificate of insurance and a signed contract.");
      await wait(1000);
      await step("Catch expiring insurance", "Expired and soon-to-expire documents are flagged under “Needs attention”, before they become your risk.", page.getByText("Needs attention").first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await step("See who still owes you paperwork", "The follow-up list shows which vendors have not sent a required document yet.", page.getByText("Follow up today").first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await step("Onboard new vendors with a checklist", "A vendor who is still onboarding shows how many required documents are outstanding.", page.getByText("Precision Electric").first().locator("xpath=ancestor::*[self::li or self::div][contains(@class,'border') or contains(@class,'rounded')][1]"));
      await wait(500);
    },
  },
  {
    id: "tasks", title: "Tasks & Projects", pain: "Keep every job and task moving",
    async run({ page, go, wait, step }) {
      await go("/app/projects", 1500);
      await step("Every task and job in one place", "See active projects, open tasks, overdue tasks and what you finished this month.", page.getByText("Active projects").first().locator("xpath=ancestor::*[contains(@class,'grid')][1]"));
      await step("Add a task in seconds", "Describe the work, choose who owns it and when it is due. Tasks can repeat weekly or monthly.", page.getByLabel("New task").first().locator("xpath=ancestor::form[1]"));
      const task = page.getByLabel("New task").first();
      await task.click();
      await task.pressSequentially("Order refrigerant for Maple Ridge", { delay: 55 });
      const who = page.getByLabel("Assignee").first();
      await who.click();
      await who.pressSequentially("Sam", { delay: 90 });
      await page.getByRole("button", { name: "Add task" }).first().click();
      await wait(1500);
      await step("Late work stands out", "Overdue tasks are flagged with how many days late they are, so nothing quietly slips.", page.getByText("Order units").first().locator("xpath=ancestor::li[1]"));
      await step("Group work into projects", "A project, such as a rooftop replacement, collects its tasks, client and due date in one place.", page.getByText("Maple Ridge: rooftop replacements").first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await wait(500);
    },
  },
  {
    id: "forms", title: "Forms & Paperwork", pain: "Collect the information you need without chasing it",
    async run({ page, go, wait, scroll, step }) {
      await go("/app/forms", 1500);
      await step("Collect information without chasing it", "Build a form once, send it to anyone, and collect the answers in one place.");
      await wait(1000);
      await step("Start from ready-made forms", "Client feedback and visitor sign-in forms are included. Edit them or build your own.", page.getByText("Client feedback").first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await step("Send it, fill it out, or print it", "Each form can be sent to a client, filled out inside AdFlo, or saved as a blank PDF.", page.getByRole("button", { name: "Send" }).first());
      await step("Onboarding packets and signatures", "Start a checklist of forms and documents for a new client or vendor, or request a signed copy of a document.", page.getByText("Onboarding packets").first().locator("xpath=ancestor::*[contains(@class,'rounded') or self::section][1]"));
      await wait(500);
    },
  },
  {
    id: "calendar", title: "Calendar", pain: "Every deadline from every part of your business, in one calendar",
    async run({ page, go, wait, step }) {
      await go("/app/calendar", 1500);
      await step("Every deadline in one calendar", "License renewals, invoices due, tasks and equipment service dates all appear together, so nothing hides in a separate list.");
      await wait(1200);
      await step("See what is due, and when", "Each item names what it is, such as an invoice due or a renewal, and clicking it opens the record.", page.getByText("INV-1041 due").first());
      await step("Switch between views", "Month, week or agenda. The agenda lists what is late first, then what is coming up, in date order.", page.getByRole("tab", { name: "agenda" }));
      await page.getByRole("tab", { name: "agenda" }).click({ timeout: 4000 }).catch(() => {});
      await wait(2500);
      await step("Take your deadlines with you", "Download a calendar file to add AdFlo deadlines to the calendar you already use.", page.getByRole("button", { name: /Download/ }).first());
      await wait(500);
    },
  },
  {
    id: "reporting", title: "Reporting", pain: "See the state of the business without building spreadsheets",
    async run({ page, go, wait, scroll, step }) {
      await go("/app/reporting", 1500);
      await step("See where to look first", "The overview ranks overdue and expiring items across every service, most urgent first.", page.getByText("Where to look first").first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
      await step("A report for every part of the business", "Open a report for licenses, invoices, vendors, contacts, equipment, tasks or forms.", page.getByRole("tab", { name: "Licenses & Renewals" }).first());
      await page.getByRole("tab", { name: "Licenses & Renewals" }).first().click({ timeout: 4000 }).catch(() => {});
      await wait(2500);
      await step("Licenses by status and type", "See what is active or expiring, how licenses split by type, and every record with its expiry date.");
      await page.getByRole("tab", { name: "Invoices" }).first().click({ timeout: 4000 }).catch(() => {});
      await wait(1500);
      await step("Invoices by status and client", "Outstanding, overdue and paid amounts, broken down by status and by client.");
      await wait(500);
    },
  },
  {
    id: "activity", title: "Activity Log", pain: "Know who did what, and when",
    async run({ page, go, wait, step }) {
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
      await step("Every change is recorded", "Adding, editing or deleting a record is logged automatically, so there is a clear trail of what happened.");
      await step("Who did what, and when", "Each entry names the person, the action, the record and the time.", page.getByText(/marked as paid/i).first().locator("xpath=ancestor::*[self::li or self::div][1]"));
      await step("Filter to find what you need", "Narrow the log by area, by person or by date range, or export it as a CSV.", page.getByPlaceholder(/Search activity/));
      await wait(500);
    },
  },
  {
    id: "addy", title: "Addy, your assistant", pain: "Ask in plain language, then review and approve",
    async run({ page, go, wait, step }) {
      await go("/app/assistant", 1500);
      await step("Meet Addy, your administrative assistant", "Addy answers questions about AdFlo and prepares drafts for you to review. You set up and manage your account yourself.");
      await wait(1000);
      await step("Ask in plain language", "Type what you need, such as a new invoice for a customer.", page.getByPlaceholder("Type a message"));
      const box = page.getByPlaceholder("Type a message");
      await box.click();
      await box.pressSequentially("New invoice for Harbor View Dental, $4,200 for spring maintenance", { delay: 45 });
      await wait(700);
      await box.press("Enter");
      await wait(2000);
      await step("Addy opens the form. You stay in control", "Addy only opens the form. Nothing changes until you review, edit and save it.");
      await page.getByRole("link", { name: "Open a draft invoice" }).click({ timeout: 5000 });
      await page.waitForLoadState("networkidle");
      await wait(1500);
    },
  },
  {
    id: "documents", title: "Documents", pain: "Find any document in seconds",
    async run({ page, go, wait, step }) {
      await go("/app", 1500);
      await step("A home for every business document", "Folders for invoices, receipts, contracts, tax documents, HR documents and insurance keep paperwork where you expect it.", page.getByText("All files").first().locator("xpath=ancestor::*[contains(@class,'grid')][1]"));
      await step("Upload several files at once", "Drag in a batch of files, or choose them from your computer.");
      await page.getByRole("button", { name: /^\s*Upload$/ }).click();
      const names = ["Insurance_Certificate_2026.pdf", "Contractor_License_Copy.pdf", "Subcontract_Crane_Rigging.pdf", "Maple_Ridge_Proposal.pdf"];
      await page.getByRole("dialog").getByTestId("file-input").setInputFiles(
        names.map((name) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4 ${name}`) })),
      );
      await wait(3000);
      await page.getByRole("dialog").getByRole("button", { name: "Done" }).click().catch(() => {});
      await wait(1200);
      await step("Search by name, tag or content", "Type a few letters and only the matching documents remain.", page.getByPlaceholder(/Search names/).first());
      await page.getByPlaceholder(/Search names/).first().click();
      await page.getByPlaceholder(/Search names/).first().pressSequentially("insurance", { delay: 110 });
      await wait(1500);
    },
  },
];
