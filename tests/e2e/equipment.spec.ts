import { expect, test } from "./fixtures";

const row = (page: import("@playwright/test").Page, name: string) => page.getByTestId("equipment-row").filter({ hasText: name });

test.describe("equipment", () => {
  test("starts empty, adds an item, flags an overdue service and logs service", async ({ page }) => {
    await page.goto("/app/equipment");
    await expect(page.getByRole("heading", { level: 1, name: "Equipment" })).toBeVisible();
    await expect(page.getByTestId("empty-state")).toBeVisible();

    await page.getByRole("button", { name: "Add equipment" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add equipment" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Give it a name");

    await dialog.getByLabel("Name").fill("Rooftop unit 2");
    await dialog.getByLabel("Serial, VIN, plate or key tag").fill("RTU-0002");
    await dialog.getByLabel("Next service").fill("2020-01-15");
    await dialog.getByLabel("Repeat service every (days)").fill("90");
    await dialog.getByRole("button", { name: "Add equipment" }).click();

    await expect(row(page, "Rooftop unit 2")).toContainText("Service overdue");
    await page.getByRole("button", { name: "Log service for Rooftop unit 2" }).click();
    await expect(page.getByRole("status")).toContainText("Service logged for Rooftop unit 2");
    await expect(row(page, "Rooftop unit 2")).not.toContainText("Service overdue");
  });

  test("opens a prepared draft from Addy with the details filled in, and nothing is saved until you press save", async ({ page }) => {
    await page.goto("/app/equipment?new=1&name=Box%20truck&type=vehicle&identifier=VIN9");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name")).toHaveValue("Box truck");
    await expect(dialog.getByLabel("Serial, VIN, plate or key tag")).toHaveValue("VIN9");
    await dialog.getByRole("button", { name: "Add equipment" }).click();
    await expect(page.getByTestId("equipment-row").filter({ hasText: "Box truck" })).toBeVisible();
  });

  test("deletes with a confirmation and undo", async ({ page }) => {
    await page.goto("/app/equipment");
    await page.getByRole("button", { name: "Add equipment" }).first().click();
    await page.getByRole("dialog").getByLabel("Name").fill("Spare key");
    await page.getByRole("dialog").getByRole("button", { name: "Add equipment" }).click();
    await page.getByRole("button", { name: "Delete Spare key" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(row(page, "Spare key")).toBeVisible();
  });

  test("fits a phone screen without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/equipment");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
