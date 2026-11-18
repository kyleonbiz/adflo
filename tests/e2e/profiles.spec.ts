import { expect, test } from "./fixtures";

test.describe("contact and vendor profiles", () => {
  test("a contact's profile shows their details, notes and matching invoices", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("link", { name: "Pat Lee", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/contacts\/c-2$/);
    const profile = page.getByTestId("contact-profile");
    await expect(profile.getByRole("heading", { level: 1, name: "Pat Lee" })).toBeVisible();
    await expect(profile).toContainText("Northwind Traders");
    await expect(profile).toContainText("Prefers email.");
    const invoices = page.getByTestId("contact-invoices");
    await expect(invoices).toContainText("INV-0041");
    await expect(invoices).toContainText("INV-0040");
    await expect(invoices).not.toContainText("INV-0042");
    await profile.getByRole("link", { name: "All contacts" }).click();
    await expect(page).toHaveURL(/\/app\/contacts$/);
  });

  test("a vendor's profile shows terms, compliance documents and people, and links across", async ({ page }) => {
    await page.goto("/app/vendors/v-2");
    const profile = page.getByTestId("vendor-profile");
    await expect(profile.getByRole("heading", { level: 1, name: "Globex Software" })).toBeVisible();
    await expect(page.getByTestId("vendor-profile-docs")).toContainText("Expired");
    await expect(profile).toContainText("Certificate of insurance");
    // The contact whose company is this vendor is listed, and links to their own profile.
    await profile.getByRole("link", { name: "Hank Scorpio" }).click();
    await expect(page).toHaveURL(/\/app\/contacts\/c-5$/);
    await expect(page.getByTestId("contact-profile")).toContainText("Also a vendor");
    await page.getByRole("link", { name: "Globex Software" }).click();
    await expect(page).toHaveURL(/\/app\/vendors\/v-2$/);
  });

  test("an unknown record says so and links back", async ({ page }) => {
    await page.goto("/app/vendors/does-not-exist");
    await expect(page.getByRole("heading", { name: "We could not find that vendor" })).toBeVisible();
    await page.getByRole("link", { name: "All vendors" }).click();
    await expect(page).toHaveURL(/\/app\/vendors$/);
  });

  test("the vendor list opens a vendor's profile", async ({ page }) => {
    await page.goto("/app/vendors");
    await page.getByRole("link", { name: "Acme Office Supply", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/vendors\/v-1$/);
    await expect(page.getByTestId("vendor-profile")).toBeVisible();
  });
});
