/**
 * CoachAvatar — the friendly workout mascot (public wrapper).
 *
 * Renders the animated Skia character when available, or a calm static SVG
 * face otherwise (pre-rebuild window, reduced-motion, Skia-less surface). The
 * `mood` prop is the whole interface: the host session maps phase → mood.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { alpha } from "@/constants/theme";
import { useColors } from "@/components/ui";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgGradient,
  Path as SvgPath,
  Stop,
} from "react-native-svg";
import type { CoachMood, SkiaCoachAvatarProps } from "./CoachAvatar.skia";

export type { CoachMood } from "./CoachAvatar.skia";

let SkiaAvatar: React.ComponentType<SkiaCoachAvatarProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaAvatar = require("./CoachAvatar.skia").SkiaCoachAvatar;
}

export interface CoachAvatarProps {
  mood?: CoachMood;
  size?: number;
  gradient?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
}

export function CoachAvatar({
  mood = "idle",
  size = 96,
  gradient,
  style,
}: CoachAvatarProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  // Default to the theme brand ramp (orange in light, gold in dark).
  const grad = gradient ?? colors.brandGradient;
  const Impl = SkiaAvatar;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      {Impl && !reduced ? (
        <Impl mood={mood} size={size} colors={grad} />
      ) : (
        <StaticFace size={size} mood={mood} gradient={grad} />
      )}
    </View>
  );
}

const INK = "#08252B";

/** Static friendly face in the always-available SVG layer. */
function StaticFace({
  size,
  mood,
  gradient,
}: {
  size: number;
  mood: CoachMood;
  gradient: readonly [string, string, ...string[]];
}) {
  useColors(); // keep hook parity with the animated path
  const mouth =
    mood === "cheer"
      ? "M41,61 Q50,60 59,61 Q50,77 41,61 Z"
      : mood === "rest"
        ? "M45,64 Q50,67 55,64"
        : "M42,62 Q50,71 58,62";
  const filled = mood === "cheer";
  const eyeRy = mood === "rest" ? 1.4 : 7.5;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgGradient id="coachBody" x1="0" y1="20" x2="0" y2="84" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={gradient[0]} />
          <Stop offset="1" stopColor={gradient[gradient.length - 1]} />
        </SvgGradient>
      </Defs>
      <Circle cx={41} cy={82} r={6} fill={gradient[gradient.length - 1]} />
      <Circle cx={59} cy={82} r={6} fill={gradient[gradient.length - 1]} />
      <Ellipse cx={50} cy={51} rx={24} ry={29} fill="url(#coachBody)" />
      <Ellipse cx={44} cy={57} rx={14} ry={15} fill={alpha("#FFFFFF", 0.14)} />
      <Ellipse cx={40} cy={46} rx={7.5} ry={eyeRy} fill="#FFFFFF" />
      <Ellipse cx={60} cy={46} rx={7.5} ry={eyeRy} fill="#FFFFFF" />
      {mood !== "rest" && (
        <>
          <Circle cx={41} cy={45} r={3.4} fill={INK} />
          <Circle cx={61} cy={45} r={3.4} fill={INK} />
        </>
      )}
      <SvgPath
        d={mouth}
        fill={filled ? INK : "none"}
        stroke={INK}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
