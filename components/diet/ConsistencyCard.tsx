/**
 * ConsistencyCard — the Diet screen's consistency score, as an instrument.
 *
 * Owner, 2026-10-31: the old graph (a neon panel with gold and red dots either
 * side of a cyan average line) was "really poor and terrible — improve it
 * majorly: a smooth curved line with a ball at the edge, on a black card with a
 * gradient shade of the app colour, like the kcal card on Home". So this is drawn
 * exactly the way Home's calorie hero is: pure black, a thin white edge, and the
 * ring's orange glowing up from the foot of the card.
 *
 * Top to bottom: the score as one big solid figure with its name (not the
 * dot-matrix face — owner, 2026-10-31); how many of the last seven days were
 * tracked; then the line — daily adherence over the last
 * two weeks as ONE smooth white curve, a small dot where it starts and a ball
 * where it ends, today. The ball is where you are now; the curve is how you got
 * there.
 *
 * HONEST SCALE. The line is drawn against a fixed 0–100: a day at 50% sits
 * halfway up, whatever the rest of the fortnight did. Scaling to the series' own
 * peak would turn a week of 40s into a line that looks like a week of 100s. And
 * the curve is monotone (components/home/sparkline): it never swings above a day
 * that was not that good, or below one that was not that bad.
 *
 * THE LINE DRAWS ITSELF ON THE WAY IN — the same rules and the same pen as
 * Home's Fitness line: scroll down to the card and the curve travels left to
 * right with the ball on its tip; arrive from above and it is simply there. One
 * number drives both the stroke and the ball, so the ball cannot leave the line.
 * It is a one-shot: nothing moves at rest.
 */
