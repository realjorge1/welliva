/**
 * GozlinActionSheet — a themed bottom-sheet menu that replaces native
 * Alert.alert option lists. Options render as full-width rows with an icon,
 * label and optional caption; destructive actions are tinted with the error
 * hue. Used for the coach's overflow menu and its destructive confirmations,
 * so every choice lives in the app's own surface instead of an OS alert.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type IconName = keyof typeof Ionicons.glyphMap;

export interface ActionSheetOption {
  key: string;
  label: string;
  caption?: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
  onClose: () => void;
}

export function GozlinActionSheet({ visible, title, subtitle, options, onClose }: Props) {
  const { colors } = useColors();

  const handlePick = (opt: ActionSheetOption) => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
    // Let the dismiss animation begin before the action runs (avoids the new
    // sheet/toast racing the close transition).
    setTimeout(opt.onPress, 60);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <SafeAreaView style={styles.wrap} edges={["bottom"]} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          {(title || subtitle) ? (
            <View style={styles.headerText}>
              {title ? <AppText variant="headline">{title}</AppText> : null}
              {subtitle ? (
                <AppText variant="footnote" color="secondary">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
          ) : null}

          <View style={styles.options}>
            {options.map((opt) => {
              const tint = opt.destructive ? colors.error : colors.primary;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => handlePick(opt)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: pressed ? colors.surface : "transparent",
                      borderColor: colors.divider,
                    },
                  ]}
                >
                  {opt.icon ? (
                    <View style={[styles.optionIcon, { backgroundColor: alpha(tint, 0.14) }]}>
                      <Ionicons name={opt.icon} size={18} color={tint} />
                    </View>
                  ) : null}
                  <View style={styles.optionText}>
                    <AppText
                      variant="bodyLg"
                      weight="600"
                      style={opt.destructive ? { color: colors.error } : undefined}
                    >
                      {opt.label}
                    </AppText>
                    {opt.caption ? (
                      <AppText variant="footnote" color="secondary">
                        {opt.caption}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <AppText variant="bodyLg" weight="600" color="secondary">
              Cancel
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject },
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.xs,
  },
  headerText: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: 2,
  },
  options: { gap: 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1, gap: 1 },
  cancel: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: "center",
  },
});
