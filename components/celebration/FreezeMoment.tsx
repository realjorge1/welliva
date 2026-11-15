/**
 * THE FREEZE MOMENT — when a streak freeze carried a missed day.
 *
 * Once per phone, on the first look at "Your week" after it happened: a frost
 * settles over the flame's rim, three glints catch on it, and it lifts, leaving
 * the flame as it was. Beneath, one line: "A freeze held yesterday". The owner
 * approved this from the preview on 2026-11-15 (pale frost, about a second).
 *
 * The flame under the frost is the flame as it truly is: grey until today is
 * kept. Lighting it for the moment would claim a day that isn't kept yet.
 *
 * ~1.1 s, transforms and opacity only, one timing on one shared value, never
 * loops, nothing left running afterwards (the low-end rule). With Reduce
 * Motion on, nothing moves: only the line appears.
 */
import { readJSON, writeJSON } from "@/services/OfflineStorage";
import { freezeMomentLine, unseenFrozen } from "@/services/commitment";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { AppText } from "@/components/ui";
import { FLAME_ASPECT, FLAME_PATHS, FROST_COLORS } from "./Flame";

/** The last frozen day this phone has shown the moment for (device-local). */
export const FREEZE_MOMENT_SEEN_KEY = "@welliva_freeze_moment_seen";

export const FREEZE_MOMENT_MS = 1100;
/** The flame's foot — the same pivot the Flame itself moves around. */
const FLAME_FOOT = "50% 93.6%";

// Phase boundaries as shares of the whole: settle 0–380 ms, glints from
// 380 ms, lift 600–1100 ms (the approved preview's timings).
const SETTLE_END = 380 / FREEZE_MOMENT_MS;
const LIFT_START = 600 / FREEZE_MOMENT_MS;
const BREATHE_END = 1000 / FREEZE_MOMENT_MS;
const GLINT_START = 380 / FREEZE_MOMENT_MS;
const GLINT_LEN = 140 / FREEZE_MOMENT_MS;
/** Where the glints catch, in the flame's 100 × 125 drawing, and when. */
const GLINTS = [
  { x: 18, y: 34, delay: 0 },
  { x: 62, y: 9, delay: 60 / FREEZE_MOMENT_MS },
  { x: 90, y: 62, delay: 120 / FREEZE_MOMENT_MS },
] as const;
const GLINT_PATH = "M3 0 L6 6 L3 12 L0 6 Z";

function seg(t: number, a: number, b: number): number {
  "worklet";
  const v = (t - a) / (b - a);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function easeOut(x: number): number {
  "worklet";
  return 1 - Math.pow(1 - x, 3);
}
function easeInOut(x: number): number {
  "worklet";
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Should the moment play, and with which line? Waits for `ready` (the card is
 * on screen), plays at most once per mount, and marks the frozen days seen as
 * it starts — so it never repeats, even if the app closes mid-way.
 */
export function useFreezeMoment(
  frozen: readonly string[] | undefined,
  today: string,
  ready: boolean,
): { moment: { line: string; play: boolean } | null; done: () => void } {
  const [moment, setMoment] = useState<{ line: string; play: boolean } | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    let live = true;
    void (async () => {
      try {
        const seen = await readJSON<string | null>(FREEZE_MOMENT_SEEN_KEY, null);
        const fresh = unseenFrozen(frozen, typeof seen === "string" ? seen : null, today);
        if (!live || fresh.length === 0 || started.current) return;
        started.current = true;
        await writeJSON(FREEZE_MOMENT_SEEN_KEY, fresh[fresh.length - 1]);
        if (live) setMoment({ line: freezeMomentLine(fresh, today), play: true });
      } catch (e) {
        console.log("[freeze] could not read the moment's record", e);
      }
    })();
    return () => {
      live = false;
    };
  }, [ready, frozen, today]);
  const done = useCallback(() => setMoment((m) => (m ? { ...m, play: false } : m)), []);
  return { moment, done };
}

/** Wraps the flame: it breathes under the frost while the frost settles and lifts. */
export function FreezeFlame({
  size,
  play,
  onDone,
  children,
}: {
  size: number;
  play: boolean;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  const unit = size / 100;

  useEffect(() => {
    if (!play) return;
    if (reduced) {
      onDone();
      return;
    }
    t.value = 0;
    t.value = withTiming(1, { duration: FREEZE_MOMENT_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [play, reduced, onDone, t]);

  const breathe = useAnimatedStyle(() => {
    const settle = easeOut(seg(t.value, 0, SETTLE_END));
    const scale =
      t.value < LIFT_START ? 1 - 0.03 * settle : 0.97 + 0.03 * easeOut(seg(t.value, LIFT_START, BREATHE_END));
    return { transform: [{ scale }] };
  });
  const frost = useAnimatedStyle(() => {
    const settle = easeOut(seg(t.value, 0, SETTLE_END));
    const lift = easeInOut(seg(t.value, LIFT_START, 1));
    return {
      opacity: 0.88 * settle * (1 - lift),
      transform: [{ translateY: -3 * unit * lift }, { scale: 1.1 - 0.1 * settle + 0.03 * lift }],
    };
  });
  const glint0 = useAnimatedStyle(() => {
    const x = seg(t.value, GLINT_START + GLINTS[0].delay, GLINT_START + GLINTS[0].delay + GLINT_LEN);
    return { opacity: x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI) };
  });
  const glint1 = useAnimatedStyle(() => {
    const x = seg(t.value, GLINT_START + GLINTS[1].delay, GLINT_START + GLINTS[1].delay + GLINT_LEN);
    return { opacity: x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI) };
  });
  const glint2 = useAnimatedStyle(() => {
    const x = seg(t.value, GLINT_START + GLINTS[2].delay, GLINT_START + GLINTS[2].delay + GLINT_LEN);
    return { opacity: x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI) };
  });
  const glintStyles = [glint0, glint1, glint2];
  const active = play && !reduced;

  return (
    <View style={{ width: size, height: size * FLAME_ASPECT }}>
      <Animated.View style={[styles.foot, active ? breathe : null]}>{children}</Animated.View>
      {active ? (
        <>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.foot, frost]}>
            <Svg width={size} height={size * FLAME_ASPECT} viewBox={FLAME_PATHS.viewBox}>
              <Path d={FLAME_PATHS.outer} fill={FROST_COLORS.outer} />
              <Path d={FLAME_PATHS.inner} fill={FROST_COLORS.inner} fillOpacity={0.85} />
            </Svg>
          </Animated.View>
          {GLINTS.map((g, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.glint,
                { left: (g.x - 3) * unit, top: (g.y - 6) * unit, width: 6 * unit, height: 12 * unit },
                glintStyles[i],
              ]}
            >
              <Svg width={6 * unit} height={12 * unit} viewBox="0 0 6 12">
                <Path d={GLINT_PATH} fill="#FFFFFF" />
              </Svg>
            </Animated.View>
          ))}
        </>
      ) : null}
    </View>
  );
}

/** "A freeze held yesterday" — fades in as the frost lifts, then stays. */
export function FreezeLine({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      o.value = 1;
      return;
    }
    o.value = withDelay(600, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [reduced, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={fade}>
      <AppText variant="footnote" style={styles.line}>
        {text}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  foot: { transformOrigin: FLAME_FOOT },
  glint: { position: "absolute" },
  line: { color: FROST_COLORS.inner },
});
