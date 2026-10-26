import { expect, test } from "@playwright/test";

test("Settings has a Day/Night switch that persists", async ({ page }) => {
  await page.goto("/app/setup?tab=appearance");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.getByRole("radio", { name: "Night" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Day" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("business profile saves and notification choices persist", async ({ page }) => {
  await page.goto("/app/setup");
  await page.getByLabel("Business name").fill("Acme Plumbing");
  await page.getByLabel("Contact email").fill("not-an-email");
  await expect(page.getByRole("button", { name: "Save profile" })).toBeDisabled();
  await page.getByLabel("Contact email").fill("hello@acme.test");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.getByLabel("Business name")).toHaveValue("Acme Plumbing");
  await expect(page.getByLabel("Contact email")).toHaveValue("hello@acme.test");

  await page.getByRole("link", { name: "Notifications" }).click();
  const digest = page.getByRole("switch", { name: "Weekly summary" });
  await expect(digest).toHaveAttribute("aria-checked", "false");
  await digest.click();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Weekly summary" })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("link", { name: "Team" }).click();
  await expect(page.getByText("Team access turns on once your database is connected")).toBeVisible();
});
