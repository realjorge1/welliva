/**
 * WeekDonut.skia — a real donut (annular wedges around a hollow centre), drawn
 * with Skia.
 *
 * Four fixed wedges (one per status) fan out clockwise from 12 o'clock as a
 * single `progress` shared value grows each wedge's sweep on the UI thread — a
 * proper donut reveal, not a stroked ring. Each wedge is a full annular slice
 * (outer arc → inner arc back → close), so the hole stays crisp. The selected
 * wedge lifts outward along its bisector while its siblings dim; a separator
 * stroke in the page colour carves clean gaps between neighbours.
 *
 * Exactly four wedges are always rendered (absent statuses get a zero sweep) so
 * the hook count never changes. Loaded lazily; pairs with the SVG fallback.
 */
import {
  Canvas,
  Group,
  Path,
  Skia,
  type SkPath,
  type SkRect,
} from "@shopify/react-native-skia";
import React from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export interface SkiaWeekDonutSegment {
  key: string;
  color: string;
  /** Degrees from 12 o'clock, clockwise. */
  startAngle: number;
  sweepAngle: number;
}

export interface SkiaWeekDonutProps {
  size: number;
  /** Hole radius as a fraction of the outer radius (0–1). */
  innerRatio: number;
  /** Exactly four segments (zero sweep for absent statuses). */
  segments: SkiaWeekDonutSegment[];
  progress: SharedValue<number>;
  selectedKey: string | null;
  /** Gap stroke colour — the surface the donut sits on. */
  separator: string;
}

const POP = 9;

function useWedge(
  seg: SkiaWeekDonutSegment | undefined,
  progress: SharedValue<number>,
  outer: SkRect,
  inner: SkRect,
) {
  return useDerivedValue<SkPath>(() => {
    "worklet";
    const p = Skia.Path.Make();
    if (!seg) return p;
    const sweep = Math.min(359.999, seg.sweepAngle * progress.value);
    if (sweep <= 0.05) return p;
    const start = -90 + seg.startAngle;
    // Outer arc forward, then inner arc back — an annular wedge with a hole.
    p.arcToOval(outer, start, sweep, true);
    p.arcToOval(inner, start + sweep, -sweep, false);
    p.close();
    return p;
  });
}

export function SkiaWeekDonut({
  size,
  innerRatio,
  segments,
  progress,
  selectedKey,
  separator,
}: SkiaWeekDonutProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - POP - 2;
  const r = R * innerRatio;
  const outer: SkRect = { x: cx - R, y: cy - R, width: R * 2, height: R * 2 };
  const inner: SkRect = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };

  // Four fixed wedge paths (stable hook count).
  const w0 = useWedge(segments[0], progress, outer, inner);
  const w1 = useWedge(segments[1], progress, outer, inner);
  const w2 = useWedge(segments[2], progress, outer, inner);
  const w3 = useWedge(segments[3], progress, outer, inner);
  const paths = [w0, w1, w2, w3];

  const anySelected = selectedKey != null;

  return (
    <Canvas style={{ width: size, height: size }}>
      {segments.map((seg, i) => {
        if (seg.sweepAngle <= 0.05) return null;
        const selected = seg.key === selectedKey;
        const mid = ((-90 + seg.startAngle + seg.sweepAngle / 2) * Math.PI) / 180;
        const transform = selected
          ? [{ translateX: Math.cos(mid) * POP }, { translateY: Math.sin(mid) * POP }]
          : undefined;
        return (
          <Group
            key={seg.key}
            transform={transform}
            opacity={anySelected && !selected ? 0.35 : 1}
          >
            <Path path={paths[i]} color={seg.color} />
            <Path path={paths[i]} style="stroke" strokeWidth={2.5} color={separator} />
          </Group>
        );
      })}
    </Canvas>
  );
}
