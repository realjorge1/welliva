/**
 * MoodOrb.skia — the living blob that answers the valence slider.
 *
 * ── WHY CIRCLES AND A BLUR, NOT A MORPHING PATH ─────────────────────────────
 * The obvious build is one closed path whose radius is modulated by a couple of
 * sine terms, rebuilt every frame. That means a fresh `Skia.Path.Make()` sixty
 * times a second for as long as the sheet is open, which is exactly the
 * per-frame allocation the demo figure was written to avoid.
 *
 * Three overlapping circles under a single blur layer produce the same soft,
 * multi-lobed cloud with NOTHING allocated per frame: only cx, cy, r and colour
 * change, and each is a plain number or string coming off a derived value. The
 * blur fuses the three into one body, and because they drift on different sine
 * phases the silhouette never repeats in a way the eye can catch.
 *
 * ── WHAT THE ORB IS SAYING ──────────────────────────────────────────────────
 * Two things move with valence, and neither is a judgement:
 *
 *   HUE    — deep indigo at very unpleasant through cool slate at neutral to
 *            warm amber at very pleasant. Not red-to-green: an unpleasant
 *            feeling is not an error, and colouring it like one answers the
 *            question for the person before they have.
 *   GATHER — unpleasant pulls the three lobes close and small, pleasant lets
 *            them spread and breathe. Tight is not "bad", it is contained; the
 *            metaphor is how much room the feeling has, which is the one thing
 *            people do reliably report about their own mood.
 *
 * Amplitude of drift stays LOW throughout. An orb that thrashes at the
 * unpleasant end would read as alarm, and this thing sits on screen while
 * someone decides how they feel.
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Paint,
} from "@shopify/react-native-skia";
import React from "react";
import {
  interpolateColor,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";

import { VALENCE_COLORS } from "@/services/gozlin/mind";

/** Stop positions matching VALENCE_COLORS across −1…+1. */
const STOPS = [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1];

export interface SkiaMoodOrbProps {
  size: number;
  /** −1 … +1. */
  valence: SharedValue<number>;
  /** 0 … 1, looping. Drives the drift. Hold it constant to freeze the orb. */
  phase: SharedValue<number>;
}

/** The three lobes: base angle around the centre, and a phase offset. */
const LOBES = [
  { angle: -Math.PI / 2, offset: 0 },
  { angle: Math.PI / 6, offset: 0.37 },
  { angle: (5 * Math.PI) / 6, offset: 0.71 },
];

export function SkiaMoodOrb({ size, valence, phase }: SkiaMoodOrbProps) {
  const c = size / 2;

  // Blur radius scales with the orb so the fusion looks identical at any size.
  const blur = size * 0.11;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group layer={<Paint><Blur blur={blur} /></Paint>}>
        {LOBES.map((lobe, i) => (
          <Lobe
            key={i}
            centre={c}
            size={size}
            lobe={lobe}
            valence={valence}
            phase={phase}
          />
        ))}
      </Group>
    </Canvas>
  );
}

function Lobe({
  centre,
  size,
  lobe,
  valence,
  phase,
}: {
  centre: number;
  size: number;
  lobe: { angle: number; offset: number };
  valence: SharedValue<number>;
  phase: SharedValue<number>;
}) {
  // How far the lobe sits from the centre. Unpleasant gathers to ~4% of the
  // orb, pleasant opens to ~13% — enough to read as "more room" without the
  // three lobes ever separating into three visible circles.
  const spread = useDerivedValue(() => {
    const t = (valence.value + 1) / 2; // 0…1
    return size * (0.04 + t * 0.09);
  });

  const cx = useDerivedValue(() => {
    const a = lobe.angle + (phase.value + lobe.offset) * Math.PI * 2;
    return centre + Math.cos(a) * spread.value;
  });

  const cy = useDerivedValue(() => {
    const a = lobe.angle + (phase.value + lobe.offset) * Math.PI * 2;
    // Slightly flattened vertical travel — a body resting, not a ball orbiting.
    return centre + Math.sin(a) * spread.value * 0.78;
  });

  // Each lobe breathes a little out of step with the others.
  const r = useDerivedValue(() => {
    const t = (valence.value + 1) / 2;
    const base = size * (0.26 + t * 0.045);
    const breath = Math.sin((phase.value + lobe.offset) * Math.PI * 2) * size * 0.012;
    return base + breath;
  });

  const color = useDerivedValue(() => {
    // Each lobe is a touch further along the ramp than the last, so the body
    // carries a gradient rather than one flat fill.
    const shifted = Math.max(-1, Math.min(1, valence.value + (lobe.offset - 0.36) * 0.34));
    return interpolateColor(shifted, STOPS, VALENCE_COLORS as unknown as string[]);
  });

  return <Circle cx={cx} cy={cy} r={r} color={color} opacity={0.62} />;
}
