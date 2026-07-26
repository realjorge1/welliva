/**
 * CheckinModal — the optional daily self-report (Phase 7).
 *
 * Captures the "life habits" the app can't measure on its own — sleep, mood,
 * energy and stress — which power Gozlin's mood/sleep habit links (e.g. "you
 * snack more on stressful days"). Entirely optional; every habit read degrades
 * gracefully when there are none. Pure presentation — persistence is the
 * caller's job (mirrors WeighInModal).
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

export interface CheckinPayload {
  mood?: number;
  energy?: number;
  stress?: number;
  sleepHours?: number;
}

interface Props {
  visible: boolean;
  existing?: CheckinPayload | null;
  onClose: () => void;
  onSave: (data: CheckinPayload) => void;
}

function toHours(s: string): number | undefined {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 24 ? Math.round(n * 10) / 10 : undefined;
}

export function CheckinModal({ visible, existing, onClose, onSave }: Props) {
  const { colors } = useColors();
  const [mood, setMood] = useState<number | undefined>();
  const [energy, setEnergy] = useState<number | undefined>();
  const [stress, setStress] = useState<number | undefined>();
  const [sleep, setSleep] = useState("");

  // Prefill from any existing check-in each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setMood(existing?.mood);
      setEnergy(existing?.energy);
      setStress(existing?.stress);
      setSleep(existing?.sleepHours != null ? String(existing.sleepHours) : "");
    }
  }, [visible, existing]);

  const parsedSleep = toHours(sleep);
  const canSave =
    mood !== undefined ||
    energy !== undefined ||
    stress !== undefined ||
    parsedSleep !== undefined;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ mood, energy, stress, sleepHours: parsedSleep });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <View style={styles.titleRow}>
            <View style={[styles.titleIcon, { backgroundColor: alpha(colors.primary, 0.14) }]}>
              <Ionicons name="happy-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="headline">How are you, really?</AppText>
              <AppText variant="footnote" color="secondary">
                A few taps helps me learn the habits behind your results.
              </AppText>
            </View>
          </View>

          <Scale label="Mood" lowLabel="Rough" highLabel="Great" value={mood} onChange={setMood} colors={colors} />
          <Scale label="Energy" lowLabel="Drained" highLabel="Energized" value={energy} onChange={setEnergy} colors={colors} />
          <Scale label="Stress" lowLabel="Calm" highLabel="Maxed" value={stress} onChange={setStress} colors={colors} />

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.field}>
            <AppText variant="subhead" color="secondary">
              Sleep last night
            </AppText>
            <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={sleep}
                onChangeText={setSleep}
                placeholder="7.5"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                style={[styles.input, { color: colors.text }]}
              />
              <AppText variant="callout" color="tertiary">
                hours
              </AppText>
            </View>
          </View>

          <Button
            label="Save check-in"
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

function Scale({
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
  colors,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number | undefined;
  onChange: (n: number) => void;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <View style={styles.field}>
      <AppText variant="subhead" color="secondary">
        {label}
      </AppText>
      <View style={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[
                styles.dot,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
              hitSlop={6}
            >
              <AppText variant="callout" style={{ color: selected ? "#FFFFFF" : colors.textSecondary }}>
                {n}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scaleLabels}>
        <AppText variant="caption" color="tertiary">
          {lowLabel}
        </AppText>
        <AppText variant="caption" color="tertiary">
          {highLabel}
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
  scaleRow: { flexDirection: "row", gap: Spacing.sm, justifyContent: "space-between" },
  dot: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleLabels: { flexDirection: "row", justifyContent: "space-between" },
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
