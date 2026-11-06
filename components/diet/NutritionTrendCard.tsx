/**
 * NutritionTrendCard — calories, protein, carbs and fat on each finished day, as
 * a share of your daily target.
 *
 * Owner, 2026-10-31, on the card this replaced: "what does it do? It's just empty
 * and static." It was both: it opened on the one range that had nothing in it,
 * and its four lines were each indexed to their own first day, which nobody could
 * read without the footnote. Rebuilt on the instrument surface (black, a thin
 * white edge — the Consistency card's sibling) with a scale that means one thing:
 *
 *   · 100% IS THE TARGET, drawn as one faint solid line. A macro above it went
 *     over, below it fell short. All four share the scale, so they can be
 *     compared at a glance — the arithmetic is in ./nutritionTrend.
 *   · IT OPENS WHERE THERE IS SOMETHING TO SEE: the first range you can view
 *     that has two finished days with food in it. When none does, it says how
 *     many it has and why today doesn't count yet, instead of a blank box.
 *   · IT MOVES. Scroll down to it and the four lines draw on, left to right, a
 *     dot riding each tip (the same pen as the Fitness and Consistency lines).
 *     Change the range and they draw again. Drag across the chart to read any
 *     day: a hairline marks it and the legend shows what was eaten that day and
 *     its share of the target. Tap a macro to fold its line away.
 *
 * Nothing loops: after the draw-on the card is still until you touch it.
 */
import { pointAtLength } from "@/components/home/sparkline";
import { HOME_ORANGE, INSTRUMENT_CARD, MACRO_VIVID } from "@/components/home/surface";
import { TileHeader } from "@/components/home/TileHeader";
import { Ease } from "@/components/motion/motion";
import { AppText, Mono, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { DietHistoryEntry } from "@/models/diet";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useDayAdjustments } from "@/contexts/domain/useDayTarget";
import { dayCalorieDelta } from "@/services/nutrition/dayTargets";
import {
  TREND_KEYS,
  buildNutritionTrend,
  pickTrendRange,
  trendGeometry,
  type TrendKey,
  type TrendLine,
  type TrendTargets,
} from "./nutritionTrend";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const WHITE = "#FFFFFF";
const CHART_H = 156;
/** Room round the lines for their end dots and the scrub dots. */
const PAD = { x: 12, top: 14, bottom: 10 };
/** How long the pen takes to travel the lines. */
const DRAW_MS = 1200;

const META: Record<TrendKey, { label: string; unit: string; color: string }> = {
  calories: { label: "Calories", unit: "kcal", color: HOME_ORANGE },
  protein: { label: "Protein", unit: "g", color: MACRO_VIVID.protein },
  carbs: { label: "Carbs", unit: "g", color: MACRO_VIVID.carbs },
  fat: { label: "Fat", unit: "g", color: MACRO_VIVID.fat },
};

export interface TrendRange {
  key: string;
  /** "1 wk". */
  label: string;
  days: number;
  /** Beyond the viewer's plan: the tab shows, can't open, and routes its tap. */
  locked?: boolean;
}

export interface NutritionTrendCardProps {
  history: DietHistoryEntry[];
  today: string;
  targets: TrendTargets | null;
  ranges: TrendRange[];
  /** Tapped a locked range — typically opens the paywall. */
  onLockedRangePress?: (key: string) => void;
  /** 0 wait · 1 play · 2 show finished — see components/home/scrollEntrance. */
  entrance?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}

const fmt = (v: number) => Math.round(v).toLocaleString();

