/**
 * WeekPie — an interactive pie that turns a week of adherence into one glance.
 *
 * The seven days are tallied into four statuses (on-plan / partial / missed /
 * untracked) and drawn as a filled Skia pie that fans in on mount. Tap a wedge —
 * or its legend row — and it explodes outward while the rest dim and the legend
 * highlights its day count; tap again to reset. A plain react-native-svg pie
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
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import type { SkiaWeekPieProps, SkiaWeekPieSegment } from "./WeekPie.skia";

let SkiaPie: React.ComponentType<SkiaWeekPieProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaPie = require("./WeekPie.skia").SkiaWeekPie;
}

const SIZE = 150;
const POP = 8;
const R = SIZE / 2 - POP - 2;

// Deliberately light, friendly hues — green / orange / pink / blue.
const LIGHT = {
  completed: "#7BD88F",
  partial: "#F5B368",
  skipped: "#F49CC4",
  none: "#6FB1F0",
} as const;

type Status = DayAdherence["status"];

interface Cat {
  key: Status;
  label: string;
  color: string;
}

const CATS: Cat[] = [
  { key: "completed", label: "On plan", color: LIGHT.completed },
  { key: "partial", label: "Partial", color: LIGHT.partial },
  { key: "skipped", label: "Missed", color: LIGHT.skipped },
  { key: "none", label: "Untracked", color: LIGHT.none },
];

export interface WeekPieProps {
  days: DayAdherence[];
}

export function WeekPie({ days }: WeekPieProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const [selected, setSelected] = useState<Status | null>(null);

  const counts = useMemo(() => {
    const m: Record<Status, number> = { completed: 0, partial: 0, skipped: 0, none: 0 };
    days.forEach((d) => {
      m[d.status] += 1;
    });
    return m;
  }, [days]);

  const total = days.length || 1;

  // Always four segments (zero sweep for absent statuses) so the pie's hook
  // count is stable; cumulative angles clockwise from 12 o'clock.
  const segments = useMemo<SkiaWeekPieSegment[]>(() => {
    let cum = 0;
    return CATS.map((c) => {
      const sweep = (counts[c.key] / total) * 360;
      const seg = { key: c.key, color: c.color, startAngle: cum, sweepAngle: sweep };
      cum += sweep;
      return seg;
    });
  }, [counts, total]);

  const present = useMemo(() => CATS.filter((c) => counts[c.key] > 0), [counts]);

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
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    if (Math.hypot(dx, dy) > R + POP) {
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
    [segments],
  );

  return (
    <View style={styles.row}>
      <GestureDetector gesture={tap}>
        <View style={{ width: SIZE, height: SIZE }}>
          {SkiaPie ? (
            <SkiaPie
              size={SIZE}
              segments={segments}
              progress={progress}
              selectedKey={selected}
              separator={colors.background}
            />
          ) : (
            <FallbackPie segments={segments} selectedKey={selected} separator={colors.background} />
          )}
        </View>
      </GestureDetector>

      {/* Legend — doubles as a second way to isolate a status */}
      <View style={styles.legend}>
        {present.map((c) => {
          const active = selected === c.key;
          const dim = selected != null && !active;
          return (
            <Pressable
              key={c.key}
              onPress={() => selectStatus(c.key)}
              hitSlop={6}
              style={[styles.legendRow, { opacity: dim ? 0.45 : 1 }]}
            >
              <View style={[styles.legendDot, { backgroundColor: c.color }]} />
              <AppText variant="footnote" color="secondary" style={styles.flex}>
                {c.label}
              </AppText>
              <AppText
                variant="footnote"
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

/** Static (no fan-in) SVG pie for the Skia-less path. */
function FallbackPie({
  segments,
  selectedKey,
  separator,
}: {
  segments: SkiaWeekPieSegment[];
  selectedKey: string | null;
  separator: string;
}) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const anySelected = selectedKey != null;
  const pt = (deg: number): [number, number] => {
    const a = ((-90 + deg) * Math.PI) / 180;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  };
  return (
    <Svg width={SIZE} height={SIZE}>
      {segments.map((seg) => {
        if (seg.sweepAngle <= 0.05) return null;
        const selected = seg.key === selectedKey;
        const mid = ((-90 + seg.startAngle + seg.sweepAngle / 2) * Math.PI) / 180;
        const tx = selected ? Math.cos(mid) * POP : 0;
        const ty = selected ? Math.sin(mid) * POP : 0;
        const opacity = anySelected && !selected ? 0.4 : 1;
        if (seg.sweepAngle >= 359.99) {
          return (
            <Circle key={seg.key} cx={cx} cy={cy} r={R} fill={seg.color} opacity={opacity} />
          );
        }
        const [x0, y0] = pt(seg.startAngle);
        const [x1, y1] = pt(seg.startAngle + seg.sweepAngle);
        const large = seg.sweepAngle > 180 ? 1 : 0;
        const d = `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
        return (
          <Path
            key={seg.key}
            d={d}
            fill={seg.color}
            stroke={separator}
            strokeWidth={2}
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
  legend: { flex: 1, gap: Spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  legendDot: { width: 11, height: 11, borderRadius: 3 },
  legendCount: { fontWeight: "700", fontVariant: ["tabular-nums"] },
});
