import { expect, test } from "@playwright/test";

// Without a database the Control Center opens as a read-only preview with labelled sample clients.
test("control center preview: overview, clients and audit log open", async ({ page }) => {
  await page.goto("/control");
  await expect(page.getByRole("heading", { name: "Control Center" })).toBeVisible();
  await expect(page.getByText("Preview", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Control Center" })).toBeVisible();

  await page.getByRole("link", { name: "Clients" }).first().click();
  await expect(page).toHaveURL(/\/control\/clients$/);
  await expect(page.getByRole("cell", { name: "Sample: Acme Roofing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add client" })).toHaveCount(0); // the preview cannot change anything

  await page.getByLabel("Search clients").fill("birch");
  await expect(page.getByRole("cell", { name: "Sample: Acme Roofing" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Sample: Birch & Co" })).toBeVisible();

  await page.getByRole("link", { name: "Audit log" }).first().click();
  await expect(page.getByText("Nothing to show in the preview")).toBeVisible();
});

test("control center API refuses writes without a database", async ({ request }) => {
  const res = await request.post("/api/control/clients", { data: { name: "Nope Co" } });
  expect(res.status()).toBe(503);
});
