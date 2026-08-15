/**
 * APP ERROR BOUNDARY — the difference between "something broke" and a white
 * screen the user can only escape by force-quitting.
 *
 * WHY THIS EXISTS. React unmounts the entire tree when a render throws and
 * nothing catches it. In a screen-per-tab app that means one bad `.map()` over
 * unexpected data — a half-written log, a shape from an older schema version, a
 * null the type system promised couldn't happen — takes the whole app down with
 * no recovery path. This is the cheapest insurance in the codebase, and it
 * exists BEFORE the storage/state/math work it's insuring.
 *
 * THREE LEVELS, deliberately (see app/_layout.tsx):
 *   root       — above every provider. Catches provider crashes themselves.
 *   navigation — around the <Stack>. Catches routing/screen-mount crashes.
 *   tab:<name> — around each tab body. Contains the blast radius so a broken
 *                Diet screen leaves Home, Fitness and More usable.
 * A deeper boundary always wins, so most crashes never reach the root.
 *
 * NO CONTEXT, ON PURPOSE. The fallback below reads NOTHING from React context —
 * no ThemeContext, no AppContext, no useColors. The root boundary sits ABOVE
 * CustomThemeProvider, and `useTheme()` throws without its provider
 * (ThemeContext.tsx:163), so a themed fallback would crash while rendering the
 * crash screen. Colors come from `Appearance` + the raw token table instead.
 */
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Appearance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useGlobalSearchParams } from "expo-router";

import {
  Colors,
  FORCED_COLOR_SCHEME,
  LIGHT_MODE_ENABLED,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { reportCrash } from "@/services/telemetry/CrashLog";
import { fullPushSweep } from "@/services/sync/SyncEngine";
import { getActiveUserId, purgeAppData } from "@/services/sync/UserScope";

interface Props {
  children: React.ReactNode;
  /** Changing this remounts the subtree — use to auto-recover on navigation. */
  resetKey?: string | number;
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
  /** Where the error came from, for telemetry. */
  surface: string;
}

interface State {
  error: Error | null;
  /**
   * How many times the user has pressed "Try again" on this boundary. Survives
   * a re-throw because getDerivedStateFromError returns a PARTIAL state that
   * React merges — which is exactly how we know a retry didn't help, and when
   * to offer the destructive option.
   */
  retries: number;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, retries: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Route to the same fail-soft, device-local telemetry the sync layer uses.
    void reportCrash({
      surface: this.props.surface,
      message: error?.message ?? String(error),
      stack: error?.stack,
      componentStack: info?.componentStack,
    });
  }

  componentDidUpdate(prev: Props) {
    // Auto-clear when the caller signals a new context (e.g. a route change).
    // Without this, navigating away from a broken screen and back would show
    // the error again even though the input that caused it is long gone.
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, retries: 0 });
    }
  }

  private retry = () => {
    // Bump `retries` so a second failure unlocks the last-resort reset. The
    // children unmount while the fallback is up, so this is a true remount:
    // fresh state, fresh effects, fresh reads from storage.
    this.setState((s) => ({ error: null, retries: s.retries + 1 }));
  };

  render() {
    const { error, retries } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.retry);
    return (
      <DefaultErrorScreen
        error={error}
        onRetry={this.retry}
        surface={this.props.surface}
        retries={retries}
      />
    );
  }
}

/* ────────────────────────────── the fallback ───────────────────────────────*/

interface FallbackProps {
  error: Error;
  onRetry: () => void;
  surface: string;
  /** Retries already attempted — gates the destructive action. */
  retries?: number;
  /** Compact variant for a route-level boundary inside the tab shell. */
  compact?: boolean;
}

/** Retries the user must burn before we offer to wipe local data. */
const RESET_UNLOCK_AFTER = 2;

