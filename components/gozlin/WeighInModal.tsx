/**
 * WeighInModal — the data-entry loop that makes the Transformation Forecast real.
 *
 * Captures a weigh-in (+ optional waist) and the goal weight the forecast aims
 * at. Weigh-ins are the empirical ground truth the forecast trusts over the
 * energy-balance math; the goal weight unlocks the Expected Goal Date and the
 * Likelihood of Success. Pure presentation — persistence is the caller's job.
 */

import { AppText, Button } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

export interface WeighInPayload {
  weightKg?: number;
  waistCm?: number;
  goalWeightKg?: number;
}

interface Props {
  visible: boolean;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  onClose: () => void;
  onSave: (data: WeighInPayload) => void;
}

function toNum(s: string): number | undefined {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined;
}

export function WeighInModal({
  visible,
  currentWeightKg,
  goalWeightKg,
  onClose,
  onSave,
}: Props) {
  const { colors } = useColors();
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [goal, setGoal] = useState("");

  // Prefill from current values each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setWeight(currentWeightKg != null ? String(currentWeightKg) : "");
      setWaist("");
      setGoal(goalWeightKg != null ? String(goalWeightKg) : "");
    }
  }, [visible, currentWeightKg, goalWeightKg]);

  const parsedWeight = toNum(weight);
  const parsedGoal = toNum(goal);
  const canSave = parsedWeight !== undefined || parsedGoal !== undefined;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      weightKg: parsedWeight,
      waistCm: toNum(waist),
      goalWeightKg: parsedGoal,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.scrim, { backgroundColor: colors.scrim }]}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <View style={styles.titleRow}>
            <View style={[styles.titleIcon, { backgroundColor: alpha(colors.primary, 0.14) }]}>
              <Ionicons name="scale-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="headline">Log your progress</AppText>
              <AppText variant="footnote" color="secondary">
                The scale is what your forecast trusts most.
              </AppText>
            </View>
          </View>

          <Field
            label="Today's weight"
            unit="kg"
            value={weight}
            onChange={setWeight}
            placeholder={currentWeightKg != null ? String(currentWeightKg) : "70"}
            colors={colors}
            autoFocus
          />
          <Field
            label="Waist (optional)"
            unit="cm"
            value={waist}
            onChange={setWaist}
            placeholder="—"
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <Field
            label="Goal weight"
            unit="kg"
            value={goal}
            onChange={setGoal}
            placeholder="Set a target"
            colors={colors}
          />

          <Button
            label="Save"
            onPress={handleSave}
            disabled={!canSave}
            fullWidth
            style={{ marginTop: Spacing.sm }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
  placeholder,
  colors,
  autoFocus,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>["colors"];
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="subhead" color="secondary">
        {label}
      </AppText>
      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          style={[styles.input, { color: colors.text }]}
          autoFocus={autoFocus}
        />
        <AppText variant="callout" color="tertiary">
          {unit}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.xs,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  titleIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: Spacing.xs },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === "ios" ? Spacing.md : Spacing.sm,
  },
  input: { flex: 1, fontSize: 17, padding: 0, margin: 0 },
  divider: { height: 1, marginVertical: Spacing.xs },
});
