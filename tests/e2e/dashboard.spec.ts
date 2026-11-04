import { expect, test } from "./fixtures";

test.describe("dashboard", () => {
  test("shows three cards that link through, the charts, and today's to-do list", async ({ page }) => {
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
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 }); // the first visit to a page compiles it in development
    };
    await add("New invoice");
    await expect(page).toHaveURL(/\/app\/invoices\?new=1$/);
    await add("Upload document");
  });

  test("the menu can be minimized to icons and expanded again", async ({ page }) => {
    await page.goto("/app/overview");
    const nav = page.getByRole("navigation", { name: "Services" });
    const home = nav.getByRole("link", { name: "Home", exact: true });
    await expect(home).toHaveText("Home");
    await page.getByRole("button", { name: "Minimize menu" }).click();
    await expect(nav).toBeVisible();
    await expect(home).toHaveText("");
    await expect.poll(async () => (await home.boundingBox())!.width).toBeLessThan(80); // after the width transition
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand menu" })).toBeVisible(); // remembered
    await page.getByRole("button", { name: "Expand menu" }).click();
    await expect(home).toHaveText("Home");
  });

  test("the Licenses & Renewals tab opens and the Overview comes back", async ({ page }) => {
    await page.goto("/app/overview");
    await page.getByRole("tab", { name: "Licenses & Renewals" }).click();
    await expect(page.getByTestId("licenses-tab")).toContainText("No licenses tracked yet");
    await page.getByRole("link", { name: "Start from a template" }).click();
    await expect(page).toHaveURL(/\/app\/licenses$/);
    await page.goto("/app/overview");
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  test("starts empty: zeros, nothing needing attention, and an empty to-do list", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByRole("link", { name: /Outstanding invoices/ })).toContainText("$0.00");
    await expect(page.getByRole("link", { name: /Needs attention/ })).toContainText("All clear");
    await expect(page.getByTestId("attention")).toContainText("You are all caught up.");
    await expect(page.getByTestId("today-todos")).toContainText("No tasks yet");
  });
});
