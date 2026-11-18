/** Database messages written for the Owner (SQLSTATE 22023, P0002) are safe to show; anything else is not. */
export function clientDeleteError(code: string | undefined, message: string | undefined): { status: number; message: string } {
  if (code === "42501") return { status: 403, message: "Only the Owner can delete clients, and you need to have entered your two-factor code." };
  if (code === "22023") return { status: 409, message: message || "That client cannot be deleted." };
  if (code === "P0002") return { status: 404, message: message || "That client no longer exists." };
  return { status: 500, message: "Something went wrong. Try again." };
}

/** Deleting asks for the client's name, so it cannot be done by a stray click. Case and extra spaces do not matter. */
export const deleteConfirmationMatches = (clientName: string, typed: string): boolean => {
  const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(clientName) !== "" && norm(clientName) === norm(typed);
};
