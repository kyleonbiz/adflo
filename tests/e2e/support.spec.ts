import { expect, test } from "./fixtures";

test.describe("client support", () => {
  test("Help & Training leads to Support, which explains the preview", async ({ page }) => {
    await page.goto("/app/help");
    await page.getByRole("link", { name: "Open support" }).click();
    await expect(page).toHaveURL(/\/app\/support$/);
    await expect(page.getByRole("heading", { level: 1, name: "Support" })).toBeVisible();
    await expect(page.getByText(/Sign in to your AdFlo workspace/)).toBeVisible();
  });

  test("the support API refuses anyone who is not signed in to a workspace", async ({ request }) => {
    const res = await request.post("/api/support/tickets", { data: { subject: "Hi", body: "Hello", category: "question" } });
    expect([401, 503]).toContain(res.status());
    expect((await request.post("/api/support/tickets/not-a-uuid/messages", { data: { body: "x" } })).status()).toBeGreaterThanOrEqual(400);
  });
});
