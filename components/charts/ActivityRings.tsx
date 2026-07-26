/**
 * ActivityRings — a premium concentric-ring dashboard for three weekly metrics.
 *
 * The headline is a stack of Apple-Fitness-style rings (outer → inner) that fan
 * in together on mount, with a compact centre readout and a colour-keyed legend
 * beneath. Every ring is a real metric: days trained, session intensity, active
 * minutes — nothing invented. Skia draws the rings with a lock-step reveal when
 * available; a plain react-native-svg ring set stands in everywhere else, so
 * there is always a full chart on screen.
 */
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import type { SkiaActivityRingsProps, SkiaRingSpec } from "./ActivityRings.skia";

let SkiaRings: React.ComponentType<SkiaActivityRingsProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaRings = require("./ActivityRings.skia").SkiaActivityRings;
}

export interface ActivityRingMetric {
  key: string;
  /** Short legend label, e.g. "Days". */
  label: string;
  color: string;
  /** Goal completion 0–1+ (values >1 read as complete on the ring). */
  fraction: number;
  /** Legend readout, e.g. "2 / 3" or "88%". */
  valueText: string;
}

export interface ActivityRingsProps {
  /** Exactly three metrics, outer ring first. */
  metrics: ActivityRingMetric[];
  size?: number;
  /** Big centre number (e.g. "76%"). */
  centerValue?: string;
  /** Caption under the centre number. */
  centerLabel?: string;
  /** Changing this replays the fan-in. */
  animKey?: string;
}

const DEFAULT_SIZE = 216;

export function ActivityRings({
  metrics,
  size = DEFAULT_SIZE,
  centerValue,
  centerLabel,
  animKey,
}: ActivityRingsProps) {
  const { colors, isDark } = useColors();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();

  // Ring geometry: three even bands from the outer edge inward. The outer ring is
  // pinned at the edge; a tight hairline gap packs the inner rings outward so the
  // centre hole is roomy enough for the readout — the rings almost touch.
  const stroke = Math.round(size * 0.078);
  const gap = Math.max(2, Math.round(stroke * 0.16));
  const rOuter = size / 2 - stroke / 2 - 2;
  const radii = [rOuter, rOuter - (stroke + gap), rOuter - 2 * (stroke + gap)];
  const track = isDark ? alpha(colors.text, 0.08) : alpha(colors.text, 0.06);

  const rings = useMemo<SkiaRingSpec[]>(
    () =>
      metrics.slice(0, 3).map((m, i) => ({
        key: m.key,
        color: m.color,
        track: alpha(m.color, isDark ? 0.16 : 0.12),
        fraction: m.fraction,
        radius: radii[i],
      })),
    // radii derive from size; recompute when the metric set or size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, size, isDark],
  );

  // Fan in on a cold-start reveal and whenever the data changes; snap on a warm
  // first paint (navigating back to the screen).
  const firstRun = useRef(true);
  const progress = useSharedValue(reduced || !intro ? 1 : 0);
  useEffect(() => {
    const isFirst = firstRun.current;
    firstRun.current = false;
    if (reduced || (isFirst && !intro)) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: 900, easing: Ease.decelerate });
    // `intro` is captured once at mount and never changes — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, reduced, progress]);

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        {SkiaRings ? (
          <SkiaRings size={size} strokeWidth={stroke} rings={rings} progress={progress} />
        ) : (
          <FallbackRings size={size} stroke={stroke} rings={rings} track={track} />
        )}

        {(centerValue || centerLabel) && (
          <View style={styles.center} pointerEvents="none">
            {!!centerValue && (
              <AppText variant="display" style={styles.centerNum}>
                {centerValue}
              </AppText>
            )}
            {!!centerLabel && (
              <AppText variant="caption" color="tertiary" uppercase style={styles.centerCap}>
                {centerLabel}
              </AppText>
            )}
          </View>
        )}
      </View>

      {/* Legend — one colour-keyed column per ring */}
      <View style={styles.legend}>
        {metrics.slice(0, 3).map((m) => (
          <View key={m.key} style={styles.legendCol}>
            <View style={styles.legendHead}>
              <View style={[styles.dot, { backgroundColor: m.color }]} />
              <AppText variant="caption" color="tertiary" uppercase numberOfLines={1}>
                {m.label}
              </AppText>
            </View>
            <AppText variant="headline" style={styles.legendVal}>
              {m.valueText}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Static (no fan-in) SVG rings for the Skia-less path. */
function FallbackRings({
  size,
  stroke,
  rings,
  track,
}: {
  size: number;
  stroke: number;
  rings: SkiaRingSpec[];
  track: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  return (
    <Svg width={size} height={size}>
      {rings.map((ring) => {
        const c = 2 * Math.PI * ring.radius;
        const frac = Math.max(0, Math.min(1, ring.fraction));
        return (
          <React.Fragment key={ring.key}>
            <Circle
              cx={cx}
              cy={cy}
              r={ring.radius}
              fill="none"
              stroke={track}
              strokeWidth={stroke}
            />
            {frac > 0.001 && (
              <Circle
                cx={cx}
                cy={cy}
                r={ring.radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - frac)}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", alignSelf: "stretch" },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerNum: { fontVariant: ["tabular-nums"] },
  centerCap: { marginTop: 2, letterSpacing: 0.4 },
  legend: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-around",
    marginTop: Spacing.xl,
  },
  legendCol: { alignItems: "center", gap: 4, flex: 1 },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 3 },
  legendVal: { fontWeight: "800", fontVariant: ["tabular-nums"] },
});
