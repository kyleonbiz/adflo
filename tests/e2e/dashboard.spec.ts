import { expect, test } from "@playwright/test";

test.describe("dashboard", () => {
  test("shows a greeting, grouped KPI tiles that link through, and the attention list", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByTestId("greeting")).toContainText(/Good (morning|afternoon|evening)|Welcome back/);
    for (const g of ["Money", "Compliance", "Work"]) await expect(page.getByRole("heading", { name: g, exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Overdue invoices/ }).click();
    await expect(page).toHaveURL(/\/app\/invoices$/);
  });

  test("quick actions open the matching form", async ({ page }) => {
    await page.goto("/app/overview");
    await page.getByRole("link", { name: "New invoice" }).click();
    await expect(page).toHaveURL(/\/app\/invoices\?new=1$/);
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goto("/app/overview");
    await page.getByRole("link", { name: "New request" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goto("/app/overview");
    await page.getByRole("link", { name: "Upload document" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("attention items can be filtered, expanded, snoozed and added to Today", async ({ page }) => {
    await page.goto("/app/overview");
    const box = page.getByTestId("attention");
    const rows = box.getByTestId("attention-item");
    await expect(rows).toHaveCount(5);
    await box.getByRole("button", { name: /^View all/ }).click();
    expect(await rows.count()).toBeGreaterThan(5);

    await box.getByRole("button", { name: /^Invoices \(/ }).click();
    const first = rows.first();
    await expect(first).toContainText("Invoices");

    await first.getByRole("button", { name: /^Add to Today/ }).click();
    await expect(page.getByTestId("today-todos").getByTestId("todo-item")).toHaveCount(1);
    await expect(first.getByRole("button", { name: /^Add to Today/ })).toBeDisabled();

    const before = await rows.count();
    await first.getByRole("button", { name: /^Snooze/ }).click();
    await expect(rows).toHaveCount(before - 1);
    await expect(box).toContainText("snoozed until tomorrow");
    await box.getByRole("button", { name: "Restore" }).click();
    await expect(rows).toHaveCount(before);
  });
});
