import { todayLocal } from "../../src/lib/dates";
import { expect, test } from "./fixtures";

test.describe("remind me", () => {
  test("a due reminder shows in the bell and on the home feed until cleared", async ({ page }) => {
    await page.goto("/app/overview");
    // A reminder whose day has come (set directly, since the test cannot wait for tomorrow).
    const today = todayLocal();
    await page.evaluate((d) => {
      localStorage.setItem("adflo.reminders.v1", JSON.stringify([{ id: "rem-task-t-9", text: "Send the W-9 to the new vendor", area: "Tasks", href: "/app/projects", on: d }]));
    }, today);
    await page.goto("/app/overview");
    const item = page.getByTestId("attention-item").filter({ hasText: "Send the W-9" });
    await expect(item).toContainText("Reminder");
    await page.getByRole("button", { name: /^Notifications, 1 need attention/ }).click();
    await expect(page.getByRole("dialog", { name: "Notifications" }).getByRole("link", { name: /Send the W-9/ })).toBeVisible();
    await page.keyboard.press("Escape");

    await item.getByRole("button", { name: /^Clear reminder/ }).click();
    await expect(page.getByTestId("attention-item").filter({ hasText: "Send the W-9" })).toHaveCount(0);
  });
});
