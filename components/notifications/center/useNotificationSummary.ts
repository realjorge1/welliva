/**
 * useNotificationSummary — the one-line answer for the Settings row.
 *
 * "On · 9 lined up · next Today, 7:30 PM" is counted off the OS queue, like the
 * Notifications screen itself, and re-read whenever the row could be stale:
 * focus, foreground, and a lock-screen press landing while it's on screen.
 */
import { useReminderPermission } from "@/components/notifications/useReminderPermission";
import { subscribePipelineOutcomes } from "@/services/notifications/pipeline";
import { readPendingQueue, type QueuedNotification } from "@/services/notifications/queue";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { inlineWhen, plural } from "./format";

export function useNotificationSummary() {
  const permission = useReminderPermission();
  const [queue, setQueue] = useState<QueuedNotification[] | null>(null);

  const refresh = useCallback(async () => {
    setQueue(await readPendingQueue());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    const off = subscribePipelineOutcomes(() => void refresh());
    return () => {
      sub.remove();
      off();
    };
  }, [refresh]);

  let subtitle: string;
  switch (permission.status) {
    case "granted": {
      if (!queue) subtitle = "Habits, meals and water — finish them from the lock screen";
      else if (queue.length === 0) subtitle = "On — nothing scheduled yet. Tap to choose";
      else {
        const next = queue.find((q) => q.next);
        subtitle = `${plural(queue.length, "notification")} lined up${
          next?.next ? ` · next ${inlineWhen(next.next)}` : ""
        }`;
      }
      break;
    }
    case "denied":
      subtitle = "Blocked in device settings — tap to fix";
      break;
    case "unavailable":
      subtitle = "Needs the full app build (not Expo Go or web)";
      break;
    default:
      subtitle = "Off — reminders you can finish from the lock screen";
  }

  return { permission, queue, subtitle, refresh };
}
