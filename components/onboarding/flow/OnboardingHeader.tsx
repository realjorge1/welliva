/**
 * OnboardingHeader — back, where you are, and how far. In that order of
 * importance, and at about a tenth of the visual weight of the question.
 *
 * The header is the only element that persists across the whole flow, so it is
 * the one thing that must NEVER animate in and out with a step: it crossfades
 * its label in place while the canvas below it hands over. That continuity is
 * most of what makes nine screens read as one conversation.
 *
 * The back control is always present once the flow has started and is never
 * disabled mid-animation — a user who wants to change an answer should not have
 * to wait for a transition to finish to be allowed to.
 */
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { CrossFade } from "./CrossFade";
import { Dur, Ease, useMotion } from "./onboardingMotion";
import { OnboardingProgress } from "./OnboardingProgress";
import { Editorial, HIT, MIN_TOUCH } from "./onboardingTheme";

export interface OnboardingHeaderProps {
  /** Name of the beat the user is in. Crossfades when it changes. */
  label?: string;
  /** 1-based form-step position; omit to hide the line entirely. */
  index?: number;
  total?: number;
  onBack?: () => void;
  /**
   * Whether the header has anything to say on this step. It FADES rather than
   * unmounting: the welcome, the build and the reveal have no header, and
   * mounting a 60pt bar between steps would shove the canvas down mid-dissolve
   * — the one layout jump a continuous canvas cannot survive.
   */
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function OnboardingHeader({
  label,
  index,
  total,
  onBack,
  visible = true,
  style,
}: OnboardingHeaderProps) {
  const { colors } = useColors();
  const motion = useMotion();
  const showLine = typeof index === "number" && typeof total === "number" && total > 0;

  const shown = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.standard,
    });
  }, [visible, motion, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <Animated.View
      style={[styles.bar, fade, style]}
      pointerEvents={visible ? "box-none" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={HIT}
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityHint="Returns to the previous question"
            style={({ pressed }) => [
              styles.back,
              { backgroundColor: alpha(colors.surface, pressed ? 0.9 : 0.55) },
            ]}
          >
            <Ionicons name="chevron-back" size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.centre} pointerEvents="box-none">
        {label ? (
          <CrossFade contentKey={label} style={styles.labelSlot}>
            <AppText
              variant="caption"
              color="tertiary"
              uppercase
              align="center"
              style={Editorial.kicker}
            >
              {label}
            </AppText>
          </CrossFade>
        ) : null}
        {showLine ? <OnboardingProgress index={index} total={total} /> : null}
      </View>

      {/* Balances the back control so the centre column stays optically centred
          whether or not the user can go back. */}
      <View style={styles.side} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    // Fixed so the bar reserves its seat on the steps that have no header.
    // Without it the bar collapses when its contents fade out and the whole
    // canvas slides up mid-dissolve.
    minHeight: 68,
  },
  side: { width: MIN_TOUCH, alignItems: "flex-start", justifyContent: "center" },
  centre: { flex: 1, alignItems: "center", gap: 2 },
  labelSlot: { alignSelf: "stretch" },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
