/** Patterns the Control center checks in many places, kept in one spot so they cannot drift apart. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** An address AdFlo will actually send to: one @, a dot after it, a real ending, and no angle brackets that could add headers. */
export const SENDABLE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
