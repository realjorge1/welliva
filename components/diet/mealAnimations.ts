/**
 * mealAnimations — the one motion vocabulary for the meals list, so every card
 * enters, leaves and repositions the same way (no per-card hand-rolled curves).
 *
 *   mealEnter(i) — a new card fades + lifts + scales from 95% into place, gently
 *                  staggered by row so the list assembles rather than pops.
 *   mealExit     — a removed card fades and drifts as its neighbours slide up.
 *   mealLayout   — the layout transition every sibling uses to reflow smoothly.
 */
import { Ease } from "@/components/motion/motion";
import { Motion } from "@/constants/theme";
import { Keyframe, LinearTransition } from "react-native-reanimated";

export const CARD_SPRING = { damping: 18, stiffness: 220, mass: 0.9 } as const;

export function mealEnter(index = 0) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.95 }] },
    100: {
      opacity: 1,
      transform: [{ translateY: 0 }, { scale: 1 }],
      easing: Ease.decelerate,
    },
  })
    .duration(Motion.duration.slow)
    .delay(index * 70);
}

export function mealExit() {
  return new Keyframe({
    0: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] },
    100: {
      opacity: 0,
      transform: [{ translateX: -24 }, { scale: 0.94 }],
      easing: Ease.accelerate,
    },
  }).duration(Motion.duration.base);
}

export function mealLayout() {
  return LinearTransition.duration(Motion.duration.base).easing(Ease.standard);
}