export const NutritionTrendCard = React.memo(function NutritionTrendCard({
  history,
  today,
  targets,
  ranges,
  onLockedRangePress,
  entrance,
  style,
}: NutritionTrendCardProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<TrendKey>>(new Set());
  const [active, setActive] = useState<number | null>(null);

  // A day with its own target (a hungrier-week day) is measured against that one.
  const adjustments = useDayAdjustments();
  const trends = useMemo(
    () =>
      ranges.map((range) => ({
        range,
        trend: buildNutritionTrend(history, today, range.days, targets, (d) => dayCalorieDelta(d, adjustments)),
      })),
    [ranges, history, today, targets, adjustments],
  );

  // Until you pick one, the range follows the data: history loads after the
  // card mounts, and a choice made against an empty list would stick.
  const autoKey = pickTrendRange(
    trends.map((t) => ({ key: t.range.key, locked: !!t.range.locked, days: t.trend.days.length })),
  );
  const activeKey = chosen ?? autoKey;
  const current =
    trends.find((t) => t.range.key === activeKey && !t.range.locked) ??
    trends.find((t) => !t.range.locked) ??
    trends[0];
  const days = current?.trend.days ?? [];
  const drawable = !!targets && days.length >= 2;

  const geo = useMemo(
    () => (drawable && width > 0 && current ? trendGeometry(current.trend, width, CHART_H, PAD) : null),
    [drawable, width, current],
  );

  /* ── The draw-on ─────────────────────────────────────────────────────── */
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
  // A new range draws again — unless the card is off screen, waiting to arrive.
  const shownKey = current?.range.key;
  const firstKey = useRef(shownKey);
  useEffect(() => {
    if (shownKey === firstKey.current) return;
    firstKey.current = shownKey;
    if (entrance && entrance.value === 0) return;
    if (reduced) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: DRAW_MS, easing: Ease.standard });
  }, [shownKey, entrance, reduced, reveal]);
  const chartStyle = useAnimatedStyle(() => ({ opacity: reveal.value > 0 ? 1 : 0 }));

  /* ── Reading a day ───────────────────────────────────────────────────── */
  const count = days.length;
  const x0 = geo?.xs[0] ?? 0;
  const x1 = geo?.xs[count - 1] ?? 0;
  const lastIdx = useSharedValue(-1);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(count >= 2)
        // Claim a sideways drag; let the page scroll on a vertical one.
        .activeOffsetX([-8, 8])
        .failOffsetY([-14, 14])
        .onStart((e) => {
          const span = Math.max(1, x1 - x0);
          const i = Math.min(count - 1, Math.max(0, Math.round(((e.x - x0) / span) * (count - 1))));
          lastIdx.value = i;
          runOnJS(setActive)(i);
        })
        .onUpdate((e) => {
          const span = Math.max(1, x1 - x0);
          const i = Math.min(count - 1, Math.max(0, Math.round(((e.x - x0) / span) * (count - 1))));
          if (i !== lastIdx.value) {
            lastIdx.value = i;
            runOnJS(setActive)(i);
          }
        })
        .onFinalize(() => {
          lastIdx.value = -1;
          runOnJS(setActive)(null);
        }),
    [count, x0, x1, lastIdx],
  );

  const toggle = (k: TrendKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else if (TREND_KEYS.length - next.size > 1) next.add(k); // keep one line
      return next;
    });

  // The day the legend reads: the one under the finger, else each macro's latest.
  const readingFor = (k: TrendKey): { amount: number | null; pct: number | null } => {
    if (active != null && days[active]) {
      return { amount: days[active].amount[k], pct: days[active].pct[k] };
    }
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].amount[k] != null) return { amount: days[i].amount[k], pct: days[i].pct[k] };
    }
    return { amount: null, pct: null };
  };

  const caption =
    active != null && days[active]
      ? days[active].fullLabel.toUpperCase()
      : drawable
        ? "% OF YOUR DAILY TARGET"
        : "EACH FINISHED DAY";

  const tabs = (
    <View style={styles.tabs}>
      {ranges.map((r) => {
        const on = r.key === current?.range.key;
        return (
          <Pressable
            key={r.key}
            onPress={() => {
              if (r.locked) {
                onLockedRangePress?.(r.key);
                return;
              }
              setChosen(r.key);
              setActive(null);
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={r.locked ? `${r.label}, needs Pro` : r.label}
            accessibilityState={{ selected: on, disabled: !!r.locked }}
            style={[styles.tab, on && styles.tabOn]}
          >
            {r.locked ? <Ionicons name="lock-closed" size={9} color={colors.gold} /> : null}
            <Mono
              size={11}
              tracking={0.4}
              color={r.locked ? colors.gold : on ? WHITE : colors.textTertiary}
            >
              {r.label.toUpperCase()}
            </Mono>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[INSTRUMENT_CARD, style]}>
      <TileHeader label="Nutrition trends" right={tabs} />
      <Mono size={11} tracking={0.8} color={colors.textTertiary} style={styles.caption}>
        {caption}
      </Mono>

      {drawable ? (
        <>
          <GestureDetector gesture={pan}>
            <View
              style={styles.chart}
              onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
              accessible
              accessibilityLabel={`Nutrition trends, ${current?.range.label}. Latest finished day: ${TREND_KEYS.map(
                (k) => {
                  const r = readingFor(k);
                  return r.pct == null ? `${META[k].label} no reading` : `${META[k].label} ${r.pct} percent of target`;
                },
              ).join(", ")}.`}
              accessibilityHint="Drag across to read any day"
            >
              {geo ? (
                <Animated.View style={chartStyle}>
                  <Svg width={width} height={CHART_H}>
                    {/* The target: one faint, solid line. */}
                    <Line
                      x1={PAD.x}
                      x2={width - PAD.x}
                      y1={geo.targetY}
                      y2={geo.targetY}
                      stroke={alpha(WHITE, 0.26)}
                      strokeWidth={1}
                    />
                    {TREND_KEYS.filter((k) => !hidden.has(k)).map((k) => (
                      <TrendStroke key={k} line={geo.lines[k]} color={META[k].color} reveal={reveal} />
                    ))}
                    {active != null ? (
                      <>
                        <Line
                          x1={geo.xs[active]}
                          x2={geo.xs[active]}
                          y1={PAD.top - 6}
                          y2={CHART_H}
                          stroke={alpha(WHITE, 0.4)}
                          strokeWidth={1}
                        />
                        {TREND_KEYS.filter((k) => !hidden.has(k)).map((k) => {
                          const p = geo.lines[k].points[active];
                          return p ? (
                            <Circle
                              key={k}
                              cx={p.x}
                              cy={p.y}
                              r={4.5}
                              fill={META[k].color}
                              stroke="#000000"
                              strokeWidth={2}
                            />
                          ) : null;
                        })}
                      </>
                    ) : null}
                  </Svg>
                  <Mono
                    size={9}
                    tracking={0.6}
                    color={alpha(WHITE, 0.5)}
                    style={[styles.targetTag, { top: geo.targetY - 14 }]}
                  >
                    TARGET
                  </Mono>
                </Animated.View>
              ) : null}
            </View>
          </GestureDetector>
          <View style={styles.axis}>
            <Mono size={10} tracking={0.6} color={colors.textTertiary}>
              {days[0].label.toUpperCase()}
            </Mono>
            <Mono size={10} tracking={0.6} color={colors.textTertiary}>
              {days[count - 1].label.toUpperCase()}
            </Mono>
          </View>

          <View style={styles.legend}>
            {TREND_KEYS.map((k) => {
              const m = META[k];
              const off = hidden.has(k);
              const r = readingFor(k);
              return (
                <Pressable
                  key={k}
                  onPress={() => toggle(k)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !off }}
                  accessibilityLabel={
                    r.amount != null
                      ? `${m.label}, ${fmt(r.amount)} ${m.unit}${r.pct != null ? `, ${r.pct} percent of target` : ""}`
                      : `${m.label}, no reading`
                  }
                  accessibilityHint="Shows or hides this line"
                  style={({ pressed }) => [
                    styles.chip,
                    { opacity: off ? 0.42 : pressed ? 0.8 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: off ? "transparent" : m.color, borderColor: m.color },
                    ]}
                  />
                  <View style={styles.chipText}>
                    <Mono size={10} tracking={0.6} color={colors.textTertiary} numberOfLines={1}>
                      {m.label.toUpperCase()}
                    </Mono>
                    <View style={styles.chipValue}>
                      <AppText variant="callout" weight="700" numberOfLines={1}>
                        {r.amount != null ? fmt(r.amount) : "–"}
                      </AppText>
                      {r.amount != null ? (
                        <Mono size={10} color={colors.textTertiary}>
                          {m.unit}
                        </Mono>
                      ) : null}
                    </View>
                  </View>
                  {r.pct != null ? (
                    <Mono size={11} color={m.color}>
                      {r.pct}%
                    </Mono>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <AppText variant="caption" color="tertiary" align="center" style={styles.foot}>
            {Object.keys(adjustments).length
              ? "Each finished day against today's targets, with any hungrier-week change. Drag to read a day."
              : "Each finished day against today's targets. Drag to read a day."}
          </AppText>
        </>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="analytics-outline" size={22} color={colors.textTertiary} />
          <AppText variant="subhead" color="secondary" align="center">
            {!targets
              ? "Set your daily targets and each day shows here against them."
              : days.length === 0
                ? "No finished days with food logged in this range yet."
                : "One finished day with food logged so far — a line needs two."}
          </AppText>
          {targets ? (
            <AppText variant="footnote" color="tertiary" align="center">
              Today joins the chart once it&apos;s over.
            </AppText>
          ) : null}
        </View>
      )}
    </View>
  );
});

/** One macro's line, drawn on by `reveal`, with a dot riding its tip. */
function TrendStroke({
  line,
  color,
  reveal,
}: {
  line: TrendLine;
  color: string;
  reveal: SharedValue<number>;
}) {
  const total = line.trace.length;
  const xs = line.trace.xs;
  const ys = line.trace.ys;
  const cum = line.trace.cum;

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: total * (1 - reveal.value),
  }));
  const tipProps = useAnimatedProps(() => {
    const p = pointAtLength(xs, ys, cum, reveal.value * total);
    return { cx: p.x, cy: p.y };
  });

  if (!line.end) return null;
  const start = line.points.find((p) => p != null) ?? line.end;
  return (
    <>
      {total > 0 ? (
        // One dash as long as the whole line, slid along: drawn on, and no gap
        // is ever visible.
        <AnimatedPath
          d={line.d}
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={total}
          animatedProps={lineProps}
        />
      ) : null}
      <AnimatedCircle cx={start.x} cy={start.y} r={3.5} fill={color} animatedProps={tipProps} />
    </>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", alignItems: "center", gap: 2 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  tabOn: { backgroundColor: alpha(WHITE, 0.14) },
  caption: { marginTop: Spacing.xs },
  chart: { height: CHART_H, marginTop: Spacing.sm },
  targetTag: { position: "absolute", right: PAD.x },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: PAD.x - 4,
    marginTop: 2,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexGrow: 1,
    flexBasis: "46%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: alpha(WHITE, 0.06),
  },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  chipText: { flex: 1, minWidth: 0, gap: 1 },
  chipValue: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  foot: { marginTop: Spacing.md },
  empty: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
});
