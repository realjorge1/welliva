/**
 * TABS LAYOUT — four REAL routes: Home, Diet, Fitness, More.
 *
 * WHAT THIS REPLACED, AND WHY. The tabs used to be local state: one route that
 * mounted all five screens and toggled `display: none`, with `<Freeze>` around
 * the inactive ones. The `<Freeze>` instinct was right — it's what stopped four
 * hidden screens re-rendering on every AppContext change. The underlying choice
 * cost three things that only real routes give you:
 *
 *  · ANDROID BACK did nothing between tabs. No BackHandler existed anywhere, so
 *    back either exited the app or felt broken. Play's quality guidelines flag
 *    it, and users read it as a bug.
 *  · ALL FIVE SCREENS were resident at once — including a 2,900-line Diet screen
 *    and Profile — which is real memory pressure on a low-end Android.
 *  · A STALE-PARAM DEAD LINK: navigation went through `/(tabs)?tab=profile`, so
 *    after switching tabs by hand the param hadn't changed, the effect watching
 *    it didn't re-fire, and tapping the same link again did nothing.
 *
 * React Navigation gives back the freeze behaviour declaratively (`freezeOnBlur`
 * is react-freeze underneath — the same dependency, already in package.json) and
 * adds back navigation, deep links (welliva://exercise), typed routes and state
 * restoration across cold starts.
 *
 * ROUTE NAMES ARE NOW LOAD-BEARING IDENTIFIERS. `NAV_ITEMS` ids were
 * home|meal|fitness|more while the files were index|diet|exercise|more. Rather
 * than map through a second alias table — one more place for the two to drift —
 * the ids ARE the route names and `label` carries the display string.
 *
 * Profile is no longer here: it was in the screen list but not in the nav bar,
 * reachable only by that param. It isn't a tab, it's a pushed screen, and it
 * lives at `/profile`.
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { CustomBottomNav, NAV_ITEMS } from "@/components/CustomBottomNav";
import { useTheme } from "@/components/ThemeContext";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  const { isDarkMode } = useTheme();

  return (
    <Tabs
      // ANDROID BACK. The reason this whole file changed shape: with local
      // state, back between tabs did nothing (no BackHandler existed anywhere)
      // and users read that as broken. "history" retraces the tabs you actually
      // visited, which is what the gesture means to a person.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        // Exactly what <Freeze freeze={!isActive}> was doing by hand — but
        // declarative, and it composes correctly with navigation state.
        freezeOnBlur: true,
        // Each tab's own <Screen> paints an opaque full-bleed gradient, so the
        // navigator's own background is pure overdraw on the most-used screen.
        sceneStyle: { backgroundColor: "transparent" },
      }}
      // The custom nav bar is preserved verbatim — this is the whole point.
      // React Navigation owns WHICH tab is active; the bar only draws it.
      tabBar={({ state, navigation }) => (
        <CustomBottomNav
          items={NAV_ITEMS}
          activeTab={state.routes[state.index]?.name ?? "index"}
          onTabPress={(id) => navigation.navigate(id)}
          isDarkMode={isDarkMode}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="diet" options={{ title: "Diet" }} />
      <Tabs.Screen name="exercise" options={{ title: "Fitness" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}

/**
 * Tab-shell boundary. Each tab ALSO exports its own route-level `ErrorBoundary`
 * (level 3), which contains a crash inside one screen and leaves the nav bar
 * working; this one catches anything thrown by the navigator itself, so a broken
 * shell still doesn't have to reach the root boundary.
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
