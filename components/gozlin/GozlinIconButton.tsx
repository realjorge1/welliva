/**
 * GozlinIconButton — the AI icon *is* the button.
 *
 * Wraps the animated Gozlin mark (GozlinAvatar, with its expanding/shrinking
 * pulse) in a pressable that opens the full coach screen. Optionally shows a
 * small, static "AI Coach"-style badge beneath the icon. This replaces the old
 * card-style AI entry — the icon itself is now the doorway to Gozlin.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GozlinAvatar } from "./GozlinAvatar";

export function GozlinIconButton({
  size = 44,
  label,
  pulsing = true,
  prompt,
  style,
}: {
  /** Diameter of the AI mark. */
  size?: number;
  /** Static caption shown below the icon (e.g. "Coach Gozlin"). */
  label?: string;
  /** Keep the breathing animation alive. Defaults on. */
  pulsing?: boolean;
  /** Pre-ask Gozlin a question on open. */
  prompt?: string;
  /** Host layout (margins, alignment). */
  style?: object;
}) {
  const { colors } = useColors();
  const router = useRouter();

  const open = () =>
    router.push(
      (prompt
        ? { pathname: "/gozlin", params: { prompt } }
        : "/gozlin") as any,
    );

  return (
    <Pressable
      onPress={open}
      hitSlop={8}
      style={({ pressed }) => [
        styles.wrap,
        pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        style,
      ]}
    >
      <GozlinAvatar size={size} pulsing={pulsing} />
      {label ? (
        <View
          style={[styles.badge, { backgroundColor: alpha(colors.primary, 0.14) }]}
        >
          <AppText variant="caption" color="brand" uppercase>
            {label}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: Spacing.sm },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
