import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const ASK = "could you put Jane Roe from the roofing job in my address book as a lead";

/** Claude is stubbed: the route returns proposals the way the real one would, and the page does the rest. */
async function stubClaude(page: Page, proposals: unknown[]) {
  await page.route("**/api/assistant", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { text: "I prepared this. Check it and press Approve.", links: [], proposals } }) }));
}
async function ask(page: Page) {
  await page.goto("/app/assistant");
  await page.getByLabel("Message Addy").fill(ASK);
  await page.getByRole("button", { name: "Send" }).click();
}
const contact = (id: string, expiresAt: number) => ({
  id, service: "contacts", title: "Add the contact Jane Roe", href: "/app/contacts?add=1&name=Jane%20Roe", expiresAt,
  fields: { name: "Jane Roe", email: "jane@roe.example", category: "Lead" },
  lines: [{ label: "Name", value: "Jane Roe" }, { label: "Email", value: "jane@roe.example" }],
});
const janeRows = (page: Page) => page.getByTestId("contact-row").filter({ hasText: "Jane Roe" });

test.describe("assistant proposals", () => {
  test("nothing is saved until Approve; Approve saves once and is logged", async ({ page }) => {
    await stubClaude(page, [contact("p-a", Date.now() + 3_600_000)]);
    await ask(page);
    const card = page.getByTestId("proposal-card");
    await expect(card).toContainText("Add the contact Jane Roe");
    await expect(card).toContainText("jane@roe.example");

    await page.goto("/app/contacts");
    await expect(janeRows(page)).toHaveCount(0);

    await ask(page);
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("proposal-approved")).toContainText("Jane Roe added to Contacts");
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

    await page.goto("/app/contacts");
    await expect(janeRows(page)).toHaveCount(1);
    await page.goto("/app/activity");
    await expect(page.getByText(/approved Addy's proposal to add/i).first()).toBeVisible();

    // The same proposal again is refused as a duplicate, not saved twice.
    await ask(page);
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("proposal-card").getByRole("alert")).toContainText(/already a contact like this/i);
  });

  test("Undo takes an approved proposal back out", async ({ page }) => {
    await stubClaude(page, [contact("p-u", Date.now() + 3_600_000)]);
    await ask(page);
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("proposal-approved")).toBeVisible();
    await page.getByTestId("proposal-approved").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("proposal-approved")).toContainText("Undone");
    await page.goto("/app/contacts");
    await expect(janeRows(page)).toHaveCount(0);
  });

  test("Reject saves nothing, and an expired proposal can no longer be approved", async ({ page }) => {
    await stubClaude(page, [contact("p-b", Date.now() + 3_600_000), contact("p-c", Date.now() - 1000)]);
    await ask(page);
    await expect(page.getByText("This proposal expired. Ask Addy again.")).toBeVisible();
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByTestId("proposal-rejected")).toBeVisible();
    await page.goto("/app/contacts");
    await expect(janeRows(page)).toHaveCount(0);
  });
});
