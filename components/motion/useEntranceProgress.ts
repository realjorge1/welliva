/**
 * useEntranceProgress — a progress value that waits for its card to be seen.
 *
 * Rings (Ring, TickRing) fill from empty to where the day has put them. Without
 * an `entrance` that happens the way it always has: from empty on the cold-start
 * reveal, snapped on a warm mount, and every later change animates the delta.
 *
 * WITH an entrance — the screen's scroll-driven 0 / 1 / 2, decided in
 * components/home/scrollEntrance — the ring holds at empty until its card has
 * scrolled into view from below, then fills from zero. Arriving from above it is
 * simply there, finished. Once the card has left the screen entirely it is
 * wiped back to empty, unseen, so the next arrival fills from the start again.
 *
 * A value that changes while the ring is waiting below the fold is remembered,
 * not shown: the arrival fills to the new value.
 */
import { Motion } from "@/constants/theme";
import { useEffect } from "react";
import {
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useIntroReveal } from "./IntroReveal";
import { Ease } from "./motion";

export interface EntranceProgressOptions {
  /** 0 wait · 1 play · 2 show finished. Leave out for the classic behaviour. */
  entrance?: SharedValue<number>;
  /** Fill duration in ms — defaults to the hero motion token. */
  duration?: number;
}

export function useEntranceProgress(
  value: number,
  { entrance, duration = Motion.duration.hero }: EntranceProgressOptions = {},
): SharedValue<number> {
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  // What the ring should show once it is seen.
  const target = useSharedValue(value);
  const anim = useSharedValue(entrance ? 0 : reduced || !intro ? value : 0);

  useEffect(() => {
    target.value = value;
    // Still waiting below the fold: remember the value, show nothing yet.
    if (entrance && entrance.value === 0) return;
    anim.value = reduced ? value : withTiming(value, { duration, easing: Ease.standard });
  }, [value, entrance, reduced, duration, anim, target]);

  useAnimatedReaction(
    () => (entrance ? entrance.value : -1),
    (state, prev) => {
      if (state < 0 || state === prev) return;
      if (state === 0) {
        // Off screen: wipe it while nobody is looking.
        anim.value = 0;
      } else if (state === 1 && !reduced) {
        anim.value = 0;
        anim.value = withTiming(target.value, { duration, easing: Ease.standard });
      } else {
        anim.value = target.value;
      }
    },
    [entrance, reduced, duration],
  );

  return anim;
}
