/**
 * NudgeCard — the anticipation half of game feel, on Home.
 *
 * Shows the ONE thing within reach: a record two days out, one session from the
 * biggest week you've had. Everything on it is counted from this user's own
 * logs (see services/MomentEngine) — there is no projection, no "on track for",
 * and no encouragement that isn't a fact.
 *
 * WHY IT LOOKS LIKE THIS. Deliberately not a celebration: no medallion, no
 * confetti, no gradient fill. A celebration for something you have not done yet
 * is the hollow feeling this whole layer exists to avoid. So it reads as a
 * quiet note with a hairline of progress — a stake, not a trophy.
 *
 * IT RENDERS NOTHING when there is no nudge, which is most days. That is the
 * design working: a pull that is always on screen is wallpaper.
 *
 * THE RAIL HAS TO BE ABLE TO FILL. Its target is a real number the user can
 * reach (services/MomentEngine enforces this), so arriving at it looks like
 * arriving: the hairline goes the whole way across and a small marker names the
 * standing fact — "Personal best" — beside the headline. That marker is still
 * not a celebration; it is a label on something already true, and the loud half
 * of this engine (the Moment, with its confetti) has fired separately. What the
 * card must never do is show a bar that CANNOT fill, which is what it did while
 * the week target moved up every time the count did.
 */
import { AppText, Card, IconBadge, Pill, useColors } from "@/components/ui";
import { Palette, Radius, Spacing, alpha } from "@/constants/theme";
import type { Nudge } from "@/services/MomentEngine";
import React from "react";
import { StyleSheet, View } from "react-native";

/** Semantic tone → palette colour. Mirrors CelebrationService's map. */
const TONE: Record<Nudge["tone"], string> = {
  gold: Palette.gold,
  flame: Palette.brand,
  water: Palette.water,
  success: Palette.positive,
};

export function NudgeCard({ nudge }: { nudge: Nudge | null }) {
  const { colors } = useColors();
  if (!nudge) return null;

  const tone = TONE[nudge.tone];
  const { value, target } = nudge.progress;
  // Clamped so a target the user has already passed can never overflow the rail.
  const pct = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;

  return (
    <Card padding="lg">
      <View style={styles.row}>
        <IconBadge name={nudge.icon} tone={tone} size={40} />
        <View style={styles.copy}>
          <View style={styles.headlineRow}>
            <AppText variant="headline" weight="700" numberOfLines={2} style={styles.flex}>
              {nudge.headline}
            </AppText>
            {/* Only present when a record is genuinely held — see the header. */}
            {nudge.badge ? (
              <Pill label={nudge.badge} tone={tone} size="sm" icon="trophy" />
            ) : null}
          </View>
          <AppText variant="footnote" color="secondary" numberOfLines={2}>
            {nudge.detail}
          </AppText>
        </View>
      </View>

      {/* The stake, drawn. Hairline rather than a full progress bar — this is a
          note about where you stand, not a task with a completion state. */}
      <View
        style={[styles.rail, { backgroundColor: alpha(colors.textSecondary, 0.14) }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${nudge.headline}. ${nudge.detail}`}
        accessibilityValue={{ min: 0, max: target, now: value }}
      >
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: tone }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  copy: { flex: 1, gap: 2 },
  headlineRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  rail: {
    height: 3,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: Radius.pill },
});
