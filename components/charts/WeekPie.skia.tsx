/**
 * WeekPie.skia — a real pie (filled wedges from the centre, no hole), drawn with
 * Skia.
 *
 * Four fixed wedges (one per status) fan out clockwise from 12 o'clock as a
 * single `progress` shared value grows each wedge's sweep on the UI thread — a
 * proper pie reveal, not a stroked ring. The selected wedge explodes outward
 * along its bisector while its siblings dim; a thin separator stroke in the page
 * colour keeps neighbours crisp.
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

export interface SkiaWeekPieSegment {
  key: string;
  color: string;
  /** Degrees from 12 o'clock, clockwise. */
  startAngle: number;
  sweepAngle: number;
}

export interface SkiaWeekPieProps {
  size: number;
  /** Exactly four segments (zero sweep for absent statuses). */
  segments: SkiaWeekPieSegment[];
  progress: SharedValue<number>;
  selectedKey: string | null;
  /** Gap stroke colour — the surface the pie sits on. */
  separator: string;
}

const POP = 8;

function useWedge(
  seg: SkiaWeekPieSegment | undefined,
  progress: SharedValue<number>,
  cx: number,
  cy: number,
  oval: SkRect,
) {
  return useDerivedValue<SkPath>(() => {
    "worklet";
    const p = Skia.Path.Make();
    if (!seg) return p;
    const sweep = Math.min(359.999, seg.sweepAngle * progress.value);
    if (sweep <= 0.05) return p;
    p.moveTo(cx, cy);
    p.arcToOval(oval, -90 + seg.startAngle, sweep, false);
    p.close();
    return p;
  });
}

export function SkiaWeekPie({
  size,
  segments,
  progress,
  selectedKey,
  separator,
}: SkiaWeekPieProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - POP - 2;
  const oval: SkRect = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };

  // Four fixed wedge paths (stable hook count).
  const w0 = useWedge(segments[0], progress, cx, cy, oval);
  const w1 = useWedge(segments[1], progress, cx, cy, oval);
  const w2 = useWedge(segments[2], progress, cx, cy, oval);
  const w3 = useWedge(segments[3], progress, cx, cy, oval);
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
          <Group key={seg.key} transform={transform} opacity={anySelected && !selected ? 0.4 : 1}>
            <Path path={paths[i]} color={seg.color} />
            <Path path={paths[i]} style="stroke" strokeWidth={2} color={separator} />
          </Group>
        );
      })}
    </Canvas>
  );
}
