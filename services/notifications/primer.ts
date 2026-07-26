/**
 * services/notifications/primer.ts
 *
 * Whether the permission primer has been shown. Its own module (rather than a
 * named export on the route) so onboarding can consult it without importing a
 * screen.
 *
 * The flag is set on the way OUT of the primer regardless of the answer: a
 * "Not now" that re-asks on every launch is the fastest way to earn a permanent
 * "Don't Allow" from the OS. Settings keeps a manual route back in.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PRIMER_SEEN_KEY = "@welliva_notif_primer_seen";

/** True once the user has been through the primer (either answer). */
export async function hasSeenNotificationPrimer(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PRIMER_SEEN_KEY)) === "true";
  } catch {
    // If we can't tell, don't nag.
    return true;
  }
}

export async function markNotificationPrimerSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(PRIMER_SEEN_KEY, "true");
  } catch {
    // fail-soft
  }
}
