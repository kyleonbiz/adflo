import { addDays } from "@/lib/dates";
import type { Project, Task } from "@/lib/projects/types";

let seq = 0;
function task(title: string, assignee: string, dueOn: string | null, over: Partial<Task> = {}): Task {
  return { id: `t-${++seq}`, title, assignee, dueOn, repeat: "none", done: false, doneOn: null, followUpId: null, ...over };
}

/** Sample projects with dates relative to `today`, so every task and health state is represented. */
export function sampleProjects(today: string): Project[] {
  seq = 0;
  const done = (title: string, assignee: string, ago: number) =>
    task(title, assignee, addDays(today, -ago - 2), { done: true, doneOn: addDays(today, -ago) });
  return [
    {
      id: "p-1", name: "Client onboarding: Northwind", client: "Northwind Traders",
      description: "Set up workspace, import records and train the team.",
      status: "active", startOn: addDays(today, -20), dueOn: addDays(today, 18),
      tasks: [
        done("Kickoff call", "Kyle", 18),
        done("Collect existing files", "Priya", 9),
        task("Import vendor list", "Priya", addDays(today, -2)),
        task("Configure invoice templates", "Kyle", addDays(today, 2)),
        task("Train staff", "Kyle", addDays(today, 12)),
        task("Weekly check-in", "Kyle", addDays(today, 3), { repeat: "weekly" }),
      ],
    },
    {
      id: "p-2", name: "License renewals 2026", client: "Contoso Ltd",
      description: "Renew all expiring permits before year end.",
      status: "active", startOn: addDays(today, -60), dueOn: addDays(today, -4),
      tasks: [
        done("Audit current licenses", "Marta", 40),
        task("Submit city permit renewal", "Marta", addDays(today, 0)),
        task("Update insurance certificate", "Marta", null),
      ],
    },
    {
      id: "p-3", name: "Data cleanup", client: "Fabrikam Inc",
      description: "Deduplicate contacts and standardize file names.",
      status: "planning", startOn: addDays(today, 7), dueOn: addDays(today, 45),
      tasks: [task("Scope the cleanup", "Kyle", addDays(today, 8)), task("Export contact list", "Priya", addDays(today, 10))],
    },
    {
      id: "p-4", name: "Quarterly bookkeeping", client: "Adventure Works",
      description: "Close the quarter and send the summary.",
      status: "completed", startOn: addDays(today, -50), dueOn: addDays(today, -10),
      tasks: [done("Reconcile accounts", "Marta", 14), done("Send summary", "Marta", 11)],
    },
  ];
}
