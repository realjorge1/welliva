/**
 * CoachPulse — your day, uncovered behind the conversation.
 *
 * WHAT IT IS FOR. The chat answers questions; it is bad at ambient state. "How
 * am I doing today" is the most-asked question on this screen and the least
 * worth spending a turn on — it has a fixed answer that the app already knows,
 * and typing it costs a round trip to a model to be told three numbers. This is
 * those numbers, one gesture away, with no turn spent and no network involved.
 *
 * WHY IT LIVES BEHIND A PULL rather than on the screen. A permanent dashboard
 * at the top of a chat is a dashboard the conversation has to scroll past
 * forever, and it would be the loudest thing on a screen whose entire job is
 * the sentence someone is reading. Behind the pull it costs nothing when unused
 * and is exactly where a hand already is when the question occurs.
 *
 * HOW IT REVEALS. The content is pinned to the TOP of a clipping container
 * whose height the gesture drives (./usePullReveal), so it wipes down like a
 * shade being drawn rather than sliding in as a card. A quarter-speed parallax
 * keeps it alive under the finger without letting it look detached from the
 * window it is being revealed through. The hint sits in the middle of whatever
 * has been uncovered so far and fades out as the real content earns the space —
 * it is there to teach the gesture once, not to be read every time.
 *
 * EVERY FIGURE HERE IS LOGGED DATA, straight off the Twin. Nothing on this
 * panel is generated, inferred or written by a model, which is why it can be
 * shown without receipts, without a disclaimer and without a network.
 */

import { AppText, Ring } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { GozlinBriefing, GozlinTwin } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

/** A prompt the panel can hand straight to the coach. */
interface PulseAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

interface Props {
  twin: GozlinTwin;
  briefing: GozlinBriefing;
  /** Live revealed height and the panel's full height — both from usePullReveal. */
  height: SharedValue<number>;
  panelHeight: SharedValue<number>;
  /** A release right now would latch it open. Drives the hint's wording. */
  armed: boolean;
  onMeasure: (h: number) => void;
  onClose: () => void;
  onAsk: (prompt: string) => void;
  onOpenLogs: () => void;
}

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** Recovery reads as a colour before it reads as a word. */
function recoveryTone(
  level: GozlinTwin["recovery"]["level"],
  colors: ReturnType<typeof useColors>["colors"],
): string {
  return level === "green" ? colors.success : level === "amber" ? colors.warning : colors.error;
}

function round(n: number): string {
  return Math.round(n).toLocaleString();
}

