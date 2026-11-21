import type { DocBusiness } from "./doc-model";

/**
 * The letterhead every printed or downloaded document carries. The app shell keeps it current from the
 * business name in setup and the contact details in Settings, so each PDF and print uses it without being told.
 */
let current: DocBusiness = {};

export const setDocBusiness = (b: DocBusiness): void => { current = b; };
export const docBusiness = (): DocBusiness => current;

const LICENSE_NAME = /contractor|trade|professional|business license/i;

/** Builds the letterhead; an empty result means the document is printed without one. */
export function letterhead(
  name: string, details: { address?: string; phone?: string; email?: string },
  licenses: { name: string; number: string }[] = [],
): DocBusiness {
  const license = licenses.find((l) => l.number.trim() && LICENSE_NAME.test(l.name))?.number.trim();
  const clean = (s?: string) => s?.trim() || undefined;
  return { name: clean(name), address: clean(details.address), phone: clean(details.phone), email: clean(details.email), license };
}
