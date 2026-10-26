import { describe, expect, it } from "vitest";
import { addTodo, parseTodos, pruneTodos, removeTodo, toggleTodo, todaysTodos, MAX_TITLE } from "@/lib/todos/logic";

const T = "2026-10-26";

describe("todos", () => {
  it("adds trimmed tasks and ignores blanks", () => {
    expect(addTodo([], "   ", T, "a")).toEqual([]);
    expect(addTodo([], "  Call bank ", T, "a")).toEqual([{ id: "a", title: "Call bank", done: false, day: T }]);
    expect(addTodo([], "x".repeat(500), T, "a")[0].title).toHaveLength(MAX_TITLE);
  });
  it("toggles and removes", () => {
    const l = addTodo([], "a", T, "1");
    expect(toggleTodo(l, "1")[0].done).toBe(true);
    expect(removeTodo(l, "1")).toEqual([]);
  });
  it("rolls unfinished tasks over, hides old finished ones, lists open first", () => {
    const l = [
      { id: "1", title: "old open", done: false, day: "2026-10-20" },
      { id: "2", title: "old done", done: true, day: "2026-10-20" },
      { id: "3", title: "today done", done: true, day: T },
      { id: "4", title: "today open", done: false, day: T },
      { id: "5", title: "future", done: false, day: "2026-10-30" },
    ];
    expect(todaysTodos(l, T).map((t) => t.id)).toEqual(["1", "4", "3"]);
    expect(pruneTodos(l, T).map((t) => t.id)).toEqual(["1", "3", "4", "5"]);
  });
  it("parses saved data defensively", () => {
    expect(parseTodos("not json")).toEqual([]);
    expect(parseTodos('{"a":1}')).toEqual([]);
    expect(parseTodos(JSON.stringify([{ id: "1", title: "ok", day: T }, { id: 2 }, { id: "3", title: "bad", day: "x" }]))).toEqual([{ id: "1", title: "ok", done: false, day: T }]);
  });
});
