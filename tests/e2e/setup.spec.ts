import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function fillProfile(page: Page, name = "Acme Studio") {
  await page.getByLabel("Business name").fill(name);
  await page.getByRole("combobox", { name: "Industry" }).click();
  await page.getByRole("option", { name: "Professional services" }).click();
  await page.getByRole("combobox", { name: "Team size" }).click();
  await page.getByRole("option", { name: "2-5 people" }).click();
}
const next = (page: Page) => page.getByRole("button", { name: /^Next/ });
const moduleBox = (page: Page, name: string) => page.getByTestId("module-choices").getByLabel(name, { exact: true });

/** Walks the wizard to the end with a few changes from the defaults. */
async function completeSetup(page: Page) {
  await page.goto("/app/setup");
  await fillProfile(page);
  await next(page).click();
  await moduleBox(page, "Projects").uncheck();
  await moduleBox(page, "Vendors").check();
  await next(page).click();
  await page.getByLabel("Reconcile bank statements").uncheck();
  await next(page).click();
  await page.getByLabel("CRM & Data data is done").check();
  await next(page).click();
  await page.getByRole("button", { name: "Finish setup" }).click();
}

test.describe("back office setup module", () => {
  test("step 1 needs the whole profile before going on", async ({ page }) => {
    await page.goto("/app/setup");
    await expect(next(page)).toBeDisabled();
    await page.getByLabel("Business name").fill("A");
    await expect(next(page)).toBeDisabled();
    await fillProfile(page);
    await expect(next(page)).toBeEnabled();
  });

  test("modules start from the recommendations for the industry and team size", async ({ page }) => {
    await page.goto("/app/setup");
    await fillProfile(page);
    await next(page).click();
    const list = page.getByTestId("module-choices");
    await expect(list.getByText("Recommended", { exact: true })).toHaveCount(7);
    for (const name of ["Documents", "Invoices", "Admin Support", "Projects", "Forms & Paperwork", "CRM & Data", "Licenses & Renewals"]) {
      await expect(moduleBox(page, name)).toBeChecked();
    }
    for (const name of ["Vendors", "Reporting", "Business File Reset"]) await expect(moduleBox(page, name)).not.toBeChecked();
    await expect(list).toContainText("Client work needs tasks, deadlines and status reports.");

    await moduleBox(page, "Documents").uncheck();
    await page.getByRole("button", { name: "Use recommended" }).click();
    await expect(moduleBox(page, "Documents")).toBeChecked();

    for (const name of ["Documents", "Invoices", "Admin Support", "Projects", "Forms & Paperwork", "CRM & Data", "Licenses & Renewals"]) await moduleBox(page, name).uncheck();
    await expect(next(page)).toBeDisabled();
  });

  test("templates are grouped by module and all start selected", async ({ page }) => {
    await page.goto("/app/setup");
    await fillProfile(page);
    await next(page).click();
    await next(page).click();
    const groups = page.getByTestId("template-group");
    await expect(groups.filter({ hasText: "Forms & Paperwork" })).toContainText("New employee details");
    await expect(groups.filter({ hasText: "Admin Support" })).toContainText("Reconcile bank statements");
    await expect(groups.filter({ hasText: "Licenses & Renewals" })).toContainText("Common small-business licenses");
    await expect(groups.filter({ hasText: "CRM & Data" })).toContainText("Nothing to install");
    await expect(page.getByLabel("New employee details")).toBeChecked();
    await expect(page.getByLabel("Weekly team agenda").or(page.getByLabel("Send the weekly team agenda"))).toBeChecked();
  });

  test("the review shows live checks, links each problem to its step, and blocks an unusable setup", async ({ page }) => {
    await page.goto("/app/setup");
    await page.getByRole("button", { name: /Review/ }).click(); // jump straight to the end with nothing filled in
    await expect(page.getByTestId("check").filter({ hasText: "Business profile" })).toHaveAttribute("data-status", "fail");
    await expect(page.getByTestId("check").filter({ hasText: "Services chosen" })).toHaveAttribute("data-status", "fail");
    await expect(page.getByRole("button", { name: "Finish setup" })).toBeDisabled();
    await expect(page.getByText("Fix the items marked with a cross to finish.")).toBeVisible();
    await page.getByRole("button", { name: "Fix Business profile" }).click();
    await expect(page.getByLabel("Business name")).toBeVisible();
  });

  test("finishing installs the templates into their modules", async ({ page }) => {
    await completeSetup(page);
    const done = page.getByTestId("setup-complete");
    await expect(done).toContainText("Acme Studio is set up");
    const installed = page.getByTestId("installed-list");
    await expect(installed).toContainText("New employee details (Form, in Forms & Paperwork)");
    await expect(installed).toContainText("Send the weekly team agenda (Recurring task, in Admin Support)");
    await expect(installed).toContainText("Common small-business licenses (License records, in Licenses & Renewals)");
    await expect(installed).not.toContainText("Reconcile bank statements");
    await expect(done.getByRole("link", { name: "Vendors" })).toBeVisible();
    await expect(done.getByRole("link", { name: "Projects" })).toHaveCount(0);

    // Forms: 3 samples + 3 installed.
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card")).toHaveCount(6);
    await expect(page.getByRole("heading", { name: "Expense reimbursement" })).toBeVisible();
    await expect(page.getByTestId("form-card").filter({ hasText: "Expense reimbursement" })).toContainText("Approval: Finance manager");

    // Admin: 3 sample recurring tasks + 3 installed (bank reconciliation was unticked).
    await page.goto("/app/admin");
    await expect(page.getByTestId("routine-row")).toHaveCount(6);
    await expect(page.getByTestId("routine-row").filter({ hasText: "Follow up on overdue invoices" })).toContainText("every week");
    await expect(page.getByTestId("routine-row").filter({ hasText: "Reconcile bank statements" })).toHaveCount(1); // the sample one only

    // Licenses: 5 samples + 4 starter records.
    await page.goto("/app/licenses");
    await expect(page.getByTestId("license-card")).toHaveCount(9);
    await expect(page.getByTestId("license-card").filter({ hasText: "Local business permit" })).toBeVisible();
  });

  test("an installed form can be filled in and routes to its approver", async ({ page }) => {
    await completeSetup(page);
    await page.goto("/app/forms");
    const card = page.getByTestId("form-card").filter({ hasText: "Expense reimbursement" });
    await card.getByRole("button", { name: "Fill out" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Your name").fill("Sam");
    await dialog.getByLabel(/Employee name/).fill("Sam Rivera");
    await dialog.getByLabel(/Expense date/).fill("2026-11-02");
    await dialog.getByLabel(/Amount/).fill("42.50");
    await dialog.getByRole("combobox", { name: /Category/ }).click();
    await page.getByRole("option", { name: "Travel" }).click();
    await dialog.getByLabel(/What was it for/).fill("Train ticket");
    await dialog.getByLabel(/Receipt attached/).check();
    await dialog.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("status")).toContainText("Waiting for Finance manager to approve");
  });

  test("a setup that is not finished installs nothing", async ({ page }) => {
    await page.goto("/app/setup");
    await fillProfile(page);
    await next(page).click();
    await next(page).click(); // templates chosen, but never finished
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card")).toHaveCount(3);
  });

  test("progress is saved, so leaving and coming back picks up where you were", async ({ page }) => {
    await page.goto("/app/setup");
    await fillProfile(page, "Saved & Sound");
    await next(page).click();
    await moduleBox(page, "Vendors").check();
    await page.reload();
    await expect(page.getByRole("button", { name: /Services/ })).toHaveAttribute("aria-current", "step");
    await expect(moduleBox(page, "Vendors")).toBeChecked();
    await page.getByRole("button", { name: /Business/ }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("Saved & Sound");
  });

  test("a finished setup can be viewed, and Start over clears everything", async ({ page }) => {
    await completeSetup(page);
    await page.goto("/app/setup");
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("");
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card")).toHaveCount(3);
  });

  test("editing a finished setup takes it out of 'installed' until finished again", async ({ page }) => {
    await completeSetup(page);
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card")).toHaveCount(6);
    await page.goto("/app/setup");
    await page.getByRole("button", { name: "Edit setup" }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("Acme Studio"); // the answers are kept
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card")).toHaveCount(3);
    await page.goto("/app/setup");
    await page.getByRole("button", { name: /Review/ }).click();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card")).toHaveCount(6);
  });

  test("damaged or hostile saved data is ignored", async ({ page }) => {
    await page.goto("/app/setup");
    for (const bad of ["{not json", "null", JSON.stringify({ version: 1, modules: ["<img src=x onerror=alert(1)>"], templates: ["nope"], business: { name: { x: 1 } }, completedOn: "x" })]) {
      await page.evaluate((v) => localStorage.setItem("aurum.setup.v1", v), bad);
      await page.reload();
      await expect(page.getByLabel("Business name")).toHaveValue("");
      await expect(page.getByRole("heading", { level: 1, name: "Back Office Setup" })).toBeVisible();
    }
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card")).toHaveCount(3);
  });

  test("fits a phone screen without horizontal scroll at every step", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/setup");
    const noScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await noScroll();
    await fillProfile(page);
    for (let i = 0; i < 4; i++) { await next(page).click(); await noScroll(); }
    await expect(page.getByRole("button", { name: "Finish setup" })).toBeVisible();
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/setup");
    await expect(page.getByRole("heading", { level: 1, name: "Back Office Setup" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back Office Setup", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
