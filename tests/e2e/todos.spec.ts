import { expect, test } from "@playwright/test";

test.describe("today's to-do list", () => {
  test("+ adds a task, which can be completed, survives a reload and can be deleted", async ({ page }) => {
    await page.goto("/app/overview");
    const todos = page.getByTestId("today-todos");
    await expect(todos).toContainText("No tasks yet");

    await todos.getByRole("button", { name: "Add a task" }).click();
    await todos.getByLabel("New task").fill("Send the Q4 invoices");
    await todos.getByLabel("New task").press("Enter");
    await expect(todos.getByTestId("todo-item")).toHaveCount(1);
    await expect(todos).toContainText("1 to do");

    await todos.getByRole("checkbox", { name: "Complete Send the Q4 invoices" }).click();
    await expect(todos).toContainText("nothing left to do");
    await expect(todos.getByTestId("todo-item")).toHaveCount(0); // completed tasks are tucked away

    await page.reload();
    await todos.getByRole("button", { name: "Show completed (1)" }).click();
    await expect(todos.getByTestId("todo-item")).toHaveCount(1);

    await todos.getByRole("button", { name: "Delete Send the Q4 invoices" }).click();
    await expect(todos.getByTestId("todo-item")).toHaveCount(0);
  });
});
