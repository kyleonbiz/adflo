import { expect, test } from "./fixtures";

test.describe("forms module", () => {
  test("summary, response counts and search", async ({ page }) => {
    await page.goto("/app/forms");
    await expect(page.getByRole("note")).toContainText("Nothing is saved");
    await expect(page.getByTestId("form-card")).toHaveCount(3);
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("New responses");
    await expect(summary).not.toContainText("pproval");
    const vendor = page.getByTestId("form-card").filter({ hasText: "New vendor intake" });
    await expect(vendor).toContainText("1 new");
    await expect(vendor).toContainText("sent 0 times · 2 responses");
    await expect(vendor).not.toContainText("pproval");

    await page.getByRole("textbox", { name: "Search forms" }).fill("time-off");
    await expect(page.getByTestId("form-card")).toHaveCount(1);
  });

  test("filling a form validates, then adds a new response", async ({ page }) => {
    await page.goto("/app/forms");
    const leave = page.getByTestId("form-card").filter({ hasText: "Time-off request" });
    await leave.getByRole("button", { name: "Fill out" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Submit" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("required");
    await expect(dialog.getByRole("alert")).toHaveCount(4); // name, two dates, type

    await dialog.getByLabel("Your name").fill("Sam");
    await dialog.getByLabel(/Employee name/).fill("Sam Rivera");
    await dialog.getByLabel(/First day off/).fill("2026-12-01");
    await dialog.getByLabel(/Last day off/).fill("2026-12-03");
    await dialog.getByRole("combobox", { name: /Type/ }).click();
    await page.getByRole("option", { name: "Sick" }).click();
    await dialog.getByRole("button", { name: "Submit" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Response added");
    await expect(leave).toContainText("2 new");
    await expect(leave).toContainText("3 responses");
  });

  test("mark a response done and reopen it, then download the document", async ({ page }) => {
    await page.goto("/app/forms");
    const leave = page.getByTestId("form-card").filter({ hasText: "Time-off request" });
    await leave.getByRole("button", { name: /^Responses/ }).click();
    const row = leave.getByTestId("submission-row").filter({ hasText: "Marta Gill" });
    await expect(row.getByText("New", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Mark response by Marta Gill done" }).click();
    await expect(row.getByText("Done", { exact: true })).toBeVisible();
    await expect(leave).not.toContainText("1 new");
    await row.getByRole("button", { name: "Reopen response by Marta Gill" }).click();
    await expect(row.getByText("New", { exact: true })).toBeVisible();

    const download = page.waitForEvent("download");
    await row.getByRole("button", { name: "Document for response by Marta Gill" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^time-off-request-marta-gill-\d{4}-\d{2}-\d{2}\.txt$/);
    let text = "";
    for await (const chunk of await file.createReadStream()) text += chunk;
    expect(text).toContain("TIME-OFF REQUEST");
    expect(text).toContain("Type: Vacation");
    expect(text).not.toMatch(/Decision|Approved/);
  });

  test("send a form, a recipient fills it in on the public page, and their answers come back", async ({ page }) => {
    await page.goto("/app/forms");
    const feedback = page.getByTestId("form-card").filter({ hasText: "Client feedback" });
    await feedback.getByRole("button", { name: "Send" }).click();
    const send = page.getByRole("dialog");
    await expect(send.getByRole("button", { name: "Open email" })).toBeDisabled();
    await send.getByLabel("Send the answers to").fill("me@mybusiness.com");
    await send.getByLabel("Who is it for? (optional)").fill("pat@client.com");
    const link = await send.getByLabel("Link to the form").inputValue();
    expect(link).toContain("/form/");
    await expect(send.getByRole("link", { name: "Open email" })).toHaveAttribute("href", /^mailto:pat%40client\.com\?subject=/);
    await send.getByRole("button", { name: "Copy link" }).click();
    await page.keyboard.press("Escape");
    await expect(feedback).toContainText("sent 1 time ·");

    // The recipient: a plain page, no sign-in, nothing stored.
    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: "Client feedback" })).toBeVisible();
    await page.getByRole("button", { name: "Review my answers" }).click();
    await expect(page.getByRole("alert").first()).toContainText("required");
    await page.locator("#fill-by").fill("Pat Lee");
    await page.getByLabel(/Score/).fill("9");
    await page.getByLabel("Comments").fill("Fast and thorough.");
    await page.getByRole("button", { name: "Review my answers" }).click();
    const done = page.getByTestId("public-form-done");
    await expect(done).toContainText("Nothing has been sent yet");
    await expect(done.getByRole("link", { name: "Email my answers" })).toHaveAttribute("href", /^mailto:me%40mybusiness\.com\?subject=/);
    const answers = (await done.locator("pre").textContent()) ?? "";
    expect(answers).toContain("Score (1-10): 9");

    // Back in AdFlo, the sender pastes the email.
    await page.goto("/app/forms");
    const card = page.getByTestId("form-card").filter({ hasText: "Client feedback" });
    await card.getByRole("button", { name: /^Responses/ }).click();
    await card.getByRole("button", { name: "Add responses to Client feedback" }).click();
    const add = page.getByRole("dialog");
    await expect(add.getByRole("button", { name: "Add responses" })).toBeDisabled();
    await add.getByLabel("Paste the emails you received").fill("nothing useful here");
    await add.getByRole("button", { name: "Add responses" }).click();
    await expect(add.getByRole("alert")).toContainText("No AdFlo answers were found");
    await add.getByLabel("Paste the emails you received").fill(`Hi!\n\n${answers}\n\nThanks, Pat`);
    await add.getByRole("button", { name: "Add responses" }).click();
    await expect(add).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Added 1 response to Client feedback");
    await expect(card.getByTestId("submission-row").filter({ hasText: /^Pat Lee/ })).toContainText("New");

    // Pasting the same email again does not add a duplicate.
    await card.getByRole("button", { name: "Add responses to Client feedback" }).click();
    await page.getByRole("dialog").getByLabel("Paste the emails you received").fill(answers);
    await page.getByRole("dialog").getByRole("button", { name: "Add responses" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("already added");
  });

  test("a broken form link shows not found", async ({ page }) => {
    const res = await page.goto("/form/not-a-real-form");
    expect(res?.status()).toBe(404);
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

    await expect(dialog).not.toContainText("pproval");
    await dialog.getByLabel("Document template (optional)").fill("Request from {{Name}}: {{Item}}");
    await create.click();
    await expect(dialog).toBeHidden();

    const card = page.getByTestId("form-card").filter({ hasText: "Equipment request" });
    await expect(card).toContainText("2 fields");

    await card.getByRole("button", { name: "Fill out" }).click();
    await page.getByRole("dialog").getByLabel(/^Name/).last().fill("Jo");
    await page.getByRole("dialog").getByRole("combobox", { name: /Item/ }).click();
    await page.getByRole("option", { name: "Monitor" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
    await card.getByRole("button", { name: /^Responses/ }).click();
    const download = page.waitForEvent("download");
    await card.getByRole("button", { name: /^Document for response/ }).click();
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

  test("exports responses as CSV", async ({ page }) => {
    await page.goto("/app/forms");
    const vendor = page.getByTestId("form-card").filter({ hasText: "New vendor intake" });
    await vendor.getByRole("button", { name: /^Responses/ }).click();
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
    await page.getByTestId("form-card").first().getByRole("button", { name: /^Responses/ }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/forms");
    await expect(page.getByRole("heading", { level: 1, name: "Forms & Paperwork" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forms & Paperwork", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
