/**
 * HealthGroup / NothingApplies / AllergyChips / NoteField — the safety step.
 *
 * This is the most delicate screen in the app. Thirty conditions dumped onto
 * one page reads as "we think something is wrong with you"; the same thirty
 * behind five closed groups reads as "tell us if any of this applies". Nothing
 * is hidden — every group says how many options it holds and opens on a tap —
 * but the resting state of the screen is five calm rows, not a wall.
 *
 * THE HEIGHT ANIMATION. The group's content is rendered absolutely inside a
 * clipped, animated-height wrapper. Absolute so the content is laid out at its
 * natural height even while the wrapper is collapsed to zero (a normal flex
 * child would be squashed and report the wrong height); measured once via
 * `onLayout` so the open/close is a pure UI-thread animation afterwards.
 *
 * Every medical rule is unchanged. "Nothing applies" is still the `none` value,
 * still un-tickable (tapping it again clears it), and still mutually exclusive
 * with every condition — all of which lives in the step's
 * `toggleMedicalCondition`, untouched.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Appear } from "./Appear";
import { Dur, Ease, Spring, Stagger, useMotion } from "./onboardingMotion";
import { selectHaptic } from "./SelectionCard";
import { HIT, MIN_TOUCH } from "./onboardingTheme";

/* ────────────────────────── A collapsible group ────────────────────────── */

export interface HealthGroupProps {
  title: string;
  /** How many options the group holds — shown so nothing feels hidden. */
  count: number;
  /** How many are currently ticked. */
  selectedCount: number;
  open: boolean;
  onToggle: () => void;
  /** Dimmed because "Nothing applies" is ticked. */
  muted?: boolean;
  delay?: number;
  children: React.ReactNode;
}

