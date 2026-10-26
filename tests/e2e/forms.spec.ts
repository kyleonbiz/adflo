import { expect, test } from "@playwright/test";

test.describe("forms module", () => {
  test("summary, approval badges and search", async ({ page }) => {
    await page.goto("/app/forms");
    await expect(page.getByRole("note")).toContainText("Nothing is saved");
    await expect(page.getByTestId("form-card")).toHaveCount(3);
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("Awaiting approval");
    const vendor = page.getByTestId("form-card").filter({ hasText: "New vendor intake" });
    await expect(vendor).toContainText("1 awaiting approval");
    await expect(vendor).toContainText("Approval: Operations manager");

    await page.getByRole("textbox", { name: "Search forms" }).fill("time-off");
    await expect(page.getByTestId("form-card")).toHaveCount(1);
  });

  test("filling a form validates, then routes to approval", async ({ page }) => {
    await page.goto("/app/forms");
    const leave = page.getByTestId("form-card").filter({ hasText: "Time-off request" });
    await leave.getByRole("button", { name: "Fill out" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Submit" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Enter your name");
    await expect(dialog.getByRole("alert").nth(1)).toContainText("required");
    await expect(dialog.getByRole("alert")).toHaveCount(5); // your name (approver needs it), employee name, two dates, type
    await expect(dialog.getByLabel("Your name")).toBeFocused();

    await dialog.getByLabel("Your name").fill("Sam");
    await dialog.getByLabel(/Employee name/).fill("Sam Rivera");
    await dialog.getByLabel(/First day off/).fill("2026-12-01");
    await dialog.getByLabel(/Last day off/).fill("2026-11-30");
    await dialog.getByRole("button", { name: "Submit" }).click();
    await expect(dialog.locator("#fill-l-to-error")).toContainText("Must be on or after First day off");
    await dialog.getByLabel(/Last day off/).fill("2026-12-03");
    await dialog.getByRole("combobox", { name: /Type/ }).click();
    await page.getByRole("option", { name: "Sick" }).click();
    await dialog.getByRole("button", { name: "Submit" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Waiting for Priya Shah to approve");
    await expect(leave).toContainText("2 awaiting approval");
    await expect(leave).toContainText("3 submissions");
  });

  test("lists what is waiting for a decision and opens it", async ({ page }) => {
    await page.goto("/app/forms");
    const queue = page.getByRole("region", { name: "Waiting for a decision" });
    await expect(queue.getByRole("listitem")).toHaveCount(2);
    await expect(queue.getByRole("listitem").first()).toContainText("New vendor intake");
    await expect(queue.getByRole("listitem").first()).toContainText("2 days waiting");
    await queue.getByRole("button", { name: "Review Time-off request from Marta Gill" }).click();
    const leave = page.getByTestId("form-card").filter({ hasText: "Time-off request" });
    await expect(leave.getByRole("button", { name: "Approve submission by Marta Gill" })).toBeVisible();
    await leave.getByRole("button", { name: "Approve submission by Marta Gill" }).click();
    await expect(queue.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("Time-off request: submission by Marta Gill approved");
  });

  test("filters by approval state, sorts, and clears filters", async ({ page }) => {
    await page.goto("/app/forms");
    await page.getByRole("button", { name: /Awaiting approval/ }).first().click();
    await expect(page.getByTestId("form-card")).toHaveCount(2);
    await page.getByRole("combobox", { name: "Filter forms" }).click();
    await page.getByRole("option", { name: "No approval needed" }).click();
    await expect(page.getByTestId("form-card")).toHaveCount(1);
    await expect(page.getByTestId("form-card")).toContainText("Client feedback");
    await page.getByRole("textbox", { name: "Search forms" }).fill("zzz");
    await expect(page.getByText("No forms match these filters.")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("form-card")).toHaveCount(3);

    await page.getByRole("combobox", { name: "Sort forms" }).click();
    await page.getByRole("option", { name: /Most submissions/ }).click();
    await expect(page.getByTestId("form-card").first()).toContainText(/New vendor intake|Time-off request/);
  });

  test("asks before deleting a submission", async ({ page }) => {
    await page.goto("/app/forms");
    const vendor = page.getByTestId("form-card").filter({ hasText: "New vendor intake" });
    await vendor.getByRole("button", { name: /^Submissions/ }).click();
    await vendor.getByRole("button", { name: "Delete submission by Dana Whitfield" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Delete submission?");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(vendor).toContainText("2 submissions");
    await vendor.getByRole("button", { name: "Delete submission by Dana Whitfield" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(vendor).toContainText("1 submission");
  });

  test("catches a duplicate form name and a template field that does not exist", async ({ page }) => {
    await page.goto("/app/forms");
    await page.getByRole("button", { name: "New form" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Form name").fill("client feedback");
    await dialog.getByLabel("Label of field 1").fill("Name");
    await dialog.getByLabel("Document template (optional)").fill("Hello {{Nmae}}");
    await dialog.getByRole("button", { name: "Create form" }).click();
    await expect(dialog.getByRole("alert")).toContainText("already exists");
    await expect(dialog.getByRole("alert")).toContainText("{{Nmae}}");
    await expect(dialog).toContainText("Fields you can use:");
  });

  test("approve and reject with a comment, then download the document", async ({ page }) => {
    await page.goto("/app/forms");
    const leave = page.getByTestId("form-card").filter({ hasText: "Time-off request" });
    await leave.getByRole("button", { name: /^Submissions/ }).click();
    await leave.getByLabel("Comment on submission by Marta Gill").fill("Enjoy the trip");
    await leave.getByRole("button", { name: "Approve submission by Marta Gill" }).click();
    const row = leave.getByTestId("submission-row").filter({ hasText: "Marta Gill" });
    await expect(row.getByText("Approved", { exact: true })).toBeVisible();
    await expect(row).toContainText("Approved by Priya Shah");
    await expect(row).toContainText("Enjoy the trip");
    await expect(row.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
    await expect(leave).not.toContainText("awaiting approval");

    const download = page.waitForEvent("download");
    await row.getByRole("button", { name: "Document for submission by Marta Gill" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^time-off-request-marta-gill-\d{4}-\d{2}-\d{2}\.txt$/);
    let text = "";
    for await (const chunk of await file.createReadStream()) text += chunk;
    expect(text).toContain("TIME-OFF REQUEST");
    expect(text).toContain("Type: Vacation");
    expect(text).toContain("Status: Approved");

    const vendor = page.getByTestId("form-card").filter({ hasText: "New vendor intake" });
    await vendor.getByRole("button", { name: /^Submissions/ }).click();
    await vendor.getByRole("button", { name: "Reject submission by Dana Whitfield" }).first().click();
    await expect(vendor.getByRole("alert")).toContainText("Add a short reason");
    await expect(vendor.getByText("Rejected", { exact: true })).toHaveCount(0);
    await vendor.getByLabel("Comment on submission by Dana Whitfield").fill("Missing W-9");
    await expect(vendor.getByRole("alert")).toHaveCount(0);
    await vendor.getByRole("button", { name: "Reject submission by Dana Whitfield" }).first().click();
    await expect(vendor.getByText("Rejected", { exact: true })).toBeVisible();
  });

  test("builds a form, uses it, edits it and deletes it", async ({ page }) => {
    await page.goto("/app/forms");
    await page.getByRole("button", { name: "New form" }).click();
    const dialog = page.getByRole("dialog");
    const create = dialog.getByRole("button", { name: "Create form" });
    const problems = dialog.getByRole("alert");

    await create.click();
    await expect(problems).toContainText("Enter a form name");

    await dialog.getByLabel("Form name").fill("Equipment request");
    await dialog.getByRole("button", { name: "Add field" }).click();
    await create.click();
    await expect(problems).toContainText("Every field needs a label");

    await dialog.getByLabel("Label of field 2").fill("name");
    await create.click();
    await expect(problems).toContainText("must be unique");

    await dialog.getByLabel("Label of field 2").fill("Item");
    await dialog.getByLabel("Type of field 2").click();
    await page.getByRole("option", { name: "Dropdown" }).click();
    await dialog.getByLabel("Options of field 2").fill("Laptop");
    await create.click();
    await expect(problems).toContainText("at least two options");
    await dialog.getByLabel("Options of field 2").fill("Laptop, Monitor");

    await dialog.getByLabel("Submissions need approval").check();
    await create.click();
    await expect(problems).toContainText("Enter who approves");
    await dialog.getByLabel("Approver").fill("IT lead");
    await dialog.getByLabel("Document template (optional)").fill("Request from {{Name}}: {{Item}}");
    await create.click();
    await expect(dialog).toBeHidden();

    const card = page.getByTestId("form-card").filter({ hasText: "Equipment request" });
    await expect(card).toContainText("2 fields");
    await expect(card).toContainText("Approval: IT lead");

    await card.getByRole("button", { name: "Fill out" }).click();
    await page.getByRole("dialog").getByLabel("Your name").fill("Jo");
    await page.getByRole("dialog").getByLabel(/^Name/).last().fill("Jo");
    await page.getByRole("dialog").getByRole("combobox", { name: /Item/ }).click();
    await page.getByRole("option", { name: "Monitor" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
    await card.getByRole("button", { name: /^Submissions/ }).click();
    const download = page.waitForEvent("download");
    await card.getByRole("button", { name: /^Document for submission/ }).click();
    let text = "";
    for await (const chunk of await (await download).createReadStream()) text += chunk;
    expect(text).toContain("Request from Jo: Monitor");

    await card.getByRole("button", { name: "Edit Equipment request" }).click();
    await page.getByRole("dialog").getByLabel("Form name").fill("Equipment requests");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("form-card").filter({ hasText: "Equipment requests" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Equipment requests" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("form-card")).toHaveCount(3);
  });

  test("exports submissions as CSV", async ({ page }) => {
    await page.goto("/app/forms");
    const vendor = page.getByTestId("form-card").filter({ hasText: "New vendor intake" });
    await vendor.getByRole("button", { name: /^Submissions/ }).click();
    const download = page.waitForEvent("download");
    await vendor.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^new-vendor-intake-submissions-\d{4}-\d{2}-\d{2}\.csv$/);
    let text = "";
    for await (const chunk of await file.createReadStream()) text += chunk;
    expect(text.split("\r\n")[0]).toContain("Company name,Contact email,Service category");
    expect(text).toContain("Globex Software");
  });

  test("fits a phone screen without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/forms");
    await page.getByTestId("form-card").first().getByRole("button", { name: /^Submissions/ }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/forms");
    await expect(page.getByRole("heading", { level: 1, name: "Forms & Paperwork" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forms & Paperwork", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
