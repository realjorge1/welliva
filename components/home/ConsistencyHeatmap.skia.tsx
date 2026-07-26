/**
 * ConsistencyHeatmap.skia — the contribution-style activity grid, drawn in Skia.
 *
 * One rounded cell per day (weeks as columns, weekdays as rows). Cell color is a
 * single-hue alpha ramp of the accent — the busier the day, the bolder the cell.
 * The grid wipes in left→right on mount: a single `reveal` shared value drives a
 * per-column opacity sweep on the UI thread, so the reveal is smooth even while
 * the modal is still settling.
 *
 * Loaded lazily (only when isSkiaAvailable) so this file's static Skia import is
 * never evaluated on a surface without the native module. Geometry + colors are
 * plain values handed in by the wrapper.
 */
import { alpha } from "@/constants/theme";
import { Canvas, Group, RoundedRect } from "@shopify/react-native-skia";
import React from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export interface SkiaHeatmapProps {
  width: number;
  height: number;
  /** matrix[col][row] — intensity 0–1, or -1 for a cell that shouldn't render. */
  matrix: number[][];
  cell: number;
  gap: number;
  radius: number;
  accent: string;
  track: string;
  /** 0→1 mount wipe progress. */
  reveal: SharedValue<number>;
}

export function SkiaConsistencyHeatmap({
  width,
  height,
  matrix,
  cell,
  gap,
  radius,
  accent,
  track,
  reveal,
}: SkiaHeatmapProps) {
  const cols = matrix.length;
  return (
    <Canvas style={{ width, height }}>
      {matrix.map((column, c) => (
        <HeatColumn
          key={c}
          col={c}
          cols={cols}
          column={column}
          cell={cell}
          gap={gap}
          radius={radius}
          accent={accent}
          track={track}
          reveal={reveal}
        />
      ))}
    </Canvas>
  );
}

function HeatColumn({
  col,
  cols,
  column,
  cell,
  gap,
  radius,
  accent,
  track,
  reveal,
}: {
  col: number;
  cols: number;
  column: number[];
  cell: number;
  gap: number;
  radius: number;
  accent: string;
  track: string;
  reveal: SharedValue<number>;
}) {
  // Left→right wipe: this column reaches full opacity once the reveal front,
  // scaled across the width, passes its index.
  const opacity = useDerivedValue(() => {
    "worklet";
    return Math.max(0, Math.min(1, reveal.value * (cols + 3) - col));
  });
  const x = col * (cell + gap);
  return (
    <Group opacity={opacity}>
      {column.map((v, r) => {
        if (v < 0) return null;
        const color = v <= 0 ? track : alpha(accent, 0.22 + 0.78 * Math.min(1, v));
        return (
          <RoundedRect
            key={r}
            x={x}
            y={r * (cell + gap)}
            width={cell}
            height={cell}
            r={radius}
            color={color}
          />
        );
      })}
    </Group>
  );
}
