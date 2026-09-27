/**
 * MoodOrb — the orb that answers the valence slider, with a Skia-free fallback.
 *
 * Skia is a native module and can be absent (a JS reload ahead of a native
 * rebuild, or any surface it isn't linked on), so this follows the same shape as
 * every other Skia component here: require the real one behind
 * `isSkiaAvailable` and keep a plain react-native-svg stand-in that still shows
 * the right colour and the right amount of room. The fallback doesn't drift —
 * an SVG version animating three circles off the JS thread would cost more than
 * the life it bought.
 *
 * The drift clock lives HERE rather than in the Skia child so the fallback,
 * reduced-motion and the real orb are all driven by one decision.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import {
  clampValence,
  valenceColor,
  VALENCE_COLORS,
} from "@/services/gozlin/mind";
import React, { useEffect } from "react";
import { View } from "react-native";
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import type { SkiaMoodOrbProps } from "./MoodOrb.skia";

let SkiaOrb: React.ComponentType<SkiaMoodOrbProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaOrb = require("./MoodOrb.skia").SkiaMoodOrb;
}

/** One full drift cycle. Slow on purpose — this is breathing, not spinning. */
const DRIFT_MS = 9000;

export interface MoodOrbProps {
  size: number;
  /** −1 … +1, as a shared value so dragging never crosses to the JS thread. */
  valence: SharedValue<number>;
  /** Current valence as a plain number — only the SVG fallback needs it. */
  valenceSnapshot: number;
}

export function MoodOrb({ size, valence, valenceSnapshot }: MoodOrbProps) {
  const reduced = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      phase.value = 0;
      return;
    }
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(1, { duration: DRIFT_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(phase);
  }, [reduced, phase]);

  if (SkiaOrb) {
    return <SkiaOrb size={size} valence={valence} phase={phase} />;
  }

  return <FallbackOrb size={size} valence={valenceSnapshot} />;
}

/**
 * Three soft, static circles with a radial fade. No drift, no path work — it
 * carries the colour and the gathering, which is the information; the life is a
 * luxury the fallback can do without.
 */
function FallbackOrb({ size, valence }: { size: number; valence: number }) {
  const v = clampValence(valence);
  const c = size / 2;
  const t = (v + 1) / 2;
  const spread = size * (0.04 + t * 0.09);
  const r = size * (0.26 + t * 0.045);
  const tint = valenceColor(v);
  const edge = VALENCE_COLORS[0];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="orbFade" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.85} />
            <Stop offset="0.7" stopColor={tint} stopOpacity={0.45} />
            <Stop offset="1" stopColor={edge} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c - spread * 0.78} r={r} fill="url(#orbFade)" />
        <Circle cx={c + spread} cy={c + spread * 0.5} r={r} fill="url(#orbFade)" />
        <Circle cx={c - spread} cy={c + spread * 0.5} r={r} fill="url(#orbFade)" />
      </Svg>
    </View>
  );
}
