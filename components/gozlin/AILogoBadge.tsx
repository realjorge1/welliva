import { useColors } from "@/components/ui";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import AILogoIcon from "./AILogoIcon";
import { CircleRing } from "./CircleRing";
import { GradientView } from "./GradientView";

const BASE = 64;

interface AILogoBadgeProps {
  size?: number;
  /** Continuous ring rotation — the "alive" AI shimmer. */
  animated?: boolean;
}

export default function AILogoBadge({ size = BASE, animated = true }: AILogoBadgeProps) {
  const { colors } = useColors();
  // Brand gradient — orange in light, gold-yellow in dark (matches the app).
  const BRAND = colors.brandGradient; // [light, mid, deep]
  const RING_A = [BRAND[0], BRAND[1], BRAND[2], BRAND[1], BRAND[0]];
  const RING_B = [BRAND[0], BRAND[2], BRAND[0]];

  // Unique gradient ids per instance so multiple badges don't share SVG defs.
  const uid = React.useId().replace(/:/g, "");

  // Ring fills the full box so the badge reads at its given size (like the
  // previous orb), not shrunk into padding.
  const ringSize = size;
  const ringStroke = size * 0.14;
  const innerSize = size * 0.62;
  const iconSize = size * 0.44;

  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Rotating gradient rings */}
      <Animated.View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate }],
        }}
      >
        <CircleRing
          size={ringSize}
          strokeWidth={ringStroke}
          opacity={0.95}
          colors={RING_A}
          gradientStart={{ x: 0, y: 0 }}
          gradientEnd={{ x: 1, y: 1 }}
          gradientId={`ring_a_${uid}`}
        />
        <CircleRing
          size={ringSize}
          strokeWidth={ringStroke}
          opacity={0.5}
          colors={RING_B}
          gradientStart={{ x: 1, y: 0 }}
          gradientEnd={{ x: 0, y: 1 }}
          gradientId={`ring_b_${uid}`}
        />
      </Animated.View>

      {/* Inner brand-gradient circle */}
      <View
        style={{
          position: "absolute",
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: "hidden",
        }}
      >
        <GradientView
          colors={[...BRAND]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: innerSize / 2 }}
        />
      </View>

      {/* Lightning bolt centre icon (stays upright) */}
      <View style={{ position: "absolute" }}>
        <AILogoIcon size={iconSize} color="#FFFFFF" />
      </View>
    </View>
  );
}
