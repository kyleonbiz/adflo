import { expect, test } from "./fixtures";

const card = (page: import("@playwright/test").Page, name: string) =>
  page.getByTestId("vendor-card").filter({ has: page.getByRole("heading", { name, exact: true }) });

test.describe("vendors module", () => {
  test("summary, attention list, duplicates and filters", async ({ page }) => {
    await page.goto("/app/vendors");
    await expect(page.getByRole("note")).toContainText("Nothing is saved");
    await expect(page.getByTestId("vendor-card")).toHaveCount(6);

    const attention = page.getByRole("region", { name: "Needs attention" });
    await expect(attention).toContainText("Globex Software");
    await expect(attention).toContainText("Certificate of insurance expired");
    await expect(attention).toContainText("Acme Office Supply");
    await expect(attention).toContainText("expires in 15 days");

    const duplicates = page.getByRole("region", { name: "Possible duplicates" });
    await expect(duplicates.getByTestId("duplicate-pair")).toHaveCount(1);
    await expect(duplicates).toContainText("Similar name, Same email domain");

    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Awaiting approval" }).click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(1);
    await expect(card(page, "Hooli Logistics")).toBeVisible();
  });

  test("onboarding: collect documents, submit for approval, approve", async ({ page }) => {
    await page.goto("/app/vendors");
    const initech = card(page, "Initech Staffing LLC");
    const submit = initech.getByRole("button", { name: "Submit for approval" });
    await expect(submit).toBeDisabled();
    await expect(initech).toContainText("Before approval: W-9 is missing, Certificate of insurance is missing");
    await expect(initech).toContainText("2 of 4 required documents in");

    // Onboarding vendors open with their documents showing.
    await expect(initech.getByRole("button", { name: /^Documents/ })).toHaveAttribute("aria-expanded", "true");
    await initech.getByLabel("W-9 received on").fill("2026-10-20");
    await expect(initech).toContainText("3 of 4");
    await initech.getByLabel("Certificate of insurance received on").fill("2026-10-20");
    await expect(initech).toContainText("4 of 4 required documents in");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(initech.getByText("Awaiting approval", { exact: true }).first()).toBeVisible();

    await initech.getByLabel("Comment on Initech Staffing LLC").fill("Welcome aboard");
    await initech.getByRole("button", { name: "Approve Initech Staffing LLC" }).click();
    await expect(page.getByRole("dialog")).toContainText("Welcome aboard");
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(initech).toContainText("Approved by Operations manager");
    await expect(initech).toContainText("Welcome aboard");
    await initech.getByRole("button", { name: "Deactivate" }).click();
    await expect(initech.getByText("Inactive", { exact: true })).toBeVisible();
  });

  test("an expiry before the received date is refused", async ({ page }) => {
    await page.goto("/app/vendors");
    const acme = card(page, "Acme Office Supply");
    await acme.getByRole("button", { name: /^Documents/ }).click();
    await acme.getByLabel("W-9 received on").fill("2026-10-01");
    await acme.getByLabel("W-9 expires on").fill("2026-09-01");
    await expect(page.getByRole("status")).toContainText("expiry date cannot be before");
    await expect(acme.getByLabel("W-9 expires on")).toHaveValue("");
  });

  test("summary tiles and attention rows act on the list", async ({ page }) => {
    await page.goto("/app/vendors");
    await page.getByRole("button", { name: /Awaiting approval/ }).first().click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(1);
    await page.getByRole("button", { name: /^Document issues/ }).click();
    await expect(page.getByText("Showing vendors with expiring or expired documents")).toBeVisible();
    await page.getByRole("button", { name: /^Vendors/ }).first().click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(6);

    await page.getByRole("button", { name: "Open Globex Software documents" }).click();
    await expect(card(page, "Globex Software").getByRole("button", { name: /^Documents/ })).toHaveAttribute("aria-expanded", "true");
  });

  test("cancelling the approval dialog leaves the vendor awaiting approval", async ({ page }) => {
    await page.goto("/app/vendors");
    const hooli = card(page, "Hooli Logistics");
    await hooli.getByRole("button", { name: "Approve Hooli Logistics" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(hooli.getByText("Awaiting approval", { exact: true }).first()).toBeVisible();
  });

  test("removing a document and deleting a vendor can be undone", async ({ page }) => {
    await page.goto("/app/vendors");
    const acme = card(page, "Acme Office Supply");
    await acme.getByRole("button", { name: /^Documents/ }).click();
    await acme.getByRole("button", { name: "Remove W-9" }).click();
    await expect(acme.getByTestId("vendor-doc")).toHaveCount(1);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(acme.getByTestId("vendor-doc")).toHaveCount(2);

    await acme.getByRole("button", { name: "Delete Acme Office Supply" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(5);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(6);
  });

  test("a possible duplicate can be dismissed and restored, or merged", async ({ page }) => {
    await page.goto("/app/vendors");
    const dupes = page.getByRole("region", { name: "Possible duplicates" });
    await dupes.getByRole("button", { name: /are not duplicates/ }).click();
    await expect(dupes.getByTestId("duplicate-pair")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Possible duplicates/ })).toContainText("0");
    await dupes.getByRole("button", { name: /Show 1 dismissed/ }).click();
    await expect(dupes.getByTestId("duplicate-pair")).toHaveCount(1);

    await dupes.getByRole("button", { name: /^Merge / }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Merge", exact: true }).click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(5);
    await expect(dupes.getByTestId("duplicate-pair")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(6);
  });

  test("a file can be attached to a document and removed again", async ({ page }) => {
    await page.goto("/app/vendors");
    const initech = card(page, "Initech Staffing LLC");
    await initech.getByLabel("W-9 file").setInputFiles({ name: "w9.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(initech.getByRole("link", { name: "w9.pdf" })).toBeVisible();
    await expect(initech.getByLabel("W-9 received on")).not.toHaveValue("");
    await initech.getByRole("button", { name: "Remove file from W-9" }).click();
    await expect(initech.getByRole("link", { name: "w9.pdf" })).toHaveCount(0);

    await initech.getByLabel("W-9 file").setInputFiles({ name: "w9.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
    await expect(page.getByRole("status")).toContainText("not a PDF, image or Word file");
  });

  test("vendors can be filtered by category, and many categories are offered", async ({ page }) => {
    await page.goto("/app/vendors");
    await page.getByRole("combobox", { name: "Filter by category" }).click();
    await expect(page.getByRole("option")).toHaveCount(44); // "All categories" plus 43
    await page.getByRole("option", { name: "Logistics", exact: true }).click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(2);
    await expect(page).toHaveURL(/category=Logistics/);
  });

  test("a healthcare vendor gets its category's required documents", async ({ page }) => {
    await page.goto("/app/vendors");
    await page.getByRole("button", { name: "Add vendor" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Vendor name").fill("Cityview Clinic");
    await dialog.getByLabel("Contact email").fill("office@cityview.example");
    await dialog.getByRole("combobox", { name: "Category" }).click();
    await page.getByRole("option", { name: "Healthcare & medical" }).click();
    await dialog.getByRole("button", { name: "Add vendor" }).click();
    const clinic = card(page, "Cityview Clinic");
    await expect(clinic).toContainText("0 of 4 required documents in");
    await expect(clinic.getByLabel("Business associate agreement received on")).toBeVisible();
  });

  test("filters are kept in the address bar", async ({ page }) => {
    await page.goto("/app/vendors?status=pending_approval&sort=newest");
    await expect(page.getByTestId("vendor-card")).toHaveCount(1);
    await page.getByRole("button", { name: /^Document issues/ }).click();
    await expect(page).toHaveURL(/issues=1/);
    await page.getByRole("button", { name: /^Vendors/ }).first().click();
    await expect(page).not.toHaveURL(/status=|issues=/);
  });

  test("rejecting then reopening a vendor", async ({ page }) => {
    await page.goto("/app/vendors");
    const hooli = card(page, "Hooli Logistics");
    await hooli.getByRole("button", { name: "Reject Hooli Logistics" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reject", exact: true }).click();
    await expect(hooli.getByText("Rejected", { exact: true }).first()).toBeVisible();
    await hooli.getByRole("button", { name: "Reopen" }).click();
    await expect(hooli.getByText("Onboarding", { exact: true })).toBeVisible();
  });

  test("adding a vendor validates, warns about duplicates and creates required documents", async ({ page }) => {
    await page.goto("/app/vendors");
    await page.getByRole("button", { name: "Add vendor" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add vendor" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Enter the vendor name");

    await dialog.getByLabel("Vendor name").fill("Globex Software, Inc.");
    await dialog.getByLabel("Contact email").fill("someone@elsewhere.example");
    await dialog.getByLabel("Tax ID (EIN, optional)").fill("12345");
    await dialog.getByRole("button", { name: "Add vendor" }).click();
    await expect(dialog.getByRole("alert")).toContainText("12-3456789");
    await dialog.getByLabel("Tax ID (EIN, optional)").fill("");
    await dialog.getByRole("button", { name: "Add vendor" }).click();

    const warning = dialog.getByTestId("duplicate-warning");
    await expect(warning).toContainText("Globex Software: same name");
    await dialog.getByRole("button", { name: "Add anyway" }).click();
    await expect(dialog).toBeHidden();

    const added = card(page, "Globex Software, Inc.");
    await expect(added).toContainText("0 of 2 required documents in");
    await expect(page.getByRole("region", { name: "Possible duplicates" }).getByTestId("duplicate-pair")).toHaveCount(2);

    await added.getByRole("button", { name: "Delete Globex Software, Inc." }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("vendor-card")).toHaveCount(6);
  });

  test("a software vendor gets its four required documents, and documents can be added and removed", async ({ page }) => {
    await page.goto("/app/vendors");
    await page.getByRole("button", { name: "Add vendor" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Vendor name").fill("Pied Piper Cloud");
    await dialog.getByLabel("Contact email").fill("hi@piedpiper.example");
    await dialog.getByRole("combobox", { name: "Category" }).click();
    await page.getByRole("option", { name: "Software" }).click();
    await dialog.getByRole("button", { name: "Add vendor" }).click();

    const pp = card(page, "Pied Piper Cloud");
    await expect(pp).toContainText("0 of 4 required documents in");
    await expect(pp.getByRole("button", { name: /^Documents/ })).toHaveAttribute("aria-expanded", "true");
    await pp.getByLabel("Add a document for Pied Piper Cloud").fill("SOC 2 report");
    await pp.getByRole("button", { name: "Add", exact: true }).click();
    await expect(pp.getByTestId("vendor-doc")).toHaveCount(5);
    await pp.getByRole("button", { name: "Remove SOC 2 report" }).click();
    await expect(pp.getByTestId("vendor-doc")).toHaveCount(4);
  });

  test("exports the vendor list as CSV", async ({ page }) => {
    await page.goto("/app/vendors");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^vendors-\d{4}-\d{2}-\d{2}\.csv$/);
    let text = "";
    for await (const chunk of await file.createReadStream()) text += chunk;
    expect(text.split("\r\n")[0]).toBe("Name,Category,Status,Contact,Email,Phone,Tax ID,Required docs in,Required docs total,Document issues,Notes");
    expect(text).toContain("Awaiting approval");
    expect(text).toContain("Certificate of insurance (expired)");
  });

  test("fits a phone screen without horizontal scroll, documents expanded", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/vendors");
    await card(page, "Globex Software").getByRole("button", { name: /^Documents/ }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/vendors");
    await expect(page.getByRole("heading", { level: 1, name: "Vendors" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vendors", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
