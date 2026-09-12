/**
 * OnboardingProgress — progress as a line being drawn, not a bar filling up.
 *
 * A conventional progress bar makes a promise about effort remaining, and on a
 * screen that is trying not to feel like a form that promise is the wrong
 * subject to raise. The same `VitalLine` that draws itself on the welcome
 * screen is compressed into the header here, and every answer draws a little
 * more of it. The undrawn remainder is a 7% ghost — present enough that the
 * user can see there is an end, quiet enough that it never reads as a countdown.
 *
 * The count is still announced, once, to assistive tech: a screen reader user
 * genuinely does need "step 3 of 6", and a drawn curve cannot say it.
 */
import { useColors } from "@/components/ui";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Dur } from "./onboardingMotion";
import { VitalLine } from "./VitalLine";

export interface OnboardingProgressProps {
  /** 1-based position of the current form step. */
  index: number;
  /** Total number of form steps (branching already applied). */
  total: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
}

export function OnboardingProgress({
  index,
  total,
  width = 124,
  style,
}: OnboardingProgressProps) {
  const { colors } = useColors();
  const progress = total > 0 ? Math.max(0, Math.min(1, index / total)) : 0;

  return (
    <View
      style={[styles.wrap, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: index }}
    >
      <VitalLine
        progress={progress}
        width={width}
        tone={colors.primary}
        trackOpacity={0.07}
        strokeWidth={1.4}
        duration={Dur.cinematic}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
