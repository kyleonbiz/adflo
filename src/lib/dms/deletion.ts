/** How long a closed workspace is kept before it is erased, so an owner can change their mind. Must match the nightly job's grace period. */
export const DELETION_GRACE_DAYS = 30;

const DAY_MS = 86_400_000;

/** When a workspace whose deletion was requested at `requestedAt` (an ISO time) will be erased. */
export const deletionDate = (requestedAt: string): string => new Date(Date.parse(requestedAt) + DELETION_GRACE_DAYS * DAY_MS).toISOString();

/** Whole days left before erasure, never below zero. */
export const deletionDaysLeft = (requestedAt: string, now = Date.now()): number =>
  Math.max(0, Math.ceil((Date.parse(requestedAt) + DELETION_GRACE_DAYS * DAY_MS - now) / DAY_MS));

export interface DeletionStatus {
  /** ISO time the workspace will be erased, or null when nothing is scheduled. */
  scheduledFor: string | null;
  daysLeft: number;
  graceDays: number;
}
