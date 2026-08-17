/**
 * ROOT SHELL — every destination the swipe menu can reach, as one flat
 * navigator with no visible bar.
 *
 * WHAT THIS REPLACED, AND WHY. This was four tabs (Home, Diet, Fitness, More)
 * behind a floating pill nav bar, while Profile, Settings, Habits, Privacy,
 * Foods, Knows and Gozlin were PUSHED screens living at the app root. That split
 * is what the ChatGPT-style menu can't have: a menu that pushes builds a back
 * stack behind itself, so the second destination you pick gets a back arrow
 * instead of a hamburger, and picking a third stacks a third screen on top of
 * two live ones. The menu would be lying about where you are.
 *
 * So every menu destination is now a screen HERE, and the menu switches between
 * them. What that buys, and what it cost:
 *
 *  · NO BACK STACK between destinations. The hamburger is the top-left control
 *    everywhere, always, because there is never anything to go back to.
 *  · `freezeOnBlur` + lazy mounting, for eleven screens instead of four. A
 *    destination you've never opened has never mounted; one you've left stops
 *    re-rendering. This is what makes an eleven-screen shell cheaper than the
 *    old four-tab one plus a stack of pushed screens.
 *  · ANDROID BACK still retraces the destinations you actually visited
 *    (`backBehavior="history"`), which is what the gesture means to a person.
 *  · URLS DIDN'T MOVE. `(tabs)` is a route GROUP — it never appears in a path —
 *    so `app/(tabs)/settings.tsx` is still `/settings`. Every deep link,
 *    notification route and `router.push` in the codebase kept working.
 *
 * ROUTE NAMES ARE LOAD-BEARING IDENTIFIERS. The names below are the ids in
 * components/navigation/menu.ts; the menu's `label` carries the display string,
 * which is why "index" reads "Home" and "exercise" reads "Fitness". One
 * vocabulary, so the highlighted row and the visible screen can't drift.
 *
 * The floating tab bar is gone with the More tab it lived beside — its
 * destinations are menu rows now, and `tabBar` renders nothing.
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      // The menu is the navigation. Returning null (rather than hiding a bar
      // that still lays out) means no bar is measured, mounted or inset for.
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        // Stops a blurred destination re-rendering on every AppContext change —
        // the single most important option in this file now that eleven screens
        // share the navigator.
        freezeOnBlur: true,
        // Each screen paints its own opaque full-bleed gradient, so the
        // navigator's background is pure overdraw.
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      {/* Primary — the menu's main list, in menu order. */}
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="diet" options={{ title: "Diet" }} />
      <Tabs.Screen name="exercise" options={{ title: "Fitness" }} />
      <Tabs.Screen name="gozlin" options={{ title: "Gozlin" }} />
      <Tabs.Screen name="habits" options={{ title: "Habits" }} />
      <Tabs.Screen name="logs" options={{ title: "Logs" }} />
      <Tabs.Screen name="privacy" options={{ title: "Trust" }} />

      {/* Secondary — what the retired More tab used to hold. */}
      <Tabs.Screen name="foods" options={{ title: "Foods" }} />
      <Tabs.Screen name="knows" options={{ title: "Memory" }} />

      {/* Pinned separately in the menu, ordinary screens here. */}
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

/**
 * Shell boundary. Each screen ALSO exports its own route-level `ErrorBoundary`
 * (level 3), which contains a crash inside one screen and leaves the menu
 * working; this one catches anything thrown by the navigator itself.
 */
export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tabs" />;
}
