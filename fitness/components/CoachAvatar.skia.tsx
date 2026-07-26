/**
 * CoachAvatar.skia — the workout mascot (Skia impl).
 *
 * A small, friendly character that carries personality through the session: it
 * breathes and blinks at idle, springs up and beams on a win ("cheer"), sets a
 * determined face during the final push, and half-closes its eyes to breathe
 * with you at rest. One continuous UI-thread bob + blink drives the life; mood
 * changes trigger a springy pop. Zero assets — pure Skia shapes.
 *
 * Lazy-loaded only when isSkiaAvailable, so the static Skia import is safe.
 */
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect, useMemo } from "react";
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type CoachMood = "idle" | "cheer" | "rest" | "push";

export interface SkiaCoachAvatarProps {
  mood: CoachMood;
  size: number;
  /** Body gradient (brand ramp). */
  colors: readonly [string, string, ...string[]];
}

const INK = "#08252B"; // dark teal features — reads on the body in both themes
const WHITE = "#FFFFFF";

export function SkiaCoachAvatar({ mood, size, colors }: SkiaCoachAvatarProps) {
  const reduced = useReducedMotion();
  const u = size / 100;
  const S = (v: number) => v * u;

  const bob = useSharedValue(0);
  const blink = useSharedValue(1);
  const pop = useSharedValue(0);

  // Idle life: breathe + occasional blink.
  useEffect(() => {
    if (reduced) {
      bob.value = 0;
      blink.value = 1;
      return;
    }
    bob.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    blink.value = withRepeat(
      withSequence(
        withDelay(2400, withTiming(0.1, { duration: 70 })),
        withTiming(1, { duration: 90 }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(bob);
      cancelAnimation(blink);
    };
  }, [reduced, bob, blink]);

  // A springy pop whenever the mood turns active.
  useEffect(() => {
    if (reduced) return;
    if (mood === "cheer" || mood === "push") {
      pop.value = withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.back(2)) }),
        withTiming(0, { duration: 560, easing: Easing.inOut(Easing.quad) }),
      );
    }
  }, [mood, reduced, pop]);

  const sleepy = mood === "rest";
  // Scale on the JS thread so the worklets below only touch captured numbers —
  // a worklet can't synchronously call the non-worklet S() helper.
  const bobLift = S(2);
  const popLift = S(14);
  const eyeOpen = sleepy ? 0.14 : 1;

  const bodyTransform = useDerivedValue(() => {
    "worklet";
    const lift = -bobLift * bob.value - popLift * pop.value;
    const scale = 1 + 0.03 * bob.value + 0.09 * pop.value;
    return [{ translateY: lift }, { scale }];
  });

  const eyeTransform = useDerivedValue(() => {
    "worklet";
    return [{ scaleY: blink.value * eyeOpen }];
  });

  const sparkleOpacity = useDerivedValue(() => {
    "worklet";
    return mood === "cheer" ? pop.value : 0;
  });

  // Static per-mood shapes (rebuilt only when mood changes).
  const bodyPath = useMemo(
    () => Skia.Path.Make().addOval(Skia.XYWHRect(S(26), S(22), S(48), S(58))),
    [size], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bellyPath = useMemo(
    () => Skia.Path.Make().addOval(Skia.XYWHRect(S(36), S(44), S(28), S(30))),
    [size], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const mouthPath = useMemo(() => {
    const p = Skia.Path.Make();
    if (mood === "cheer") {
      // Big open beam.
      p.moveTo(S(41), S(61));
      p.quadTo(S(50), S(60), S(59), S(61));
      p.quadTo(S(50), S(78), S(41), S(61));
      p.close();
    } else if (mood === "push") {
      // Small determined "o".
      p.addOval(Skia.XYWHRect(S(45), S(62), S(10), S(8)));
    } else if (mood === "rest") {
      // Calm little curve.
      p.moveTo(S(45), S(64));
      p.quadTo(S(50), S(67), S(55), S(64));
    } else {
      // Friendly smile.
      p.moveTo(S(42), S(62));
      p.quadTo(S(50), S(71), S(58), S(62));
    }
    return p;
  }, [mood, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const browPath = useMemo(() => {
    if (mood !== "push") return null;
    const p = Skia.Path.Make();
    p.moveTo(S(34), S(40));
    p.lineTo(S(44), S(43));
    p.moveTo(S(66), S(40));
    p.lineTo(S(56), S(43));
    return p;
  }, [mood, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const mouthFilled = mood === "cheer" || mood === "push";
  const eyeR = S(7.5);
  const pupilR = S(3.4);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={bodyTransform} origin={vec(S(50), S(58))}>
        {/* feet */}
        <Circle cx={S(41)} cy={S(82)} r={S(6)} color={colors[colors.length - 1]} />
        <Circle cx={S(59)} cy={S(82)} r={S(6)} color={colors[colors.length - 1]} />

        {/* body */}
        <Path path={bodyPath}>
          <LinearGradient start={vec(0, S(20))} end={vec(0, S(84))} colors={[...colors]} />
        </Path>
        <Path path={bellyPath} color={WHITE} opacity={0.14} />

        {/* eyes (blink via scaleY around each eye center) */}
        <Group transform={eyeTransform} origin={vec(S(40), S(46))}>
          <Circle cx={S(40)} cy={S(46)} r={eyeR} color={WHITE} />
          <Circle cx={S(41)} cy={S(45)} r={pupilR} color={INK} />
        </Group>
        <Group transform={eyeTransform} origin={vec(S(60), S(46))}>
          <Circle cx={S(60)} cy={S(46)} r={eyeR} color={WHITE} />
          <Circle cx={S(61)} cy={S(45)} r={pupilR} color={INK} />
        </Group>

        {/* brows (push only) */}
        {browPath && (
          <Path path={browPath} style="stroke" strokeWidth={S(2.4)} strokeCap="round" color={INK} />
        )}

        {/* mouth */}
        <Path
          path={mouthPath}
          style={mouthFilled ? "fill" : "stroke"}
          strokeWidth={S(2.6)}
          strokeCap="round"
          strokeJoin="round"
          color={INK}
        />
      </Group>

      {/* celebration sparkles */}
      <Group opacity={sparkleOpacity}>
        <Sparkle x={S(24)} y={S(28)} r={S(4)} color={colors[0]} />
        <Sparkle x={S(78)} y={S(30)} r={S(5)} color={colors[colors.length - 1]} />
        <Sparkle x={S(70)} y={S(14)} r={S(3.5)} color={colors[0]} />
      </Group>
    </Canvas>
  );
}

/** A tiny four-point sparkle. */
function Sparkle({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const k = r * 0.32;
    p.moveTo(x, y - r);
    p.quadTo(x + k, y - k, x + r, y);
    p.quadTo(x + k, y + k, x, y + r);
    p.quadTo(x - k, y + k, x - r, y);
    p.quadTo(x - k, y - k, x, y - r);
    p.close();
    return p;
  }, [x, y, r]);
  return <Path path={path} color={color} />;
}
