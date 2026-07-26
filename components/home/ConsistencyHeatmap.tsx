/**
 * ConsistencyHeatmap — a GitHub-style activity grid built from the user's real
 * logs (weeks as columns, weekdays as rows). Every cell's intensity is derived
 * from that day's actual training + nutrition adherence — nothing invented.
 *
 * Skia draws it with a left→right wipe when available; otherwise a plain View
 * grid with a single fade renders the same geometry and colors. There is always
 * a heatmap on screen.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { useColors } from "@/components/ui";
import { Motion, alpha } from "@/constants/theme";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { SkiaHeatmapProps } from "./ConsistencyHeatmap.skia";

let SkiaHeatmap: React.ComponentType<SkiaHeatmapProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaHeatmap = require("./ConsistencyHeatmap.skia").SkiaConsistencyHeatmap;
}

export interface ConsistencyHeatmapProps {
  /** matrix[col][row] — intensity 0–1, or -1 for a cell that shouldn't render. */
  matrix: number[][];
  accent: string;
  cell?: number;
  gap?: number;
  /** Changing this replays the wipe. */
  animKey?: string;
}

const ROWS = 7;

export function ConsistencyHeatmap({
  matrix,
  accent,
  cell = 14,
  gap = 4,
  animKey,
}: ConsistencyHeatmapProps) {
  const { colors, isDark } = useColors();
  const reduced = useReducedMotion();
  const cols = matrix.length;
  const radius = Math.max(2, Math.round(cell / 3.5));

  const width = cols * (cell + gap) - gap;
  const height = ROWS * (cell + gap) - gap;
  const track = isDark ? alpha(colors.text, 0.06) : alpha(accent, 0.1);

  const reveal = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: Motion.duration.hero,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, cols]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  const cells = useMemo(() => matrix, [matrix]);

  if (SkiaHeatmap && !reduced) {
    return (
      <SkiaHeatmap
        width={width}
        height={height}
        matrix={cells}
        cell={cell}
        gap={gap}
        radius={radius}
        accent={accent}
        track={track}
        reveal={reveal}
      />
    );
  }

  // Fallback: the same grid in plain Views, faded in as one.
  return (
    <Animated.View style={[styles.grid, { width, height, gap }, fadeStyle]}>
      {cells.map((column, c) => (
        <View key={c} style={{ gap }}>
          {column.map((v, r) => (
            <View
              key={r}
              style={{
                width: cell,
                height: cell,
                borderRadius: radius,
                backgroundColor:
                  v < 0
                    ? "transparent"
                    : v <= 0
                      ? track
                      : alpha(accent, 0.22 + 0.78 * Math.min(1, v)),
              }}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row" },
});
