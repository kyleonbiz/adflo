import type { ProjectTemplate } from "./templates";

export const NEW_TYPE = "__new__";
export const CUSTOM_PREFIX = "custom-";
export const MAX_TASKS = 30;

export interface CustomTypeInput { name: string; summary: string; durationDays: string; tasks: string }

/** Turns what someone typed into a project type, or says what is wrong. Tasks are one per line and spread evenly across the duration. */
export function buildCustomType(input: CustomTypeInput, id: string, existing: ProjectTemplate[]): { type: ProjectTemplate } | { error: string } {
  const name = input.name.trim();
  if (name.length < 2) return { error: "Give the project type a name." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };
  if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase())) return { error: "A project type with that name already exists." };
  const days = Number(input.durationDays);
  if (!Number.isInteger(days) || days < 1 || days > 730) return { error: "Duration is a whole number of days, from 1 to 730." };
  const titles = input.tasks.split("\n").map((l) => l.trim()).filter(Boolean);
  if (titles.length > MAX_TASKS) return { error: `List at most ${MAX_TASKS} tasks.` };
  if (titles.some((t) => t.length > 120)) return { error: "Keep each task under 120 characters." };
  const summary = input.summary.trim().slice(0, 140);
  return {
    type: {
      id: `${CUSTOM_PREFIX}${id}`, name, summary: summary || `Your own project type with ${titles.length} task${titles.length === 1 ? "" : "s"}.`,
      description: summary, durationDays: days,
      tasks: titles.map((title, i) => ({ title, offsetDays: Math.round(((i + 1) / titles.length) * days) })),
    },
  };
}

export const isCustomType = (id: string) => id.startsWith(CUSTOM_PREFIX);

export function parseCustomTypes(raw: string): ProjectTemplate[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((t): t is ProjectTemplate =>
      !!t && typeof t.id === "string" && isCustomType(t.id) && typeof t.name === "string" && typeof t.summary === "string" &&
      typeof t.description === "string" && Number.isInteger(t.durationDays) && Array.isArray(t.tasks) &&
      t.tasks.every((k: { title?: unknown; offsetDays?: unknown }) => typeof k?.title === "string" && Number.isInteger(k?.offsetDays)));
  } catch { return []; }
}
