import { todayLocal } from "../../src/lib/dates";
import { expect, test } from "./fixtures";

test.describe("remind me", () => {
  test("set a reminder on a request; once due it shows in the bell and on the home feed until cleared", async ({ page }) => {
    await page.goto("/app/admin");
    const card = page.getByTestId("request-card").filter({ hasText: "Order new toner" });
    await card.getByRole("button", { name: /^Remind me about Order new toner/ }).click();
    await page.getByRole("menuitem", { name: "Tomorrow" }).click();
    await expect(card.getByRole("button", { name: /^Reminder set for .*Order new toner/ })).toBeVisible();

    // A reminder whose day has come (set directly, since the test cannot wait for tomorrow).
    const today = todayLocal();
    await page.evaluate((d) => {
      localStorage.setItem("adflo.reminders.v1", JSON.stringify([{ id: "rem-request-r-5", text: "Order new toner for the front office printer", area: "Admin", href: "/app/admin", on: d }]));
    }, today);
    await page.goto("/app/overview");
    const item = page.getByTestId("attention-item").filter({ hasText: "Order new toner" });
    await expect(item).toContainText("Reminder");
    await page.getByRole("button", { name: /^Notifications, 1 need attention/ }).click();
    await expect(page.getByRole("dialog", { name: "Notifications" }).getByRole("link", { name: /Order new toner/ })).toBeVisible();
    await page.keyboard.press("Escape");

    await item.getByRole("button", { name: /^Clear reminder/ }).click();
    await expect(page.getByTestId("attention-item").filter({ hasText: "Order new toner" })).toHaveCount(0);
  });
});
