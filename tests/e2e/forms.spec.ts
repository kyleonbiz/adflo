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
    await page.getByRole("button", { name: "Done" }).click();
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

  test("a new form can be sent straight after it is made, or later from its card", async ({ page }) => {
    await page.goto("/app/forms");
    await page.getByRole("button", { name: "New form" }).click();
    const builder = page.getByRole("dialog");
    await builder.getByLabel("Form name").fill("Site visit");
    await builder.getByLabel("Label of field 1").fill("Visitor name");
    await builder.getByRole("button", { name: "Create form" }).click();

    const send = page.getByRole("dialog", { name: /^Send/ });
    await expect(send).toContainText("Site visit");
    await expect(send.getByTestId("send-just-created")).toBeVisible();
    await send.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const card = page.getByTestId("form-card").filter({ hasText: "Site visit" });
    await expect(card).toBeVisible(); // closing the prompt keeps the form
    await card.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("dialog", { name: /^Send/ })).toBeVisible();
    await expect(page.getByTestId("send-just-created")).toHaveCount(0); // the saved line is only for the first time
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

    // A new form is made to be sent, so the Send dialog opens straight away.
    const send = page.getByRole("dialog", { name: /^Send/ });
    await expect(send.getByTestId("send-just-created")).toContainText("Your form is saved");
    await send.getByLabel("Send the answers to").fill("me@example.com");
    await expect(send.getByLabel("Link to the form")).toHaveValue(/\/form\//);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    const card = page.getByTestId("form-card").filter({ hasText: "Equipment request" });
    await expect(card).toContainText("2 fields");

    await card.getByRole("button", { name: "Fill out" }).click();
    await page.getByRole("dialog").getByLabel(/^Name/).last().fill("Jo");
    await page.getByRole("dialog").getByRole("combobox", { name: /Item/ }).click();
    await page.getByRole("option", { name: "Monitor" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
    await page.getByRole("button", { name: "Done" }).click();
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
  test("choose paperwork by business type, fill it in, then print or download it", async ({ page }) => {
    await page.goto("/app/forms");
    await page.getByRole("button", { name: "More ways to start a form" }).click();
    await page.getByRole("menuitem", { name: "Choose paperwork" }).click();
    const picker = page.getByRole("dialog");
    await picker.getByRole("combobox", { name: "Your business" }).click();
    await page.getByRole("option", { name: "Restaurant or food service" }).click();
    await expect(picker.getByText("Temperature log")).toBeVisible();
    await picker.getByLabel("Only forms I fill in again and again").check();
    await expect(picker.getByText("Food waste and spoilage log")).toBeVisible();
    await picker.getByRole("button", { name: "Fill out: Temperature log" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Your name").fill("Sam");
    await dialog.getByLabel(/^Date/).fill("2026-11-02");
    await dialog.getByLabel(/Checked by/).fill("Sam");
    await dialog.getByLabel(/Walk-in cooler/).fill("38");
    await dialog.getByLabel(/Freezer/).fill("0");
    await dialog.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByRole("heading", { name: "Your paperwork is ready" })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.pdf$/);
    let head = "";
    for await (const chunk of await file.createReadStream()) { head += chunk; break; }
    expect(head.startsWith("%PDF")).toBe(true);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("form-card").filter({ hasText: "Temperature log" })).toBeVisible();
  });

  test("request signatures on written text, sign as each person, and download the signed copy", async ({ page }) => {
    await page.goto("/app/forms");
    const section = page.getByTestId("signatures");
    await expect(section).toContainText("Nothing out for signature.");
    await section.getByRole("button", { name: "Request signatures" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create request" }).click();
    await expect(dialog.getByRole("alert")).toContainText("title");
    await dialog.getByLabel("Title").fill("Equipment loan");
    await dialog.getByLabel("Text", { exact: true }).fill("Dana borrows one laptop until December.");
    await dialog.getByLabel(/^Signers/).fill("Dana Whitfield <dana@example.com>\nPat Lee");
    await dialog.getByRole("button", { name: "Create request" }).click();

    const request = section.getByTestId("signing-request").filter({ hasText: "Equipment loan" });
    await expect(request).toContainText("Waiting");
    await expect(request).toContainText("Fingerprint (SHA-256):");

    await request.getByRole("button", { name: "Sign as Dana Whitfield" }).click();
    const sign = page.getByRole("dialog");
    await sign.getByLabel("Type your full name to sign").fill("Wrong Name");
    await sign.getByLabel("I have read this and agree to sign it.").check();
    await sign.getByRole("button", { name: "Sign", exact: true }).click();
    await expect(sign.getByRole("alert")).toContainText("Type Dana Whitfield exactly");
    await sign.getByLabel("Type your full name to sign").fill("Dana Whitfield");
    await sign.getByRole("button", { name: "Sign", exact: true }).click();
    await expect(request).toContainText("Partly signed");

    await request.getByRole("button", { name: "Sign as Pat Lee" }).click();
    await page.getByRole("dialog").getByLabel("Type your full name to sign").fill("Pat Lee");
    await page.getByRole("dialog").getByLabel("I have read this and agree to sign it.").check();
    await page.getByRole("dialog").getByRole("button", { name: "Sign", exact: true }).click();
    await expect(request).toContainText("Signed", { ignoreCase: false });
    await expect(request.getByRole("button", { name: /^Sign as/ })).toHaveCount(0);

    const pdf = page.waitForEvent("download");
    await request.getByRole("button", { name: "Download signed copy of Equipment loan" }).click();
    expect((await pdf).suggestedFilename()).toBe("equipment-loan-signed.pdf");

    await page.reload();
    await expect(page.getByTestId("signing-request")).toHaveCount(1); // kept in this browser
  });

  test("onboarding packets: start one for a new hire, fill a form from it, tick items off, print the checklist", async ({ page }) => {
    await page.goto("/app/forms");
    const section = page.getByTestId("packets");
    await expect(section).toContainText("No packets started");
    await section.getByRole("button", { name: "Start a packet" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Start packet" }).click();
    await expect(dialog.getByRole("alert")).toContainText("name");
    await dialog.getByLabel("Who is it for").fill("Sam Ito");
    await dialog.getByRole("button", { name: "Start packet" }).click();

    const packet = section.getByTestId("packet").filter({ hasText: "Sam Ito" });
    await expect(packet).toContainText("0 of 6 done");
    await packet.getByRole("button", { name: "Fill out New employee information for Sam Ito" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "New employee information" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await packet.getByRole("checkbox", { name: "Government-issued ID for Sam Ito" }).check();
    await expect(packet).toContainText("1 of 6 done");
    await expect(packet.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "17");
    for (const label of ["New employee information", "Confidentiality acknowledgment", "Tax withholding form", "Direct deposit details", "Employee handbook acknowledgment"]) {
      await packet.getByRole("checkbox", { name: `${label} for Sam Ito` }).check();
    }
    await expect(packet).toContainText("Complete");
    const pdf = page.waitForEvent("download");
    await packet.getByRole("button", { name: "Download PDF for Sam Ito" }).click();
    expect((await pdf).suggestedFilename()).toBe("new-employee-sam-ito.pdf");

    await page.reload();
    await expect(page.getByTestId("packet")).toHaveCount(1);
  });
});
