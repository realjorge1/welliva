import { useColors } from "@/components/ui";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { CircleRing } from "./CircleRing";
import { GozlinAvatar } from "./GozlinAvatar";

const BASE = 64;
/** Below this the ring is clutter, not a frame: the badge is just the avatar. */
const RING_FROM = 24;

interface AILogoBadgeProps {
  size?: number;
  /** Continuous ring rotation — the "alive" AI shimmer. */
  animated?: boolean;
}

/**
 * Gozlin's mark for hero moments — onboarding, the consent screen: the avatar
 * disc (the diamond on its own black ground) inside a thin rotating gold ring.
 *
 * The ring is the badge's; the diamond is the icon's and is drawn untouched.
 * The ring is kept thin and the disc large on purpose — the bolt this replaced
 * was a glyph on a gold coin, and the same proportions would shrink the diamond
 * to a speck inside its own frame.
 */
export default function AILogoBadge({ size = BASE, animated = true }: AILogoBadgeProps) {
  const { colors } = useColors();
  // Brand gradient — orange in light, gold-yellow in dark (matches the app).
  const BRAND = colors.brandGradient; // [light, mid, deep]
  const RING_A = [BRAND[0], BRAND[1], BRAND[2], BRAND[1], BRAND[0]];
  const RING_B = [BRAND[0], BRAND[2], BRAND[0]];

  // Unique gradient ids per instance so multiple badges don't share SVG defs.
  const uid = React.useId().replace(/:/g, "");

  const ringed = size >= RING_FROM;
  const ringStroke = Math.max(1.5, size * 0.06);
  const discSize = ringed ? Math.round(size * 0.8) : size;

  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated || !ringed) {
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
  }, [animated, ringed, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {ringed ? (
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate }],
          }}
        >
          <CircleRing
            size={size}
            strokeWidth={ringStroke}
            opacity={0.95}
            colors={RING_A}
            gradientStart={{ x: 0, y: 0 }}
            gradientEnd={{ x: 1, y: 1 }}
            gradientId={`ring_a_${uid}`}
          />
          <CircleRing
            size={size}
            strokeWidth={ringStroke}
            opacity={0.5}
            colors={RING_B}
            gradientStart={{ x: 1, y: 0 }}
            gradientEnd={{ x: 0, y: 1 }}
            gradientId={`ring_b_${uid}`}
          />
        </Animated.View>
      ) : null}

      {/* The mark on its own ground. Stays upright while the ring turns. The
          ring already draws the rim, so the disc's own hairline is off. */}
      <GozlinAvatar size={discSize} edge={!ringed} />
    </View>
  );
}
