import { expect, test } from "./fixtures";

test.describe("contacts and forms work together", () => {
  test("fill out a form for a contact, then add the person from a form to Contacts", async ({ page }) => {
    await page.goto("/app/contacts");
    const row = page.getByTestId("contact-row").first();
    const name = (await row.locator("p.font-medium").first().textContent())!.trim();
    await row.getByRole("button", { name: `Fill out a form for ${name}` }).click();
    const picker = page.getByRole("dialog");
    await picker.getByRole("combobox", { name: "Form" }).click();
    await page.getByRole("option", { name: "Client intake" }).click();
    await picker.getByRole("link", { name: "Open form" }).click();

    await expect(page).toHaveURL(/\/app\/forms\?fill=pw-client-intake/);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Client intake" })).toBeVisible();
    await expect(dialog.getByLabel(/Client name/)).toHaveValue(name);
    await expect(dialog.getByLabel("Your name")).toHaveValue(name);

    await dialog.getByLabel(/Email/).fill("new.person@example.com");
    await dialog.getByLabel(/What you need help with/).fill("Monthly bookkeeping");
    await dialog.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("heading", { name: "Your paperwork is ready" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(`Add ${name} to Contacts`) }).click();

    await expect(page).toHaveURL(/\/app\/contacts\?add=1/);
    const form = page.getByRole("dialog");
    await expect(form.getByRole("heading", { name: "Add contact" })).toBeVisible();
    await expect(form.getByLabel("Name")).toHaveValue(name);
    await expect(form.getByLabel("Email")).toHaveValue("new.person@example.com");
  });
});
