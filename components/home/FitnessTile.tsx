/**
 * FitnessTile — the fitness line: active minutes over the last seven days, and
 * the curve of that figure over the last four weeks.
 *
 * WHAT IT COUNTS is in components/home/fitnessLine.ts: minutes in a ROLLING
 * seven days, read off the workout log, so the figure here is exactly the right
 * end of the curve beside it. The chip compares it with the seven days before —
 * and is simply absent when there were none, because a percentage of zero is not
 * a number.
 *
 * The chip is deliberately neutral (no green, no red): more minutes is not
 * automatically better on a rest week, and colouring a drop as bad would be the
 * app having an opinion it has no business having.
 *
 * THE LINE DRAWS ITSELF ON THE WAY IN. Scroll down to the card and the line
 * travels from the left to where your activity has put it, with the orange dot
 * riding its tip. Whether and when is Home's call, handed over as one shared
 * value (`entrance`): 0 waits, empty, below the fold; 1 plays; 2 shows the
 * finished line with no motion (the card arrived from above, or the phone is
 * set to reduce motion). The decision lives in ./scrollEntrance.
 *
 * The card is the plain instrument surface — black, a thin white edge — the
 * same as the calorie hero and Your week (owner, 2026-10-31).
 *
 * Stroke and dot are both driven by ONE number — how far along the curve the pen
 * has got — so the dot cannot drift off the end of the line. It is a one-shot:
 * once it has arrived nothing animates, so the card costs nothing at rest.
 */
import { AppText, Mono, useColors } from "@/components/ui";
import { Ease } from "@/components/motion/motion";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { WorkoutLogEntry } from "@/models/workout";
import { Ionicons } from "@expo/vector-icons";
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
import { buildFitnessLine } from "./fitnessLine";
import { pointAtLength, sparkline } from "./sparkline";
import { HOME_ORANGE, INSTRUMENT_CARD } from "./surface";
import { TileHeader } from "./TileHeader";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CHART_HEIGHT = 64;
/** How long the pen takes to travel the whole line. */
const DRAW_MS = 1100;
const NO_POINTS: number[] = [];

export const FitnessTile = React.memo(function FitnessTile({
  log,
  today,
  entrance,
  style,
}: {
  log: readonly WorkoutLogEntry[];
  today: string;
  /**
   * 0 wait · 1 play · 2 show finished. Leave it out for a line that is simply
   * always drawn.
   */
  entrance?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);

  const line = useMemo(() => buildFitnessLine(log, today), [log, today]);
  const spark = useMemo(
    () => (width > 0 ? sparkline(line.series, width, CHART_HEIGHT) : null),
    [line.series, width],
  );

  // How far along the curve the pen has got, 0 → 1.
  const reveal = useSharedValue(entrance ? 0 : 1);
  useAnimatedReaction(
    () => (entrance ? entrance.value : 2),
    (state) => {
      if (state === 1 && !reduced) {
        reveal.value = withTiming(1, { duration: DRAW_MS, easing: Ease.standard });
      } else {
        // Assigning cancels a draw in flight; 0 wipes it while nobody is looking.
        reveal.value = state === 0 ? 0 : 1;
      }
    },
    [entrance, reduced],
  );

  // Stable references even before the chart has a width: the animated props
  // below capture these, and a fresh `[]` each render would make them rebuild.
  const trace = spark?.trace;
  const total = trace?.length ?? 0;
  const xs = trace?.xs ?? NO_POINTS;
  const ys = trace?.ys ?? NO_POINTS;
  const cum = trace?.cum ?? NO_POINTS;

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: total * (1 - reveal.value),
  }));
  const tipProps = useAnimatedProps(() => {
    const p = pointAtLength(xs, ys, cum, reveal.value * total);
    return { cx: p.x, cy: p.y };
  });
  // Nothing at all until the pen starts: an empty chart, then the line.
  const chartStyle = useAnimatedStyle(() => ({ opacity: reveal.value > 0 ? 1 : 0 }));

  const minutes = Math.round(line.minutes);
  const delta = line.deltaPct;
  const spoken =
    `Fitness: ${minutes} active minutes in the last 7 days` +
    (delta == null
      ? ""
      : delta === 0
        ? ", the same as the 7 days before"
        : `, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} percent on the 7 days before`);

  const chip =
    delta == null ? null : (
      <View style={[styles.chip, { borderColor: colors.border }]}>
        {delta !== 0 ? (
          <Ionicons
            name={delta > 0 ? "arrow-up" : "arrow-down"}
            size={11}
            color={colors.textSecondary}
          />
        ) : null}
        <Mono size={11} color={colors.textSecondary}>
          {Math.abs(delta)}%
        </Mono>
      </View>
    );

  return (
    <View style={[INSTRUMENT_CARD, style]}>
      <View accessible accessibilityLabel={spoken}>
        <TileHeader label="Fitness" right={chip} />

        <View style={styles.body}>
          <View style={styles.figure}>
            <View style={styles.valueRow}>
              <AppText variant="display" weight="600" style={styles.value}>
                {minutes}
              </AppText>
              <AppText variant="subhead" color="tertiary">
                min
              </AppText>
            </View>
            <Mono size={11} tracking={0.6} color={colors.textTertiary}>
              LAST 7 DAYS
            </Mono>
          </View>

          <View
            style={styles.chart}
            onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
          >
            {spark && spark.end ? (
              <Animated.View style={chartStyle}>
                <Svg width={width} height={CHART_HEIGHT}>
                  {/* One dash as long as the whole line, slid along: the stroke
                      is "drawn on" and no gap is ever visible. */}
                  <AnimatedPath
                    d={spark.d}
                    stroke={alpha(colors.text, 0.92)}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    strokeDasharray={total}
                    animatedProps={lineProps}
                  />
                  <AnimatedCircle
                    cx={spark.points[0].x}
                    cy={spark.points[0].y}
                    r={7}
                    fill={alpha(HOME_ORANGE, 0.22)}
                    animatedProps={tipProps}
                  />
                  <AnimatedCircle
                    cx={spark.points[0].x}
                    cy={spark.points[0].y}
                    r={3.5}
                    fill={HOME_ORANGE}
                    animatedProps={tipProps}
                  />
                </Svg>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  figure: { flexShrink: 0, gap: 2 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  value: { fontVariant: ["tabular-nums"] },
  chart: { flex: 1, height: CHART_HEIGHT, minWidth: 0 },
});
