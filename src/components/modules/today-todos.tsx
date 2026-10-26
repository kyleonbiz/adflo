"use client";

import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayLong } from "@/lib/dates";
import { addTodo, MAX_TITLE, pruneTodos, removeTodo, toggleTodo, todaysTodos, type Todo } from "@/lib/todos/logic";
import { saveTodos, useTodos } from "@/lib/todos/storage";
import { cn } from "@/lib/utils";

const newId = () => `todo-${Math.random().toString(36).slice(2, 10)}`;

/** Today's to-do list. Saved in this browser only; unfinished tasks roll over to the next day. */
export function TodayTodos({ today }: { today: string }) {
  const stored = useTodos();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const list = todaysTodos(stored, today);
  const open = list.filter((t) => !t.done).length;

  const commit = (next: Todo[]) => saveTodos(pruneTodos(next, today));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    commit(addTodo(stored, title, today, newId()));
    setTitle(""); // stay open so several tasks can be added in a row
  };

  return (
    <section aria-labelledby="today-heading" className="rounded-2xl border bg-card p-4 shadow-panel" data-testid="today-todos">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="today-heading" className="text-base font-semibold">Today</h2>
          <p className="text-sm text-muted-foreground">{formatDayLong(today)} · {open === 0 ? "nothing left to do" : `${open} to do`}</p>
        </div>
        <Button type="button" size="icon" aria-label="Add a task" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
          {adding ? <X aria-hidden /> : <Plus aria-hidden />}
        </Button>
      </div>

      {adding && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <Input autoFocus value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing today?" aria-label="New task" />
          <Button type="submit" disabled={!title.trim()}>Add</Button>
        </form>
      )}

      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No tasks yet. Press + to add one.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {list.map((t) => (
            <li key={t.id} data-testid="todo-item" className="flex items-center gap-3 py-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={t.done}
                aria-label={`${t.done ? "Reopen" : "Complete"} ${t.title}`}
                onClick={() => commit(toggleTodo(stored, t.id))}
                className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring", t.done ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
              >
                {t.done && <Check className="size-3.5" aria-hidden />}
              </button>
              <span className={cn("min-w-0 flex-1 break-words text-sm", t.done && "text-muted-foreground line-through")}>
                {t.title}
                {!t.done && t.day < today && <span className="ml-2 text-xs text-amber-700">from {formatDayLong(t.day)}</span>}
              </span>
              <button type="button" aria-label={`Delete ${t.title}`} onClick={() => commit(removeTodo(stored, t.id))} className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
