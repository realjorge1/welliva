/**
 * GozlinButton — the coach, tucked under the menu button.
 *
 * It used to sit in the top-RIGHT of Home, Diet and Fitness, competing with each
 * screen's title for the eye. Now the hamburger owns the top-left and the
 * greeting reads from the far right, which leaves the left column free: the
 * coach sits directly beneath the menu button, so the two things that take you
 * somewhere else live together and the header reads as one thing.
 *
 * IN FLOW, NOT FLOATING. It's passed to `ScreenTopBar`'s `below` slot, inside
 * each screen's PINNED header — so it stays put while the page scrolls without
 * ever overlapping the first card, which is exactly what an absolutely
 * positioned button in this corner would do.
 *
 * The mark is still the button — no label, no card.
 */

import { enterHero } from "@/components/motion";
import { useColors } from "@/components/ui/useColors";
import { Radius, alpha } from "@/constants/theme";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { GozlinAvatar } from "./GozlinAvatar";

export interface GozlinButtonProps {
  /** Pre-ask Gozlin a question on open. */
  prompt?: string;
  /** Diameter. Matches the menu button above it, so the left column reads as
   *  one clean vertical line rather than two stacked circles. */
  size?: number;
  /** Keep the mark breathing. Defaults on — it's what says "alive". */
  pulsing?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GozlinButton({
  prompt,
  size = 40,
  pulsing = true,
  style,
}: GozlinButtonProps) {
  const { colors } = useColors();
  const router = useRouter();

  // Gozlin is a root screen now, so this is a switch, not a push — going to the
  // coach and coming back must not build a stack behind the hamburger.
  const open = () =>
    router.navigate(
      (prompt
        ? { pathname: "/gozlin", params: { prompt } }
        : "/gozlin") as never,
    );

  return (
    <Animated.View entering={enterHero()} style={style}>
      <Pressable
        onPress={open}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Ask Gozlin, your AI coach"
        style={({ pressed }) => [
          styles.button,
          {
            width: size,
            height: size,
            backgroundColor: colors.surfaceElevated,
            borderColor: alpha(colors.primary, 0.28),
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
        ]}
      >
        <GozlinAvatar size={Math.round(size * 0.66)} pulsing={pulsing} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
