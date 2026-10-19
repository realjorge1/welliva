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
 * The mark is still the button — no label, no card. Since 2026-10-15 the face
 * IS the avatar: the diamond on its own black ground with a gold rim, i.e. the
 * old app icon cropped round. The bolt-era face nested a gold ring and a gold
 * coin inside this disc, and at 40dp that would have left the diamond a speck.
 *
 * IT DOES NOT MOVE (owner, 2026-10-15: "kill the animated effect"). It used to
 * breathe — a 1 → 1.08 scale loop, forever — and zoom in on mount. A header
 * button that swells and shrinks on every screen reads as a nag, not a
 * presence. The only motion left is the press feedback, which is the finger's.
 */

import { Radius } from "@/constants/theme";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GozlinAvatar } from "./GozlinAvatar";

export interface GozlinButtonProps {
  /** Pre-ask Gozlin a question on open. */
  prompt?: string;
  /** Diameter. Matches the menu button above it, so the left column reads as
   *  one clean vertical line rather than two stacked circles. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function GozlinButton({ prompt, size = 40, style }: GozlinButtonProps) {
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
    <View style={style}>
      <Pressable
        onPress={open}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Ask Gozlin, your AI coach"
        style={({ pressed }) => [
          styles.button,
          { width: size, height: size },
          pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
        ]}
      >
        <GozlinAvatar size={size} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
