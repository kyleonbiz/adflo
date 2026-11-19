import type { ClientStatus } from "./types";

/**
 * The on/off switch for a client's account. ON means the client is in service (a trial or active client),
 * OFF means they are not (suspended or cancelled). The four statuses stay in the data, so trials and cancellations
 * keep their own wording; the switch only chooses between in service and not.
 */
export const isAccountOn = (s: ClientStatus): boolean => s === "trial" || s === "active";

/** The status when the switch is turned off. Nothing is deleted. */
const STATUS_WHEN_OFF: ClientStatus = "suspended";

/**
 * The status when the switch is turned on again: back to where the client started if that was in service
 * (a trial turned off and on stays a trial), otherwise active.
 */
const statusWhenOn = (started: ClientStatus): ClientStatus => (isAccountOn(started) ? started : "active");

export const statusAfterSwitch = (started: ClientStatus, on: boolean): ClientStatus => (on ? statusWhenOn(started) : STATUS_WHEN_OFF);
