import { expect, test } from "./fixtures";

test.describe("approval chain", () => {
  test("a two-step chain set in Settings carries a request through both approvers", async ({ page }) => {
    await page.goto("/app/setup?tab=approvals");
    const requests = page.getByTestId("chain-requests");
    await expect(requests).toContainText("Operations manager approves on their own");
    for (const who of ["Department head", "Finance manager"]) {
      await requests.getByLabel("Add an approver for requests").fill(who);
      await requests.getByRole("button", { name: "Add step" }).click();
    }
    await expect(requests.getByTestId("chain-step")).toHaveText([/Department head/, /Finance manager/]);
    await requests.getByRole("button", { name: "Move Finance manager up" }).click();
    await expect(requests.getByTestId("chain-step").first()).toContainText("Finance manager");
    await requests.getByRole("button", { name: "Move Finance manager down" }).click();

    await page.goto("/app/admin");
    await page.getByRole("button", { name: "New request" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Wire the annual deposit");
    await dialog.getByLabel("Details").fill("Please wire the deposit");
    await dialog.getByRole("button", { name: "Submit for approval" }).click();
    const card = page.getByTestId("request-card").filter({ hasText: "Wire the annual deposit" });
    await expect(card.getByTestId("approval-chain")).toContainText("Step 1 of 2: waiting on Department head");

    await card.getByRole("button", { name: "Approve Wire the annual deposit" }).click();
    await expect(page.getByRole("status")).toContainText("Step 2 of 2: waiting on Finance manager");
    await expect(card.getByTestId("approval-chain")).toContainText("Approved by Department head");
    await expect(card.getByTestId("approval-chain")).toContainText("Step 2 of 2: waiting on Finance manager");

    await card.getByRole("button", { name: "Approve Wire the annual deposit" }).click();
    await expect(card.getByTestId("approval-chain")).toContainText("Approved by Finance manager");
    await expect(card.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Start Wire the annual deposit" })).toBeVisible();
  });

  test("a decline at the first step ends it", async ({ page }) => {
    await page.goto("/app/setup?tab=approvals");
    const requests = page.getByTestId("chain-requests");
    for (const who of ["Manager", "Owner"]) {
      await requests.getByLabel("Add an approver for requests").fill(who);
      await requests.getByRole("button", { name: "Add step" }).click();
    }
    await page.goto("/app/admin");
    await page.getByRole("button", { name: "New request" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Pay the contractor");
    await dialog.getByLabel("Details").fill("Please wire the payment");
    await dialog.getByRole("button", { name: "Submit for approval" }).click();
    const card = page.getByTestId("request-card").filter({ hasText: "Pay the contractor" });
    await card.getByRole("button", { name: "Decline Pay the contractor" }).click();
    await expect(card.getByTestId("approval-chain")).toContainText("Declined by Manager");
    await expect(card.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
  });
});
