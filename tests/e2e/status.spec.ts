import { expect, test } from "./fixtures";

test.describe("status page", () => {
  test("is public and reports system status", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByRole("heading", { name: "AdFlo status" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("All systems operational");
  });
  test("JSON endpoint answers for uptime monitors", async ({ request }) => {
    const res = await request.get("/api/status");
    expect(res.status()).toBe(200);
    expect((await res.json()).services.length).toBeGreaterThan(0);
  });
});
