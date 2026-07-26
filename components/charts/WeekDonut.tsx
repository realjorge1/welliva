/**
 * WeekDonut — an interactive donut that turns a week of adherence into one
 * glance, in bold colour.
 *
 * The seven days are tallied into four statuses (on-plan / partial / missed /
 * untracked) and drawn as a filled Skia donut that fans in on mount. The hollow
 * centre carries the headline — average adherence — and switches to a status's
 * day-count when you isolate it. Tap a wedge (or its legend row) and it lifts
 * outward while the rest dim; tap again to reset. A plain react-native-svg donut
 * stands in wherever Skia isn't available.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { AppText, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { DayAdherence } from "@/services/intelligence";
import * as Haptics from "@/utils/haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import type { SkiaWeekDonutProps, SkiaWeekDonutSegment } from "./WeekDonut.skia";

let SkiaDonut: React.ComponentType<SkiaWeekDonutProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaDonut = require("./WeekDonut.skia").SkiaWeekDonut;
}

const POP = 9;
const INNER_RATIO = 0.6; // hole radius / outer radius — a wide, modern donut ring
const DEFAULT_SIZE = 168;
const MIN_SIZE = 148;
const MAX_SIZE = 184;

// Bold, saturated status hues — punchy against the light page, and legible when
// a single wedge is isolated. Untracked stays a quiet slate so logged days lead.
const BOLD = {
  completed: "#12C48B", // emerald
  partial: "#FF9F1C", // amber
  skipped: "#FF4D6D", // rose
  none: "#9AA6B8", // slate (recedes)
} as const;

type Status = DayAdherence["status"];

interface Cat {
  key: Status;
  label: string;
  color: string;
}

const CATS: Cat[] = [
  { key: "completed", label: "On plan", color: BOLD.completed },
  { key: "partial", label: "Partial", color: BOLD.partial },
  { key: "skipped", label: "Missed", color: BOLD.skipped },
  { key: "none", label: "Untracked", color: BOLD.none },
];

export interface WeekDonutProps {
  days: DayAdherence[];
}

export function WeekDonut({ days }: WeekDonutProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const [selected, setSelected] = useState<Status | null>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);

  const counts = useMemo(() => {
    const m: Record<Status, number> = { completed: 0, partial: 0, skipped: 0, none: 0 };
    days.forEach((d) => {
      m[d.status] += 1;
    });
    return m;
  }, [days]);

  const total = days.length || 1;

  // Average adherence across logged days (0–100) — the headline in the hole,
  // matching computeWeeklySummary's definition.
  const adherence = useMemo(() => {
    const logged = days.filter((d) => d.status !== "none");
    if (logged.length === 0) return 0;
    return Math.round(
      (logged.reduce((s, d) => s + d.pct, 0) / logged.length) * 100,
    );
  }, [days]);

  // Always four segments (zero sweep for absent statuses) so the donut's hook
  // count is stable; cumulative angles clockwise from 12 o'clock.
  const segments = useMemo<SkiaWeekDonutSegment[]>(() => {
    let cum = 0;
    return CATS.map((c) => {
      const sweep = (counts[c.key] / total) * 360;
      const seg = { key: c.key, color: c.color, startAngle: cum, sweepAngle: sweep };
      cum += sweep;
      return seg;
    });
  }, [counts, total]);

  const present = useMemo(() => CATS.filter((c) => counts[c.key] > 0), [counts]);

  const R = size / 2 - POP - 2;
  const rInner = R * INNER_RATIO;

  // Fan in on a cold-start reveal and whenever the week's data actually changes,
  // but snap on a warm first paint (navigating back to this screen).
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
    progress.value = withTiming(1, { duration: 850, easing: Ease.decelerate });
    // `intro` is captured once at mount and never changes — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length, reduced, progress]);

  const selectStatus = (key: Status | null) => {
    setSelected((prev) => (prev === key ? null : key));
    if (key) Haptics.selectionAsync().catch(() => {});
  };

  const onTapAt = (x: number, y: number) => {
    const dx = x - size / 2;
    const dy = y - size / 2;
    const dist = Math.hypot(dx, dy);
    // Only the ring is interactive — the hole and the outside deselect.
    if (dist > R + POP || dist < rInner) {
      setSelected(null);
      return;
    }
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const fromTop = (deg + 90 + 360) % 360;
    const seg = segments.find(
      (s) => s.sweepAngle > 0 && fromTop >= s.startAngle && fromTop < s.startAngle + s.sweepAngle,
    );
    if (seg) selectStatus(seg.key as Status);
    else setSelected(null);
  };

  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd((e) => {
        runOnJS(onTapAt)(e.x, e.y);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, size],
  );

  // Responsive: size the donut from the available width so it scales across
  // phones without ever crowding the legend.
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    const next = Math.round(Math.max(MIN_SIZE, Math.min(MAX_SIZE, w * 0.46)));
    if (Math.abs(next - size) > 1) setSize(next);
  };

  const activeCat = selected ? CATS.find((c) => c.key === selected) : null;
  const centerColor = activeCat ? activeCat.color : colors.text;

  return (
    <View style={styles.row} onLayout={onLayout}>
      <View style={{ width: size, height: size }}>
        <GestureDetector gesture={tap}>
          <View style={StyleSheet.absoluteFill}>
            {SkiaDonut ? (
              <SkiaDonut
                size={size}
                innerRatio={INNER_RATIO}
                segments={segments}
                progress={progress}
                selectedKey={selected}
                separator={colors.background}
              />
            ) : (
              <FallbackDonut
                size={size}
                segments={segments}
                selectedKey={selected}
                separator={colors.background}
              />
            )}
          </View>
        </GestureDetector>

        {/* Centre readout — headline adherence, or the isolated status's count */}
        <View style={styles.center} pointerEvents="none">
          {activeCat ? (
            <>
              <AppText variant="display" color={centerColor} style={styles.centerNum}>
                {counts[activeCat.key]}
              </AppText>
              <AppText variant="caption" color="tertiary" uppercase style={styles.centerCap}>
                {counts[activeCat.key] === 1 ? "day" : "days"} · {activeCat.label}
              </AppText>
            </>
          ) : (
            <>
              <AppText variant="display" color={centerColor} style={styles.centerNum}>
                {adherence}
                <AppText variant="headline" color="tertiary">
                  %
                </AppText>
              </AppText>
              <AppText variant="caption" color="tertiary" uppercase style={styles.centerCap}>
                Adherence
              </AppText>
            </>
          )}
        </View>
      </View>

      {/* Legend — doubles as a second way to isolate a status */}
      <View style={styles.legend}>
        {present.map((c) => {
          const active = selected === c.key;
          const dim = selected != null && !active;
          const pct = Math.round((counts[c.key] / total) * 100);
          return (
            <Pressable
              key={c.key}
              onPress={() => selectStatus(c.key)}
              hitSlop={6}
              style={[styles.legendRow, { opacity: dim ? 0.4 : 1 }]}
            >
              <View style={[styles.legendDot, { backgroundColor: c.color }]} />
              <View style={styles.flex}>
                <AppText variant="footnote" color="secondary" numberOfLines={1}>
                  {c.label}
                </AppText>
                <AppText variant="caption" color="tertiary">
                  {pct}% of week
                </AppText>
              </View>
              <AppText
                variant="headline"
                style={[styles.legendCount, { color: active ? c.color : colors.text }]}
              >
                {counts[c.key]}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Static (no fan-in) SVG donut for the Skia-less path. */
function FallbackDonut({
  size,
  segments,
  selectedKey,
  separator,
}: {
  size: number;
  segments: SkiaWeekDonutSegment[];
  selectedKey: string | null;
  separator: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - POP - 2;
  const r = R * INNER_RATIO;
  const anySelected = selectedKey != null;
  const pt = (deg: number, radius: number): [number, number] => {
    const a = ((-90 + deg) * Math.PI) / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  };
  return (
    <Svg width={size} height={size}>
      {segments.map((seg) => {
        if (seg.sweepAngle <= 0.05) return null;
        const selected = seg.key === selectedKey;
        const mid = ((-90 + seg.startAngle + seg.sweepAngle / 2) * Math.PI) / 180;
        const tx = selected ? Math.cos(mid) * POP : 0;
        const ty = selected ? Math.sin(mid) * POP : 0;
        const opacity = anySelected && !selected ? 0.35 : 1;
        // A single full-circle status draws as a stroked ring (no seams to join).
        if (seg.sweepAngle >= 359.99) {
          return (
            <Circle
              key={seg.key}
              cx={cx}
              cy={cy}
              r={(R + r) / 2}
              fill="none"
              stroke={seg.color}
              strokeWidth={R - r}
              opacity={opacity}
            />
          );
        }
        const [ox0, oy0] = pt(seg.startAngle, R);
        const [ox1, oy1] = pt(seg.startAngle + seg.sweepAngle, R);
        const [ix1, iy1] = pt(seg.startAngle + seg.sweepAngle, r);
        const [ix0, iy0] = pt(seg.startAngle, r);
        const large = seg.sweepAngle > 180 ? 1 : 0;
        const d = `M ${ox0} ${oy0} A ${R} ${R} 0 ${large} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix0} ${iy0} Z`;
        return (
          <Path
            key={seg.key}
            d={d}
            fill={seg.color}
            stroke={separator}
            strokeWidth={2.5}
            opacity={opacity}
            transform={`translate(${tx} ${ty})`}
          />
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.xl },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerNum: { fontVariant: ["tabular-nums"] },
  centerCap: { marginTop: 2, textAlign: "center", letterSpacing: 0.3 },
  legend: { flex: 1, gap: Spacing.md },
  legendRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 4 },
  legendCount: { fontWeight: "800", fontVariant: ["tabular-nums"] },
});
