import { expect, test } from "@playwright/test";

// No seeded records here: this follows one real record through the app, the way a person would.
test.describe("records carry through the app", () => {
  test("an invoice you create shows on Home and in Reporting, and is still there after leaving and reloading", async ({ page }) => {
    await page.goto("/app/invoices");
    await page.getByRole("button", { name: "New invoice" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Business name").fill("Sample Co");
    await dialog.getByLabel("Client", { exact: true }).fill("Globex Corp");
    await dialog.getByLabel("Description", { exact: true }).fill("Setup work");
    await dialog.getByLabel("Rate", { exact: true }).fill("1250.50");
    await dialog.getByRole("button", { name: /create invoice/i }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Send" }).first().click(); // a draft is not owed until it is sent
    await page.keyboard.press("Escape");

    const nav = page.getByRole("navigation", { name: "Services" });
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page.getByRole("link", { name: /Outstanding invoices/ })).toContainText("$1,250.50");

    await nav.getByRole("link", { name: "Reporting", exact: true }).click();
    await expect(page.getByText("Records tracked")).toBeVisible();
    await expect(page.getByText("Records tracked").locator("..")).toContainText("1");

    await nav.getByRole("link", { name: "Invoices", exact: true }).click();
    await expect(page.getByText("Globex Corp").first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("Globex Corp").first()).toBeVisible();
    await page.goto("/app/overview");
    await expect(page.getByRole("link", { name: /Outstanding invoices/ })).toContainText("$1,250.50");
  });

  test("Home's to-do list and its task card use different words, so they do not look like they disagree", async ({ page }) => {
    await page.goto("/app/overview");
    const todos = page.getByTestId("today-todos");
    await todos.getByRole("button", { name: "Add a to-do" }).click();
    await todos.getByLabel("New to-do").fill("Call the accountant");
    await todos.getByLabel("New to-do").press("Enter");
    await expect(todos).toContainText("1 to do");
    await expect(page.getByRole("link", { name: /Open tasks/ })).toContainText("0"); // project tasks only
    await expect(page.getByTestId("progress")).toContainText("to-dos done");
  });
});
