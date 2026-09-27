/**
 * services/notifications/backgroundTask.ts
 *
 * THE KILLED-APP PATH (Android).
 *
 * When the app is not running at all and the user presses "Mark as Done" on a
 * lock-screen reminder, Android does not start the React Native app — so no
 * listener exists to receive the press, and before this module the press was
 * simply lost: the banner went away, the habit stayed undone. What Android DOES
 * do is run every task registered through `Notifications.registerTaskAsync`,
 * booting the JS bundle headless via expo-task-manager. This is that task.
 *
 * It must be DEFINED at module scope of a module the entry file imports (here,
 * through ./boot from /index.js): in a headless launch nothing renders, so a
 * definition inside a component or a route file would never run.
 *
 * iOS never runs this task for a button press — Apple doesn't offer it. iOS
 * instead launches the app in the background and delivers the press to the
 * listener, which ./boot installs at module scope for exactly that reason.
 *
 * The task also fires for incoming remote pushes; the pipeline ignores anything
 * that isn't a response.
 */
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { processNotificationResponse } from "./pipeline";

export const NOTIFICATION_RESPONSE_TASK = "welliva.notification-response";

let defined = false;

/** Define the task. Idempotent; must run at module scope, before registration. */
export function defineNotificationTask(): void {
  if (defined) return;
  defined = true;
  try {
    TaskManager.defineTask(NOTIFICATION_RESPONSE_TASK, async ({ data, error }) => {
      if (error || !data) return;
      // Awaited: the headless runtime stays alive until the write has landed.
      await processNotificationResponse(data, "task");
    });
  } catch {
    // expo-task-manager unavailable (Expo Go / web) — the listener still works
    // whenever the app is running.
  }
}

/** Register the task with the OS. Android only; idempotent across launches. */
export async function registerNotificationTask(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.registerTaskAsync(NOTIFICATION_RESPONSE_TASK);
  } catch {
    // no native module in this build — degrade to listener-only handling
  }
}
