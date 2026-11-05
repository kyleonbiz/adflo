import { expect, test } from "./fixtures";

test.describe("activity", () => {
  test("starts with a short explanation and nothing in it", async ({ page }) => {
    await page.goto("/app/activity");
    await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
    await expect(page.getByTestId("activity-empty")).toContainText("Nothing has happened yet");
  });

  test("records who did what, with the time, and links back to it", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("button", { name: "Add contact" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Zed Quill");
    await dialog.getByLabel("Email").fill("zed@example.com");
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Activity", exact: true }).click();
    const row = page.getByTestId("activity-item").first();
    await expect(row).toContainText("You added the contact Zed Quill"); // preview mode has no name, so it says "You"
    await expect(row).toContainText("Contacts");
    await expect(row.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
    await row.getByRole("link", { name: "the contact Zed Quill" }).click();
    await expect(page).toHaveURL(/\/app\/contacts$/);
  });

  test("keeps the newest first and can be filtered by area", async ({ page }) => {
    await page.goto("/app/contacts");
    for (const name of ["Ada One", "Bea Two"]) {
      await page.getByRole("button", { name: "Add contact" }).click();
      await page.getByRole("dialog").getByLabel("Name").fill(name);
      await page.getByRole("dialog").getByLabel("Email").fill(`${name.split(" ")[0].toLowerCase()}@example.com`);
      await page.getByRole("dialog").getByRole("button", { name: "Add contact" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
    }
    await page.goto("/app/activity");
    const rows = page.getByTestId("activity-item");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Bea Two");
    await page.getByRole("combobox", { name: "Filter activity by area" }).click();
    await page.getByRole("option", { name: "Invoices" }).click();
    await expect(page.getByTestId("activity-empty")).toContainText("Nothing here for that area");
  });
});