import type { ChartPoint } from "@/components/charts/types";
import { pointAtLength, sparkline } from "@/components/home/sparkline";
import { GLOW_AT, GLOW_ORANGE, INSTRUMENT_CARD } from "@/components/home/surface";
import { TileHeader } from "@/components/home/TileHeader";
import { Ease } from "@/components/motion/motion";
import { AppText, Mono, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { ConsistencyScore } from "@/services/intelligence";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const WHITE = "#FFFFFF";
/** Days of adherence the line shows, ending today. */
const LINE_DAYS = 14;
const CHART_H = 112;
/** Room round the curve for the ball and its halo, which must not be clipped. */
const PAD = { x: 16, top: 16, bottom: 14 };
const BALL = 6.5;
const HALO = 13;
/** How long the pen takes to travel the whole curve. */
const DRAW_MS = 1200;
const NO_POINTS: number[] = [];

const TREND: Record<ConsistencyScore["trend"], { icon?: "arrow-up" | "arrow-down"; text: string }> = {
  up: { icon: "arrow-up", text: "RISING" },
  down: { icon: "arrow-down", text: "SLIPPING" },
  flat: { text: "STEADY" },
};

export interface ConsistencyCardProps {
  consistency: ConsistencyScore;
  /** Daily adherence, 0–100, oldest → newest; today last. */
  points: readonly ChartPoint[];
  /** 0 wait · 1 play · 2 show finished. Leave out for a line that is simply drawn. */
  entrance?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}

export const ConsistencyCard = React.memo(function ConsistencyCard({
  consistency,
  points,
  entrance,
  style,
}: ConsistencyCardProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);

  const view = useMemo(
    () => (points.length > LINE_DAYS ? points.slice(-LINE_DAYS) : points),
    [points],
  );
  const values = useMemo(() => view.map((p) => p.value), [view]);
  const spark = useMemo(
    () => (width > 0 && values.length > 1 ? sparkline(values, width, CHART_H, PAD, 100) : null),
    [values, width],
  );

  // How far along the curve the pen has got, 0 → 1.
  const reveal = useSharedValue(entrance ? 0 : 1);
  useAnimatedReaction(
    () => (entrance ? entrance.value : 2),
    (state) => {
      if (state === 1 && !reduced) {
        reveal.value = 0;
        reveal.value = withTiming(1, { duration: DRAW_MS, easing: Ease.standard });
      } else {
        // Assigning cancels a draw in flight; 0 wipes it while nobody is looking.
        reveal.value = state === 0 ? 0 : 1;
      }
    },
    [entrance, reduced],
  );

  // Stable references even before the chart has a width: the animated props
  // capture these, and a fresh `[]` each render would make them rebuild.
  const trace = spark?.trace;
  const total = trace?.length ?? 0;
  const xs = trace?.xs ?? NO_POINTS;
  const ys = trace?.ys ?? NO_POINTS;
  const cum = trace?.cum ?? NO_POINTS;

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: total * (1 - reveal.value),
  }));
  const ballProps = useAnimatedProps(() => {
    const p = pointAtLength(xs, ys, cum, reveal.value * total);
    return { cx: p.x, cy: p.y };
  });
  // Nothing at all until the pen starts: an empty chart, then the line.
  const chartStyle = useAnimatedStyle(() => ({ opacity: reveal.value > 0 ? 1 : 0 }));

  const { score, label, trend, daysTracked } = consistency;
  const t = TREND[trend];
  const sub =
    daysTracked > 0
      ? `Tracked ${daysTracked} of the last 7 days`
      : "Log meals to start building your score";
  const first = view[0];

  const chip = (
    <View style={styles.chip}>
      {t.icon ? <Ionicons name={t.icon} size={11} color={colors.textSecondary} /> : null}
      <Mono size={11} tracking={0.6} color={colors.textSecondary}>
        {t.text}
      </Mono>
    </View>
  );

  return (
    <View style={[INSTRUMENT_CARD, styles.card, style]}>
      <View
        style={styles.top}
        accessible
        accessibilityLabel={`Consistency ${score} out of 100, ${label}. ${sub}. Trend: ${t.text.toLowerCase()}.`}
      >
        <TileHeader label="Consistency" right={chip} />
        <View style={styles.figureRow}>
          <AppText variant="metric" color={WHITE} numberOfLines={1} style={styles.score}>
            {score}
          </AppText>
          <View style={styles.figureText}>
            <AppText variant="headline" weight="700" numberOfLines={1}>
              {label}
            </AppText>
            <Mono size={11} tracking={0.6} color={colors.textTertiary}>
              OF 100
            </Mono>
          </View>
        </View>
        <AppText variant="footnote" color="tertiary" style={styles.sub}>
          {sub}
        </AppText>
      </View>

      {/* The glow's own band, edge to edge and down to the card's foot. The
          line is white, so the orange can run right through it. */}
      <View style={styles.band}>
        <LinearGradient
          pointerEvents="none"
          colors={GLOW_ORANGE}
          locations={GLOW_AT}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {values.length > 1 ? (
          <>
            <View
              style={styles.chart}
              onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
            >
              {spark ? (
                <Animated.View style={chartStyle}>
                  <Svg width={width} height={CHART_H}>
                    {/* Where it starts: a small, quiet dot. */}
                    <Circle
                      cx={spark.points[0].x}
                      cy={spark.points[0].y}
                      r={3}
                      fill={alpha(WHITE, 0.85)}
                    />
                    {/* One dash as long as the whole curve, slid along: the line
                        is "drawn on" and no gap is ever visible. */}
                    <AnimatedPath
                      d={spark.d}
                      stroke={WHITE}
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      strokeDasharray={total}
                      animatedProps={lineProps}
                    />
                    {/* Where you are now: the ball on the pen's tip. */}
                    <AnimatedCircle
                      cx={spark.points[0].x}
                      cy={spark.points[0].y}
                      r={HALO}
                      fill={alpha(WHITE, 0.16)}
                      animatedProps={ballProps}
                    />
                    <AnimatedCircle
                      cx={spark.points[0].x}
                      cy={spark.points[0].y}
                      r={BALL}
                      fill={WHITE}
                      animatedProps={ballProps}
                    />
                  </Svg>
                </Animated.View>
              ) : null}
            </View>
            <View style={styles.axis}>
              <Mono size={10} tracking={0.6} color={alpha(WHITE, 0.6)}>
                {first ? first.label.toUpperCase() : ""}
              </Mono>
              <Mono size={10} tracking={0.6} color={alpha(WHITE, 0.6)}>
                TODAY
              </Mono>
            </View>
          </>
        ) : (
          <AppText variant="subhead" color="secondary" style={styles.empty}>
            Log meals on a couple of days and your line draws itself here.
          </AppText>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // The band runs edge to edge, so the card pads its top block instead of itself,
  // and clips the glow to its rounded corners.
  card: { padding: 0, overflow: "hidden" },
  top: { padding: Spacing.lg, paddingBottom: 0 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: alpha(WHITE, 0.2),
  },
  figureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  // The figure leads: the type scale's metric face, set larger and tighter.
  score: { fontSize: 46, lineHeight: 52, letterSpacing: -1.4, fontVariant: ["tabular-nums"] },
  figureText: { flex: 1, minWidth: 0, gap: 2 },
  sub: { marginTop: Spacing.sm },
  band: { marginTop: Spacing.md, paddingBottom: Spacing.md },
  chart: { height: CHART_H },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: PAD.x,
    marginTop: 2,
  },
  empty: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl },
});
