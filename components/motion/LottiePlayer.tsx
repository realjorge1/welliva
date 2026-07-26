/**
 * LottiePlayer — a thin, safe wrapper around lottie-react-native.
 *
 * We build the session animations in Skia (code-drawn, zero assets), but Lottie
 * is wired and ready so a designer-made `.json` can be dropped in later without
 * touching any screen. With no `source` (the default today) it renders nothing,
 * so hosts can place it unconditionally. Safe-required so a missing/older native
 * build can't crash the route.
 *
 *   <LottiePlayer source={require("@/assets/lottie/celebrate.json")} size={160} />
 */
import React from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

type LottieComponent = React.ComponentType<{
  source: unknown;
  autoPlay?: boolean;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

let Lottie: LottieComponent | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Lottie = require("lottie-react-native").default as LottieComponent;
} catch {
  Lottie = null;
}

export const isLottieAvailable = Lottie !== null;

export interface LottiePlayerProps {
  /** `require("...json")` or `{ uri }`. Omit → renders nothing. */
  source?: unknown;
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LottiePlayer({
  source,
  size = 120,
  loop = true,
  autoPlay = true,
  style,
}: LottiePlayerProps) {
  const reduced = useReducedMotion();
  if (!source || !Lottie) return null;
  return (
    <Lottie
      source={source}
      autoPlay={autoPlay && !reduced}
      loop={loop && !reduced}
      style={[{ width: size, height: size }, style]}
    />
  );
}
