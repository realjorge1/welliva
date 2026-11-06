/**
 * useEntranceTrigger — wires one card to ./scrollEntrance.
 *
 * The screen keeps the latest scroll metrics in ONE ref and calls `step()` on
 * each trigger from its scroll handler; every card that plays on arrival brings
 * its own trigger — a shared value for the card to read (0 wait · 1 play · 2
 * show finished) and the `onLayout` that says where the card sits.
 *
 * The card's wrapper must be a DIRECT child of the scroll region, so its layout
 * `y` is its true place on the page (see Reveal's `onLayout`).
 *
 * Refs and a shared value only, on purpose: this runs on every scroll event, and
 * state here would re-render the whole screen sixty times a second to answer a
 * question whose answer changes twice.
 */
import { NAV_CLEARANCE } from "@/components/ui";
import { useCallback, useMemo, useRef, type RefObject } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { INITIAL_ENTRANCE, stepEntrance, type EntranceState } from "./scrollEntrance";

export interface ScrollMetrics {
  /** The scroll offset. */
  y: number;
  /** The viewport's height. */
  h: number;
}

export interface EntranceTrigger {
  /** 0 wait · 1 play · 2 show finished — hand it to the card. */
  value: SharedValue<number>;
  /** Re-decide against the screen's latest scroll metrics. */
  step: () => void;
  /** Put on the card's wrapper (a direct child of the scroll region). */
  onLayout: (e: LayoutChangeEvent) => void;
}

export function useEntranceTrigger(
  metrics: RefObject<ScrollMetrics>,
  // The rail floats over the foot of the page; a card half under it is not yet
  // "in view".
  reservedBottom: number = NAV_CLEARANCE,
): EntranceTrigger {
  const value = useSharedValue(0);
  const box = useRef({ y: 0, h: 0 });
  const state = useRef<EntranceState>(INITIAL_ENTRANCE);

  const step = useCallback(() => {
    const b = box.current;
    if (b.h <= 0) return;
    const { y, h } = metrics.current;
    const out = stepEntrance(state.current, {
      scrollY: y,
      viewportH: h,
      boxY: b.y,
      boxH: b.h,
      reservedBottom,
    });
    state.current = out.state;
    if (out.signal !== null) value.value = out.signal;
  }, [metrics, reservedBottom, value]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      box.current = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height };
      // A tall phone can show it before anyone scrolls: that is an arrival too.
      step();
    },
    [step],
  );

  return useMemo(() => ({ value, step, onLayout }), [value, step, onLayout]);
}
