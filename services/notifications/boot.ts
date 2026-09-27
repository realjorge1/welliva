/**
 * services/notifications/boot.ts
 *
 * Imported for its side effects by the app entry (/index.js), BEFORE
 * expo-router loads — which is the whole point:
 *
 *   · Android can boot the JS bundle headless to deliver a lock-screen press to
 *     a background task. Headless means nothing renders, so the task has to be
 *     defined here, at module scope, or it never exists.
 *   · iOS launches a killed app in the background to deliver a press and gives
 *     it only seconds. The response listener is installed here, before fonts,
 *     auth and the provider tree, so the write happens inside that window.
 *
 * Nothing here waits on React, and everything is idempotent — the root layout
 * calls {@link installNotificationResponseHandling} again, harmlessly.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { defineNotificationTask, registerNotificationTask } from "./backgroundTask";
import { initNotifications } from "./init";
import { HANDLED_KEY, processNotificationResponse } from "./pipeline";

/** The pre-pipeline dedupe key (one response). Folded into the ledger once. */
const LEGACY_HANDLED_KEY = "@welliva_notif_last_response";

let installed = false;

async function migrateLegacyHandledKey(): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_HANDLED_KEY);
    if (!legacy) return;
    const raw = await AsyncStorage.getItem(HANDLED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    const keys = Array.isArray(list) ? list : [];
    if (!keys.includes(legacy)) {
      await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([legacy, ...keys].slice(0, 64)));
    }
    await AsyncStorage.removeItem(LEGACY_HANDLED_KEY);
  } catch {
    // worst case: the last pre-upgrade response is offered once more, and every
    // action it could trigger is idempotent or already recorded
  }
}

/**
 * Start listening for notification responses — live, and the one that launched
 * the app. Idempotent.
 */
export function installNotificationResponseHandling(): void {
  if (installed) return;
  installed = true;

  // The legacy key must be folded in BEFORE the cold replay reads the ledger,
  // or the last pre-upgrade press would be applied a second time.
  const ready = migrateLegacyHandledKey();

  try {
    Notifications.addNotificationResponseReceivedListener((response) => {
      void ready.then(() => processNotificationResponse(response, "listener"));
    });
  } catch {
    // no native module — reminders simply won't be interactive
  }

  void ready.then(async () => {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) await processNotificationResponse(last, "cold");
    } catch {
      // nothing to replay
    }
  });
}

// ── module-scope side effects ───────────────────────────────────────
initNotifications();
defineNotificationTask();
void registerNotificationTask();
installNotificationResponseHandling();
