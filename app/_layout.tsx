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
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { AchievementCelebration } from "@/components/AchievementCelebration";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthWrapper } from "@/components/AuthWrapper";
import { LegalGateProvider } from "@/components/legal";
import { IntroRevealProvider } from "@/components/motion/IntroReveal";
import { AppDrawer } from "@/components/navigation";
import { NotificationActionRunner } from "@/components/notifications/NotificationActionRunner";
import { ProactiveDeliveryRunner } from "@/components/notifications/ProactiveDeliveryRunner";
import { SupabaseAuthProvider, useAuth } from "@/components/SupabaseAuthProvider";
import { CustomThemeProvider, useTheme } from "@/components/ThemeContext";
import { Colors } from "@/constants/theme";
import { ensureDietLibraryLoaded } from "@/constants/DietDatabase";
import { ensureFoodDictionaryLoaded } from "@/constants/FoodDictionary";
import { ensureWorkoutExercisesLoaded } from "@/services/WorkoutGenerator";
import { installBackendWarmup } from "@/services/api/warmup";
import { initNotifications } from "@/services/notifications/init";
import { refreshFitnessReminders } from "@/fitness/services/FitnessNotifications";
import { useDataEpoch } from "@/services/sync/dataEpoch";
import { installNetworkProbe } from "@/services/sync/networkProbe";
import { setRetentionCompactor } from "@/services/sync/retention";
import { memory } from "@/health-os";
import { AppProvider } from "@/contexts/AppContext";
import { BillingProvider } from "@/contexts/BillingContext";
import { HabitsProvider } from "@/contexts/HabitsContext";
import { MealPlanProvider } from "@/contexts/MealPlanContext";

/*
 * Hold the NATIVE splash until we know who the user is.
 *
 * expo-splash-screen was configured in app.json and never controlled, so it
 * auto-hid the moment the JS bundle loaded — revealing `if (!loaded) return
 * null` as a blank frame, and then whatever route expo-router restored, before
 * the auth gate had an answer. Module scope on purpose: this must run before the
 * first render, not in an effect.
 *
 * `.catch()` because the call rejects harmlessly if the splash is already gone
 * (fast refresh, or a re-import) — it must never take the app down with it.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

/*
 * Cold-start stopwatch (dev only). Heavy catalogs log their evaluation time
 * against this stamp — see constants/ExerciseDatabase.ts. If one of those logs
 * appears before you navigate to the screen that needs it, `inlineRequires`
 * (metro.config.js) isn't deferring that module and it's back on the cold-start
 * path. Costs nothing in release: the whole block is stripped when __DEV__ is false.
 */
if (__DEV__) {
  (globalThis as { __APP_START__?: number }).__APP_START__ ??= Date.now();
}

/*
 * Teach the sync engine what "offline" means. Until this runs the engine
 * assumes it's online (its safe default), so installing it at module scope —
 * before the first flush can be scheduled — is what stops an offline device
 * burning retries on fetches that cannot land.
 */
installNetworkProbe();

/*
 * Let retention compact a day into the health-os summaries BEFORE it prunes the
 * raw logs. Injected rather than imported by the leaf services that prune, so
 * FoodLogService doesn't have to reach into the health-os module graph.
 */
