import { expect, test } from "@playwright/test";

test("Settings has a Day/Night switch that persists", async ({ page }) => {
  await page.goto("/app/setup");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.getByRole("radio", { name: "Night" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Day" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
