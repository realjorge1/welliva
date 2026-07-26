/**
 * TABS LAYOUT
 * 4-tab navigation: Home, Diet, Exercise, More (Profile lives behind More)
 */

import { CustomBottomNav, NAV_ITEMS } from "@/components/CustomBottomNav";
import { useTheme } from "@/components/ThemeContext";
import { Colors } from "@/constants/theme";
import { useGlobalSearchParams } from "expo-router";
import { Freeze } from "react-freeze";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

// Import screens
import DietScreen from "./diet";
import ExerciseScreen from "./exercise";
import HomeScreen from "./index";
import MoreScreen from "./more";
import ProfileScreen from "./profile";

export default function TabLayout() {
  // The tabs are local state, not routes — so other screens (e.g. the session
  // summary's "Back to Fitness") select a tab by navigating to `/(tabs)` with a
  // `tab` param, which this layout honors. Read globally so it updates even
  // though this root layout is always mounted underneath the pushed screen.
  const { tab } = useGlobalSearchParams<{ tab?: string }>();
  const tabParam = Array.isArray(tab) ? tab[0] : tab;

  const [activeTab, setActiveTab] = useState(tabParam ?? "home");
  const { currentTheme, isDarkMode } = useTheme();
  const colors = Colors[currentTheme];

  // Honor an incoming tab request (deep-link / cross-screen navigation).
  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  const handleTabPress = (tabId: string) => {
    setActiveTab(tabId);
  };

  // All four tab screens stay MOUNTED; we only toggle visibility. Previously
  // this used a switch that unmounted the inactive screens, wiping their local
  // component state on every tab change. Keeping them mounted preserves state
  // (scroll position, filters, in-flight UI) across tab switches.
  //
  // PERF: each screen subscribes to AppContext, so any state change (logging
  // water, toggling a meal…) used to re-render ALL FOUR screens — including the
  // hidden ones with their heavy achievement grids and animated SVG rings.
  // `<Freeze>` suspends re-rendering of the inactive tabs while keeping them
  // mounted, so only the visible screen reconciles. A tab also mounts lazily
  // (on first visit) and stays mounted thereafter.
  // "profile" stays mounted-lazy but is no longer a nav item — the More tab
  // reaches it via `/(tabs)?tab=profile` (same deep-link path other screens use).
  const TABS: { id: string; Screen: React.ComponentType }[] = [
    { id: "home", Screen: HomeScreen },
    { id: "meal", Screen: DietScreen },
    { id: "fitness", Screen: ExerciseScreen },
    { id: "more", Screen: MoreScreen },
    { id: "profile", Screen: ProfileScreen },
  ];

  return (
    // No ambient gradient here on purpose: every tab's <Screen> already paints
    // its own opaque full-bleed gradient over this surface, so a gradient on the
    // layout would be 100% occluded — pure overdraw on the most-used screen.
    // A flat background color is the cheap backstop behind lazy first mounts.
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {TABS.map(({ id, Screen }) => {
          const isActive = activeTab === id;
          return (
            <View
              key={id}
              style={[styles.screen, { display: isActive ? "flex" : "none" }]}
            >
              <Freeze freeze={!isActive}>
                <Screen />
              </Freeze>
            </View>
          );
        })}
      </View>

      <CustomBottomNav
        items={NAV_ITEMS}
        activeTab={activeTab}
        onTabPress={handleTabPress}
        isDarkMode={isDarkMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
});
