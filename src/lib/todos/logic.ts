export interface Todo {
  id: string;
  title: string;
  done: boolean;
  /** The day the task was added or is planned for, `YYYY-MM-DD`. */
  day: string;
}

export const MAX_TITLE = 120;
export const MAX_TODOS = 200;

/** Adds a task for `day`; blank titles are ignored, long ones trimmed to fit. */
export function addTodo(todos: Todo[], title: string, day: string, id: string): Todo[] {
  const clean = title.trim().slice(0, MAX_TITLE);
  if (!clean || todos.length >= MAX_TODOS) return todos;
  return [...todos, { id, title: clean, done: false, day }];
}

export const toggleTodo = (todos: Todo[], id: string): Todo[] => todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
export const removeTodo = (todos: Todo[], id: string): Todo[] => todos.filter((t) => t.id !== id);

/**
 * What belongs on today's list: everything planned for today, plus anything unfinished from an
 * earlier day (it rolls over until done). Open tasks come first, in the order they were added.
 */
export function todaysTodos(todos: Todo[], today: string): Todo[] {
  const shown = todos.filter((t) => t.day === today || (!t.done && t.day < today));
  return [...shown.filter((t) => !t.done), ...shown.filter((t) => t.done)];
}

/** Drops finished tasks from earlier days so the saved list does not grow forever. */
export function pruneTodos(todos: Todo[], today: string): Todo[] {
  return todos.filter((t) => !(t.done && t.day < today));
}

/** Reads saved JSON defensively: anything malformed is dropped. */
export function parseTodos(raw: string): Todo[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.flatMap((x): Todo[] => {
      const t = x as Partial<Todo> | null;
      if (!t || typeof t.id !== "string" || typeof t.title !== "string" || typeof t.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t.day)) return [];
      const title = t.title.trim().slice(0, MAX_TITLE);
      return title ? [{ id: t.id, title, done: t.done === true, day: t.day }] : [];
    }).slice(0, MAX_TODOS);
  } catch {
    return [];
  }
}