export function DefaultErrorScreen({
  error,
  onRetry,
  surface,
  retries = 0,
  compact = false,
}: FallbackProps) {
  // Context-free theming — see the module header for why this can't use useColors.
  // While light mode is disabled the system scheme is ignored (this screen can
  // render outside the ThemeProvider, so it has to honour the flag itself).
  const scheme = !LIGHT_MODE_ENABLED
    ? FORCED_COLOR_SCHEME
    : Appearance.getColorScheme() === "dark"
      ? "dark"
      : "light";
  const colors = Colors[scheme];
  const [resetting, setResetting] = React.useState(false);

  const goHome = () => {
    try {
      router.replace("/(tabs)");
    } catch {
      // No mounted navigator (a root-level crash) — the retry still remounts it.
    }
    onRetry();
  };

  const resetLocalData = () => {
    Alert.alert(
      "Reset this device's data?",
      "Your logs, plans and history will be re-downloaded from your account. " +
        "Anything that hasn't reached the cloud yet will be sent up first.\n\n" +
        "Use this only if the app keeps failing to open.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setResetting(true);
            void (async () => {
              try {
                // PUSH BEFORE PURGE. A corrupt-local-state bug must not also
                // destroy work that never made it to the cloud — this is the
                // whole reason the reset is gated behind two failed retries.
                const userId = await getActiveUserId();
                if (userId) await fullPushSweep(userId);
              } catch {
                /* fail-soft: a failed sweep must not block the recovery */
              }
              try {
                await purgeAppData();
              } catch {
                /* fail-soft */
              }
              setResetting(false);
              goHome();
            })();
          },
        },
      ],
    );
  };

  const canReset = retries >= RESET_UNLOCK_AFTER;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}
        >
          <Ionicons
            name="refresh-circle-outline"
            size={compact ? 34 : 42}
            color={colors.primary}
          />
        </View>

        {/* Calm voice, matching the rest of the app. The user did nothing wrong
            and the data is safe — say both, plainly. */}
        <Text style={[styles.title, { color: colors.text }]}>
          {compact ? "This screen hit a snag" : "Something went wrong"}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {compact
            ? "The rest of the app is still fine — your data is saved."
            : "Your data is safe on this device. Let's try that again."}
        </Text>

        <View style={styles.actions}>
          <ActionButton
            label="Try again"
            icon="refresh"
            onPress={onRetry}
            colors={colors}
            variant="primary"
          />
          <ActionButton
            label="Go home"
            icon="home-outline"
            onPress={goHome}
            colors={colors}
            variant="tonal"
          />
          {/* Destructive, and only after two retries have genuinely failed. */}
          {canReset ? (
            resetting ? (
              <View style={styles.resetting}>
                <ActivityIndicator color={colors.textSecondary} size="small" />
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Saving your changes first…
                </Text>
              </View>
            ) : (
              <ActionButton
                label="Reset local data"
                icon="trash-outline"
                onPress={resetLocalData}
                colors={colors}
                variant="danger"
              />
            )
          ) : null}
        </View>

        {__DEV__ ? (
          <View style={[styles.devBox, { borderColor: colors.border }]}>
            <Text style={[styles.devLabel, { color: colors.textTertiary }]}>
              {surface} · retry {retries}
            </Text>
            <Text style={[styles.devText, { color: colors.textSecondary }]}>
              {error?.message ?? String(error)}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Route-level fallback for `export function ErrorBoundary` in a route file
 * (Expo Router hands us `{ error, retry }`). Compact, because it renders inside
 * the tab shell with the nav bar still visible and working.
 */
export function ScreenErrorFallback({
  error,
  onRetry,
  surface,
}: {
  error: Error;
  onRetry: () => void;
  surface: string;
}) {
  return (
    <DefaultErrorScreen
      error={error}
      onRetry={onRetry}
      surface={surface}
      compact
    />
  );
}

/* ───────────────────────────────── pieces ──────────────────────────────────*/

function ActionButton({
  label,
  icon,
  onPress,
  colors,
  variant,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  colors: (typeof Colors)["light"];
  variant: "primary" | "tonal" | "danger";
}) {
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? "transparent"
        : colors.surfaceMuted;
  const fg =
    variant === "primary"
      ? colors.onPrimary
      : variant === "danger"
        ? colors.error
        : colors.text;

  return (
    <Pressable
      onPress={onPress}
      // The recovery screen is the LAST place to skimp on this: a screen-reader
      // user who hits a crash has no other way out of the app. The label is the
      // visible text, so the two can't describe different buttons.
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          opacity: pressed ? 0.8 : 1,
          borderWidth: variant === "danger" ? 1 : 0,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={fg} />
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * __DEV__ crash trigger — how you verify the three levels catch independently.
 *
 * Render `{__DEV__ && <CrashTrigger surface="diet" />}` in a screen, then open
 * it with `?crash=1` (every trigger) or `?crash=diet` (that one) and confirm you
 * land on an error screen with the rest of the app still working.
 *
 * A COMPONENT, not a hook, deliberately: `{__DEV__ && …}` means the element is
 * never created in a release build, so `useGlobalSearchParams` — which
 * re-renders its caller on ANY global param change — never runs on Home or Diet
 * in production. A hook would have to be called unconditionally.
 */
export function CrashTrigger({ surface }: { surface: string }): null {
  const { crash } = useGlobalSearchParams<{ crash?: string }>();
  const token = Array.isArray(crash) ? crash[0] : crash;
  if (token && (token === "1" || token === surface)) {
    throw new Error(
      `Deliberate __DEV__ crash on "${surface}" (?crash=${token}) — ` +
        `if you can read this on an error screen, the boundary works.`,
    );
  }
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.huge,
  },
  contentCompact: { paddingVertical: Spacing.xxl },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.title,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xxl,
    maxWidth: 320,
  },
  actions: { width: "100%", maxWidth: 340, gap: Spacing.md },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.pill,
  },
  buttonLabel: { ...Typography.callout, fontSize: 15, fontWeight: "700" },
  resetting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 52,
  },
  hint: { ...Typography.subhead },
  devBox: {
    marginTop: Spacing.xxl,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    width: "100%",
    maxWidth: 340,
  },
  devLabel: { ...Typography.caption, marginBottom: Spacing.xs },
  devText: { ...Typography.footnote, fontFamily: undefined },
});
