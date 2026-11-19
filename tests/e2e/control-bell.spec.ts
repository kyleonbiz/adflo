import { expect, test } from "@playwright/test";

// The preview of the Control center (no database) shows the bell from the built-in sample clients and tickets.
test("the Control center has a notifications bell that opens a list with links", async ({ page }) => {
  await page.goto("/control");
  const bell = page.getByRole("button", { name: /^Notifications/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link").first()).toHaveAttribute("href", /\/control\//);
});
