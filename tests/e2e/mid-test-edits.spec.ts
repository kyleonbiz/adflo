import { expect, test } from "./fixtures";
import { addDocuments } from "./docs";

test.describe("documents", () => {
  test("a starred document cannot be deleted, and Empty trash clears the rest", async ({ page }) => {
    await page.goto("/app");
    await addDocuments(page);
    const cards = page.getByTestId("document-card");

    // Star one: its quick actions no longer offer to delete it, and the details panel disables Delete File.
    const starred = cards.filter({ hasText: "NDA_Summit" });
    await starred.getByRole("button", { name: /^Star / }).click();
    await starred.getByRole("button", { name: /Quick actions/ }).click();
    await expect(page.getByRole("menuitem", { name: "Move to trash" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await starred.getByRole("button", { name: /^Open / }).click();
    await expect(page.getByRole("button", { name: "Delete File" })).toBeDisabled();
    await page.keyboard.press("Escape");

    // Quick action: move another to trash.
    for (const name of ["Invoice_INV-2041", "AR_Aging"]) {
      const card = cards.filter({ hasText: name });
      await card.getByRole("button", { name: /Quick actions/ }).click();
      await page.getByRole("menuitem", { name: "Move to trash" }).click();
      await expect(cards.filter({ hasText: name })).toHaveCount(0);
    }

    await page.getByRole("button", { name: /^Trash/ }).click();
    await expect(cards).toHaveCount(2);
    await page.getByRole("button", { name: "Empty trash" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Empty trash" }).click();
    await expect(cards).toHaveCount(0);
  });

  test("setting and clearing a document's expiry date confirms each change", async ({ page }) => {
    await page.goto("/app");
    await addDocuments(page, ["Invoice_INV-2041_Northwind.pdf"]);
    await page.getByTestId("document-card").getByRole("button", { name: /^Open / }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Expiration Date (Optional)").fill("2099-03-01");
    await expect(page.getByText("Expiry date saved.")).toBeVisible();
    await dialog.getByLabel("Expiration Date (Optional)").fill("");
    await expect(page.getByText("Expiry date cleared.")).toBeVisible();
  });

  test("a document has a custom reminder and a Send action", async ({ page }) => {
    await page.goto("/app");
    await addDocuments(page, ["Invoice_INV-2041_Northwind.pdf"]);
    await page.getByTestId("document-card").getByRole("button", { name: /^Open / }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Send", exact: true }).first()).toBeVisible();
    await dialog.getByLabel("Reminder date").fill("2099-01-15");
    await dialog.getByLabel("Reminder note").fill("renew it");
    await dialog.getByRole("button", { name: "Set reminder" }).click();
    await expect(dialog.getByTestId("document-reminder-current")).toContainText("renew it");
  });
});

test.describe("contacts", () => {
  test("a contact row opens to show its details when clicked", async ({ page }) => {
    await page.goto("/app/contacts");
    const row = page.getByTestId("contact-row").first();
    await expect(row.getByTestId("contact-details")).toHaveCount(0);
    // Click the row's own padding, away from the name link (which opens the contact's profile instead).
    await row.click({ position: { x: 4, y: 4 } });
    await expect(row.getByTestId("contact-details")).toBeVisible();
    await row.getByRole("button", { name: /^Hide details/ }).click();
    await expect(row.getByTestId("contact-details")).toHaveCount(0);
  });
});

test.describe("tasks", () => {
  test("clicking a task row opens it for editing", async ({ page }) => {
    await page.goto("/app/projects");
    await page.getByTestId("task-row").first().locator("span.break-words").click();
    await expect(page.getByRole("button", { name: /^Save/ }).first()).toBeVisible();
  });
});

test.describe("reporting", () => {
  test("a report can be run and downloaded as PDF, Excel and to Google Sheets, and metrics are shown", async ({ page }) => {
    await page.goto("/app/reporting?view=invoices");
    await page.getByRole("button", { name: "Run report" }).click();
    await expect(page.getByTestId("report-run-status")).toContainText("Last run");
    await page.getByRole("button", { name: "Download" }).click();
    await expect(page.getByRole("menuitem", { name: "Excel" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Google Sheets" })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

    await page.goto("/app/reporting?section=metrics");
    await expect(page.getByTestId("metrics")).toBeVisible();
    await expect(page.getByTestId("metric-tile").first()).toBeVisible();
  });
});

test.describe("navigation", () => {
  test("has a Help & Training button in the header", async ({ page }) => {
    await page.goto("/app/overview");
    await page.getByRole("link", { name: "Help & Training" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Help & Training" })).toBeVisible();
  });

  test("module names are capitalised", async ({ page }) => {
    await page.goto("/app/overview");
    const nav = page.getByRole("navigation", { name: "Services" });
    await expect(nav.getByRole("link", { name: "Licenses & Renewals" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Forms & Paperwork" })).toBeVisible();
  });
});
