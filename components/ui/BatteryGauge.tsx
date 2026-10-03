/**
 * BatteryGauge — recovery drawn as what it is: charge.
 *
 * The recovery card used to show the same five ascending bars as Home's
 * progress tiles, which made recovery look like progress: a thing you fill by
 * doing more. Recovery runs the other way. Training drains it and rest refills
 * it, and a battery is the one gauge everybody already reads in that direction.
 *
 * Colour lives only in the charge. The casing stays neutral, as on a phone, so
 * a low battery reads as a nudge rather than an alarm. The casing takes the
 * tone only when the battery is full, with the bolt cut out of the charge, so
 * full is the one state that looks finished.
 *
 * Drawn on a 30×20 canvas and scaled to `height`. The charge animates like
 * AscendingMeter's bars: up from empty on a cold-start reveal, and on to its
 * new level when it changes while mounted.
 */
import { Motion, alpha } from "@/constants/theme";
import React, { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { useColors } from "./useColors";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const CANVAS_W = 30;
const CANVAS_H = 20;

/**
 * Where the charge sits: an even 1.3 inside the casing on every side, with
 * corners concentric to it (casing radius 4.6 at the stroke centre, 3.8 at its
 * inner edge, minus the gap = 2.5).
 */
const SLOT = { x: 2.95, y: 4.2, width: 21.4, height: 11.6, r: 2.5 };

/**
 * The full charge with the bolt punched through it: two subpaths filled
 * even-odd, so the bolt is a hole the card shows through and the glyph stays
 * one colour on any surface. The bolt is point-symmetric about the slot's
 * centre (13.65, 10), so it sits optically centred, not just boxed.
 */
const FULL_WITH_BOLT =
  "M5.45 4.2 H21.85 a2.5 2.5 0 0 1 2.5 2.5 V13.3 a2.5 2.5 0 0 1 -2.5 2.5 " +
  "H5.45 a2.5 2.5 0 0 1 -2.5 -2.5 V6.7 a2.5 2.5 0 0 1 2.5 -2.5 Z " +
  "M15.5 5.1 L9.9 11 H13.1 L11.9 14.9 L17.3 9 H14.2 Z";

/** The thinnest charge drawn. Anything above empty has to be visible. */
const MIN_SLIVER = 1.2;

export interface BatteryGaugeProps {
  /** 0–1. */
  charge: number;
  /** The charge's colour, and the casing's once full. */
  tone: string;
  /** Height in px; the width follows at 3:2. */
  height?: number;
  /** Announced instead of the bare percentage. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function BatteryGauge({ charge, tone, height = 34, label, style }: BatteryGaugeProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const c = Math.max(0, Math.min(1, charge || 0));
  const full = c >= 1;

  // Fill up from empty only on a cold-start reveal; snap on warm mounts.
  const p = useSharedValue(reduced || !intro ? c : 0);
  useEffect(() => {
    p.value = reduced
      ? c
      : withTiming(c, { duration: Motion.duration.hero, easing: Ease.standard });
  }, [c, reduced, p]);

  const fillProps = useAnimatedProps(() => {
    const w = p.value <= 0 ? 0 : Math.max(MIN_SLIVER, SLOT.width * p.value);
    const r = Math.min(SLOT.r, w / 2);
    return { width: w, rx: r, ry: r };
  });

  const casing = full ? tone : colors.textTertiary;
  const width = height * (CANVAS_W / CANVAS_H);

  return (
    <View
      style={[{ width, height }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? `${Math.round(c * 100)} percent charged`}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
        <Rect
          x={0.85}
          y={2.1}
          width={25.6}
          height={15.8}
          rx={4.6}
          stroke={casing}
          strokeWidth={1.6}
          fill="none"
        />
        {/* The terminal, at half strength so the casing reads as the object. */}
        <Rect x={27.75} y={7.1} width={2} height={5.8} rx={1} fill={casing} opacity={0.5} />
        {full ? (
          <Path d={FULL_WITH_BOLT} fill={tone} fillRule="evenodd" />
        ) : (
          <>
            <Rect
              x={SLOT.x}
              y={SLOT.y}
              width={SLOT.width}
              height={SLOT.height}
              rx={SLOT.r}
              fill={alpha(colors.textTertiary, 0.16)}
            />
            <AnimatedRect
              x={SLOT.x}
              y={SLOT.y}
              height={SLOT.height}
              fill={tone}
              animatedProps={fillProps}
            />
          </>
        )}
      </Svg>
    </View>
  );
}
