/**
 * PACE ROW — how fast to lose (or gain), in her own numbers.
 *
 * Three choices, each priced for this person by the same engine that builds
 * her target (NutritionService.paceOptions): "Steady · 1,452 kcal a day ·
 * about 0.4 kg a week". No new step anywhere — this is one row on the
 * onboarding reveal and one in the profile's goals.
 *
 * `value` absent = an account from before pace existed, still on the fixed
 * modifier it was always given. The row says so plainly and highlights
 * nothing; her number moves only if she taps a pace.
 */
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { AppText, SegmentedControl } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { TargetPace } from "@/models/user";
import type { PaceOption } from "@/services/NutritionService";

const LABEL: Record<TargetPace, string> = { gentle: "Gentle", steady: "Steady", faster: "Faster" };

export interface PaceRowProps {
  options: PaceOption[];
  value: TargetPace | undefined;
  onChange: (pace: TargetPace) => void;
  /** "lose" reads "below", "gain" reads "above". */
  direction: "lose" | "gain";
  style?: StyleProp<ViewStyle>;
}

export function PaceRow({ options, value, onChange, direction, style }: PaceRowProps) {
  if (options.length === 0) return null;
  const chosen = options.find((o) => o.pace === value) ?? null;
  const verb = direction === "lose" ? "lose" : "gain";

  const detail = chosen
    ? chosen.kgPerWeek > 0
      ? `${chosen.calories.toLocaleString()} kcal a day · about ${chosen.kgPerWeek.toFixed(1)} kg a week`
      : `${chosen.calories.toLocaleString()} kcal a day`
    : // An existing account on the old fixed modifier: say what it is, offer the choice.
      direction === "lose"
      ? "You're on the original plan: 500 kcal below what you burn. Pick a pace to switch."
      : "You're on the original plan: 300 kcal above what you burn. Pick a pace to switch.";

  return (
    <View style={[styles.wrap, style]}>
      <AppText variant="caption" color="tertiary" uppercase>
        Pace
      </AppText>
      <SegmentedControl
        label={`How fast to ${verb}`}
        options={options.map((o) => ({ value: o.pace, label: LABEL[o.pace] }))}
        value={value ?? ("" as TargetPace)}
        onChange={onChange}
      />
      <AppText variant="footnote" color="secondary">
        {detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
});
