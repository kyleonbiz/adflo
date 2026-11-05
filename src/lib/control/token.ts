import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** A new secret for an agreement link: 256 random bits, URL-safe (43 characters). */
export const newToken = () => randomBytes(32).toString("base64url");
/** Only this hash is stored; the database never sees the secret. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
