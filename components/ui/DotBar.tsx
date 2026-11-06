/**
 * DotBar — progress drawn as a short row of square dots, like a tiny LED meter.
 *
 * The lit dots wear the colour you give them; every other dot stays a plain,
 * dim white. At zero NOTHING is coloured, so an empty bar says "nothing yet"
 * without a single tinted pixel, and as progress grows the colour fills in dot by
 * dot from the left, reaching the far end only when the goal is met.
 *
 * HOW IT ANIMATES. Two copies of the same dots are stacked — dim white beneath,
 * coloured above — and the coloured copy sits in a window whose width is a whole
 * number of dots. That window is the only thing that moves: it widens one dot at a
 * time on the UI thread, so the fill lights up dot by dot rather than sliding
 * through a dot half-lit. The paths themselves are drawn once.
 *
 * Same cold-start reveal, reduced-motion and timing as ProgressBar and Ring, so
 * bars and rings across the app still move as one system.
 */
import { Motion } from "@/constants/theme";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { Ease } from "@/components/motion/motion";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { dotBarGeometry, litCells } from "./dotBarLayout";

/**
 * Unlit dots: white, not a tint of anything — see the header.
 *
 * Dim enough that a lit dot is unmistakable: a saturated colour at full
 * brightness beside a dot that is only a faint white is different in hue AND in
 * brightness, so it survives anyone who cannot tell the hues apart (owner,
 * 2026-10-31: lit and unlit must never read as nearly the same shade).
 */
const IDLE = "rgba(255, 255, 255, 0.07)";
/** Before the width is known there is nothing to light. */
const NO_EDGES = [0];
/** A dot's side on a typical phone (~90pt of room ÷ 10.4), held until the width is measured. */
const FALLBACK_HEIGHT = 8;

export interface DotBarProps {
  /** 0–1. Anything past 1 simply lights every dot. */
  progress: number;
  /** The colour of the lit dots. */
  tone: string;
  /** Unlit dot colour. */
  idle?: string;
  style?: StyleProp<ViewStyle>;
}

export function DotBar({ progress, tone, idle = IDLE, style }: DotBarProps) {
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const [width, setWidth] = useState(0);

  const lit = litCells(progress);
  // Fill up from empty only on a cold-start reveal; snap on warm mounts. Value
  // changes always animate the delta.
  const anim = useSharedValue(reduced || !intro ? lit : 0);
  useEffect(() => {
    if (reduced) {
      anim.value = lit;
      return;
    }
    anim.value = withTiming(lit, { duration: Motion.duration.hero, easing: Ease.standard });
  }, [lit, anim, reduced]);

  const geometry = useMemo(() => (width > 0 ? dotBarGeometry(width) : null), [width]);
  const edges = geometry?.edges ?? NO_EDGES;

  // A whole number of dots wide: the colour lights a dot at a time, never a part of one.
  const windowStyle = useAnimatedStyle(() => {
    const n = Math.max(0, Math.min(edges.length - 1, Math.round(anim.value)));
    return { width: edges[n] };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === w ? prev : w));
  };

  // The height is worked out from the measured width and set EXPLICITLY. It was an
  // `aspectRatio` first, which looked right in a web mock and collapsed to nothing
  // on the phone (2026-11-01: no bar at all) — a stretched child's aspect ratio is
  // not something to lean on. Until the width arrives, a typical height is held so
  // the card around it moves by a point or two at most.
  return (
    <View onLayout={onLayout} style={[{ height: geometry ? geometry.size : FALLBACK_HEIGHT }, style]}>
      {geometry ? (
        <>
          <Svg width={width} height={geometry.size} style={StyleSheet.absoluteFill}>
            <Path d={geometry.d} fill={idle} />
          </Svg>
          <Animated.View style={[styles.window, { height: geometry.size }, windowStyle]}>
            <Svg width={width} height={geometry.size}>
              <Path d={geometry.d} fill={tone} />
            </Svg>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  window: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
});
