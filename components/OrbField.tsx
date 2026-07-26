/**
 * OrbField — the drifting brand orbs behind the auth canvas, extracted so other
 * surfaces (onboarding) can reuse the *exact same* animation. Positions, sizes,
 * drift and timing are fixed here; callers only vary the tint and overall
 * opacity, so every surface shares one identical motion.
 *
 *   <OrbField color="#F6CF54" />                 // sign-in (full strength)
 *   <OrbField color="#F6CF54" opacityScale={0.65} />  // onboarding (softer)
 *
 * Optional elastic bounce-off — touching an orb (through any press, swipe or
 * scroll) shoves THAT orb away; it springs back with a visible wobble. Orbs not
 * under the finger stay purely ambient.
 *
 *   const { touch, touchHandlers } = useOrbTouch();
 *   <View style={styles.flex} {...touchHandlers}>   // the screen's root
 *     <OrbField color="#F6CF54" touch={touch} />
 *     ...screen content...
 *   </View>
 *
 * The handlers are bubble-phase touch observers (`onTouchStart/Move/End`) — they
 * see every press, swipe and scroll inside the subtree WITHOUT ever claiming
 * the responder, so buttons, inputs and scroll views behave exactly as before.
 */
import React, { useEffect, useMemo } from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/**
 * The drifting orbs — deliberately few. Two big ones anchor opposite corners and
 * a third sits low to break the symmetry; more than this and the canvas starts
 * competing with the form.
 *
 * Positions are fractions of the screen, seeded so every orb hugs an edge and
 * the centre column stays clear behind the wordmark and form. `drift` is the
 * travel in px over half a period: ~120px across ~13s is roughly 10px/sec, which
 * reads as a slow float. Each orb has its own period (and no start delay, so
 * nothing sits frozen on mount); the mismatched periods keep them out of phase.
 */
const ORBS = [
  { x: -0.42, y: -0.1, size: 320, opacity: 0.14, drift: 120, duration: 13000 },
  { x: 0.74, y: 0.28, size: 260, opacity: 0.1, drift: -105, duration: 17000 },
  { x: -0.34, y: 0.74, size: 280, opacity: 0.09, drift: 115, duration: 15000 },
] as const;

/**
 * Elastic bounce-off. A touch landing INSIDE an orb's circle shoves it away
 * along the finger→centre line, harder the deeper the finger is in
 * (penetration × PUSH_FACTOR, capped at MAX_PUSH_FR of the orb's diameter).
 * While the finger stays in the orb's spot the FOLLOW spring keeps it shoved;
 * the moment the finger leaves (lift, or a swipe passing through) the BOUNCE
 * spring takes over — deliberately underdamped, so the orb rides its outward
 * velocity past the shove, then visibly wobbles back into place.
 *
 * Hit-testing is against the orb's UNDISPLACED circle (seed + drift, ignoring
 * the shove): the orb "gives way" from its spot and can't jitter in and out of
 * its own hit zone.
 */
const PUSH_FACTOR = 1.25;
const MAX_PUSH_FR = 0.35;
const FOLLOW_SPRING = {
  damping: 15,
  stiffness: 220,
  mass: 1,
  reduceMotion: ReduceMotion.Never,
} as const;
const BOUNCE_SPRING = {
  damping: 6.5,
  stiffness: 130,
  mass: 1,
  reduceMotion: ReduceMotion.Never,
} as const;

/** Shared touch state read by every orb's UI-thread reaction. */
export interface OrbTouch {
  /** Raw finger position in window coords — unsmoothed, for exact hit tests. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** 1 while a finger is down, 0 otherwise (raw flag — all smoothing lives in
   *  the per-orb bounce springs). */
  active: SharedValue<number>;
}

/**
 * Creates the shared touch state plus the bubble-phase observers to spread onto
 * the screen's root container. Kept as plain `onTouch*` props (not a gesture
 * recognizer) so it can never compete with the screen's real interactions.
 */
export function useOrbTouch(): {
  touch: OrbTouch;
  touchHandlers: {
    onTouchStart: (e: GestureResponderEvent) => void;
    onTouchMove: (e: GestureResponderEvent) => void;
    onTouchEnd: (e: GestureResponderEvent) => void;
    onTouchCancel: (e: GestureResponderEvent) => void;
  };
} {
  // Seeded far off-screen so no orb registers a phantom hit before first touch.
  const x = useSharedValue(-9999);
  const y = useSharedValue(-9999);
  const active = useSharedValue(0);

  const touch = useMemo(() => ({ x, y, active }), [x, y, active]);

  const touchHandlers = useMemo(() => {
    const point = (e: GestureResponderEvent) =>
      e.nativeEvent.touches && e.nativeEvent.touches.length > 0
        ? e.nativeEvent.touches[0]
        : e.nativeEvent;
    const track = (e: GestureResponderEvent) => {
      const t = point(e);
      x.value = t.pageX;
      y.value = t.pageY;
      active.value = 1;
    };
    const release = (e: GestureResponderEvent) => {
      // Multi-touch: if a finger remains, hand the collider over to it.
      if (e.nativeEvent.touches && e.nativeEvent.touches.length > 0) {
        const t = e.nativeEvent.touches[0];
        x.value = t.pageX;
        y.value = t.pageY;
        return;
      }
      active.value = 0;
    };
    return {
      onTouchStart: track,
      onTouchMove: track,
      onTouchEnd: release,
      onTouchCancel: release,
    };
  }, [x, y, active]);

  return { touch, touchHandlers };
}

