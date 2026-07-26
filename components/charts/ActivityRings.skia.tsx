/**
 * ActivityRings.skia — Apple-Fitness-style concentric progress rings, in Skia.
 *
 * Each metric is one stroked ring at its own radius: a faint full-circle track
 * plus a round-capped progress arc that sweeps clockwise from 12 o'clock. A
 * single `progress` shared value grows every ring's sweep in lock-step on the UI
 * thread, so all rings fill together in one smooth reveal. Rings that overshoot
 * their goal are clamped to a full turn (the true numbers live in the legend).
 *
 * Loaded lazily (only when isSkiaAvailable) so this file's static Skia import is
 * never evaluated on a surface without the native module. Geometry + colors are
 * plain values handed in by the wrapper, which pairs it with an SVG fallback.
 */
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import React from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export interface SkiaRingSpec {
  key: string;
  color: string;
  track: string;
  /** Goal completion 0–1+ (values >1 are clamped to a full turn). */
  fraction: number;
  /** Centre radius of the ring's stroke, in px. */
  radius: number;
}

export interface SkiaActivityRingsProps {
  size: number;
  strokeWidth: number;
  /** Exactly three rings, outer → inner. */
  rings: SkiaRingSpec[];
  progress: SharedValue<number>;
}

const START = -90; // 12 o'clock

function useRingPath(
  ring: SkiaRingSpec | undefined,
  cx: number,
  cy: number,
  progress: SharedValue<number>,
) {
  return useDerivedValue<SkPath>(() => {
    "worklet";
    const p = Skia.Path.Make();
    if (!ring) return p;
    const frac = Math.max(0, Math.min(1, ring.fraction));
    const sweep = frac * 359.999 * progress.value;
    if (sweep <= 0.01) return p;
    const r = ring.radius;
    p.addArc({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, START, sweep);
    return p;
  });
}

export function SkiaActivityRings({
  size,
  strokeWidth,
  rings,
  progress,
}: SkiaActivityRingsProps) {
  const cx = size / 2;
  const cy = size / 2;

  // Exactly three fixed paths so the hook count is always stable.
  const p0 = useRingPath(rings[0], cx, cy, progress);
  const p1 = useRingPath(rings[1], cx, cy, progress);
  const p2 = useRingPath(rings[2], cx, cy, progress);
  const paths = [p0, p1, p2];

  return (
    <Canvas style={{ width: size, height: size }}>
      {rings.map((ring, i) => (
        <Group key={ring.key}>
          <Circle
            cx={cx}
            cy={cy}
            r={ring.radius}
            style="stroke"
            strokeWidth={strokeWidth}
            color={ring.track}
          />
          <Path
            path={paths[i]}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            color={ring.color}
          />
        </Group>
      ))}
    </Canvas>
  );
}
