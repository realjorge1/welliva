/**
 * useReminderPermission — the OS notification permission, as UI state.
 *
 * Distinct from `useNotificationSettings` (which gates the *proactive companion*
 * on a consent category): this is the raw device permission that every local
 * reminder — habits, fitness, proactive alike — depends on. The primer screen and
 * the Settings row both read it.
 *
 * It re-reads on every return to the foreground, because the permission can be
 * changed outside the app (iOS Settings → Notifications) and a status row that
 * still says "Allowed" after the user revoked it is worse than no row at all.
 */
import {
  ensureNotificationCategories,
} from "@/services/notifications/categories";
import { ensureRemindersChannel } from "@/services/notifications/init";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";

export type ReminderPermission =
  | "granted"
  | "denied" // refused, and the OS won't let us ask again
  | "undetermined" // never asked, or askable
  | "unavailable"; // Expo Go / web — no native module

export interface UseReminderPermission {
  loading: boolean;
  status: ReminderPermission;
  granted: boolean;
  /** Prompt (when allowed) and return the resulting status. */
  request: () => Promise<ReminderPermission>;
  refresh: () => Promise<void>;
  /** Deep-link to the OS settings page — the only route once `denied`. */
  openSystemSettings: () => void;
}

function classify(perms: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (perms.granted) return "granted";
  if (perms.canAskAgain === false) return "denied";
  return "undetermined";
}

export function useReminderPermission(): UseReminderPermission {
  const [status, setStatus] = useState<ReminderPermission>("undetermined");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setStatus(classify(await Notifications.getPermissionsAsync()));
    } catch {
      setStatus("unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(async (): Promise<ReminderPermission> => {
    try {
      const current = await Notifications.getPermissionsAsync();
      const next =
        current.granted || current.canAskAgain === false
          ? current
          : await Notifications.requestPermissionsAsync();
      const result = classify(next);
      setStatus(result);
      setLoading(false);
      // Lay down the channel + action categories the moment we're allowed, so
      // the very first reminder already arrives with its buttons.
      if (result === "granted") {
        await ensureRemindersChannel();
        await ensureNotificationCategories();
      }
      return result;
    } catch {
      setStatus("unavailable");
      setLoading(false);
      return "unavailable";
    }
  }, []);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings().catch(() => {});
  }, []);

  return {
    loading,
    status,
    granted: status === "granted",
    request,
    refresh,
    openSystemSettings,
  };
}
