/**
 * FLOATING HEADER — the header that never cuts the page off.
 *
 * Owner, 2026-10-16, on a screenshot of Home with the calorie ring sliced in
 * half under the header: "the screen gets cut off by the very broad screen
 * header, that's bad UI … header elements remain and screen scrolls without any
 * visible cut off." A fade at the top of the list was turned down flat
 * ("shadow???"): it softened the line and kept the wall.
 *
 * So there is no wall. The page scrolls all the way up the glass, under the
 * header, and the header gets out of its way by FOLDING:
 *
 *   at rest      ☰          Good night           ◆     the header as designed,
 *                welliva                                straight on the canvas
 *
 *   scrolled   ( ☰  welliva                       ◆ )   an island over the page;
 *              ░░░░ cards pass above, beside, under ░░░  nothing is ever sliced
 *
 * - The menu line never moves. Its controls stay exactly where they were (the
 *   menu button's position is a promise across every destination — see
 *   ScreenTopBar) and an opaque rounded plate grows in behind them: the island.
 * - The title line folds away as the page arrives under it, and the screen's
 *   name rises into the island beside the menu, so identity survives the fold.
 * - Everything else in the header's box is transparent. The page shows above,
 *   beside and through it, right up to the status bar.
 *
 * It is the Deck's twin. The rail floats over the foot of every destination and
 * folds as you read; the island floats over the head and folds on the same
 * scroll. No shadow, no line across the page.
 *
 * MECHANICS. The header is an absolute overlay and the list starts at the top
 * of the screen with `paddingTop = contentTop` (top inset + the header's
 * measured height), so at rest the layout is exactly what it always was. The
 * fold is the scroll offset over `span`: the travel it takes the page to climb
 * from the header's foot to the menu line. Measured, not guessed — the overlay
 * reports the header's height, ScreenTopBar reports where its menu line ends.
 *
 * TOUCHES. The overlay is `box-none` all the way down, so a drag that starts on
 * the page showing through the header still scrolls it. ScreenTopBar makes the
 * two exceptions once folded: the island's plate takes touches (a tap on it
 * must not land on a card hidden beneath it), and the folded title line takes
 * none (its controls are invisible).
 *
 * The hook lives with the screen scaffold that owns the scroll (Screen, or a
 * screen that hand-rolls its own); the overlay hands the fold to whatever
 * header is inside it through context, so headers never thread a prop.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useDerivedValue, useSharedValue, type SharedValue } from "react-native-reanimated";

/**
 * The shortest fold. A header with almost nothing under its menu line (no
 * title, no gap) would otherwise fold on the first point of travel, which reads
 * as a flicker rather than a fold.
 */
const MIN_SPAN = 24;

export interface HeaderFold {
  /** 0 at rest, 1 once the page has reached the menu line. UI thread. */
  progress: SharedValue<number>;
  /** ScreenTopBar: where the menu line ends, from the top of the header. */
  reportBar: (bottom: number) => void;
}

const HeaderFoldContext = createContext<HeaderFold | null>(null);

/** The fold, inside a FloatingHeader. Null anywhere else — the header stays put. */
export function useHeaderFold(): HeaderFold | null {
  return useContext(HeaderFoldContext);
}

export interface FloatingHeaderState {
  /** The top inset the overlay sits under. */
  inset: number;
  /** Where the page starts at rest: the list's `paddingTop`. */
  contentTop: number;
  /**
   * False until the header has been measured. Keep the page hidden until then,
   * or its first frame lands under the header and jumps.
   */
  ready: boolean;
  /** Feed it the list's vertical offset from the scroll handler. */
  track: (y: number) => void;
  fold: HeaderFold;
  onLayout: (e: LayoutChangeEvent) => void;
}

/**
 * The fold's state, for the component that owns the scroll.
 *
 * @param inset the top safe-area inset the header has to sit under (0 when the
 *   screen doesn't own the top edge).
 */
export function useFloatingHeader(inset: number): FloatingHeaderState {
  const [height, setHeight] = useState(0);
  const offset = useSharedValue(0);
  const span = useSharedValue(MIN_SPAN);
  const box = useRef({ height: 0, bar: 0 });

  const respan = useCallback(() => {
    span.value = Math.max(MIN_SPAN, box.current.height - box.current.bar);
  }, [span]);

  // Clamped at zero: iOS reports a negative offset while bouncing at the top,
  // and Android's elastic pull leaves the offset at zero — neither is a fold.
  const progress = useDerivedValue(() =>
    Math.min(1, Math.max(0, offset.value / span.value)),
  );

  const track = useCallback(
    (y: number) => {
      offset.value = y;
    },
    [offset],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      box.current.height = h;
      respan();
      setHeight(h);
    },
    [respan],
  );

  const reportBar = useCallback(
    (bottom: number) => {
      box.current.bar = bottom;
      respan();
    },
    [respan],
  );

  const fold = useMemo(() => ({ progress, reportBar }), [progress, reportBar]);

  return {
    inset,
    contentTop: inset + height,
    ready: height > 0,
    track,
    fold,
    onLayout,
  };
}

export interface FloatingHeaderProps {
  state: FloatingHeaderState;
  /** The header's own box — the screen gutter goes here. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** The overlay. Render it AFTER the list, so it draws over it. */
export function FloatingHeader({ state, style, children }: FloatingHeaderProps) {
  return (
    <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: state.inset }]}>
      <View pointerEvents="box-none" style={style} onLayout={state.onLayout}>
        <HeaderFoldContext.Provider value={state.fold}>{children}</HeaderFoldContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
