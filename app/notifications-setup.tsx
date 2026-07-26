/**
 * NOTIFICATIONS SETUP — the permission ask, as a screen.
 *
 * Shown once, right after onboarding completes (`?from=onboarding`), and
 * reachable any time from Settings → Reminders. Asking here rather than at cold
 * boot means the user has already seen what Welliva does before deciding whether
 * to let it speak.
 *
 * Marking it seen is what makes it once-only; the flag is set on the way out
 * whatever the user chose, because a "Not now" that re-asks on every launch is
 * the fastest way to earn a permanent "Don't Allow".
 */
import { NotificationPrimer } from "@/components/notifications/NotificationPrimer";
import { Screen } from "@/components/ui";
import { markNotificationPrimerSeen } from "@/services/notifications/primer";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback } from "react";

export default function NotificationsSetupScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();

  const handleDone = useCallback(() => {
    void markNotificationPrimerSeen();
    // Coming out of onboarding there is no sane screen to go "back" to.
    if (from === "onboarding") router.replace("/(tabs)" as never);
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as never);
  }, [from]);

  return (
    <Screen scroll={false} contentStyle={{ flex: 1 }}>
      <NotificationPrimer
        onDone={handleDone}
        skipLabel={from === "onboarding" ? "Maybe later" : "Not now"}
      />
    </Screen>
  );
}