export function HealthGroup({
  title,
  count,
  selectedCount,
  open,
  onToggle,
  muted = false,
  delay = 0,
  children,
}: HealthGroupProps) {
  const { colors } = useColors();
  const motion = useMotion();
  const [height, setHeight] = useState(0);

  const p = useSharedValue(open ? 1 : 0);
  const dim = useSharedValue(muted ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(open ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.soft,
    });
  }, [open, motion, p]);

  useEffect(() => {
    dim.value = withTiming(muted ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.standard,
    });
  }, [muted, motion, dim]);

  const body = useAnimatedStyle(() => ({
    height: height > 0 ? height * p.value : 0,
    opacity: p.value,
  }));
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${p.value * 90}deg` }],
  }));
  const wrap = useAnimatedStyle(() => ({ opacity: 1 - 0.55 * dim.value }));

  return (
    <Animated.View style={wrap}>
      <Appear delay={delay} duration={Dur.content}>
        <View
          style={[
            styles.group,
            { backgroundColor: alpha(colors.surface, 0.5), borderColor: alpha(colors.border, 0.85) },
          ]}
        >
          <Pressable
            onPress={() => {
              selectHaptic();
              onToggle();
            }}
            style={styles.groupHead}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={title}
            accessibilityHint={
              selectedCount > 0
                ? `${selectedCount} of ${count} selected. ${open ? "Collapses" : "Expands"} the group.`
                : `${count} options. ${open ? "Collapses" : "Expands"} the group.`
            }
          >
            <Animated.View style={chevron}>
              <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
            </Animated.View>
            <AppText variant="callout" color={selectedCount > 0 ? "brand" : "secondary"} style={styles.flex}>
              {title}
            </AppText>
            <AppText variant="footnote" color="tertiary">
              {selectedCount > 0 ? `${selectedCount} selected` : count}
            </AppText>
          </Pressable>

          <Animated.View
            style={[styles.clip, body]}
            pointerEvents={open ? "auto" : "none"}
            accessibilityElementsHidden={!open}
            importantForAccessibility={open ? "auto" : "no-hide-descendants"}
          >
            {/* Absolute so it lays out at its natural height even while the
                wrapper is collapsed — that is what makes the first open smooth. */}
            <View
              style={styles.measure}
              onLayout={(e) => {
                const h = Math.round(e.nativeEvent.layout.height);
                if (h > 0 && h !== height) setHeight(h);
              }}
            >
              {children}
            </View>
          </Animated.View>
        </View>
      </Appear>
    </Animated.View>
  );
}

/* ─────────────────────────── "Nothing applies" ─────────────────────────── */

/**
 * The fastest honest answer on this screen, given the most prominent row.
 * Ticking it dims the groups below rather than removing them — the user can
 * still change their mind without first untick-ing anything.
 */
export function NothingApplies({
  selected,
  onPress,
  delay = 0,
}: {
  selected: boolean;
  onPress: () => void;
  delay?: number;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const sel = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(0);

  const restFill = alpha(colors.surface, 0.72);
  const selFill = alpha(colors.primary, 0.12);
  const restLine = alpha(colors.border, 0.9);
  const selLine = alpha(colors.primary, 0.55);

  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, {
      duration: motion.dur(Dur.tap),
      easing: Ease.soft,
    });
  }, [selected, motion, sel]);

  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [restFill, selFill]),
    borderColor: interpolateColor(sel.value, [0, 1], [restLine, selLine]),
    transform: [{ scale: 1 - 0.02 * press.value }],
  }));
  const tick = useAnimatedStyle(() => ({
    opacity: sel.value,
    transform: [{ scale: 0.7 + 0.3 * sel.value }],
  }));

  return (
    <Appear delay={delay} duration={Dur.content}>
      <Animated.View style={[styles.none, surface]}>
        <Pressable
          onPress={() => {
            selectHaptic();
            onPress();
          }}
          onPressIn={() => {
            press.value = withSpring(1, Spring.press);
          }}
          onPressOut={() => {
            press.value = withSpring(0, Spring.press);
          }}
          style={styles.nonePad}
          accessibilityRole="checkbox"
          accessibilityLabel="Nothing applies"
          accessibilityHint="Clears every condition below"
          accessibilityState={{ checked: selected }}
        >
          <AppText variant="callout" color={selected ? "brand" : "secondary"} style={styles.flex}>
            Nothing applies
          </AppText>
          <Animated.View style={[styles.tick, { backgroundColor: colors.primary }, tick]}>
            <View style={[styles.tickMark, { borderColor: colors.onPrimary }]} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Appear>
  );
}

/* ───────────────────────────── Small chips ─────────────────────────────── */

/** A flowing chip field — used for allergies, where the set is short and flat. */
export function ChipField<T extends string>({
  options,
  selected,
  onToggle,
  delay = 0,
  style,
}: {
  options: { value: T; label: string }[];
  selected: readonly string[];
  onToggle: (value: T) => void;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.chips, style]}>
      {options.map((option, i) => (
        <Appear
          key={option.value}
          delay={delay + i * Stagger.item * 0.5}
          duration={Dur.ui}
          distance={6}
        >
          <Chip
            label={option.label}
            selected={selected.includes(option.value)}
            onPress={() => onToggle(option.value)}
          />
        </Appear>
      ))}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const sel = useSharedValue(selected ? 1 : 0);

  const restFill = alpha(colors.surface, 0.6);
  const selFill = alpha(colors.primary, 0.14);
  const restLine = alpha(colors.border, 0.9);
  const selLine = alpha(colors.primary, 0.5);

  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, {
      duration: motion.dur(Dur.tap),
      easing: Ease.soft,
    });
  }, [selected, motion, sel]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [restFill, selFill]),
    borderColor: interpolateColor(sel.value, [0, 1], [restLine, selLine]),
  }));

  return (
    <Animated.View style={[styles.chip, style]}>
      <Pressable
        onPress={() => {
          selectHaptic();
          onPress();
        }}
        hitSlop={HIT}
        style={styles.chipPad}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
      >
        <AppText variant="subhead" color={selected ? "brand" : "secondary"}>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

/* ──────────────────────────── Free-text notes ──────────────────────────── */

/** A multiline field that stays visually secondary — this is all optional. */
export function NoteField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = true,
  delay = 0,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  delay?: number;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const focus = useSharedValue(0);

  const restLine = alpha(colors.border, 0.9);
  const focusLine = alpha(colors.primary, 0.5);

  const style = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [restLine, focusLine]),
  }));

  const set = (to: number) => {
    focus.value = withTiming(to, { duration: motion.dur(Dur.tap), easing: Ease.soft });
  };

  return (
    <Appear delay={delay} duration={Dur.content}>
      <View style={styles.note}>
        <AppText variant="caption" color="tertiary" uppercase>
          {label}
        </AppText>
        <Animated.View
          style={[styles.noteBox, { backgroundColor: alpha(colors.surfaceSunken, 0.7) }, style]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={alpha(colors.textTertiary, 0.75)}
            multiline={multiline}
            onFocus={() => set(1)}
            onBlur={() => set(0)}
            accessibilityLabel={label}
            style={[styles.noteInput, multiline && styles.noteMultiline, { color: colors.text }]}
          />
        </Animated.View>
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  group: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: MIN_TOUCH,
  },
  clip: { overflow: "hidden" },
  measure: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },

  none: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  nonePad: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    minHeight: MIN_TOUCH,
  },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tickMark: {
    width: 9,
    height: 5,
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    transform: [{ rotate: "-45deg" }],
    marginTop: -2,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: 1, overflow: "hidden" },
  chipPad: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: MIN_TOUCH - 8,
    justifyContent: "center",
  },

  note: { gap: Spacing.sm },
  noteBox: { borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.lg },
  noteInput: { fontSize: 15, lineHeight: 22, paddingVertical: Spacing.md },
  noteMultiline: { minHeight: 72, textAlignVertical: "top" },
});
