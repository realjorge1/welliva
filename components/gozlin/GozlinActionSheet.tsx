/**
 * GozlinActionSheet — the coach's option list, on the app's bottom sheet.
 *
 * WHAT WAS WRONG WITH IT. The first version was a `Modal` with
 * `animationType="fade"`: the panel didn't travel, it just appeared, over a
 * flat scrim, with a full-width grey "Cancel" slab under the options. No
 * motion, a hard-edged panel and a Cancel bar is the exact shape of a 2013 iOS
 * action sheet, and it read as one.
 *
 * The motion, the blur and the drag-to-dismiss now live in `ui/Sheet`, shared
 * with every other sheet in the app. What's left here is the list: an icon
 * plate, a label, an optional caption, and — new — badges for rows that carry a
 * count and chevrons for rows that go somewhere rather than do something. The
 * Cancel slab is gone: drag it down, tap the scrim, or press back.
 */

import { AppText, Sheet } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type IconName = keyof typeof Ionicons.glyphMap;

export interface ActionSheetOption {
  key: string;
  label: string;
  caption?: string;
  icon?: IconName;
  destructive?: boolean;
  /** Tint override for the icon plate. Defaults to brand (or error). */
  tone?: string;
  /** Show a chevron — this row goes somewhere rather than doing something. */
  navigates?: boolean;
  /** Right-aligned count or status, e.g. "12". */
  badge?: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
  /** Dismissed WITHOUT choosing — scrim, back button or drag. */
  onClose: () => void;
  /**
   * Hide the sheet after an option was picked. Defaults to `onClose`.
   *
   * These are the same thing for a menu, and emphatically NOT the same thing
   * for a confirmation, where dismissing means "no". The tool-confirm sheet
   * used to pass only `onClose`, so picking "Yes, go ahead" ran
   * `respondToConfirm(false)` on the way out and then `respondToConfirm(true)`
   * against a resolver that had already been consumed — every write the coach
   * proposed was silently declined whichever button you pressed. Sheets whose
   * dismissal carries a meaning must say what a PICK means separately.
   */
  onAfterPick?: () => void;
}

export function GozlinActionSheet({
  visible,
  title,
  subtitle,
  options,
  onClose,
  onAfterPick,
}: Props) {
  const { colors } = useColors();

  const handlePick = (opt: ActionSheetOption) => {
    Haptics.selectionAsync().catch(() => {});
    (onAfterPick ?? onClose)();
    // Let the dismiss animation begin before the action runs (avoids the new
    // sheet/toast racing the close transition).
    setTimeout(opt.onPress, 60);
  };

  const header =
    title || subtitle ? (
      <View style={styles.headerText}>
        {title ? <AppText variant="headline">{title}</AppText> : null}
        {subtitle ? (
          <AppText variant="footnote" color="tertiary" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    ) : null;

  return (
    <Sheet visible={visible} onClose={onClose} header={header}>
      <View style={styles.options}>
        {options.map((opt, i) => {
          const tint = opt.tone ?? (opt.destructive ? colors.error : colors.primary);
          // A destructive action gets a rule above it, not just a colour — the
          // pause is what stops a mis-tap, the hue only explains it afterwards.
          const rule = opt.destructive && i > 0 && !options[i - 1].destructive;

          return (
            <React.Fragment key={opt.key}>
              {rule && <View style={[styles.rule, { backgroundColor: colors.divider }]} />}
              <Pressable
                onPress={() => handlePick(opt)}
                accessibilityRole="button"
                accessibilityLabel={opt.caption ? `${opt.label}. ${opt.caption}` : opt.label}
                style={({ pressed }) => [
                  styles.option,
                  pressed && { backgroundColor: alpha(colors.text, 0.06) },
                ]}
              >
                {opt.icon ? (
                  <View style={[styles.optionIcon, { backgroundColor: alpha(tint, 0.14) }]}>
                    <Ionicons name={opt.icon} size={19} color={tint} />
                  </View>
                ) : null}

                <View style={styles.optionText}>
                  <AppText
                    variant="bodyLg"
                    weight="600"
                    numberOfLines={1}
                    style={opt.destructive ? { color: colors.error } : undefined}
                  >
                    {opt.label}
                  </AppText>
                  {opt.caption ? (
                    <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                      {opt.caption}
                    </AppText>
                  ) : null}
                </View>

                {opt.badge ? (
                  <View style={[styles.badge, { backgroundColor: alpha(colors.text, 0.08) }]}>
                    <AppText variant="caption" weight="700" color="secondary">
                      {opt.badge}
                    </AppText>
                  </View>
                ) : null}
                {opt.navigates ? (
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                ) : null}
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headerText: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  subtitle: { marginTop: 2 },

  options: { gap: 2 },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1, gap: 1 },
  badge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignItems: "center",
  },
});
