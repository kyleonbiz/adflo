import { expect, test } from "@playwright/test";

test("the assistant sits under Dashboard and leaves setup to Settings", async ({ page }) => {
  await page.goto("/app/overview");
  const links = page.getByRole("navigation", { name: "Services" }).getByRole("link");
  await expect(links.nth(0)).toHaveText("Dashboard");
  await expect(links.nth(1)).toHaveText("Addy");
  await links.nth(1).click();
  await expect(page.getByRole("heading", { level: 1, name: "Addy" })).toBeVisible();

  // Asking it to set up the account points to Settings; nothing is installed.
  await page.getByLabel("Message Addy").fill("set up my business");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("assistant-log")).toContainText("done by you in Settings");
  await expect(page.getByRole("link", { name: "Open Settings" })).toBeVisible();
});
