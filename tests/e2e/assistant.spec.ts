import { expect, test } from "@playwright/test";

test("the assistant sits under Home and deploys a business", async ({ page }) => {
  await page.goto("/app/overview");
  const links = page.getByRole("navigation", { name: "Services" }).getByRole("link");
  await expect(links.nth(0)).toHaveText("Home");
  await expect(links.nth(1)).toHaveText("AI Assistant");
  await links.nth(1).click();
  await expect(page.getByRole("heading", { level: 1, name: "AI Assistant" })).toBeVisible();

  await page.getByRole("button", { name: "Set up my business" }).click();
  await page.getByLabel("Message the assistant").fill("Acme Plumbing");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "Construction & trades" }).click();
  await page.getByRole("button", { name: "2-5 people" }).click();
  await page.getByRole("button", { name: "Deploy it" }).click();
  await expect(page.getByTestId("assistant-log")).toContainText("templates are installed");

  // The same saved setup shows up in Settings.
  await page.goto("/app/setup?tab=setup");
  await expect(page.getByTestId("setup-complete")).toContainText("Acme Plumbing is set up");
});
