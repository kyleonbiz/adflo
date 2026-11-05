import { expect, test } from "./fixtures";

test.describe("calendar", () => {
  test("opens on this month with today picked and the day's items beside it", async ({ page }) => {
    await page.goto("/app/calendar");
    await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
    await expect(page.getByTestId("calendar-month")).toContainText(String(new Date().getFullYear()));
    await expect(page.getByTestId("calendar-selected")).toHaveText("Today");
    await expect(page.getByTestId("calendar-day").first()).toBeVisible();
  });

  test("moves between months and back to today", async ({ page }) => {
    await page.goto("/app/calendar");
    const month = page.getByTestId("calendar-month");
    const first = await month.textContent();
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(month).not.toHaveText(first!);
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(month).toHaveText(first!);
    await page.getByRole("button", { name: "Next month" }).click();
    await page.getByRole("button", { name: "Today" }).click();
    await expect(month).toHaveText(first!);
  });

  test("shows dated items from the services, and clicking an item opens it", async ({ page }) => {
    await page.goto("/app/calendar");
    await page.getByRole("tab", { name: "agenda" }).click();
    const rows = page.getByTestId("agenda-event");
    await expect(rows.first()).toBeVisible();
    await expect(page.getByText("Late", { exact: true }).first()).toBeVisible(); // the sample invoices include overdue ones
    const link = rows.first().getByRole("link");
    const href = await link.getAttribute("href");
    await link.click();
    await expect(page).toHaveURL(new RegExp(href!.split("?")[0]));
  });

  test("can be narrowed to one kind of item", async ({ page }) => {
    await page.goto("/app/calendar");
    await page.getByRole("tab", { name: "agenda" }).click();
    const all = await page.getByTestId("agenda-event").count();
    await page.getByRole("combobox", { name: "Show on the calendar" }).click();
    await page.getByRole("option", { name: "Reminders" }).click();
    await expect(page.getByTestId("agenda-empty")).toContainText("Nothing coming up");
    await page.getByRole("combobox", { name: "Show on the calendar" }).click();
    await page.getByRole("option", { name: "Everything" }).click();
    await expect(page.getByTestId("agenda-event")).toHaveCount(all);
  });

  test("picking a day lists what is due on it", async ({ page }) => {
    await page.goto("/app/calendar");
    const withItems = page.getByTestId("calendar-day").filter({ has: page.getByTestId("calendar-pill") }).first();
    await expect(withItems).toBeVisible();
    const day = await withItems.getAttribute("data-day");
    await withItems.click();
    await expect(page.getByTestId("calendar-day-event").first()).toBeVisible();
    await expect(withItems).toHaveAttribute("aria-pressed", "true");
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("fits a phone screen without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/calendar");
    await expect(page.getByTestId("calendar-month")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
