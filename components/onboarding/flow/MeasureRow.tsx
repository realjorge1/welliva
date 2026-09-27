/**
 * MeasureRow — a height or a weight, in whichever units the person thinks in.
 *
 * It is `InputRow` (same slab, same focus lift, same receding siblings, same
 * faint range guide) with one addition: the unit is a CHOICE. A small pill in
 * the corner says what the number is in — "cm ⌄" — and opens a switch of the
 * three units people actually use. Picking one converts what is already typed
 * in place, so the user watches their own 178 cm become 5 ft 10 in rather than
 * being asked to type it again.
 *
 * Feet-and-inches and stones-and-pounds are TWO numbers, so they are two boxes
 * ("5 ft 10 in"): the caret moves to the second box as soon as the first is
 * full, and a backspace in an empty second box steps back to the first. The
 * range guide re-draws in the chosen unit ("3′4″ ── 8′2″").
 *
 * PRESENTATION ONLY. Conversion, bounds and storage live in models/units; this
 * component receives the fields to draw, the parts typed and the guide text.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { FieldSpec, MeasureParts, UnitOption } from "@/models/units";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInput as TextInputType,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Appear } from "./Appear";
import { selectHaptic } from "./SelectionCard";
import { Dur, Ease, Pace, useMotion } from "./onboardingMotion";
import { HIT, MIN_TOUCH } from "./onboardingTheme";

/** What each box of a two-box unit is called out loud. */
const SPOKEN_SUFFIX: Record<string, string> = { ft: "feet", in: "inches", st: "stones", lb: "pounds" };

/* ───────────────────────────── The unit switch ─────────────────────────── */

