import { expect, test } from "./fixtures";

test.describe("tasks view", () => {
  test("opens on the flat task list, most urgent first, across every project", async ({ page }) => {
    await page.goto("/app/projects");
    await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Tasks" })).toHaveAttribute("aria-selected", "true");
    const rows = page.getByTestId("task-row");
    await expect(rows).toHaveCount(8);
    await expect(rows.first()).toContainText("Import vendor list");
    await expect(rows.first()).toContainText("Client onboarding: Northwind");
    await expect(rows.nth(1)).toContainText("Submit city permit renewal");
    await expect(rows.last()).toContainText("Update insurance certificate");
    await expect(page.getByTestId("project-card")).toHaveCount(0);
  });

  test("adds a standalone task, completes it, filters and searches", async ({ page }) => {
    await page.goto("/app/projects");
    const form = page.getByRole("form", { name: "Add a task" });
    await form.getByRole("button", { name: "Add task" }).click();
    await expect(form.getByRole("alert")).toContainText("Enter a task");
    await form.getByLabel("New task").fill("Order printer toner");
    await form.getByLabel("Assignee").fill("Priya");
    await form.getByRole("button", { name: "Add task" }).click();
    const row = page.getByTestId("task-row").filter({ hasText: "Order printer toner" });
    await expect(row).toContainText("Priya");
    await expect(page.getByTestId("task-row")).toHaveCount(9);

    // A standalone task is not a project.
    await page.getByRole("tab", { name: "Projects" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(4);
    await page.getByRole("tab", { name: "Tasks" }).click();

    await page.getByRole("checkbox", { name: "Order printer toner" }).click(); // finished tasks leave the list
    await expect(page.getByTestId("task-row")).toHaveCount(8);
    await page.getByLabel("Show completed").check();
    await expect(page.getByTestId("task-row").filter({ hasText: "Order printer toner" })).toBeVisible();
    await page.getByLabel("Show completed").uncheck();

    await page.getByRole("combobox", { name: "Filter tasks" }).click();
    await page.getByRole("option", { name: "Overdue" }).click();
    await expect(page.getByTestId("task-row")).toHaveCount(1);
    await page.getByRole("combobox", { name: "Filter tasks" }).click();
    await page.getByRole("option", { name: "All tasks" }).click();

    await page.getByLabel("Search tasks").fill("marta");
    await expect(page.getByTestId("task-row")).toHaveCount(2);
  });

  test("adds a task to a project from the list", async ({ page }) => {
    await page.goto("/app/projects");
    const form = page.getByRole("form", { name: "Add a task" });
    await form.getByLabel("New task").fill("Book the venue");
    await form.getByRole("combobox", { name: "Project" }).click();
    await page.getByRole("option", { name: "Data cleanup" }).click();
    await form.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByTestId("task-row").filter({ hasText: "Book the venue" })).toContainText("Data cleanup");
    await page.getByRole("tab", { name: "Projects" }).click();
    await expect(page.getByTestId("project-card").filter({ hasText: "Data cleanup" })).toContainText("0 of 3 tasks");
  });
});

test("the tasks view fits a phone screen without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/app/projects");
  await expect(page.getByTestId("task-row").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe("projects view", () => {
  test("summary, attention list, health and status filter", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    await expect(page.getByRole("note")).toContainText("saved in this browser only");
    await expect(page.getByTestId("project-card")).toHaveCount(4);

    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("Active projects");
    const attention = page.getByRole("region", { name: "Needs attention" });
    await expect(attention).toContainText("Import vendor list");
    await expect(attention).toContainText("2 days overdue");
    await expect(attention).toContainText("Submit city permit renewal");

    const onboarding = page.getByTestId("project-card").filter({ hasText: "Client onboarding" });
    await expect(onboarding.getByText("At risk", { exact: true })).toBeVisible();
    await expect(onboarding).toContainText("2 of 6 tasks");
    const licenses = page.getByTestId("project-card").filter({ hasText: "License renewals 2026" });
    await expect(licenses.getByText("Late", { exact: true })).toBeVisible();

    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Completed" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
  });

  test("completing tasks updates progress and repeating tasks schedule the next one", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    const card = page.getByTestId("project-card").filter({ hasText: "Client onboarding" });
    // A project with overdue tasks arrives expanded.
    await expect(card.getByRole("button", { name: /^Tasks/ })).toHaveAttribute("aria-expanded", "true");

    await card.getByRole("checkbox", { name: /^Import vendor list/ }).check();
    await expect(card).toContainText("3 of 6 tasks");
    await expect(page.getByRole("region", { name: "Needs attention" })).not.toContainText("Import vendor list");
    await expect(card.getByText("At risk", { exact: true })).toHaveCount(0);
    await expect(card.getByText("On track", { exact: true })).toBeVisible();

    await card.getByRole("checkbox", { name: /^Weekly check-in/ }).check();
    await expect(page.getByRole("status")).toContainText("The next one is scheduled");
    await expect(card.getByRole("checkbox", { name: /^Weekly check-in/ })).toHaveCount(2);
    await expect(card).toContainText("4 of 7 tasks");

    // Reopen and complete again: no second follow-up appears.
    await card.getByRole("checkbox", { name: /^Weekly check-in/, checked: true }).uncheck();
    await card.getByRole("checkbox", { name: /^Weekly check-in/, checked: false }).first().check();
    await expect(card.getByRole("checkbox", { name: /^Weekly check-in/ })).toHaveCount(2);
  });

  test("add task with validation, create project, edit and delete", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    const card = page.getByTestId("project-card").filter({ hasText: "Data cleanup" });
    await card.getByRole("button", { name: /^Tasks/ }).click();
    await card.getByRole("button", { name: "Add", exact: true }).click();
    await expect(card.getByRole("alert")).toContainText("Enter a task");
    await card.getByLabel("New task for Data cleanup").fill("Review duplicates");
    await card.getByLabel("Assignee").fill("Priya");
    await card.getByRole("button", { name: "Add", exact: true }).click();
    await expect(card.getByRole("checkbox", { name: "Review duplicates" })).toBeVisible();
    await card.getByRole("button", { name: "Remove task Review duplicates" }).click();
    await expect(card.getByRole("checkbox", { name: "Review duplicates" })).toHaveCount(0);
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(card.getByRole("checkbox", { name: "Review duplicates" })).toBeVisible();

    await card.getByRole("button", { name: "Edit task Review duplicates" }).click();
    await card.getByLabel("Edit task for Data cleanup").fill("Review duplicate contacts");
    await card.getByRole("button", { name: "Save", exact: true }).click();
    await expect(card.getByRole("checkbox", { name: "Review duplicate contacts" })).toBeVisible();
    await card.getByRole("button", { name: "Remove task Review duplicate contacts" }).click();

    await page.getByRole("button", { name: "New project" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Enter a project name");
    await dialog.getByLabel("Project name").fill("Website refresh");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(dialog).toBeHidden();
    const created = page.getByTestId("project-card").filter({ hasText: "Website refresh" });
    await expect(created).toContainText("0 of 0 tasks");

    await created.getByRole("button", { name: "More actions for Website refresh" }).click();
    await page.getByRole("menuitem", { name: "Edit project" }).click();
    await page.getByRole("dialog").getByLabel("Project name").fill("Website relaunch");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("project-card").filter({ hasText: "Website relaunch" })).toBeVisible();

    await page.getByRole("button", { name: "More actions for Website relaunch" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(4);
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(5);
  });

  test("creates a project from a template and lets you trim the checklist", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    await page.getByRole("button", { name: "New project" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/^Checklist/)).toHaveCount(0);

    await dialog.getByRole("combobox", { name: "Start from a template" }).click();
    await page.getByRole("option", { name: "Vendor Onboarding" }).click();
    await expect(dialog.getByLabel("Project name")).toHaveValue("Vendor Onboarding");
    await expect(dialog).toContainText("7 of 7 tasks will be added");
    await dialog.getByRole("checkbox", { name: /Collect business license copy/ }).uncheck();
    await expect(dialog).toContainText("6 of 7 tasks will be added");
    await dialog.getByRole("button", { name: "Create project" }).click();

    const card = page.getByTestId("project-card").filter({ hasText: "Vendor Onboarding" });
    await expect(card).toContainText("0 of 6 tasks");
    await expect(page.getByRole("status")).toContainText("created with 6 tasks");
    // The new project opens so the checklist is visible straight away.
    await expect(card.getByRole("checkbox", { name: /^Collect W-9/ })).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /Collect business license copy/ })).toHaveCount(0);

    // Reopening the dialog starts blank again.
    await page.getByRole("button", { name: "New project" }).click();
    await expect(page.getByRole("dialog").getByLabel("Project name")).toHaveValue("");
    await expect(page.getByRole("dialog").getByText(/^Checklist/)).toHaveCount(0);
  });

  test("adds your own project type with the + option, then uses it", async ({ page }) => {
    await page.goto("/app/projects");
    await page.getByRole("tab", { name: "Projects" }).click();
    await page.getByRole("button", { name: "New project" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Start from a template" }).click();
    await page.getByRole("option", { name: "+ Add your own project type" }).click();
    await dialog.getByRole("button", { name: "Save project type" }).click();
    await expect(dialog.getByRole("alert")).toContainText("name");
    await dialog.getByLabel("Type name").fill("Quarterly tax prep");
    await dialog.getByLabel("Typical length (days)").fill("45");
    await dialog.getByLabel("Tasks (one per line)").fill("Gather receipts\nReconcile accounts\nSend to accountant");
    await dialog.getByRole("button", { name: "Save project type" }).click();
    await expect(dialog.getByLabel("Project name")).toHaveValue("Quarterly tax prep");
    await expect(dialog).toContainText("3 of 3 tasks will be added");
    await dialog.getByRole("button", { name: "Create project" }).click();
    const card = page.getByTestId("project-card").filter({ hasText: "Quarterly tax prep" });
    await expect(card).toContainText("0 of 3 tasks");

    // The type stays in the list for next time, and can be removed.
    await page.reload();
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByRole("dialog").getByRole("combobox", { name: "Start from a template" }).click();
    await page.getByRole("option", { name: "Quarterly Tax Prep" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove this project type" }).click();
    await page.getByRole("dialog").getByRole("combobox", { name: "Start from a template" }).click();
    await expect(page.getByRole("option", { name: "Quarterly Tax Prep" })).toHaveCount(0);
  });

  test("sorts, filters from the summary tiles and clears filters", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    await expect(page.getByTestId("project-card")).toHaveCount(4);
    const names = () => page.getByTestId("project-card").locator("h3").allTextContents();
    expect((await names())[0]).toBe("License renewals 2026");
    await page.getByRole("combobox", { name: "Sort projects" }).click();
    await page.getByRole("option", { name: "Sort: Name" }).click();
    expect((await names())[0]).toBe("Client onboarding: Northwind");

    await page.getByRole("button", { name: /Overdue tasks/ }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Overdue tasks/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(4);

    await page.getByLabel("Search projects").fill("zzz");
    await expect(page.getByText("No projects match these filters.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Report for 0 project/ })).toBeDisabled();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(4);
  });

  test("attention rows complete tasks and jump to their project", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    const attention = page.getByRole("region", { name: "Needs attention" });
    await attention.getByRole("button", { name: "Mark Submit city permit renewal done" }).click();
    await expect(attention).not.toContainText("Submit city permit renewal");
    await attention.getByRole("button", { name: "Client onboarding: Northwind" }).first().click();
    await expect(page.getByTestId("project-card").filter({ hasText: "Client onboarding" }).getByRole("button", { name: /^Tasks/ })).toHaveAttribute("aria-expanded", "true");
  });

  test("completing a project with open tasks asks what to do with them", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    const card = page.getByTestId("project-card").filter({ hasText: "Data cleanup" });
    await card.getByRole("combobox", { name: "Status of Data cleanup" }).click();
    await page.getByRole("option", { name: "Completed" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("2 open tasks");
    await dialog.getByRole("button", { name: "Mark tasks done" }).click();
    await expect(card).toContainText("2 of 2 tasks");
  });

  test("downloads a status report", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Status report" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^status-report-\d{4}-\d{2}-\d{2}\.txt$/);
    let text = "";
    for await (const chunk of await file.createReadStream()) text += chunk;
    expect(text).toContain("PROJECT STATUS REPORT");
    expect(text).toContain("CLIENT ONBOARDING: NORTHWIND");
    expect(text).toContain("Health: At risk");
  });

  test("fits a phone screen without horizontal scroll, tasks expanded", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/projects?view=projects");
    await page.getByTestId("project-card").first().getByRole("button", { name: /^Tasks/ }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/projects?view=projects");
    await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tasks", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("an owner, who it is for, milestones and a log of updates", async ({ page }) => {
    await page.goto("/app/projects");
    await page.getByRole("tab", { name: "Projects" }).click();
    await page.getByRole("button", { name: "New project" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Project name").fill("Office move");
    await dialog.getByLabel("Owner (optional)").fill("Priya Shah");
    await dialog.getByRole("combobox", { name: "For a contact or vendor?" }).click();
    await page.getByRole("option", { name: "A vendor" }).click();
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Enter who it is for");
    await dialog.getByLabel("Vendor name").fill("Blue Ridge Movers");
    await dialog.getByRole("button", { name: "Create project" }).click();

    const card = page.getByTestId("project-card").filter({ hasText: "Office move" });
    await expect(card).toContainText("Owner: Priya Shah");
    await expect(card.getByTestId("project-link").getByRole("link", { name: "Blue Ridge Movers" })).toHaveAttribute("href", "/app/vendors?q=Blue%20Ridge%20Movers");
    await card.getByRole("button", { name: /^Tasks/ }).click();

    await card.getByLabel("New milestone for Office move").fill("Keys handed over");
    await card.getByRole("button", { name: "Add milestone to Office move" }).click();
    await expect(card.getByRole("alert")).toContainText("Choose a date");
    await card.getByLabel("Milestone date for Office move").fill("2020-01-15");
    await card.getByRole("button", { name: "Add milestone to Office move" }).click();
    const milestones = card.getByTestId("milestones");
    await expect(milestones).toContainText("0 of 1, 1 overdue");
    await milestones.getByLabel("Keys handed over done").check();
    await expect(milestones).toContainText("1 of 1");

    await card.getByLabel("Add an update to Office move").fill("Movers booked for the 14th");
    await card.getByRole("button", { name: "Post" }).click();
    await expect(card.getByTestId("update").first()).toContainText("You"); // posted by the signed-in person; preview mode says "You"
    await expect(card.getByTestId("update").first()).toContainText("Movers booked for the 14th");
  });

});
