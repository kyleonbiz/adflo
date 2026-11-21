import { readSingleRaw } from "@/lib/records/storage";
import { parseSettings } from "@/lib/settings/storage";
import { parseStored } from "@/lib/setup/storage";
import type { Letterhead } from "./types";

/** The business's name and contact details as saved right now (Settings > Business profile). Empty on the server. */
export function currentLetterhead(): Letterhead {
  try {
    const name = parseStored(readSingleRaw("setup"))?.business.name.trim() ?? "";
    const d = parseSettings(readSingleRaw("settings")).details;
    return { name, lines: [d.address, d.phone, d.email].map((l) => l.trim()).filter(Boolean) };
  } catch { return { name: "", lines: [] }; }
}
