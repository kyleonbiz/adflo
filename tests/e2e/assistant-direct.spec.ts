import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function say(page: Page, message: string) {
  await page.getByLabel("Message Addy").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
}

test.describe("Addy acts on small requests", () => {
  test("adds a to-do for today, and Undo takes it back", async ({ page }) => {
    await page.goto("/app/assistant");
    await say(page, "Add call the accountant to my to-do list");
    const log = page.getByTestId("assistant-log");
    await expect(log).toContainText('Added "call the accountant" to your to-do list for today.');

    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByTestId("today-todos")).toContainText("call the accountant");

    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "AI Assistant", exact: true }).click();
    // Addy's earlier messages are not kept when you leave the page, so say it again and undo straight away.
    await say(page, "add pay the electric bill to my to-do list");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("undone")).toBeVisible();
    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByTestId("today-todos")).not.toContainText("pay the electric bill");
    await expect(page.getByTestId("today-todos")).toContainText("call the accountant");
  });

  test("sets a reminder that shows on the calendar", async ({ page }) => {
    await page.goto("/app/assistant");
    await say(page, "Remind me to renew the permit in 3 days");
    await expect(page.getByTestId("assistant-log")).toContainText("I will remind you on");
    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Calendar", exact: true }).click();
    await page.getByRole("tab", { name: "agenda" }).click();
    await expect(page.getByTestId("agenda-event").filter({ hasText: "renew the permit" })).toBeVisible();
  });

  test("ticks off a to-do it finds, and asks when it cannot tell which", async ({ page }) => {
    await page.goto("/app/assistant");
    await say(page, "add call the accountant to my to-do list");
    await say(page, "add call the bank to my to-do list");
    await say(page, "mark call as done");
    await expect(page.getByTestId("assistant-log")).toContainText("More than one to-do matches");
    await say(page, "mark call the bank as done");
    await expect(page.getByTestId("assistant-log")).toContainText('Ticked off "call the bank".');
    await say(page, "mark dentist as done");
    await expect(page.getByTestId("assistant-log")).toContainText("could not find an open to-do");
  });

  test("records that you asked Addy, and still refuses what it must not do", async ({ page }) => {
    await page.goto("/app/assistant");
    await say(page, "add order toner to my to-do list");
    await expect(page.getByTestId("assistant-log")).toContainText("Added");
    await say(page, "delete the Acme invoice");
    await expect(page.getByTestId("assistant-log")).toContainText("never delete, approve, pay, send or sign");
    await say(page, "add pay with 4111 1111 1111 1111 to my to-do list");
    await expect(page.getByTestId("assistant-log")).toContainText("card number");

    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Activity", exact: true }).click();
    await expect(page.getByTestId("activity-item").first()).toContainText("asked Addy to add");
  });
});