setRetentionCompactor((date) => memory.compactDayIfPresent(date));

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
  const { user, isLoading: authLoading } = useAuth();
  // Bumped by "Reset data" once the wipe has landed — see the provider key below.
  const dataEpoch = useDataEpoch();

  // Drop the native splash only once the session is restored. Fonts are already
  // guaranteed — RootLayout doesn't render this component until they've loaded.
  // Until then the splash covers everything, so there is no blank frame and no
  // glimpse of a route the auth gate is about to redirect away from.
  useEffect(() => {
    if (!authLoading) void SplashScreen.hideAsync().catch(() => {});
  }, [authLoading]);

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
    // Re-derive the fitness reminder schedule from the stored profile. A
    // schedule can go missing between launches — permission granted in OS
    // Settings after opting in, an OS-cleared queue, a restore that brought
    // storage back but not the pending notifications — and this repairs it.
    // Idempotent (it cancels its own ids first) and a no-op when nothing is on.
    void refreshFitnessReminders();
    // Wake the backend now (and on every foreground) so its 30-50s cold start
    // has already happened by the time someone opens the coach. Fire-and-forget.
    return installBackendWarmup();
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
       *
       * The data epoch rides the same key for the same reason: "Reset data"
       * empties storage, but every provider loads exactly once on mount — so
       * without a remount the wiped data simply stays in memory, and gets
       * written straight back on the next edit. See services/sync/dataEpoch.ts.
       */}
      {/*
       * Billing sits ABOVE the account re-key on purpose. It has to survive an
       * account switch to run its own logIn/logOut transfer (a purchase must
       * follow the account, not the device), and re-keying it would reconfigure
       * the RevenueCat SDK on every switch — which it explicitly guards against.
       */}
      <BillingProvider>
      <AppProvider key={`${user?.id ?? "signed-out"}:${dataEpoch}`}>
        {/* Composes over AppContext — reads its clock, owns plan periods,
            custom menus, food logging and tracking mode. */}
        <MealPlanProvider>
        <HabitsProvider>
        {/* Owns "has this account accepted the current policies?". Sits above
            AuthWrapper because the answer is a routing decision, and inside
            AppProvider because it waits on the login-time profile reconcile. */}
        <LegalGateProvider>
        <AuthWrapper>
          <IntroRevealProvider>
          {/*
           * LEVEL 2 — navigation. Catches a crash while a screen mounts or
           * renders, so a bad route drops to a recoverable screen instead of
           * taking the providers (and every unsaved bit of in-memory state)
           * down with it. Level 1 is the root boundary in RootLayout below;
           * level 3 is each route's own `export function ErrorBoundary`.
           */}
          <AppErrorBoundary surface="navigation">
          {/*
           * THE SWIPE MENU wraps the whole navigator, not a screen inside it —
           * that's what lets the app itself be the thing that slides. Everything
           * below is drawn on the moving surface; the panel sits behind it.
           *
           * It sits INSIDE the auth gate on purpose: the menu header reads the
           * signed-in account, and the sign-in / onboarding / consent routes it
           * also technically contains are excluded from the gesture by
           * SWIPEABLE_PATHS and simply don't render a hamburger.
           */}
          <AppDrawer>
          <Stack screenOptions={{ headerShown: false }}>
            {/* The root shell: Home, Diet, Fitness, Gozlin, Habits, Logs,
                Trust, Foods, Knows, Settings, Profile — every menu
                destination, switched without a push. See (tabs)/_layout. */}
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="memory-center" />
            <Stack.Screen name="life" />
            <Stack.Screen name="story/[id]" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="verify-email" />
            <Stack.Screen name="onboarding" />
            {/* Legal. The consent gate can't be swiped away — it's the one
                screen a signed-in user must answer before the app opens. */}
            <Stack.Screen name="legal/consent" options={{ gestureEnabled: false }} />
            <Stack.Screen name="legal/[doc]" />
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
            <Stack.Screen name="habit/[id]" />
            <Stack.Screen name="habit/new" options={{ presentation: "modal" }} />
            {/* The purchase surface is `/upgrade`, a menu destination inside
                (tabs) — not a modal stacked over whatever you were doing. A lock
                navigates there; the menu is always one tap away, so the ask can
                never trap the user. */}
            <Stack.Screen name="new-chapter" options={{ presentation: "modal" }} />
            {/* Flexible meal planning */}
            <Stack.Screen name="diet/plan-menu" />
            <Stack.Screen name="diet/history" />
            <Stack.Screen name="diet/log-food" options={{ presentation: "modal" }} />
            <Stack.Screen name="diet/report/[periodId]" options={{ presentation: "modal" }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          </AppDrawer>
          </AppErrorBoundary>
          <AchievementCelebration />
          <ProactiveDeliveryRunner />
          {/* Closes the loop on delivered notifications: "Mark as Done",
              "Later", and tap-to-route. Headless. */}
          <NotificationActionRunner />
          <StatusBar style={currentTheme === "dark" ? "light" : "dark"} />
          </IntroRevealProvider>
        </AuthWrapper>
        </LegalGateProvider>
        </HabitsProvider>
        </MealPlanProvider>
      </AppProvider>
      </BillingProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // `error` matters as much as `loaded`: the splash is held open at module scope
  // and is only dropped by RootLayoutContent, which never mounts while we return
  // null here. So a font that fails to load would otherwise strand the user on
  // the splash forever. Booting without the custom font is the correct
  // degradation — RN falls back to the system face.
  const [loaded, error] = useFonts({
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

  if (!loaded && !error) {
    return null;
  }

  return (
    // Root gesture context — required for the interactive charts' pan-to-scrub
    // (and any future gesture-handler surfaces) to receive touches.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/*
       * LEVEL 1 — root. Sits ABOVE every provider, so a crash inside auth, theme
       * or the data contexts themselves still lands on a screen with a way out
       * instead of a white void. Its fallback deliberately reads no context (see
       * AppErrorBoundary's header) — a themed fallback would crash right here.
       */}
      <AppErrorBoundary surface="root">
        <SupabaseAuthProvider>
          <CustomThemeProvider>
            <RootLayoutContent />
          </CustomThemeProvider>
        </SupabaseAuthProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
