/**
 * health-os/signals/types.ts — shared vocabulary for external senses.
 */

/** OS permission state for a signal source, plus "unavailable" (module not in this build). */
export type SignalPermission = "granted" | "denied" | "undetermined" | "unavailable";

/** A source is "ready" only when its module is present AND permission is granted. */
export interface SignalStatus {
  permission: SignalPermission;
  ready: boolean;
}
