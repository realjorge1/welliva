/**
 * StatusHero — the answer to "are my notifications actually working?"
 *
 * Four states, each stated plainly and never assumed:
 *
 *   · ON           — how many are lined up, counted off the OS queue, and the
 *                    very next one by name and time. If the queue is empty it
 *                    says so, rather than a reassuring "all set".
 *   · NOT ASKED    — the permission ask, EARNED first: the exact banner, button
 *                    and all, before the system dialog (which can be shown once).
 *   · BLOCKED      — the only way back is the device's settings; one button.
 *   · UNAVAILABLE  — Expo Go / web. Said once, calmly.
 */
import { NotificationBannerPreview } from "@/components/notifications/NotificationBannerPreview";
import { AppText, Button, Card, Pill, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import type { ExactAlarmStatus } from "@/services/notifications/exactAlarms";
import type { QueuedNotification } from "@/services/notifications/queue";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { NotificationCenter } from "./useNotificationCenter";
import { inlineWhen, plural } from "./format";

export function StatusHero({
  center,
  exact,
}: {
  center: NotificationCenter;
  /** Android exact-alarm access; "not-applicable" on iOS. */
  exact: ExactAlarmStatus;
}) {
  const { colors } = useColors();
  const { permission, queue } = center;
  const status = permission.status;

  const next = queue.find((q) => q.next !== null) ?? null;
  const tone =
    status === "granted"
      ? colors.success
      : status === "denied"
        ? colors.warning
        : colors.primary;

  return (
    <Card padding="lg" style={styles.card}>
      <View style={styles.row}>
        <BellGlyph tone={tone} on={status === "granted"} />
        <View style={styles.flex}>
          <AppText variant="headline">{TITLE[status]}</AppText>
          <AppText variant="footnote" color="secondary" style={styles.line}>
            {status === "granted" ? summary(queue, next) : BLURB[status]}
          </AppText>
          {status === "granted" && exact === "exact" && queue.length > 0 ? (
            <Pill
              label="On the minute"
              icon="alarm"
              tone={colors.success}
              size="sm"
              style={styles.pill}
            />
          ) : null}
        </View>
      </View>

      {status === "undetermined" ? (
        <>
          <NotificationBannerPreview
            title="Lunch"
            body="Grilled chicken salad — had it? One tap and it's logged."
            actionLabel="Ate it"
            style={styles.preview}
          />
          <Button
            label="Turn on notifications"
            icon="notifications"
            onPress={() => void permission.request()}
            disabled={permission.loading}
            style={styles.cta}
          />
        </>
      ) : status === "denied" ? (
        <Button
          label="Open device settings"
          icon="open-outline"
          variant="tonal"
          onPress={permission.openSystemSettings}
          style={styles.cta}
        />
      ) : null}
    </Card>
  );
}

const TITLE: Record<string, string> = {
  granted: "Notifications are on",
  undetermined: "Turn on notifications",
  denied: "Notifications are off",
  unavailable: "Not available here",
};

const BLURB: Record<string, string> = {
  undetermined:
    "At the times you choose, welliva asks about a habit, a meal or a glass of water — and one tap on the notification logs it. No unlocking, no opening the app.",
  denied:
    "Your device has notifications switched off for welliva, so nothing here can reach you until that changes.",
  unavailable:
    "Notifications need the full app build — they don't run in Expo Go or on the web. Everything else works as normal.",
};

function summary(queue: QueuedNotification[], next: QueuedNotification | null): string {
  if (queue.length === 0) {
    return "Nothing is scheduled yet — choose what to be reminded about below.";
  }
  const count = `${plural(queue.length, "notification")} lined up on this phone`;
  if (!next?.next) return `${count}.`;
  const name = next.title ? `${next.title}, ` : "";
  return `${count}. Next: ${name}${inlineWhen(next.next)}.`;
}

/** The bell: a soft halo that breathes while notifications are on. */
function BellGlyph({ tone, on }: { tone: string; on: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!on) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [on, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.2] });

  return (
    <View style={styles.glyph}>
      <Animated.View
        style={[
          styles.halo,
          { backgroundColor: alpha(tone, 0.22), opacity, transform: [{ scale }] },
        ]}
      />
      <View style={[styles.core, { backgroundColor: alpha(tone, 0.14) }]}>
        <Ionicons name={on ? "notifications" : "notifications-outline"} size={24} color={tone} />
      </View>
    </View>
  );
}

const GLYPH = 56;

const styles = StyleSheet.create({
  card: { marginTop: Spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  flex: { flex: 1 },
  line: { marginTop: 4, lineHeight: 19 },
  pill: { alignSelf: "flex-start", marginTop: Spacing.sm },
  preview: { marginTop: Spacing.lg },
  cta: { marginTop: Spacing.lg },
  glyph: { width: GLYPH, height: GLYPH, alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: GLYPH,
    height: GLYPH,
    borderRadius: GLYPH / 2,
  },
  core: {
    width: GLYPH - 12,
    height: GLYPH - 12,
    borderRadius: (GLYPH - 12) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
