/**
 * MessageActions — the row of verbs under a message.
 *
 * WHY IT IS TAP-TO-REVEAL RATHER THAN ALWAYS ON. Five icons under every bubble
 * turns a conversation into a control panel: the eye is drawn to the chrome
 * instead of the sentence, and a long thread becomes a wall of repeated
 * hardware. So the row appears under the message you're actually dealing with —
 * the newest reply, which is where a retry or a copy is nearly always aimed, and
 * any older message the moment you tap it.
 *
 * WHY THE ICONS ARE QUIET. These are secondary to the text by definition. They
 * sit at tertiary weight with no plates and no borders until something is true
 * of them: a rating you've given lights up in the brand colour and stays lit,
 * because it is a state, not a button press. Nothing else changes appearance.
 *
 * WHY ONE COMPONENT SERVES BOTH SIDES. The coach's row (copy, retry, rate,
 * details) and your own (copy, edit) are the same object with different verbs,
 * and `align` is the whole difference — a right-aligned row under your bubble,
 * a left-aligned one under Gozlin's. Two components would have drifted apart on
 * spacing within a week.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

type IconName = keyof typeof Ionicons.glyphMap;

export interface MessageAction {
  key: string;
  icon: IconName;
  /** Spoken name. Also the visible text when `showLabel` is set. */
  label: string;
  showLabel?: boolean;
  /** Lit — a rating that has been given, not a button being pressed. */
  active?: boolean;
  /** Colour override for the lit/label state. Defaults to brand. */
  tone?: string;
  /** Swap the icon for a spinner and refuse taps. */
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function MessageActions({
  actions,
  align = "left",
}: {
  actions: MessageAction[];
  align?: "left" | "right";
}) {
  const { colors } = useColors();
  if (actions.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      exiting={FadeOut.duration(100)}
      style={[styles.row, align === "right" ? styles.right : styles.left]}
    >
      {actions.map((a) => {
        const tint = a.tone ?? colors.primary;
        const color = a.active ? tint : colors.textTertiary;
        return (
          <Pressable
            key={a.key}
            onPress={() => {
              if (a.busy || a.disabled) return;
              Haptics.selectionAsync().catch(() => {});
              a.onPress();
            }}
            disabled={a.busy || a.disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityState={{ selected: !!a.active, disabled: !!a.disabled }}
            style={({ pressed }) => [
              styles.action,
              a.showLabel && styles.labelled,
              a.showLabel && { backgroundColor: alpha(colors.text, 0.06) },
              pressed && { opacity: 0.55 },
              a.disabled && { opacity: 0.35 },
            ]}
          >
            {a.busy ? (
              <ActivityIndicator size="small" color={color} />
            ) : (
              <Ionicons name={a.icon} size={16} color={color} />
            )}
            {a.showLabel ? (
              <AppText variant="caption" weight="600" style={{ color }}>
                {a.label}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  left: { justifyContent: "flex-start", paddingLeft: 2 },
  right: { justifyContent: "flex-end", paddingRight: 2 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 30,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
    justifyContent: "center",
  },
  /** A verb with a name needs room to breathe on both sides of its icon. */
  labelled: { paddingHorizontal: Spacing.sm + 2 },
});

