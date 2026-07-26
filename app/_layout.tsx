/**
 * ROOT LAYOUT
 * Simplified provider hierarchy and app navigation
 */

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { AchievementCelebration } from "@/components/AchievementCelebration";
import { AuthWrapper } from "@/components/AuthWrapper";
import { IntroRevealProvider } from "@/components/motion/IntroReveal";
import { NotificationActionRunner } from "@/components/notifications/NotificationActionRunner";
import { ProactiveDeliveryRunner } from "@/components/notifications/ProactiveDeliveryRunner";
import { SupabaseAuthProvider, useAuth } from "@/components/SupabaseAuthProvider";
import { CustomThemeProvider, useTheme } from "@/components/ThemeContext";
import { Colors } from "@/constants/theme";
import { ensureDietLibraryLoaded } from "@/constants/DietDatabase";
import { ensureFoodDictionaryLoaded } from "@/constants/FoodDictionary";
import { ensureWorkoutExercisesLoaded } from "@/services/WorkoutGenerator";
import { initNotifications } from "@/services/notifications/init";
import { AppProvider } from "@/contexts/AppContext";
import { HabitsProvider } from "@/contexts/HabitsContext";
import { MealPlanProvider } from "@/contexts/MealPlanContext";

// Suppress keep-awake warnings in dev
if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("keep awake") || args[0].includes("Keep Awake"))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

function RootLayoutContent() {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  // Warm up the lazy-loaded diet/food catalogs (Phase D — bundle trim) after
  // first paint, so their heavy generated module stays off the synchronous
  // cold-start path but is ready before the diet/food/logging flows read it.
  // Fire-and-forget + memoized, so this never blocks and never double-loads.
  useEffect(() => {
    void ensureDietLibraryLoaded();
    void ensureFoodDictionaryLoaded();
    void ensureWorkoutExercisesLoaded();
    // Set the foreground handler + Android reminders channel once, so scheduled
    // habit/fitness reminders present correctly in a release build. Fail-soft.
    initNotifications();
  }, []);

  // Match the navigator's base background to the ambient canvas so screen
  // transitions never flash white/black behind the gradient.
  const base = currentTheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: Colors[currentTheme].background },
  };

  return (
    <ThemeProvider value={navTheme}>
      {/*
       * Re-key the whole data-provider subtree on the account. When the signed-in
       * user changes (A signs out, B signs in) every provider remounts fresh, so
       * one account's in-memory state can never linger into another's session.
       * Keyed on the STABLE user id (not the session object) so a token refresh
       * doesn't needlessly remount.
       */}
      <AppProvider key={user?.id ?? "signed-out"}>
        {/* Composes over AppContext — reads its clock, owns plan periods,
            custom menus, food logging and tracking mode. */}
        <MealPlanProvider>
        <HabitsProvider>
        <AuthWrapper>
          <IntroRevealProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="knows" />
            <Stack.Screen name="memory-center" />
            <Stack.Screen name="life" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="story/[id]" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="verify-email" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="notifications-setup" />
            <Stack.Screen name="exercise/[id]" />
            <Stack.Screen name="fitness/library" />
            <Stack.Screen name="fitness/workout/[id]" />
            <Stack.Screen name="fitness/progress" />
            <Stack.Screen name="fitness/calendar" />
            <Stack.Screen name="fitness/setup" options={{ presentation: "modal" }} />
            <Stack.Screen name="fitness/settings" />
            <Stack.Screen
              name="guided-session"
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen name="session-summary" />
            <Stack.Screen name="habits" />
            <Stack.Screen name="foods" />
            <Stack.Screen name="habit/[id]" />
            <Stack.Screen name="habit/new" options={{ presentation: "modal" }} />
            <Stack.Screen name="gozlin" options={{ presentation: "modal" }} />
            <Stack.Screen name="new-chapter" options={{ presentation: "modal" }} />
            <Stack.Screen name="recap/[period]" options={{ presentation: "modal" }} />
            {/* Flexible meal planning */}
            <Stack.Screen name="diet/plan-menu" />
            <Stack.Screen name="diet/history" />
            <Stack.Screen name="diet/log-food" options={{ presentation: "modal" }} />
            <Stack.Screen name="diet/report/[periodId]" options={{ presentation: "modal" }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <AchievementCelebration />
          <ProactiveDeliveryRunner />
          {/* Closes the loop on delivered notifications: "Mark as Done",
              "Later", and tap-to-route. Headless. */}
          <NotificationActionRunner />
          <StatusBar style={currentTheme === "dark" ? "light" : "dark"} />
          </IntroRevealProvider>
        </AuthWrapper>
        </HabitsProvider>
        </MealPlanProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (Platform.OS === "android") {
      const originalError = console.error;
      console.error = (...args) => {
        if (typeof args[0] === "string" && args[0].includes("keep awake")) {
          return;
        }
        originalError(...args);
      };
    }
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    // Root gesture context — required for the interactive charts' pan-to-scrub
    // (and any future gesture-handler surfaces) to receive touches.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SupabaseAuthProvider>
        <CustomThemeProvider>
          <RootLayoutContent />
        </CustomThemeProvider>
      </SupabaseAuthProvider>
    </GestureHandlerRootView>
  );
}
