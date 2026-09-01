/**
 * AscendingMeter — a row of thin bars that step up from lowest to highest and
 * fill left-to-right as progress rises (a calm "equalizer" that grows with you).
 *
 * Each bar fills from the bottom; a single Reanimated value drives the whole row
 * so the bars light up one after another in sequence, on the UI thread. Used on
 * Home's today card (diet + workout progress) and inside the coach deep-dive.
 *
 * `glyph` is the escape hatch, and it exists because a meter is only honest
 * while it is measuring something. On a rest day the workout tile has no
 * progress to show — nothing was asked for, so nothing was missed — and the old
 * behaviour of scoring the day 1.0 lit all five bars, which reads as "you
 * trained" on the one day you deliberately did not. Passing a glyph swaps the
 * bars for a picture in the same box and the same tone (see ./MeterGlyph); the
 * meter stops pretending to a number it does not have, and the layout does not
 * shift when the state flips back.
 */
import { Motion, Radius, alpha } from "@/constants/theme";
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { MeterGlyph, type MeterGlyphName } from "./MeterGlyph";
import { useColors } from "./useColors";

export interface AscendingMeterProps {
  /** 0–1 fill of the whole row. */
  progress: number;
  tone: string;
  /** Number of bars (default 5). */
  bars?: number;
  /** Row height in px — the tallest bar. */
  height?: number;
  /** Bar width in px. */
  barWidth?: number;
  /** Gap between bars. */
  gap?: number;
  /** Track fill for the empty portion of each bar. */
  track?: string;
  /**
   * Draw this instead of the bars. For states where a filled meter would be
   * meaningless rather than impressive — a rest day, a fully-recovered body.
   */
  glyph?: MeterGlyphName | null;
  /** What the glyph means, for screen readers. */
  glyphLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function AscendingMeter({
  progress,
  tone,
  bars = 5,
  height = 26,
  barWidth = 5,
  gap = 5,
  track,
  glyph,
  glyphLabel,
  style,
}: AscendingMeterProps) {
  const { colors, isDark } = useColors();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const clamped = Math.max(0, Math.min(1, progress || 0));

  // Step up from empty only on a cold-start reveal; snap on warm mounts.
  const p = useSharedValue(reduced || !intro ? clamped : 0);
  useEffect(() => {
    p.value = reduced
      ? clamped
      : withTiming(clamped, { duration: Motion.duration.hero, easing: Ease.standard });
  }, [clamped, reduced, p]);

  const trackColor = track ?? (isDark ? alpha(colors.text, 0.1) : alpha(tone, 0.14));

  // The exact footprint the bars would have taken, so the glyph lands in the
  // same place on the card and nothing around it moves.
  if (glyph) {
    return (
      <MeterGlyph
        name={glyph}
        width={bars * barWidth + gap * (bars - 1)}
        height={height}
        tone={tone}
        label={glyphLabel}
        style={style}
      />
    );
  }

  return (
    <View style={[styles.row, { height, gap }, style]}>
      {Array.from({ length: bars }).map((_, i) => {
        // Ascending heights — the shortest bar is 42% of the row, the tallest full.
        const h = Math.round(height * (0.42 + 0.58 * (i / (bars - 1))));
        return (
          <Bar
            key={i}
            index={i}
            bars={bars}
            width={barWidth}
            height={h}
            tone={tone}
            track={trackColor}
            p={p}
          />
        );
      })}
    </View>
  );
}

function Bar({
  index,
  bars,
  width,
  height,
  tone,
  track,
  p,
}: {
  index: number;
  bars: number;
  width: number;
  height: number;
  tone: string;
  track: string;
  p: SharedValue<number>;
}) {
  // This bar owns the slice [index/bars, (index+1)/bars] of the total progress;
  // its own fill fraction ramps 0→1 as the shared value crosses that slice.
  const fillStyle = useAnimatedStyle(() => {
    "worklet";
    const frac = Math.max(0, Math.min(1, p.value * bars - index));
    return { height: frac * height };
  });

  return (
    <View
      style={[
        styles.bar,
        { width, height, borderRadius: width / 2, backgroundColor: track },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: width / 2, backgroundColor: tone },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  bar: { overflow: "hidden", justifyContent: "flex-end" },
  fill: { width: "100%", borderRadius: Radius.xs },
});
