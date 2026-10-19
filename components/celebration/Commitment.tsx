/**
 * THE DAILY COMMITMENT, ON SCREEN — the week row and Home's streak strip.
 *
 * The same flame as the celebration (components/celebration/Flame), so the
 * object you watch light up when a day is kept is the object that sits on Home
 * going grey on a day that hasn't been. That continuity is the whole mechanic:
 * a grey flame with your number next to it is the reason to open the app.
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
import { Spacing, alpha } from "@/constants/theme";
import {
  commitmentStatus,
  readCommitment,
  type CommitmentDay,
  type StreakLike,
} from "@/services/commitment";
import { todayDate } from "@/services/OfflineStorage";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { FLAME_COLORS, FlameGlyph } from "./Flame";

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
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── Home's strip ─────────────────────────────────────────────────────────── */

/**
 * The streak as Home shows it, card-less like the rest of Home's heroes: the
 * flame and the count, the week, and one line that says where today stands.
 *
 * The flame is the static glyph, not the animated one — a perpetually
 * flickering icon on Home is an animation the 1 GB phones pay for on every
 * frame of every scroll (see welliva-low-end-perf). The flicker belongs to the
 * moment a day is kept, which is the celebration's job.
 */
export function CommitmentStrip({
  streak,
  style,
}: {
  streak: StreakLike;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useColors();
  const today = todayDate();
  const state = useMemo(() => readCommitment(streak, today), [streak, today]);
  const status = commitmentStatus(state);
  const caption =
    state.totalDays > 0
      ? `Best ${state.best} · ${state.totalDays} ${state.totalDays === 1 ? "day" : "days"} kept`
      : "Your first flame is one log away";

  return (
    <View style={style}>
      <View
        style={styles.head}
        accessible
        accessibilityLabel={`${state.streak} day streak. ${caption}.`}
      >
        <FlameGlyph size={30} unlit={!state.keptToday} dark={isDark} />
        <AppText
          variant="display"
          weight="800"
          style={[
            styles.count,
            { color: state.keptToday ? FLAME_COLORS.outer : colors.text },
          ]}
        >
          {state.streak}
        </AppText>
        <View style={styles.headText}>
          <AppText variant="callout" weight="700" numberOfLines={1}>
            day streak
          </AppText>
          <AppText variant="caption" color="tertiary" numberOfLines={1}>
            {caption}
          </AppText>
        </View>
      </View>

      <CommitmentWeek week={state.week} />

      <AppText variant="footnote" color="tertiary" align="center" style={styles.status}>
        {status}
      </AppText>
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
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  count: { fontVariant: ["tabular-nums"] },
  headText: { flex: 1, gap: 1 },
  status: { marginTop: Spacing.lg },
});
