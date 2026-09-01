/**
 * NotificationPrimer — the permission ask, done properly.
 *
 * The OS dialog can only be shown once, and a "Don't Allow" is close to
 * permanent. So this screen earns it first: it states the promise ("a nudge at
 * the right time", not all day), and SHOWS the exact thing being asked for — a
 * live mock of the lock-screen banner, complete with the "Mark as Done" button —
 * before the system prompt appears.
 *
 * Three terminal states are handled honestly:
 *   • undetermined → "Enable Reminders" triggers the OS prompt
 *   • granted      → confirmation, and the CTA becomes "Continue"
 *   • denied       → the prompt is gone for good; the only route is OS settings
 */
import { AppText, Button, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { NotificationBannerPreview } from "./NotificationBannerPreview";
import { useReminderPermission } from "./useReminderPermission";

export interface NotificationPrimerProps {
  /** Called once the user has resolved the ask (granted, skipped, or blocked). */
  onDone: () => void;
  /** Label for the dismiss affordance. */
  skipLabel?: string;
}

export function NotificationPrimer({
  onDone,
  skipLabel = "Not now",
}: NotificationPrimerProps) {
  const { colors } = useColors();
  const perm = useReminderPermission();

  const handleEnable = async () => {
    if (perm.status === "granted") return onDone();
    if (perm.status === "denied") return perm.openSystemSettings();
    const result = await perm.request();
    // A fresh grant deserves a beat on the confirmation state rather than an
    // instant dismiss — the user should see that it worked.
    if (result === "granted") setTimeout(onDone, 900);
    else onDone();
  };

  const cta =
    perm.status === "granted"
      ? "Continue"
      : perm.status === "denied"
        ? "Open Settings"
        : "Enable Reminders";

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <BellMark granted={perm.granted} />

        <AppText variant="display" align="center" style={styles.title}>
          A nudge at the right time
        </AppText>
        <AppText
          variant="body"
          color="secondary"
          align="center"
          style={styles.blurb}
        >
          One quiet reminder when it matters — never a stream of them. Finish it
          straight from the lock screen, without opening the app.
        </AppText>

        {/* The shared mock, so the promise here and the promise on the
            Tap-to-log screen are literally the same component. */}
        <NotificationBannerPreview
          title="Evening wind-down"
          body="A small step keeps the ember burning."
          actionLabel="Mark as Done"
          style={styles.banner}
        />
      </View>

      <View style={styles.actions}>
        {perm.status === "granted" ? (
          <View style={styles.allowedRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <AppText variant="footnote" color={colors.success} style={styles.allowedLabel}>
              Reminders allowed
            </AppText>
          </View>
        ) : perm.status === "denied" ? (
          <AppText variant="caption" color="tertiary" align="center" style={styles.note}>
            Notifications are turned off for Welliva in your device settings.
          </AppText>
        ) : perm.status === "unavailable" ? (
          <AppText variant="caption" color="tertiary" align="center" style={styles.note}>
            Reminders need the full app build — everything else works as normal.
          </AppText>
        ) : null}

        <Button
          label={cta}
          icon={perm.status === "granted" ? "arrow-forward" : "notifications"}
          onPress={handleEnable}
          disabled={perm.loading || perm.status === "unavailable"}
        />
        {perm.status !== "granted" ? (
          <Button label={skipLabel} variant="ghost" onPress={onDone} style={styles.skip} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The bell: a soft halo with a slow, sparing swing. It rings twice on mount and
 * then rests — a demo of the product's promise, not an attention-grab. Swaps to
 * a settled checkmark once permission is granted.
 */
function BellMark({ granted }: { granted: boolean }) {
  const { colors } = useColors();
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (granted) return;
    const tilt = (to: number, duration: number) =>
      Animated.timing(swing, {
        toValue: to,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
    Animated.sequence([
      Animated.delay(500),
      tilt(1, 110),
      tilt(-1, 200),
      tilt(0.6, 180),
      tilt(0, 240),
    ]).start();
  }, [granted, swing]);

  const rotate = swing.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-11deg", "11deg"],
  });

  return (
    <View style={[styles.halo, { backgroundColor: alpha(colors.primary, 0.1) }]}>
      <View style={[styles.haloInner, { backgroundColor: alpha(colors.primary, 0.16) }]}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons
            name={granted ? "checkmark" : "notifications"}
            size={38}
            color={granted ? colors.success : colors.primary}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between", paddingVertical: Spacing.xl },
  top: { alignItems: "center", paddingTop: Spacing.xxl },

  halo: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  haloInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
  },

  title: { marginTop: Spacing.xxl },
  blurb: { marginTop: Spacing.md, paddingHorizontal: Spacing.md, lineHeight: 22 },

  banner: { marginTop: Spacing.xxl },

  actions: { paddingTop: Spacing.xl },
  allowedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  allowedLabel: { marginLeft: Spacing.xs, fontWeight: "600" },
  note: { marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, lineHeight: 18 },
  skip: { marginTop: Spacing.sm },
});
