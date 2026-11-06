/**
 * CalorieHero — Home's one big card: the calorie ring, Target, Remaining and
 * how much of the goal is eaten, all together.
 *
 * It is drawn the way an instrument is: pure black like the canvas, a thin white
 * edge, and a glow of the ring's own orange along the foot of the card. The ring
 * and the Orbitron figures are exactly the ones Home already had — this changes
 * the surface they sit on, not what they say.
 *
 * THE GLOW HAS ITS OWN BAND, AND THE RING CAN NEVER REACH IT. The ring and the
 * glow are the same orange, so any overlap swallows the ring: an orange arc over
 * an orange wash has no edge. (A ring is drawn from its 6 o'clock position, so
 * the very first sliver of progress sits at the bottom — exactly where an
 * overlapping glow would be.) The first version aimed the gradient with fractions
 * of the card's height and merely hoped it started below the ring; at a larger
 * system font, where the card grows, it would not have. Now the card is two
 * stacked boxes — the row with the ring, then a band that owns the glow — so the
 * glow physically begins below the row, at any height and any text size, with a
 * gap of `BAND_GAP` between the two. The gradient also starts fully transparent
 * at the top of its band, so the first visible orange is well below that again.
 *
 * The "% of goal" chip lives in the glow — dark glass, white text, so it keeps
 * its contrast however strong the orange is beneath it.
 */
import { AnimatedNumber, AppText, Ring, useColors } from "@/components/ui";
import { retroText } from "@/constants/RetroFont";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  EDGE_WHITE,
  GLOW_AT,
  GLOW_ORANGE as GLOW,
  HOME_ORANGE,
  INSTRUMENT_BLACK,
} from "./surface";

export interface CalorieHeroProps {
  /** Calories eaten today. */
  eaten: number;
  /** Today's calorie target. */
  target: number;
  /** Calories left to the target (never negative). */
  remaining: number;
  /** Whole percent of the target eaten, 0–100. */
  percent: number;
  /**
   * A rough day (services/smart/roughDay): today reads "eat well enough".
   * What was eaten and the target are still shown — they are facts — but the
   * countdown and the percentage chip, the pressure, step aside.
   */
  gentle?: boolean;
  /** When today's target isn't the usual one, what moved it: "+250 · hungrier week". */
  targetNote?: string | null;
  style?: StyleProp<ViewStyle>;
}

/** Clear space between the foot of the ring's row and the top of the glow band. */
const BAND_GAP = Spacing.lg;

export function CalorieHero({ eaten, target, remaining, percent, gentle = false, targetNote, style }: CalorieHeroProps) {
  const { colors } = useColors();

  return (
    <View style={[styles.card, style]}>
      {/* The ring and this block are ONE centred group, not two things pinned
          to opposite edges of the card — stretched apart they read as two cards
          sharing a box. Stacked and centred, every width fits: this column is
          ~140pt on a 390pt screen and under 90pt on a small one, where a
          label-left/figure-right row would overflow or truncate its label. */}
      <View style={styles.row}>
        <Ring progress={percent / 100} size={132} strokeWidth={12} gradient={Gradients.calories}>
          <AnimatedNumber value={Math.round(eaten)} variant="metric" />
          <AppText variant="caption" color="tertiary" uppercase>
            kcal eaten
          </AppText>
        </Ring>

        <View style={styles.info}>
          <View style={styles.stat}>
            <AppText variant="caption" color="tertiary" uppercase align="center">
              Target
            </AppText>
            <AppText
              variant="headline"
              align="center"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={retroText}
            >
              {target.toLocaleString()}
              <AppText variant="footnote" color="tertiary" style={styles.unit}>
                {" "}
                kcal
              </AppText>
            </AppText>
            {targetNote ? (
              <AppText variant="caption" color="tertiary" align="center" numberOfLines={1} adjustsFontSizeToFit>
                {targetNote}
              </AppText>
            ) : null}
          </View>

          <View style={[styles.rule, { backgroundColor: colors.divider }]} />

          {gentle ? (
            <View style={styles.stat}>
              <AppText variant="caption" color="tertiary" uppercase align="center">
                Today
              </AppText>
              <AppText variant="callout" weight="700" align="center">
                Eat well enough
              </AppText>
            </View>
          ) : (
            <View style={styles.stat}>
              <AppText variant="caption" color="tertiary" uppercase align="center">
                Remaining
              </AppText>
              <AppText
                variant="headline"
                color="calories"
                align="center"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={retroText}
              >
                {remaining.toLocaleString()}
                <AppText variant="footnote" color="tertiary" style={styles.unit}>
                  {" "}
                  kcal
                </AppText>
              </AppText>
            </View>
          )}
        </View>
      </View>

      {/* The glow's own box — a sibling BELOW the row, never behind it. */}
      <View style={styles.band}>
        <LinearGradient
          pointerEvents="none"
          colors={GLOW}
          locations={GLOW_AT}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.chip}>
          <Ionicons name={gentle ? "leaf" : "flame"} size={13} color={HOME_ORANGE} />
          <AppText variant="footnote" weight="700" color="#FFFFFF">
            {gentle ? "A gentle day" : `${percent}% of goal`}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No padding of its own: the row pads itself, and the band must run edge to
  // edge and down to the card's bottom edge, where the glow is strongest.
  card: {
    backgroundColor: INSTRUMENT_BLACK,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
  },
  info: { flexShrink: 1, gap: Spacing.md, alignItems: "center" },
  stat: { alignSelf: "stretch", gap: 1 },
  rule: { height: 1, alignSelf: "stretch" },
  // The unit sits a size under the Orbitron figure; 11 is the floor for text
  // that has to survive a large system font.
  unit: { fontSize: 11, lineHeight: 24 },
  band: {
    marginTop: BAND_GAP,
    paddingTop: 22,
    paddingBottom: Spacing.lg,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: alpha("#FFFFFF", 0.2),
  },
});
