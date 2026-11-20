/** Database messages written for the Owner (SQLSTATE 22023, P0002) are safe to show; anything else is not. */
export function agreementDeleteError(code: string | undefined, message: string | undefined): { status: number; message: string } {
  if (code === "42501") return { status: 403, message: "Only the Owner can delete agreements, and you need to have entered your two-factor code." };
  if (code === "22023") return { status: 409, message: message || "That agreement cannot be deleted." };
  if (code === "P0002") return { status: 404, message: message || "That agreement no longer exists." };
  return { status: 500, message: "Something went wrong. Try again." };
}

/** Same for editing a published version before anyone has accepted it. */
export function agreementEditError(code: string | undefined, message: string | undefined): { status: number; message: string } {
  if (code === "42501") return { status: 403, message: "Only the Owner can edit agreements, and you need to have entered your two-factor code." };
  if (code === "22023") return { status: 409, message: message || "That agreement cannot be edited." };
  if (code === "P0002") return { status: 404, message: message || "That agreement no longer exists." };
  return { status: 500, message: "Something went wrong. Try again." };
}

/** Same for withdrawing an agreement from one client (Support and the Owner may). */
export function sentAgreementDeleteError(code: string | undefined, message: string | undefined): { status: number; message: string } {
  if (code === "42501") return { status: 403, message: "Your role cannot do this, or you have not entered your two-factor code." };
  if (code === "22023") return { status: 409, message: message || "That agreement cannot be deleted." };
  if (code === "P0002") return { status: 404, message: message || "That agreement is no longer on this client." };
  return { status: 500, message: "Something went wrong. Try again." };
}
