/**
 * WeekStrip — a meal's week, one mark per day, Monday first.
 *
 * It is the answer to "when do I eat this?" drawn rather than asked. Picking a
 * dish fills days here in front of the user (the rotation is computed by the
 * step, not here); tapping a day hands it to the next pick, then to Gozlin, then
 * round again. So the one control that assigns days is the picture of them.
 *
 * A day left to Gozlin is not blank. It is a faint ring with a spark — a
 * promise that something will be there, which is true: the planner fills it.
 *
 * MOTION. A day whose occupant changes pops (0.82 → 1 on a settling spring) so
 * the eye goes to what moved. Nothing else moves, which is the point: seven
 * marks re-animating because one changed would hide the one that did.
 */
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Appear } from "./Appear";
import { OnboardingGlyph } from "./OnboardingGlyph";
import { selectHaptic } from "./SelectionCard";
import { Dur, Ease, Spring, Stagger, useMotion } from "./onboardingMotion";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface WeekMark {
  /** A dish's monogram ("AP"), or null for a day Gozlin chooses. */
  label: string | null;
  tone: string | null;
  /** What the day holds, spoken: "Akara and Pap". */
  spoken: string;
}

function DayCell({
  index,
  mark,
  size,
  onPress,
  enterDelay,
  showLetter,
}: {
  index: number;
  mark: WeekMark;
  size: number;
  onPress?: () => void;
  enterDelay: number;
  showLetter: boolean;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const pop = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.value = motion.reduced
      ? withTiming(1, { duration: motion.dur(Dur.micro) })
      : withSequence(
          withTiming(0.82, { duration: Dur.micro * 0.6, easing: Ease.standard }),
          withSpring(1, Spring.settle),
        );
  }, [mark.label, mark.tone, motion, pop]);

  const discStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const planned = mark.label !== null && mark.tone !== null;
  const tone = mark.tone ?? colors.textTertiary;

  const disc = (
    <Animated.View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2 },
        planned
          ? { backgroundColor: alpha(tone, 0.16), borderColor: alpha(tone, 0.7), borderStyle: "solid" }
          : { backgroundColor: "transparent", borderColor: alpha(colors.textTertiary, 0.55), borderStyle: "solid" },
        discStyle,
      ]}
    >
      {planned ? (
        <AppText variant="caption" color={tone} style={styles.mono} numberOfLines={1}>
          {mark.label}
        </AppText>
      ) : (
        <OnboardingGlyph name="spark" tone={alpha(colors.textTertiary, 0.9)} size={size * 0.46} weight={1.8} />
      )}
    </Animated.View>
  );

  return (
    <Appear delay={enterDelay} duration={Dur.ui} distance={6} style={styles.cell}>
      <Pressable
        onPress={
          onPress
            ? () => {
                selectHaptic();
                onPress();
              }
            : undefined
        }
        disabled={!onPress}
        hitSlop={4}
        accessibilityRole={onPress ? "button" : "text"}
        accessibilityLabel={`${DAY_NAMES[index]}: ${planned ? mark.spoken : "Gozlin picks"}.`}
        accessibilityHint={onPress ? "Changes what is on this day." : undefined}
        style={styles.press}
      >
        {showLetter ? (
          <AppText variant="caption" color="tertiary">
            {DAY_LETTERS[index]}
          </AppText>
        ) : null}
        {disc}
      </Pressable>
    </Appear>
  );
}

export interface WeekStripProps {
  marks: WeekMark[];
  /** Omit to draw the week read-only. */
  onPressDay?: (day: number) => void;
  size?: number;
  /** Day letters above the marks. Off for the lower rows of a stacked grid. */
  showLetters?: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function WeekStrip({
  marks,
  onPressDay,
  size = 34,
  showLetters = true,
  delay = 0,
  style,
}: WeekStripProps) {
  return (
    <View style={[styles.row, style]}>
      {marks.map((mark, i) => (
        <DayCell
          key={i}
          index={i}
          mark={mark}
          size={size}
          showLetter={showLetters}
          onPress={onPressDay ? () => onPressDay(i) : undefined}
          enterDelay={delay + i * Stagger.item * 0.6}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  cell: { flex: 1, alignItems: "center" },
  press: { alignItems: "center", gap: Spacing.xs, paddingVertical: 2 },
  disc: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  mono: { letterSpacing: 0.4 },
});
