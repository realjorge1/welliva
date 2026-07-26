/**
 * GozlinAvatar — the coach's identity mark. The AILogoBadge with a subtle
 * "alive" breathing pulse, so Gozlin reads as a presence, not a button.
 */

import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import AILogoBadge from "./AILogoBadge";

export function GozlinAvatar({
  size = 36,
  pulsing = false,
}: {
  size?: number;
  pulsing?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulsing) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <AILogoBadge size={size} />
    </Animated.View>
  );
}
