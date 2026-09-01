/**
 * ConfirmSheet — "are you sure?", on the app's bottom sheet.
 *
 * A destructive action needs three things before it runs, and an OS alert gives
 * you one of them: it needs to NAME what is about to happen, say what will
 * survive it, and put the safe answer where the thumb already is. This does all
 * three on the same sheet surface (motion, blur, drag-to-dismiss) as everything
 * else that slides up in this app, instead of dropping a system dialog on top
 * of a screen that has its own visual language.
 *
 * `reassurance` is not decoration. Most of the fear in a delete confirmation is
 * about collateral damage — "does this take my streak with it?" — and answering
 * that question in the sheet is what turns a scary tap into an informed one.
 *
 * Dismissing (scrim, back, drag) always means CANCEL. Only the destructive
 * button confirms, and it is the lower of the two: the reachable position goes
 * to the reversible answer.
 */
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Sheet } from "./Sheet";
import { AppText } from "./Text";
import { useColors } from "./useColors";

export interface ConfirmSheetProps {
  visible: boolean;
  /** The question, as a question. "Delete Coding?" — not "Confirm". */
  title: string;
  /** What actually happens. One or two sentences. */
  body?: string;
  /**
   * What SURVIVES this — shown as a quiet reassurance strip under the body.
   * Skip it only when nothing survives.
   */
  reassurance?: string;
  /** Label on the destructive button. Say the verb: "Delete habit". */
  confirmLabel: string;
  cancelLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Runs on confirm. The sheet closes itself first. */
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  body,
  reassurance,
  confirmLabel,
  cancelLabel = "Keep it",
  icon = "trash-outline",
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const { colors } = useColors();

  const confirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
    onClose();
    onConfirm();
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <View
          style={[styles.plate, { backgroundColor: alpha(colors.error, 0.12) }]}
        >
          <Ionicons name={icon} size={24} color={colors.error} />
        </View>

        <AppText variant="title" align="center" style={styles.title}>
          {title}
        </AppText>

        {body ? (
          <AppText variant="subhead" color="secondary" align="center">
            {body}
          </AppText>
        ) : null}

        {reassurance ? (
          <View
            style={[
              styles.reassure,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={15} color={colors.success} />
            <AppText variant="footnote" color="secondary" style={styles.flex}>
              {reassurance}
            </AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="body" style={styles.btnLabel}>
              {cancelLabel}
            </AppText>
          </Pressable>

          <Pressable
            onPress={confirm}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: alpha(colors.error, 0.14),
                borderColor: alpha(colors.error, 0.4),
              },
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="body" color={colors.error} style={styles.btnLabel}>
              {confirmLabel}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  plate: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  title: { marginBottom: 2 },
  reassure: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    alignSelf: "stretch",
  },
  actions: {
    alignSelf: "stretch",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  btn: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
  },
  btnLabel: { fontWeight: "600" },
  pressed: { opacity: 0.72 },
});
