import { expect, test } from "./fixtures";

test.describe("dashboard", () => {
  test("shows four cards that link through, the charts, and today's to-do list", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByTestId("workload")).toBeVisible();
    await expect(page.getByTestId("upcoming")).toBeVisible();
    await expect(page.getByTestId("progress")).toContainText("ALL CLEAR");
    await expect(page.getByTestId("today-todos")).toBeVisible();
    await page.getByRole("link", { name: /Outstanding invoices/ }).click();
    await expect(page).toHaveURL(/\/app\/invoices$/);
  });

  test("Add new entry opens the matching form", async ({ page }) => {
    const add = async (item: string) => {
      await page.goto("/app/overview");
      await page.getByRole("button", { name: "Add new entry" }).click();
      await page.getByRole("menuitem", { name: item }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    };
    await add("New invoice");
    await expect(page).toHaveURL(/\/app\/invoices\?new=1$/);
    await add("New request");
    await add("Upload document");
  });

  test("the menu can be hidden and shown", async ({ page }) => {
    await page.goto("/app/overview");
    const nav = page.getByRole("navigation", { name: "Services" });
    await expect(nav).toBeVisible();
    await page.getByRole("button", { name: "Hide Menu" }).click();
    await expect(nav).toBeHidden();
    await page.getByRole("button", { name: "Show Menu" }).click();
    await expect(nav).toBeVisible();
  });

  test("starts empty: zeros, nothing needing attention, and an empty to-do list", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByRole("link", { name: /Outstanding invoices/ })).toContainText("$0.00");
    await expect(page.getByRole("link", { name: /Needs attention/ })).toContainText("All clear");
    await expect(page.getByTestId("attention")).toContainText("You are all caught up.");
    await expect(page.getByTestId("today-todos")).toContainText("No tasks yet");
  });
});
