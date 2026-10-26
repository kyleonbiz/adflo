import { expect, test } from "./fixtures";

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

  test("starts empty: zeros, nothing needing attention, and an empty to-do list", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByRole("link", { name: /Outstanding invoices/ })).toContainText("$0.00");
    await expect(page.getByTestId("attention")).toContainText("You are all caught up.");
    await expect(page.getByTestId("today-todos")).toContainText("No tasks yet");
  });
});
