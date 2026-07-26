/**
 * NotificationActionRunner — the app's single notification RESPONSE handler.
 *
 * Headless; mounted once in the root layout. It closes the loop that scheduling
 * opens: a reminder is delivered, the user acts on it, and something has to
 * happen. Three responses are handled:
 *
 *   • "Mark as Done"  → completes the habit straight in storage (no app UI
 *     needed), dismisses the banner, and lets the live UI reload.
 *   • "Later"         → re-posts the same nudge an hour out, dismisses the banner.
 *   • the tap itself  → follows the notification's `data.route`, which is what
 *     the proactive/health-os notifications have always carried.
 *
 * Two delivery paths, one handler:
 *
 *   1. WARM — `addNotificationResponseReceivedListener`, app alive (foreground or
 *      background).
 *   2. COLD — the app wasn't running, so the response is replayed on launch via
 *      `getLastNotificationResponseAsync`. That replay repeats on EVERY launch
 *      until another notification is actioned, so responses are de-duplicated
 *      against a persisted key; the habit write is idempotent on top of that.
 */
import { useAuth } from "@/components/SupabaseAuthProvider";
import {
  ACTION_MARK_DONE,
  ACTION_SNOOZE,
} from "@/services/notifications/categories";
import { markHabitDoneFromNotification } from "@/services/notifications/habitActions";
import { snoozeReminder } from "@/services/notifications/send";
import { setWidgetHost } from "@/services/notifications/widgets";
import * as Haptics from "@/utils/haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { NativeModules } from "react-native";

/** Last response we acted on, so a cold-start replay isn't applied twice. */
const HANDLED_KEY = "@welliva_notif_last_response";

/** Optional native module that can force home-screen widgets to redraw. */
const WIDGET_NATIVE_MODULE = "WellivaWidgets";

function responseKey(response: Notifications.NotificationResponse): string {
  const { notification, actionIdentifier } = response;
  return `${notification.request.identifier}:${notification.date}:${actionIdentifier}`;
}

async function alreadyHandled(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(HANDLED_KEY)) === key;
  } catch {
    return false;
  }
}

async function rememberHandled(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(HANDLED_KEY, key);
  } catch {
    // fail-soft: worst case an idempotent action is re-applied
  }
}

/** Remove the banner/lock-screen entry once its action has been taken. */
async function dismiss(identifier: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // already gone
  }
}

async function handleResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const { notification, actionIdentifier } = response;
  const { identifier, content } = notification.request;
  const data = (content.data ?? {}) as Record<string, unknown>;

  switch (actionIdentifier) {
    case ACTION_MARK_DONE: {
      // The Settings demo notification looks real but owns no habit.
      if (data.test === true) {
        await dismiss(identifier);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
        return;
      }
      const habitId = typeof data.habitId === "string" ? data.habitId : null;
      if (!habitId) return;

      const result = await markHabitDoneFromNotification(
        habitId,
        notification.date,
      );
      await dismiss(identifier);
      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }
      return;
    }

    case ACTION_SNOOZE: {
      await snoozeReminder(
        content.title ?? "Reminder",
        content.body ?? "Still time to keep the ember burning.",
        data,
      );
      await dismiss(identifier);
      return;
    }

    // A plain tap on the notification body.
    case Notifications.DEFAULT_ACTION_IDENTIFIER: {
      const route = typeof data.route === "string" ? data.route : null;
      const habitId = typeof data.habitId === "string" ? data.habitId : null;
      const target = route ?? (habitId ? `/habit/${habitId}` : null);
      if (!target) return;
      try {
        router.push(target as never);
      } catch {
        // navigator not ready / unknown route — opening the app is enough
      }
      return;
    }

    default:
      return;
  }
}

export function NotificationActionRunner() {
  // Responses are account-scoped: they write habit logs, so a reminder actioned
  // while signed out must not land in the next user's data.
  const { user } = useAuth();
  const signedIn = !!user;
  // Responses are applied one at a time. Two buttons tapped in quick succession
  // must both land, so this SERIALIZES rather than dropping the second.
  const chain = useRef<Promise<void>>(Promise.resolve());

  // Hand the widget bridge its native host, if this build has one. This is the
  // only place allowed to touch NativeModules for widgets.
  useEffect(() => {
    const host = (NativeModules as Record<string, unknown>)[WIDGET_NATIVE_MODULE] as
      | { reload?: () => void | Promise<void> }
      | undefined;
    setWidgetHost(typeof host?.reload === "function" ? { reload: host.reload } : null);
    return () => setWidgetHost(null);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;

    const run = (response: Notifications.NotificationResponse): Promise<void> => {
      chain.current = chain.current
        .then(async () => {
          const key = responseKey(response);
          // The cross-launch replay guard: `getLastNotificationResponseAsync`
          // returns the same response on every launch until another is actioned.
          if (await alreadyHandled(key)) return;
          await rememberHandled(key);
          await handleResponse(response);
        })
        .catch(() => {
          // One bad response must not wedge the queue.
        });
      return chain.current;
    };

    // COLD path — the response that launched (or last woke) the app.
    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (alive && last) await run(last);
      } catch {
        // no native module — nothing to replay
      }
    })();

    // WARM path — everything while the app is alive.
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener((r) => {
        void run(r);
      });
    } catch {
      // no native module — reminders simply won't be interactive
    }

    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [signedIn]);

  return null;
}