function UnitSwitch<U extends string>({
  units,
  unit,
  onPick,
  label,
}: {
  units: readonly UnitOption<U>[];
  unit: U;
  onPick: (u: U) => void;
  label: string;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, units.findIndex((u) => u.value === unit));
  // The track pads itself by 4pt on every side, so the thumb's lane is narrower.
  const cell = width > 0 ? (width - 8) / units.length : 0;
  const pos = useSharedValue(index);

  useEffect(() => {
    pos.value = motion.reduced ? index : withSpring(index, { damping: 20, stiffness: 180, mass: 0.8 });
  }, [index, motion.reduced, pos]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * cell }],
    opacity: cell > 0 ? 1 : 0,
  }));

  return (
    <View style={styles.switchBlock}>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.track, { backgroundColor: alpha(colors.background, 0.55), borderColor: alpha(colors.border, 0.9) }]}
        accessibilityRole="radiogroup"
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: cell, backgroundColor: alpha(colors.primary, 0.18), borderColor: alpha(colors.primary, 0.5) },
            thumb,
          ]}
        />
        {units.map((u) => {
          const active = u.value === unit;
          return (
            <Pressable
              key={u.value}
              onPress={() => {
                selectHaptic();
                onPick(u.value);
              }}
              style={styles.cell}
              accessibilityRole="radio"
              accessibilityLabel={u.name}
              accessibilityState={{ selected: active, checked: active }}
            >
              <AppText variant="callout" color={active ? "brand" : "secondary"}>
                {u.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ──────────────────────────────── The row ──────────────────────────────── */

export interface MeasureRowProps<U extends string> {
  label: string;
  unit: U;
  units: readonly UnitOption<U>[];
  onUnit: (unit: U) => void;
  /** One box, or two (feet + inches, stones + pounds). */
  fields: FieldSpec[];
  parts: MeasureParts;
  onParts: (parts: MeasureParts) => void;
  /** The accepted range in this unit, already formatted ("3′4″", "8′2″"). */
  guide: { min: string; max: string };
  dimmed?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function MeasureRow<U extends string>({
  label,
  unit,
  units,
  onUnit,
  fields,
  parts,
  onParts,
  guide,
  dimmed = false,
  onFocus,
  onBlur,
  delay = 0,
  style,
}: MeasureRowProps<U>) {
  const { colors } = useColors();
  const motion = useMotion();
  const majorRef = useRef<TextInputType | null>(null);
  const minorRef = useRef<TextInputType | null>(null);
  const [open, setOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const compound = fields.length > 1;
  const empty = parts.major.length === 0 && parts.minor.length === 0;
  const current = units.find((u) => u.value === unit);

  const focus = useSharedValue(0);
  const dim = useSharedValue(0);
  const guideP = useSharedValue(empty ? 1 : 0);
  const drawer = useSharedValue(0);
  const swap = useSharedValue(1);

  useEffect(() => {
    dim.value = withTiming(dimmed ? 1 : 0, { duration: motion.dur(Dur.ui), easing: Ease.standard });
  }, [dimmed, motion, dim]);

  useEffect(() => {
    guideP.value = withTiming(empty ? 1 : 0, { duration: motion.dur(Dur.ui), easing: Ease.standard });
  }, [empty, motion, guideP]);

  useEffect(() => {
    drawer.value = withTiming(open ? 1 : 0, { duration: motion.dur(Dur.ui), easing: Ease.soft });
  }, [open, motion, drawer]);

  // A changed unit re-draws the number in place: a quick dip and settle, so the
  // eye reads it as the same value said differently rather than as a reset.
  const firstUnit = useRef(true);
  useEffect(() => {
    if (firstUnit.current) {
      firstUnit.current = false;
      return;
    }
    swap.value = withSequence(
      withTiming(0.25, { duration: motion.dur(Dur.micro * 0.5), easing: Ease.standard }),
      withTiming(1, { duration: motion.dur(Dur.ui), easing: Ease.soft }),
    );
  }, [unit, motion, swap]);

  const restFill = alpha(colors.surfaceSunken, 0.7);
  const focusFill = alpha(colors.surfaceSunken, 0.98);
  const restLine = alpha(colors.border, 0.9);
  const focusLine = alpha(colors.primary, 0.5);
  const lift = motion.dist(2);
  const nudge = motion.dist(4);
  const measured = drawerHeight;

  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(focus.value, [0, 1], [restFill, focusFill]),
    borderColor: interpolateColor(focus.value, [0, 1], [restLine, focusLine]),
    opacity: 1 - 0.55 * dim.value,
    transform: [{ translateY: -lift * focus.value }],
  }));
  const guideStyle = useAnimatedStyle(() => ({ opacity: guideP.value }));
  const drawerStyle = useAnimatedStyle(() => ({
    height: measured * drawer.value,
    opacity: drawer.value,
  }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${drawer.value * 180}deg` }] }));
  const valueStyle = useAnimatedStyle(() => ({
    opacity: swap.value,
    transform: [{ translateY: nudge * (1 - swap.value) }],
  }));

  const setFocus = (to: number) => {
    focus.value = withTiming(to, { duration: motion.dur(Dur.tap), easing: Ease.soft });
  };
  const handleFocus = () => {
    setFocus(1);
    onFocus?.();
  };
  const handleBlur = () => {
    setFocus(0);
    onBlur?.();
  };

  const pick = (u: U) => {
    if (u !== unit) onUnit(u);
    // Long enough to watch the thumb land and the number re-draw, then fold.
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), Pace.handover);
  };

  const guideInk = alpha(colors.textTertiary, 0.62);
  const guideLine = alpha(colors.textTertiary, 0.3);
  const unitName = current?.name.toLowerCase() ?? String(unit);
  const hint = `Between ${guide.min} and ${guide.max}`;

  const input = (which: "major" | "minor", spec: FieldSpec) => {
    const value = parts[which];
    return (
      <TextInput
        ref={which === "major" ? majorRef : minorRef}
        value={value}
        onChangeText={(text) => {
          onParts({ ...parts, [which]: text });
          // Feet is one digit, stones two: the moment the first box is full,
          // the caret belongs in the second.
          if (compound && which === "major" && text.length >= spec.maxLength) {
            minorRef.current?.focus();
          }
        }}
        onKeyPress={(e) => {
          if (compound && which === "minor" && e.nativeEvent.key === "Backspace" && value.length === 0) {
            majorRef.current?.focus();
          }
        }}
        placeholder="—"
        placeholderTextColor={alpha(colors.textTertiary, 0.75)}
        keyboardType={spec.decimal ? "decimal-pad" : "number-pad"}
        maxLength={spec.maxLength}
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityLabel={
          compound ? `${label}, ${SPOKEN_SUFFIX[spec.suffix] ?? spec.suffix}` : `${label} in ${unitName}`
        }
        accessibilityHint={which === "major" ? hint : undefined}
        style={[
          styles.input,
          compound ? { width: spec.maxLength * 16 + 10, textAlign: "center" } : styles.inputFill,
          { color: colors.text },
        ]}
      />
    );
  };

  return (
    <Appear delay={delay} duration={Dur.content} style={style}>
      <Animated.View style={[styles.row, surface]}>
        <Pressable
          // Tapping anywhere on the slab puts the caret in the first box that
          // still needs a number. Not an accessibility stop of its own: the
          // inputs and the unit pill inside it are the controls.
          onPress={() => (compound && parts.major.length > 0 ? minorRef : majorRef).current?.focus()}
          accessible={false}
          accessibilityLabel={label}
          style={styles.pad}
        >
          <View style={styles.head}>
            <AppText variant="caption" color="tertiary" uppercase>
              {label}
            </AppText>
            <Pressable
              onPress={() => {
                selectHaptic();
                setOpen((o) => !o);
              }}
              hitSlop={HIT}
              accessibilityRole="button"
              accessibilityLabel={`${label} unit: ${unitName}. Change unit.`}
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor: alpha(colors.primary, pressed || open ? 0.16 : 0.08),
                  borderColor: alpha(colors.primary, open ? 0.5 : 0.28),
                },
              ]}
            >
              <AppText variant="footnote" color="brand">
                {current?.label ?? String(unit)}
              </AppText>
              <Animated.View style={chevron}>
                <Ionicons name="chevron-down" size={13} color={colors.primary} />
              </Animated.View>
            </Pressable>
          </View>

          <View style={styles.valueLine}>
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.guide, guideStyle]}
            >
              <AppText variant="footnote" color={guideInk}>
                {guide.min}
              </AppText>
              <View style={[styles.guideTick, { backgroundColor: guideLine }]} />
              <View style={[styles.guideTrack, { backgroundColor: guideLine }]} />
              <View style={[styles.guideTick, { backgroundColor: guideLine }]} />
              <AppText variant="footnote" color={guideInk}>
                {guide.max}
              </AppText>
            </Animated.View>

            <Animated.View style={[styles.fields, !compound && styles.inputFill, valueStyle]}>
              {input("major", fields[0]!)}
              {compound || parts.major.length > 0 ? (
                <AppText variant="subhead" color="tertiary" style={styles.suffix}>
                  {fields[0]!.suffix}
                </AppText>
              ) : null}
              {compound ? (
                <>
                  {input("minor", fields[1]!)}
                  <AppText variant="subhead" color="tertiary" style={styles.suffix}>
                    {fields[1]!.suffix}
                  </AppText>
                </>
              ) : null}
            </Animated.View>
          </View>
        </Pressable>

        {/* The switch folds out of the slab it belongs to; its height is
            measured off-layout so the fold is a pure UI-thread animation. */}
        <Animated.View style={[styles.drawer, drawerStyle]} pointerEvents={open ? "auto" : "none"}>
          <View
            style={styles.drawerInner}
            onLayout={(e) => setDrawerHeight(e.nativeEvent.layout.height)}
            accessibilityElementsHidden={!open}
            importantForAccessibility={open ? "auto" : "no-hide-descendants"}
          >
            <UnitSwitch units={units} unit={unit} onPick={pick} label={`Enter ${label.toLowerCase()} in`} />
          </View>
        </Animated.View>
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
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  valueLine: { flexDirection: "row", alignItems: "center" },
  fields: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  // Right-aligned over the value line and never a layout participant, exactly
  // as InputRow's guide: the row is the same height before and after it fades.
  guide: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  guideTrack: { width: 22, height: 1, borderRadius: 0.5 },
  guideTick: { width: 1, height: 7, borderRadius: 0.5 },
  input: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: -0.3,
    padding: 0,
    height: 34,
    textAlignVertical: "center",
  },
  inputFill: { flex: 1 },
  suffix: { marginRight: 4 },

  drawer: { overflow: "hidden" },
  drawerInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  switchBlock: { gap: Spacing.sm },
  track: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 4,
  },
  thumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 38 },
});