/**
 * One slowly-breathing orb: it drifts vertically and scales a touch, both on an
 * eased in-out loop, so the whole field reads as a gentle swell rather than
 * anything mechanical. When `touch` is provided, a touch inside THIS orb shoves
 * it away elastically (see the bounce constants above); every other orb is
 * left completely untouched.
 */
function Orb({
  spec,
  color,
  opacityScale,
  touch,
}: {
  spec: (typeof ORBS)[number];
  color: string;
  opacityScale: number;
  touch?: OrbTouch;
}) {
  const { width, height } = useWindowDimensions();
  // Start at -1 and oscillate to +1 so the travel is centred on the seeded
  // position rather than pushing every orb off in one direction.
  const progress = useSharedValue(-1);
  // The elastic shove — displacement away from a touch inside this orb.
  const kickX = useSharedValue(0);
  const kickY = useSharedValue(0);
  const inside = useSharedValue(0);

  const R = spec.size / 2;
  const maxPush = spec.size * MAX_PUSH_FR;

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: spec.duration,
        easing: Easing.inOut(Easing.sin),
        // Reanimated honours the OS "Reduce Motion" setting by default, which
        // silently collapses this loop to a static frame. These orbs are
        // decorative, low-contrast and slow — nothing that triggers motion
        // sensitivity — so we opt out rather than ship a dead background.
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [progress, spec.duration]);

  // Collision loop, fully on the UI thread: whenever the finger or the drift
  // moves, hit-test this orb and shove/release accordingly. Spring targets are
  // only (re)assigned on meaningful ticks — the release wobble is never
  // restarted mid-flight, so the elastic bounce always plays out in full.
  useAnimatedReaction(
    () => {
      if (!touch) return null;
      return {
        tx: touch.x.value,
        ty: touch.y.value,
        down: touch.active.value,
        p: progress.value,
      };
    },
    (cur) => {
      if (!cur) return;
      // Undisplaced centre right now: seed + drift.
      const cx = spec.x * width + R + cur.p * spec.drift * 0.35;
      const cy = spec.y * height + R + cur.p * spec.drift;
      const dx = cx - cur.tx;
      const dy = cy - cur.ty;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (cur.down > 0 && dist < R) {
        // Away from the finger. Dead-centre press has no direction — keep the
        // current shove's direction, or pick a diagonal for the very first tick.
        let nx: number;
        let ny: number;
        if (dist > 2) {
          nx = dx / dist;
          ny = dy / dist;
        } else {
          const mag = Math.sqrt(kickX.value * kickX.value + kickY.value * kickY.value);
          nx = mag > 2 ? kickX.value / mag : 0.7071;
          ny = mag > 2 ? kickY.value / mag : 0.7071;
        }
        const push = Math.min((R - dist) * PUSH_FACTOR, maxPush);
        inside.value = 1;
        kickX.value = withSpring(nx * push, FOLLOW_SPRING);
        kickY.value = withSpring(ny * push, FOLLOW_SPRING);
      } else if (inside.value === 1) {
        inside.value = 0;
        kickX.value = withSpring(0, BOUNCE_SPRING);
        kickY.value = withSpring(0, BOUNCE_SPRING);
      }
    },
    [touch, width, height],
  );

  const animated = useAnimatedStyle(() => {
    const kx = kickX.value;
    const ky = kickY.value;
    // A whisper of extra scale while shoved, so the bounce reads as elastic
    // (the orb "loads up") rather than a rigid slide.
    const squash = (Math.sqrt(kx * kx + ky * ky) / maxPush) * 0.06;
    return {
      transform: [
        { translateY: progress.value * spec.drift + ky },
        { translateX: progress.value * spec.drift * 0.35 + kx },
        { scale: 1 + (progress.value + 1) * 0.08 + squash },
      ],
    };
  });

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          left: spec.x * width,
          top: spec.y * height,
          backgroundColor: color,
          opacity: spec.opacity * opacityScale,
        },
        animated,
      ]}
    />
  );
}

export function OrbField({
  color,
  opacityScale = 1,
  touch,
  style,
}: {
  color: string;
  /** Multiplies every orb's baseline opacity — <1 for a more transparent field. */
  opacityScale?: number;
  /** Shared touch state from `useOrbTouch()` — when provided, a touch landing
   *  on an orb bounces it off elastically. Omit for a purely ambient field. */
  touch?: OrbTouch;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    // Clipped so orbs seeded past the edges never bleed outside the canvas.
    <View style={[StyleSheet.absoluteFill, styles.field, style]} pointerEvents="none">
      {ORBS.map((spec, i) => (
        <Orb key={i} spec={spec} color={color} opacityScale={opacityScale} touch={touch} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { overflow: "hidden" },
  orb: { position: "absolute" },
});