export function CoachPulse({
  twin,
  briefing,
  height,
  panelHeight,
  armed,
  onMeasure,
  onClose,
  onAsk,
  onOpenLogs,
}: Props) {
  const { colors } = useColors();
  const today = twin.today;

  /** 0→1 of the reveal. Everything visual here is a function of this. */
  const contentStyle = useAnimatedStyle(() => {
    const full = Math.max(1, panelHeight.value);
    const p = Math.min(1, height.value / full);
    return {
      // Content earns its opacity in the back half of the pull, so a short
      // accidental drag shows a hint rather than a half-lit dashboard.
      opacity: Math.max(0, (p - 0.32) / 0.5),
      transform: [{ translateY: -(full - height.value) * 0.25 }],
    };
  });

  const hintStyle = useAnimatedStyle(() => {
    const full = Math.max(1, panelHeight.value);
    const p = Math.min(1, height.value / full);
    return { opacity: Math.max(0, 1 - p * 1.9) };
  });

  const dayLine = [
    DAYS[new Date().getDay()],
    briefing.dayCount ? `DAY ${briefing.dayCount}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const actions: PulseAction[] = [
    {
      label: "Plan my day",
      icon: "compass-outline",
      onPress: () => onAsk("What should I focus on today?"),
    },
    {
      label: "How am I doing?",
      icon: "pulse-outline",
      onPress: () => onAsk("How am I doing this week?"),
    },
    { label: "Your logs", icon: "reader-outline", onPress: onOpenLogs },
  ];

  return (
    <>
      {/* The teach-once line, centred in whatever has been uncovered so far. */}
      <Animated.View style={[styles.hint, hintStyle]} pointerEvents="none">
        <Ionicons
          name={armed ? "chevron-up" : "chevron-down"}
          size={15}
          color={armed ? colors.primary : colors.textTertiary}
        />
        <AppText
          variant="caption"
          weight="600"
          style={{ color: armed ? colors.primary : colors.textTertiary }}
        >
          {armed ? "Release for your day" : "Keep pulling for your day"}
        </AppText>
      </Animated.View>

      <Animated.View
        style={[styles.content, contentStyle]}
        onLayout={(e) => onMeasure(e.nativeEvent.layout.height)}
      >
        <View style={styles.topRow}>
          <AppText variant="caption" weight="700" color="tertiary" style={styles.day}>
            {dayLine}
          </AppText>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onClose();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close your day"
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.5 }]}
          >
            <Ionicons name="chevron-up" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.rings}>
          <PulseRing
            progress={today.calories.pct}
            tone={colors.calories}
            value={round(today.calories.consumed)}
            unit="kcal"
            of={round(today.calories.target)}
          />
          <PulseRing
            progress={today.protein.pct}
            tone={colors.protein}
            value={`${round(today.protein.consumed)}g`}
            unit="protein"
            of={`${round(today.protein.target)}g`}
          />
          <PulseRing
            progress={today.water.pct}
            tone={colors.water}
            value={`${(today.water.consumed / 1000).toFixed(1)}L`}
            unit="water"
            of={`${(today.water.target / 1000).toFixed(1)}L`}
          />
        </View>

        <View style={[styles.strip, { borderTopColor: colors.divider }]}>
          <Marker
            icon="flame-outline"
            tone={twin.momentum.streak > 0 ? colors.primary : colors.textTertiary}
            text={
              twin.momentum.streak > 0
                ? `${twin.momentum.streak}-day streak`
                : "No streak yet"
            }
          />
          <Marker
            icon="battery-charging-outline"
            tone={recoveryTone(twin.recovery.level, colors)}
            text={`Recovery ${twin.recovery.score}`}
          />
          <Marker
            icon={
              twin.momentum.trend === "rising"
                ? "trending-up-outline"
                : twin.momentum.trend === "cooling"
                  ? "trending-down-outline"
                  : "remove-outline"
            }
            tone={colors.textSecondary}
            text={`${twin.momentum.adherence7d}/100`}
          />
        </View>

        {briefing.microAction ? (
          <View style={styles.nextRow}>
            <View style={[styles.nextDot, { backgroundColor: colors.primary }]} />
            <AppText variant="footnote" color="secondary" numberOfLines={2} style={styles.next}>
              {briefing.microAction}
            </AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                a.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name={a.icon} size={13} color={colors.primary} />
              <AppText variant="caption" weight="600" numberOfLines={1}>
                {a.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </>
  );
}

function PulseRing({
  progress,
  tone,
  value,
  unit,
  of,
}: {
  progress: number;
  tone: string;
  value: string;
  unit: string;
  of: string;
}) {
  const { colors } = useColors();
  return (
    <View
      style={styles.ringCell}
      accessibilityRole="text"
      accessibilityLabel={`${unit}: ${value} of ${of}`}
    >
      <Ring
        progress={Math.min(1, progress)}
        size={58}
        strokeWidth={5}
        tone={tone}
        track={alpha(colors.text, 0.09)}
      >
        <AppText variant="footnote" weight="700">
          {value}
        </AppText>
      </Ring>
      <AppText variant="caption" color="tertiary" numberOfLines={1}>
        {unit} · {of}
      </AppText>
    </View>
  );
}

function Marker({
  icon,
  tone,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  text: string;
}) {
  return (
    <View style={styles.marker}>
      <Ionicons name={icon} size={13} color={tone} />
      <AppText variant="caption" weight="600" color="secondary" numberOfLines={1}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  /**
   * Pinned to the TOP of the clipping container, at its own intrinsic height,
   * so the reveal is a wipe rather than a slide and `onLayout` reports the full
   * height even while the window above it is a few points tall.
   */
  content: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  day: { flex: 1, letterSpacing: 1 },
  close: { width: 28, height: 22, alignItems: "flex-end", justifyContent: "center" },

  rings: { flexDirection: "row", justifyContent: "space-between" },
  ringCell: { flex: 1, alignItems: "center", gap: 5 },

  strip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  marker: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },

  nextRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  nextDot: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  next: { flex: 1, lineHeight: 18 },

  actions: { flexDirection: "row", gap: Spacing.xs },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
