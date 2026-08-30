/**
 * RestingFace — what the player shows while you are recovering, in the slot the
 * exercise figure occupies while you are working.
 *
 * The figure kept doing squats through rest, which read as the app not knowing
 * what phase it was in. This is the answer: a sleeping face, held to the user's
 * reference emoji — round, thick outline, two closed arcs for eyes, a small
 * open mouth, and a rising "Zzz".
 *
 * It is the ONE face in the fitness module, and it exists because rest is the
 * one moment nothing is being demonstrated. It is not a mascot: it never
 * appears during work, never reacts to performance, and never speaks. Do not
 * grow it into one.
 *
 * Built from SVG (the curved eyes need paths) plus plain animated Views for the
 * mouth and the Zs, so there are no animated SVG props anywhere and no Skia
 * dependency — it renders identically on every surface. Outline and features
 * take the theme's text colour so the face works on a dark canvas; only the
 * fill is a fixed warm yellow, because a sleeping face that isn't yellow isn't
 * the reference.
 */
import { AppText, useColors } from "@/components/ui";
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Reanimated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

/** The reference emoji's yellow. Fixed on purpose — see the header. */
const FACE_FILL = "#F2C34C";
/**
 * Outline, eyes and mouth. Fixed BLACK rather than `colors.text`: on a dark
 * canvas the theme's text colour turned the face's own features white, which
 * read as holes punched through it. The face is a printed sticker — its ink
 * doesn't follow the theme. The Zs do, so they stay light on a dark stage.
 */
const INK = "#141414";

/** One full breath, in and out. */
const BREATH_MS = 3600;
/** How long one "Z" takes to drift up and fade. */
const Z_MS = 2400;

export interface RestingFaceProps {
  /** Overall height in px; the face is drawn to fill it. */
  size?: number;
  /** Set false to freeze the breath and the Zs. */
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function RestingFace({ size = 140, playing = true, style }: RestingFaceProps) {
  const reduced = useReducedMotion();
  const animate = playing && !reduced;

  const breath = useSharedValue(0);
  const z0 = useSharedValue(0);
  const z1 = useSharedValue(0);
  const z2 = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 300 });
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [animate, breath]);

  useEffect(() => {
    const zs = [z0, z1, z2];
    if (!animate) {
      zs.forEach((z) => {
        cancelAnimation(z);
        z.value = 0;
      });
      return;
    }
    // Staggered rather than simultaneous: three Zs leaving together is a shape,
    // three leaving one after another is sleep.
    zs.forEach((z, i) => {
      z.value = 0;
      z.value = withDelay(
        i * (Z_MS / 3),
        withRepeat(withTiming(1, { duration: Z_MS, easing: Easing.linear }), -1, false),
      );
    });
    return () => zs.forEach((z) => cancelAnimation(z));
  }, [animate, z0, z1, z2]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.022 * breath.value }],
  }));

  // The mouth is the snore: it opens on the inhale and settles on the out.
  const mouthStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + 0.22 * breath.value }, { scaleX: 1 - 0.05 * breath.value }],
  }));

  const R = size * 0.42;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(2, size * 0.055);
  // Eyes: shallow domes with the ends turned down — a closed, contented eye.
  const eyeY = cy - size * 0.03;
  const eyeDx = size * 0.165;
  const eyeW = size * 0.088;
  const eyeH = size * 0.075;
  const eye = (dir: -1 | 1) =>
    `M${cx + dir * eyeDx - eyeW},${eyeY} Q${cx + dir * eyeDx},${eyeY - eyeH} ${cx + dir * eyeDx + eyeW},${eyeY}`;

  const mouthW = size * 0.14;
  const mouthH = size * 0.175;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Reanimated.View style={[StyleSheet.absoluteFill, styles.center, faceStyle]}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={R} fill={FACE_FILL} stroke={INK} strokeWidth={stroke} />
          <Path
            d={eye(-1)}
            stroke={INK}
            strokeWidth={stroke * 0.82}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={eye(1)}
            stroke={INK}
            strokeWidth={stroke * 0.82}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        <Reanimated.View
          style={[
            styles.mouth,
            {
              width: mouthW,
              height: mouthH,
              borderRadius: mouthW / 2,
              backgroundColor: INK,
              top: cy + size * 0.115,
              left: cx - mouthW / 2,
            },
            mouthStyle,
          ]}
        />
      </Reanimated.View>

      {/* Zzz — rising off the top-right, largest first. */}
      <View style={[styles.zField, { width: size * 0.5, height: size * 0.5 }]} pointerEvents="none">
        <Zed progress={z0} size={size * 0.19} x={size * 0.02} y={size * 0.26} />
        <Zed progress={z1} size={size * 0.14} x={size * 0.17} y={size * 0.14} />
        <Zed progress={z2} size={size * 0.1} x={size * 0.29} y={size * 0.05} />
      </View>
    </View>
  );
}

function Zed({
  progress,
  size,
  x,
  y,
}: {
  progress: SharedValue<number>;
  size: number;
  x: number;
  y: number;
}) {
  const { colors } = useColors();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.22, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -size * 1.6]) },
      { translateX: interpolate(progress.value, [0, 1], [0, size * 0.5]) },
    ],
  }));

  return (
    <Reanimated.View style={[styles.zed, { left: x, top: y }, style]}>
      <AppText
        variant="caption"
        style={{
          fontSize: size,
          lineHeight: size * 1.1,
          fontWeight: "800",
          color: colors.text,
        }}
      >
        Z
      </AppText>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  mouth: { position: "absolute" },
  zField: { position: "absolute", right: 0, top: 0 },
  zed: { position: "absolute" },
});
