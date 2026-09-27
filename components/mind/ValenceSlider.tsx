/**
 * ValenceSlider — the one control that takes the whole answer.
 *
 * ── CONTINUOUS TO DRAG, NAMED TO READ ───────────────────────────────────────
 * The finger moves continuously and the orb follows it continuously, because a
 * feeling does not arrive in notches. But it SETTLES on one of seven named
 * stops, because "Slightly Pleasant" is an answer a person can stand behind and
 * "0.41" is not. So the drag is free, the release snaps, and the number stored
 * is the stop's exact valence rather than wherever the finger happened to stop.
 *
 * ── WHY THE DRAG NEVER CROSSES TO JS ────────────────────────────────────────
 * `valence` is a shared value written inside the gesture worklet and read
 * directly by the orb's derived values, so the orb tracks the finger on the UI
 * thread with no round trip. The only thing that crosses to JS is the STOP
 * INDEX, and only when it actually changes — that is what re-orders the label
 * list and re-renders the stop name, and it happens at most seven times in a
 * drag instead of once a frame.
 *
 * ── THE HORIZONTAL GESTURE PROBLEM ──────────────────────────────────────────
 * A horizontal pan is the app's drawer-open gesture. This slider lives inside a
 * Modal, so it isn't competing with the root drawer in practice, but it claims
 * horizontal intent early with `activeOffsetX` anyway rather than relying on
 * that remaining true — the same guard the elastic scroll needed when its own
 * vertical pan met the drawer's horizontal one.
 */
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import {
  STOP_COUNT,
  VALENCE_COLORS,
  valenceAtStop,
  valenceStopIndex,
} from "@/services/gozlin/mind";
import * as Haptics from "@/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

const TRACK_H = 14;
const THUMB = 32;
/** Row height. The extra padding is hit area — a 14px bar is not a target. */
const HIT_H = THUMB + 16;

export interface ValenceSliderProps {
  /** −1 … +1. Written by this component, read by the orb. */
  valence: SharedValue<number>;
  /** The stop the slider is currently resting on, 0–6. */
  stop: number;
  /** Fired when the resting stop changes — mid-drag as well as on release. */
  onStopChange: (stop: number) => void;
}

export function ValenceSlider({ valence, stop, onStopChange }: ValenceSliderProps) {
  const { colors } = useColors();
  const [width, setWidth] = useState(0);

  // Mirrors the last stop we told JS about, so the worklet can fire only on a
  // genuine change instead of every frame of the drag.
  const reported = useSharedValue(stop);
  const dragging = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
  };

  const emit = useCallback(
    (next: number) => {
      onStopChange(next);
      // A no-op while HAPTICS_ENABLED is false, but the call belongs here so the
      // slider gains the feedback the moment that flag flips.
      void Haptics.selectionAsync();
    },
    [onStopChange],
  );

  const travel = Math.max(0, width - THUMB);

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onBegin(() => {
      dragging.value = withSpring(1, { damping: 20, stiffness: 240 });
    })
    .onUpdate((e) => {
      if (travel <= 0) return;
      // x is the thumb's CENTRE within the usable travel, so the ends are
      // reachable: at x=0 the thumb's left edge is flush, not its centre.
      const x = Math.max(0, Math.min(travel, e.x - THUMB / 2));
      const t = x / travel; // 0…1
      valence.value = t * 2 - 1;

      const idx = Math.min(
        STOP_COUNT - 1,
        Math.round(t * (STOP_COUNT - 1)),
      );
      if (idx !== reported.value) {
        reported.value = idx;
        runOnJS(emit)(idx);
      }
    })
    .onFinalize(() => {
      dragging.value = withSpring(0, { damping: 20, stiffness: 240 });
      // Settle on the stop, so what is stored is a named answer.
      const idx = Math.min(
        STOP_COUNT - 1,
        Math.max(0, Math.round(((valence.value + 1) / 2) * (STOP_COUNT - 1))),
      );
      valence.value = withSpring((idx / (STOP_COUNT - 1)) * 2 - 1, {
        damping: 18,
        stiffness: 180,
      });
      if (idx !== reported.value) {
        reported.value = idx;
        runOnJS(emit)(idx);
      }
    });

  // `dragging` is ALREADY a spring, set in the gesture callbacks. Starting a
  // withSpring here instead would re-issue an animation on every frame this
  // style is evaluated, which is what makes a thumb judder under the finger.
  const thumbStyle = useAnimatedStyle(() => {
    const t = (valence.value + 1) / 2;
    return {
      transform: [
        { translateX: t * travel },
        { scale: 1 + dragging.value * 0.14 },
      ],
    };
  });

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={pan}>
        {/* The row is the hit area, not the track — a 14px bar is not a target. */}
        <View style={styles.hit} onLayout={onLayout}>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            <LinearGradient
              colors={VALENCE_COLORS as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Stop ticks, so the seven answers are visible before you drag. */}
          <View style={styles.ticks} pointerEvents="none">
            {Array.from({ length: STOP_COUNT }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.tick,
                  {
                    backgroundColor:
                      i === stop ? colors.text : alpha(colors.text, 0.22),
                  },
                ]}
              />
            ))}
          </View>

          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: VALENCE_COLORS[stop],
              },
              thumbStyle,
            ]}
            accessibilityRole="adjustable"
            accessibilityLabel="How pleasant your state of mind is"
            accessibilityValue={{ min: 1, max: STOP_COUNT, now: stop + 1 }}
            accessibilityActions={[
              { name: "increment", label: "More pleasant" },
              { name: "decrement", label: "Less pleasant" },
            ]}
            onAccessibilityAction={(e) => {
              const delta = e.nativeEvent.actionName === "increment" ? 1 : -1;
              const next = Math.max(0, Math.min(STOP_COUNT - 1, stop + delta));
              if (next === stop) return;
              valence.value = withSpring(valenceAtStop(next), {
                damping: 18,
                stiffness: 180,
              });
              reported.value = next;
              emit(next);
            }}
          />
        </View>
      </GestureDetector>

      <View style={styles.ends}>
        <AppText variant="caption" color="tertiary">
          Very Unpleasant
        </AppText>
        <AppText variant="caption" color="tertiary">
          Very Pleasant
        </AppText>
      </View>
    </View>
  );
}

/** Stop index for a valence — re-exported so callers don't reach into mind.ts. */
export { valenceStopIndex };

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  hit: { height: HIT_H, justifyContent: "center" },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    marginHorizontal: THUMB / 2,
    overflow: "hidden",
  },
  ticks: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: THUMB / 2 - 1.5,
  },
  tick: { width: 3, height: 3, borderRadius: 1.5 },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    // `left: 0` puts the thumb's CENTRE at the track's left inset (the track is
    // inset by THUMB / 2), so translateX maps straight onto travel with no
    // offset arithmetic at either end.
    left: 0,
    // An absolutely-positioned child ignores the row's justifyContent, so the
    // vertical centre has to be stated or the thumb rides 8px above the track.
    top: (HIT_H - THUMB) / 2,
  },
  ends: { flexDirection: "row", justifyContent: "space-between" },
});
