/**
 * AnimatedNumber — counts up to its value when it changes. Reserved for hero
 * metrics (calories eaten, totals) so the number feels alive, not static.
 */
import { Typography, type TypographyVariant } from "@/constants/theme";
import React, { useEffect, useRef, useState } from "react";
import { Animated, type TextStyle } from "react-native";
import { useColors } from "./useColors";

export interface AnimatedNumberProps {
  value: number;
  variant?: TypographyVariant;
  color?: string;
  duration?: number;
  format?: (n: number) => string;
  style?: TextStyle;
}

export function AnimatedNumber({
  value,
  variant = "metric",
  color,
  duration = 800,
  format = (n) => `${Math.round(n)}`,
  style,
}: AnimatedNumberProps) {
  const { colors } = useColors();
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(() => format(value));

  // Keep the latest formatter without restarting the animation every parent
  // render (the default `format` is a fresh arrow each render).
  const formatRef = useRef(format);
  formatRef.current = format;
  // The last text actually shown — guards against redundant re-renders.
  const lastTextRef = useRef(display);

  useEffect(() => {
    // The animation runs at ~60fps, but the user only ever sees the *formatted*
    // value (rounded). Re-render React only when that text actually changes —
    // turning ~50 reconciliations per count into a handful.
    const id = anim.addListener(({ value: v }) => {
      const next = formatRef.current(v);
      if (next !== lastTextRef.current) {
        lastTextRef.current = next;
        setDisplay(next);
      }
    });
    Animated.timing(anim, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, duration, anim]);

  return (
    <Animated.Text
      style={[Typography[variant] as TextStyle, { color: color ?? colors.text }, style]}
    >
      {display}
    </Animated.Text>
  );
}
