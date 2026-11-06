/**
 * THE DAILY COMMITMENT, ON SCREEN — the week row of the celebration.
 *
 * Home's streak lives in "Your week" now (components/home/WeekTable — the
 * streak strip that sat here told the same week as that table, so the two were
 * merged on 2026-10-31). This row is the one the celebration pops today into.
 *
 * NOTHING HERE IS AN OUTLINE. These circles are not buttons, and an outlined
 * shape reads as one (see the no-dashed-lines / no-outline rule). State is told
 * by FILL alone: kept is a solid flame-orange disc with a check, today-not-yet
 * is a warm tint, a missed day is the recessed grey, and the rest of the week
 * is that grey, fainter.
 *
 * What a kept day IS, and every number shown, comes from services/commitment —
 * read off the dated ledger, never off a counter that can go stale.
 */
import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha } from "@/constants/theme";
import type { CommitmentDay } from "@/services/commitment";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { FLAME_COLORS } from "./Flame";

/* ── The week ─────────────────────────────────────────────────────────────── */

export function CommitmentWeek({
  week,
  size = 30,
  todayKept,
  animateToday = false,
}: {
  week: CommitmentDay[];
  /** Disc diameter. */
  size?: number;
  /**
   * Override today's state — the celebration holds today open until its flame
   * has caught, then flips this to true so the disc lands on the beat.
   */
  todayKept?: boolean;
  /** Pop today's disc in when it turns kept (the celebration only). */
  animateToday?: boolean;
}) {
  const { colors } = useColors();
  const pending = alpha(FLAME_COLORS.outer, 0.18);

  return (
    <View style={styles.week}>
      {week.map((d) => {
        const kept = d.isToday && todayKept !== undefined ? todayKept : d.kept;
        const fill = kept
          ? FLAME_COLORS.outer
          : d.isToday
            ? pending
            : colors.surfaceSunken;
        const state = kept
          ? "kept"
          : d.paused
            ? "rough day, streak paused"
            : d.isToday
              ? "not kept yet"
              : d.isFuture
                ? "still to come"
                : "missed";
        return (
          <View
            key={d.date}
            style={styles.day}
            accessible
            accessibilityLabel={`${d.label}: ${state}`}
          >
            <AppText
              variant="caption"
              weight={d.isToday ? "800" : "600"}
              style={{ color: d.isToday ? FLAME_COLORS.outer : colors.textTertiary }}
            >
              {d.label}
            </AppText>
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: kept ? "transparent" : fill,
                opacity: d.isFuture && !kept ? 0.55 : 1,
              }}
            >
              {kept ? (
                <Animated.View
                  // Keyed by state so the disc REMOUNTS when today turns kept —
                  // that remount is what plays the pop.
                  key="kept"
                  entering={
                    animateToday && d.isToday
                      ? ZoomIn.springify().damping(9).stiffness(240)
                      : undefined
                  }
                  style={[
                    StyleSheet.absoluteFill,
                    styles.keptDisc,
                    { borderRadius: size / 2, backgroundColor: FLAME_COLORS.outer },
                  ]}
                >
                  <Ionicons name="checkmark" size={Math.round(size * 0.56)} color="#FFFFFF" />
                </Animated.View>
              ) : d.paused ? (
                // A rough day that paused the streak: its own quiet mark.
                <View style={[StyleSheet.absoluteFill, styles.keptDisc]}>
                  <Ionicons name="pause" size={Math.round(size * 0.44)} color={colors.textTertiary} />
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  week: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  day: { alignItems: "center", gap: 6 },
  keptDisc: { alignItems: "center", justifyContent: "center" },
});
