/**
 * InputRow — a number the user tells us, not a form field.
 *
 * Four things separate this from the `TextInput` it replaces:
 *
 *  • THE UNIT SETTLES. The row starts as a label and a placeholder. The moment
 *    a value exists, its unit fades in beside it — "27" becomes "27 years".
 *    Nothing validates, nothing turns green; the field just finishes the
 *    sentence the user started.
 *  • FOCUS LIFTS, SIBLINGS RECEDE. The active row rises 2px and takes a thin
 *    accent hairline while the rest of the screen dims to 45%. The screen is
 *    holding one thing at a time, which is the whole posture of this flow.
 *  • THE BOUNDS ARE SHOWN, NOT ENFORCED. A row given a `range` draws it as a
 *    faint scale behind the empty value — "100 ── 250 cm" — so the user learns
 *    what fits BEFORE an alert tells them it didn't. It sits to the right of
 *    where the caret and the placeholder sit (never under either, so it can
 *    never read as a pre-filled number), it is never a layout participant, and
 *    it fades away on the first keystroke and back if the field is emptied.
 *  • THE ROW IS THE TARGET. The label and the whole 56pt slab focus the input,
 *    not just the 16pt of text inside it.
 *
 * Validation is NOT done here. The bounds (13–120, 100–250cm, 30–300kg) belong
 * to the step that owns the data and are still enforced on Continue exactly as
 * before — a field that rejected keystrokes would silently change what the user
 * is allowed to enter.
 */
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import React, { useRef } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInput as TextInputType,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Appear } from "./Appear";
import { Dur, Ease, useMotion } from "./onboardingMotion";
import { MIN_TOUCH } from "./onboardingTheme";

export interface InputRowProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Shown after the value once there is one ("years", "cm", "kg"). */
  unit?: string;
  /**
   * The bounds this number has to land in, drawn as a faint guide while the
   * field is empty. Purely advisory: the step still validates on Continue.
   */
  range?: { min: number; max: number };
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  /** Dimmed because another row on the screen holds the caret. */
  dimmed?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Entrance delay — the step staggers its rows with this. */
  delay?: number;
  returnKeyType?: "next" | "done";
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInputType | null>;
  style?: StyleProp<ViewStyle>;
}

export function InputRow({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  range,
  keyboardType = "number-pad",
  maxLength,
  dimmed = false,
  onFocus,
  onBlur,
  delay = 0,
  returnKeyType,
  onSubmitEditing,
  inputRef,
  style,
}: InputRowProps) {
  const { colors } = useColors();
  const motion = useMotion();
  const ownRef = useRef<TextInputType | null>(null);
  const ref = inputRef ?? ownRef;

  const focus = useSharedValue(0);
  const dim = useSharedValue(0);
  // Starts settled rather than animating on mount: a returning user whose
  // answers are already filled in must never see the guide flash past.
  const guide = useSharedValue(value.length > 0 ? 0 : 1);

  const restFill = alpha(colors.surfaceSunken, 0.7);
  const focusFill = alpha(colors.surfaceSunken, 0.98);
  const restLine = alpha(colors.border, 0.9);
  const focusLine = alpha(colors.primary, 0.5);

  React.useEffect(() => {
    dim.value = withTiming(dimmed ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.standard,
    });
  }, [dimmed, motion, dim]);

  // Typing is the trigger, not focus — the guide is most useful in the moment
  // between the caret landing and the first digit.
  React.useEffect(() => {
    guide.value = withTiming(value.length > 0 ? 0 : 1, {
      duration: motion.dur(Dur.ui),
      easing: Ease.standard,
    });
  }, [value, motion, guide]);

  const lift = motion.dist(2);
  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(focus.value, [0, 1], [restFill, focusFill]),
    borderColor: interpolateColor(focus.value, [0, 1], [restLine, focusLine]),
    opacity: 1 - 0.55 * dim.value,
    transform: [{ translateY: -lift * focus.value }],
  }));

  const guideStyle = useAnimatedStyle(() => ({ opacity: guide.value }));

  const guideInk = alpha(colors.textTertiary, 0.62);
  const guideLine = alpha(colors.textTertiary, 0.3);

  const setFocus = (to: number) => {
    focus.value = withTiming(to, { duration: motion.dur(Dur.tap), easing: Ease.soft });
  };

  return (
    <Appear delay={delay} duration={Dur.content} style={style}>
      <Animated.View style={[styles.row, surface]}>
        <Pressable
          onPress={() => ref.current?.focus()}
          style={styles.pad}
          // The row focuses the input; the input itself is the accessible
          // control, so the slab must not become a second stop for a reader.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <AppText variant="caption" color="tertiary" uppercase>
            {label}
          </AppText>
          <View style={styles.valueLine}>
            {range ? (
              <Animated.View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.guide, guideStyle]}
              >
                <AppText variant="footnote" color={guideInk}>
                  {String(range.min)}
                </AppText>
                <View style={[styles.guideTick, { backgroundColor: guideLine }]} />
                <View style={[styles.guideTrack, { backgroundColor: guideLine }]} />
                <View style={[styles.guideTick, { backgroundColor: guideLine }]} />
                <AppText variant="footnote" color={guideInk}>
                  {unit ? `${range.max} ${unit}` : String(range.max)}
                </AppText>
              </Animated.View>
            ) : null}
            <TextInput
              ref={ref}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={alpha(colors.textTertiary, 0.75)}
              keyboardType={keyboardType}
              maxLength={maxLength}
              returnKeyType={returnKeyType}
              onSubmitEditing={onSubmitEditing}
              onFocus={() => {
                setFocus(1);
                onFocus?.();
              }}
              onBlur={() => {
                setFocus(0);
                onBlur?.();
              }}
              accessibilityLabel={label}
              accessibilityHint={
                range
                  ? `Between ${range.min} and ${range.max}${unit ? ` ${unit}` : ""}`
                  : undefined
              }
              style={[styles.input, { color: colors.text }]}
            />
            {unit && value.length > 0 ? (
              // Arrives only once there is something for it to qualify.
              <Appear delay={0} duration={Dur.ui} distance={4}>
                <AppText variant="subhead" color="tertiary">
                  {unit}
                </AppText>
              </Appear>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  pad: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: MIN_TOUCH + 16,
    gap: 2,
    justifyContent: "center",
  },
  valueLine: { flexDirection: "row", alignItems: "baseline", gap: Spacing.sm },
  // Absolutely placed over the value line and right-aligned: it shares no
  // space with the caret and costs the row no height, so the field is exactly
  // as tall before, during and after the fade.
  guide: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  guideTrack: { width: 26, height: 1, borderRadius: 0.5 },
  guideTick: { width: 1, height: 7, borderRadius: 0.5 },
  input: {
    flex: 1,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: -0.3,
    padding: 0,
    // Matched to the line height (plus Android descender slack) so the row does
    // not grow the moment the caret lands in it.
    height: 34,
    textAlignVertical: "center",
  },
});
