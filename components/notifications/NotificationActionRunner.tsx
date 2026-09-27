/**
 * NotificationActionRunner — the React end of notification responses.
 *
 * Headless; mounted once in the root layout. The responses themselves are NOT
 * handled here any more — they are handled by services/notifications/pipeline,
 * which the app entry installs at module scope before React exists. That move
 * is what makes a lock-screen press work when there is no React tree: a killed
 * Android app delivers it to a headless background task, and a killed iOS app
 * gets a few background seconds that a listener mounted behind fonts, auth and
 * the provider tree would miss.
 *
 * What is left needs React, so it lives here:
 *
 *   • NAVIGATION for a plain tap. The pipeline records where the notification
 *     wants to go (`data.route`); this runner follows it once someone is signed
 *     in and the auth gate has settled — so a tap that cold-launched the app
 *     lands on its screen instead of being swallowed by the splash or bounced by
 *     the sign-in redirect.
 *   • A HAPTIC when a press is applied while the app is on screen. From the lock
 *     screen the OS gives its own feedback; in the foreground the app should.
 *   • The widget bridge's native host (the only place allowed to touch
 *     NativeModules for widgets).
 */
import { useAuth } from "@/components/SupabaseAuthProvider";
import { installNotificationResponseHandling } from "@/services/notifications/boot";
import {
  subscribePipelineOutcomes,
  subscribeRouteIntents,
} from "@/services/notifications/pipeline";
import { setWidgetHost } from "@/services/notifications/widgets";
import * as Haptics from "@/utils/haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState, NativeModules } from "react-native";

/** Optional native module that can force home-screen widgets to redraw. */
const WIDGET_NATIVE_MODULE = "WellivaWidgets";

/**
 * How long after the auth gate settles before following a tap. The gate's own
 * redirect (sign-in → tabs, consent) lands in the same tick; pushing inside it
 * would be overwritten by it.
 */
const SETTLE_MS = 450;

export function NotificationActionRunner() {
  const { user, isLoading } = useAuth();
  const ready = !!user && !isLoading;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const pendingRoute = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idempotent — the entry already did this. Kept so a build whose entry file
  // was swapped out still handles responses.
  useEffect(() => {
    installNotificationResponseHandling();
  }, []);

  // Hand the widget bridge its native host, if this build has one.
  useEffect(() => {
    const host = (NativeModules as Record<string, unknown>)[WIDGET_NATIVE_MODULE] as
      | { reload?: () => void | Promise<void> }
      | undefined;
    setWidgetHost(typeof host?.reload === "function" ? { reload: host.reload } : null);
    return () => setWidgetHost(null);
  }, []);

  const flush = useCallback(() => {
    if (!readyRef.current || !pendingRoute.current) return;
    const route = pendingRoute.current;
    pendingRoute.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        router.push(route as never);
      } catch {
        // navigator not ready / unknown route — opening the app is enough
      }
    }, SETTLE_MS);
  }, []);

  // Taps: remember the latest, follow it as soon as we can.
  useEffect(
    () =>
      subscribeRouteIntents((route) => {
        pendingRoute.current = route;
        flush();
      }),
    [flush],
  );

  useEffect(() => {
    if (ready) flush();
  }, [ready, flush]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Foreground feedback for an applied press.
  useEffect(
    () =>
      subscribePipelineOutcomes((o) => {
        if (AppState.currentState !== "active") return;
        if ((o.kind === "habit" || o.kind === "meal" || o.kind === "water") && o.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => {},
          );
        }
      }),
    [],
  );

  return null;
}
