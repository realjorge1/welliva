/**
 * services/notifications/owner.ts
 *
 * WHOSE REMINDER IS THIS? — the account guard for lock-screen writes.
 *
 * A notification can outlive the session that scheduled it. It sits on a lock
 * screen through a sign-out; a repeating trigger keeps firing if a cancel was
 * missed; a meal reminder names a SLOT, not a meal, so a leftover one pressed
 * after a different person signs in would tick THEIR lunch. None of that can be
 * checked by React — the button may be pressed with no React tree at all — so
 * the guard reads the one fact that is always on disk: which account's data this
 * device currently holds (services/sync/UserScope, claimed at every signed-in
 * boot).
 *
 * The rule:
 *   · nobody owns the device's data (signed out and purged) → never write
 *   · the notification names an owner (`data.uid`) → it must be that owner
 *   · an older notification with no owner stamp → allowed while SOMEONE owns
 *     the device (it was scheduled on this install, by this install's user)
 *
 * Only AsyncStorage is touched — never SecureStore — because iOS keychain items
 * are unreadable while the phone is locked, and locked is exactly when these
 * buttons get pressed.
 */
import { getActiveUserId } from "../sync/UserScope";

/** The account this device's data belongs to, or null when nobody's does. */
export function notificationOwner(): Promise<string | null> {
  return getActiveUserId();
}

/**
 * The owner stamp every scheduled reminder carries. Empty when the owner isn't
 * known yet (first boot before the claim lands) — such a reminder falls under
 * the "no stamp" rule above rather than being skipped.
 */
export async function ownerStamp(): Promise<{ uid?: string }> {
  const uid = await notificationOwner();
  return uid ? { uid } : {};
}

/** May a response carrying `data` write into this device's data? */
export async function mayWriteFor(data: Record<string, unknown>): Promise<boolean> {
  const owner = await notificationOwner();
  if (!owner) return false;
  const stamped = typeof data.uid === "string" && data.uid ? data.uid : null;
  return stamped === null || stamped === owner;
}
