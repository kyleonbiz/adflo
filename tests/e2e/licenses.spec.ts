import { expect, test } from "@playwright/test";

test.describe("platform modules", () => {
  test("the dashboard links through to the licenses module", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Licenses & Renewals" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Licenses & Renewals" })).toBeVisible();
  });

  test("licenses: summary, tasks, filtering, documents checklist and renewal", async ({ page }) => {
    await page.goto("/app/licenses");
    await expect(page.getByRole("note")).toContainText("Nothing is saved");
    await expect(page.getByTestId("license-card")).toHaveCount(5);

    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("Expired");
    await expect(page.getByRole("region", { name: "Licenses" })).toBeVisible();
    await expect(page.getByText("Renew City Operating Permit")).toBeVisible();
    await expect(page.getByText("Renew State Business License")).toBeVisible();

    await page.getByRole("textbox", { name: "Search licenses" }).fill("insurance");
    await expect(page.getByTestId("license-card")).toHaveCount(1);
    await page.getByRole("textbox", { name: "Search licenses" }).fill("");

    const permit = page.getByTestId("license-card").filter({ hasText: "City Operating Permit" });
    await expect(permit.getByText("Expired", { exact: true })).toBeVisible();
    // Documents open by themselves when some are missing and the renewal is close.
    await permit.getByRole("checkbox", { name: "Signed application" }).check();

    await permit.getByRole("button", { name: "Mark renewed" }).click();
    const renew = page.getByRole("dialog");
    await expect(renew.getByLabel("New expiry date")).not.toHaveValue("");
    await renew.getByRole("button", { name: "Confirm renewal" }).click();
    await expect(page.getByRole("status")).toContainText("City Operating Permit renewed");
    await expect(permit.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByText("Renew City Operating Permit")).toHaveCount(0);

    // The confirmation offers Undo.
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(permit.getByText("Expired", { exact: true })).toBeVisible();
    await expect(page.getByText("Renew City Operating Permit")).toBeVisible();
  });

  test("licenses: summary tiles filter the list and tasks start a renewal", async ({ page }) => {
    await page.goto("/app/licenses");
    await page.getByRole("region", { name: "Summary" }).getByRole("button", { name: /Expired/ }).click();
    await expect(page.getByTestId("license-card")).toHaveCount(1);
    await page.getByRole("region", { name: "Summary" }).getByRole("button", { name: /Expired/ }).click();
    await expect(page.getByTestId("license-card")).toHaveCount(5);

    await page.getByRole("button", { name: "Start renewal: Renew City Operating Permit" }).click();
    const card = page.getByTestId("license-card").filter({ hasText: "City Operating Permit" });
    await expect(page.getByRole("status")).toContainText("renewal in progress");
    await expect(card.getByRole("combobox", { name: /Renewal stage/ })).toContainText("In progress");
    await expect(card.getByRole("checkbox", { name: "Signed application" })).toBeVisible();
  });

  test("licenses: the add form suggests documents and the expiry date", async ({ page }) => {
    await page.goto("/app/licenses");
    await page.getByRole("button", { name: "Add license" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Required documents (one per line)")).toHaveValue(/Annual report/);
    await dialog.getByLabel("Renewal term (months)").fill("6");
    await expect(dialog.getByLabel("Expires on")).not.toHaveValue("");
    await dialog.getByRole("button", { name: "90 days" }).click();
    await expect(dialog.getByLabel("Remind me (days before expiry)")).toHaveValue("90, 60, 30, 7");
    await dialog.getByLabel("License name").fill("Test permit");
    await dialog.getByRole("button", { name: "Add license" }).click();
    const card = page.getByTestId("license-card").filter({ hasText: "Test permit" });
    await card.getByRole("button", { name: /Required documents/ }).click();
    await expect(card.getByRole("checkbox", { name: "Renewal fee receipt" })).toBeVisible();
  });

  test("licenses: add, validate, edit and delete", async ({ page }) => {
    await page.goto("/app/licenses");
    await page.getByRole("button", { name: "Add license" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add license" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Enter a name");

    await dialog.getByLabel("License name").fill("Food Handler Permit");
    await dialog.getByLabel("Issuing authority").fill("Health Department");
    await dialog.getByRole("button", { name: "Add license" }).click();
    await expect(dialog).toBeHidden();
    const card = page.getByTestId("license-card").filter({ hasText: "Food Handler Permit" });
    await expect(card).toBeVisible();
    await expect(page.getByTestId("license-card")).toHaveCount(6);

    await card.getByRole("button", { name: "Edit Food Handler Permit" }).click();
    await page.getByRole("dialog").getByLabel("License name").fill("Food Handler Card");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("license-card").filter({ hasText: "Food Handler Card" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Food Handler Card" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("license-card")).toHaveCount(5);
  });

  test("licenses fit a phone screen without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/licenses");
    await expect(page.getByTestId("license-card").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the signed-in app shows the module tabs in development mode", async ({ page }) => {
    await page.goto("/app/licenses");
    await expect(page.getByRole("navigation", { name: "Services" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Licenses & Renewals" })).toBeVisible();
    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page.getByTestId("document-card").first()).toBeVisible();
  });
});
