import { describe, expect, it } from "vitest";
import { MAX_REMINDERS, clearReminder, dueReminders, parseReminders, reminderId, reminderItems, setReminder, type Reminder } from "@/lib/reminders/logic";

const T = "2026-10-26";
const base = { id: reminderId("request", "r1"), text: "Order toner", area: "Tasks" as const, href: "/app/projects" };

describe("reminders", () => {
  it("sets a day, moves it when asked again, and clears it", () => {
    let list = setReminder([], base, T, 3);
    expect(list).toEqual([{ ...base, on: "2026-10-29" }]);
    list = setReminder(list, base, T, 1);
    expect(list).toHaveLength(1);
    expect(list[0].on).toBe("2026-10-27");
    expect(clearReminder(list, base.id)).toEqual([]);
  });

  it("is due from its day onward, oldest first, and becomes a feed item", () => {
    const list: Reminder[] = [{ ...base, on: "2026-10-26" }, { ...base, id: "rem-task-t1", text: "Send W-9", area: "Tasks", href: "/app/projects", on: "2026-10-20" }, { ...base, id: "rem-request-r2", on: "2026-10-30" }];
    expect(dueReminders(list, T).map((r) => r.id)).toEqual(["rem-task-t1", base.id]);
    expect(reminderItems(list, T)[0]).toMatchObject({ id: "rem-task-t1", area: "Tasks", label: "Reminder", severity: "warning", href: "/app/projects" });
  });

  it("keeps the list bounded and reads saved reminders defensively", () => {
    let list: Reminder[] = [];
    for (let i = 0; i < MAX_REMINDERS + 5; i++) list = setReminder(list, { ...base, id: `rem-request-${i}` }, T, 1);
    expect(list).toHaveLength(MAX_REMINDERS);
    expect(parseReminders("nope")).toEqual([]);
    expect(parseReminders(JSON.stringify([{ ...base, on: T }, { ...base, on: "not a day" }, { ...base, id: "other", on: T }, { ...base, href: "https://evil.example", on: T }]))).toHaveLength(1);
  });
});
