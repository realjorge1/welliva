/**
 * SegmentedControl — pick one of two to four short options, all visible at once.
 *
 * Reach for this over chips when the options are a closed set the user is
 * *switching between* (theme, meals per day) rather than a list they're
 * *choosing from*. The sunken track is what separates the two: it reads as one
 * control with a selected position, not as N independent buttons.
 */
import { Radius, Spacing } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./Text";
import { useColors } from "./useColors";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Spoken name for the group, e.g. "Theme". */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  style,
}: SegmentedControlProps<T>) {
  const { colors } = useColors();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[
        styles.track,
        { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
        style,
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(opt.value);
            }}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, checked: active }}
            style={({ pressed }) => [
              styles.item,
              active && { backgroundColor: colors.primary },
              !active && pressed && { opacity: 0.6 },
            ]}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={16}
                color={active ? colors.onPrimary : colors.textSecondary}
              />
            ) : null}
            <AppText
              variant="footnote"
              color={active ? colors.onPrimary : "secondary"}
              style={styles.label}
              numberOfLines={1}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.md,
  },
  label: { fontWeight: "600" },
});
