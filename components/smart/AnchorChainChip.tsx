/**
 * AnchorChainChip — "Next: vitamins?" [Done], right after the thing it's tied to
 * was logged. Smaller than a smart card on purpose: it isn't telling anyone
 * anything, it's saving a trip to the habits screen.
 */
import { AppText, Button, IconBadge, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export function AnchorChainChip({
  name,
  icon,
  color,
  onDone,
  onDismiss,
  style,
}: {
  name: string;
  icon: string;
  color: string;
  onDone: () => void;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  return (
    <View style={[styles.row, { backgroundColor: colors.surfaceMuted }, style]}>
      <IconBadge name={icon as never} tone={color} size={32} />
      <AppText variant="callout" style={styles.text}>
        Next: {name}?
      </AppText>
      <Button label="Done" size="sm" variant="tonal" fullWidth={false} onPress={onDone} />
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Not now: ${name}`}
      >
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.xl,
  },
  text: { flex: 1 },
});
