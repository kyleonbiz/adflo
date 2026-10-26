import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const card = (page: Page, title: string) => page.getByTestId("request-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

async function readDownload(download: import("@playwright/test").Download): Promise<string> {
  let text = "";
  for await (const chunk of await download.createReadStream()) text += chunk;
  return text;
}

test.describe("admin support module", () => {
  test("summary, digest, filters and search", async ({ page }) => {
    await page.goto("/app/admin");
    await expect(page.getByRole("note")).toContainText("Nothing is saved");
    await expect(page.getByTestId("request-card")).toHaveCount(7);

    const digest = page.getByTestId("digest");
    await expect(digest).toContainText("is 1 day overdue");
    await expect(digest).toContainText("waiting for approval");
    await expect(digest).toContainText("1 recurring task due: Reconcile bank statements");

    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Awaiting approval" }).click();
    await expect(page.getByTestId("request-card")).toHaveCount(2);
    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "All statuses" }).click();
    await page.getByRole("combobox", { name: "Filter by category" }).click();
    await page.getByRole("option", { name: "Documents" }).click();
    await expect(page.getByTestId("request-card")).toHaveCount(2);
    await page.getByRole("textbox", { name: "Search requests" }).fill("lease");
    await expect(page.getByTestId("request-card")).toHaveCount(1);
  });

  test("risky requests wait for approval; approving makes them open", async ({ page }) => {
    await page.goto("/app/admin");
    const wire = card(page, "Wire $4,800 to Globex for the annual license");
    await expect(wire).toContainText("Awaiting approval");
    await expect(wire).toContainText("Needs approval: mentions a wire transfer");
    await expect(wire.getByRole("button", { name: /^Start/ })).toHaveCount(0);

    await wire.getByLabel(/^Comment on/).fill("Checked invoice 4471");
    await wire.getByRole("button", { name: /^Approve/ }).click();
    await expect(wire.getByText("Open", { exact: true })).toBeVisible();
    await expect(wire).toContainText("Approved by Operations manager");
    await expect(wire).toContainText("Checked invoice 4471");
    await expect(wire.getByRole("button", { name: /^Start/ })).toBeVisible();

    const access = card(page, "Give Sam access to the shared drive");
    await access.getByRole("button", { name: /^Decline/ }).click();
    await expect(access.getByText("Declined", { exact: true })).toBeVisible();
    await expect(access.getByRole("button", { name: /^Start/ })).toHaveCount(0);
  });

  test("a finished request shows its due date, not how late it was", async ({ page }) => {
    await page.goto("/app/admin");
    const lease = card(page, "Send the signed lease to the landlord");
    await expect(lease.getByText("Done", { exact: true })).toBeVisible();
    await expect(lease).not.toContainText("overdue");
    await expect(lease).toContainText(/Due [A-Z][a-z]{2} \d{1,2}, \d{4}/);
  });

  test("working a request: start, done, reopen and delete", async ({ page }) => {
    await page.goto("/app/admin");
    const toner = card(page, "Order new toner for the front office printer");
    await toner.getByRole("button", { name: /^Start/ }).click();
    await expect(toner.getByText("In progress", { exact: true })).toBeVisible();
    await toner.getByRole("button", { name: /^Mark .* done/ }).click();
    await expect(toner.getByText("Done", { exact: true })).toBeVisible();
    await toner.getByRole("button", { name: /^Reopen/ }).click();
    await expect(toner.getByText("Open", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete Order new toner for the front office printer" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("request-card")).toHaveCount(6);
  });

  test("new request: live suggestions, approval warning, validation", async ({ page }) => {
    await page.goto("/app/admin");
    await page.getByRole("button", { name: "New request" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create request" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Enter a short title");

    await dialog.getByLabel("Title").fill("Reschedule the vendor call");
    await expect(dialog.getByTestId("suggestion-why")).toContainText("Suggested Scheduling (high confidence) from: reschedul, call");
    await expect(dialog.getByTestId("approval-note")).toHaveCount(0);

    await dialog.getByLabel("Details").fill("Please wire the deposit, urgent");
    await expect(dialog.getByTestId("approval-note")).toContainText("mentions a wire transfer");
    await expect(dialog.getByRole("button", { name: "Submit for approval" })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Priority" })).toContainText("Suggested: High");

    await dialog.getByLabel("Details").fill("Move it to Friday");
    await dialog.getByLabel("From").fill("Dana");
    await dialog.getByLabel("Due date (optional)").fill("2026-12-01");
    await dialog.getByRole("button", { name: "Create request" }).click();
    await expect(dialog).toBeHidden();
    const created = card(page, "Reschedule the vendor call");
    await expect(created).toContainText("Dana");
    await expect(created.getByText("Scheduling", { exact: true })).toBeVisible();
    await expect(created.getByText("Open", { exact: true })).toBeVisible();
  });

  test("a category you pick overrides the suggestion", async ({ page }) => {
    await page.goto("/app/admin");
    await page.getByRole("button", { name: "New request" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Reschedule the vendor call");
    await dialog.getByRole("combobox", { name: "Category" }).click();
    await page.getByRole("option", { name: "Finance & payments" }).click();
    await expect(dialog.getByTestId("suggestion-why")).toHaveCount(0);
    await expect(dialog.getByTestId("approval-note")).toContainText("finance requests need approval");
  });

  test("fill a request from a pasted email", async ({ page }) => {
    await page.goto("/app/admin");
    await page.getByRole("button", { name: "New request" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Fill from a pasted email" }).click();
    await dialog.getByRole("button", { name: "Fill the form" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Paste an email first");
    await dialog.getByLabel("Pasted email").fill("From: Priya Shah <priya@contoso.example>\nSubject: Re: Install the new printer\n\nThe office printer needs the driver installed.\n\n> older quoted text");
    await dialog.getByRole("button", { name: "Fill the form" }).click();
    await expect(dialog.getByLabel("Title")).toHaveValue("Install the new printer");
    await expect(dialog.getByLabel("From")).toHaveValue("Priya Shah");
    await expect(dialog.getByLabel("Details")).toHaveValue("The office printer needs the driver installed.");
    await expect(dialog.getByTestId("suggestion-why")).toContainText("IT & equipment");
    await dialog.getByRole("button", { name: "Create request" }).click();
    const created = card(page, "Install the new printer");
    await expect(created.getByText("From email", { exact: true })).toBeVisible();
  });

  test("recurring tasks: create the due ones, add and delete", async ({ page }) => {
    await page.goto("/app/admin");
    await expect(page.getByTestId("routine-row")).toHaveCount(3);
    await expect(page.getByTestId("routine-row").first()).toContainText("Due");
    await page.getByRole("button", { name: "Create due requests" }).click();
    await expect(page.getByRole("status")).toContainText("Created 1 request from recurring tasks.");
    await expect(page.getByTestId("request-card")).toHaveCount(8);
    const made = card(page, "Reconcile bank statements");
    await expect(made.getByText("Recurring", { exact: true })).toBeVisible();
    await expect(made).toContainText("Needs approval: finance requests need approval");
    await expect(page.getByRole("button", { name: "Create due requests" })).toBeDisabled();

    await page.getByRole("region", { name: "Recurring tasks" }).getByRole("button", { name: "Add" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add recurring task" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Enter a short title");
    await dialog.getByLabel("Title").fill("Back up the shared drive");
    await dialog.getByRole("button", { name: "Add recurring task" }).click();
    await expect(page.getByTestId("routine-row")).toHaveCount(4);
    await page.getByRole("button", { name: "Delete recurring task Back up the shared drive" }).click();
    await expect(page.getByTestId("routine-row")).toHaveCount(3);
  });

  test("downloads a calendar file with the due dates", async ({ page }) => {
    await page.goto("/app/admin");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Add to calendar" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^admin-calendar-\d{4}-\d{2}-\d{2}\.ics$/);
    const ics = await readDownload(file);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("SUMMARY:Reschedule Thursday's vendor call");
    expect(ics).toContain("SUMMARY:Recurring: Send weekly team agenda");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(5);
    expect(ics).not.toContain("Wire $4,800"); // waiting for approval, so not scheduled yet
  });

  test("fits a phone screen without horizontal scroll, including the request dialog", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/admin");
    await expect(page.getByTestId("request-card").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "New request" }).click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Admin Support" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin Support", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
