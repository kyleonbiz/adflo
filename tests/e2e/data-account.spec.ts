import { expect, test } from "./fixtures";

test("settings has a Data and account tab that explains what needs a connected workspace", async ({ page }) => {
  await page.goto("/app/setup?tab=data");
  await expect(page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Data and account" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Data and account", level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Data and account" })).toContainText("once your database is connected");
});
