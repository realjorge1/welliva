/**
 * Reveal — subtle entrance animation (fade + rise). Used to stagger content
 * in as a screen mounts, so things feel composed rather than popped on.
 *
 *   <Reveal index={0}><Card>…</Card></Reveal>
 *   <Reveal index={1}>…</Reveal>   // staggers ~70ms after the first
 */
import { Motion } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export interface RevealProps {
  children: React.ReactNode;
  /** Stagger position; each step delays the start by `stagger` ms. */
  index?: number;
  stagger?: number;
  /** Initial vertical offset in px. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Layout callback. Transforms don't affect onLayout, so when a Reveal is a
   * direct child of a scroll region its `y` is the true content offset — handy
   * for scroll-driven effects.
   */
  onLayout?: (e: LayoutChangeEvent) => void;
}

export function Reveal({
  children,
  index = 0,
  stagger = 90,
  distance = 16,
  style,
  onLayout,
}: RevealProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = Animated.timing(progress, {
      toValue: 1,
      duration: Motion.duration.slow,
      delay: index * stagger,
      useNativeDriver: true,
    });
    id.start();
    return () => id.stop();
  }, [progress, index, stagger]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
