import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const next = (page: Page) => page.getByRole("button", { name: /^Next/ });

async function pickIndustry(page: Page, industry: string) {
  await page.getByLabel("Business name").fill("Harbor Law");
  await page.getByRole("combobox", { name: "Industry" }).click();
  await page.getByRole("option", { name: industry, exact: true }).click();
  await page.getByRole("combobox", { name: "Team size" }).click();
  await page.getByRole("option", { name: "2-5 people" }).click();
}

test.describe("industry setup", () => {
  test("shows what will be set up for the industry, lets you untick parts, and puts the rest where it belongs", async ({ page }) => {
    await page.goto("/app/setup?tab=setup");
    await pickIndustry(page, "Legal");
    await next(page).click();
    await next(page).click();

    const bundles = page.getByTestId("industry-bundles");
    await expect(bundles).toContainText("What we'll set up for a legal business");
    await expect(bundles.getByLabel("License and renewal records")).toBeChecked();
    await expect(bundles).toContainText("Bar admission");
    await expect(bundles).toContainText("Conflict check");
    await expect(bundles).toContainText("Requests: Office manager then Managing partner");
    await bundles.getByLabel("Project templates").uncheck();
    await next(page).click();
    await next(page).click();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page.getByTestId("industry-installed")).toContainText("License and renewal records");
    await expect(page.getByTestId("industry-installed")).not.toContainText("Project templates");

    await page.goto("/app/licenses");
    await expect(page.getByTestId("license-card").filter({ hasText: "Bar admission" })).toBeVisible();
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card").filter({ hasText: "Conflict check" })).toBeVisible();
    await page.goto("/app/setup?tab=approvals");
    await expect(page.getByTestId("chain-requests").getByTestId("chain-step")).toHaveText([/Office manager/, /Managing partner/]);
    await page.goto("/app/setup?tab=notifications");
    await expect(page.getByRole("combobox", { name: "Start reminders" })).toContainText("60");
  });

  test("changing the industry in Settings changes what the services show", async ({ page }) => {
    await page.goto("/app/setup?tab=setup");
    await pickIndustry(page, "Legal");
    await next(page).click();
    await next(page).click();
    await next(page).click();
    await next(page).click();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card").filter({ hasText: "Conflict check" })).toBeVisible();

    await page.goto("/app/setup?tab=profile");
    await page.getByRole("combobox", { name: "Industry" }).click();
    await page.getByRole("option", { name: "Auto & fleet", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await page.goto("/app/forms");
    await expect(page.getByTestId("form-card").filter({ hasText: "Vehicle inspection checklist" })).toBeVisible();
    await expect(page.getByTestId("form-card").filter({ hasText: "Conflict check" })).toHaveCount(0);
    await page.goto("/app/licenses");
    await expect(page.getByTestId("license-card").filter({ hasText: "Vehicle registration" })).toBeVisible();
  });

});
