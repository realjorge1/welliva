/**
 * SelectionCard — the one tactile surface the flow answers questions with.
 *
 * Every choice in the onboarding — a goal, a sex, an activity level, a piece of
 * equipment, a cuisine — is this component. That is the point: the user learns
 * one interaction on the goals screen and it behaves identically for the rest
 * of the ritual.
 *
 * THE FOUR MOVEMENTS (the brief's "card lift / card settle"):
 *
 *   1. PRESS      scale 1 → 0.97, spring-tracked to the finger, no overshoot.
 *   2. RELEASE    springs back to 1 — it never snaps.
 *   3. SETTLE     on becoming selected the card lifts 2px, its tint fades up
 *                 and its hairline strengthens. The lift is a TRANSFORM, so the
 *                 grid never reflows: selecting the fourth of six options must
 *                 not move the other five.
 *   4. ACKNOWLEDGE the glyph pops 1 → 1.08 → 1 and the check draws in.
 *
 * RECEDING. In a single-select group the cards that were not chosen drop to
 * 62% opacity rather than disappearing. They stay legible and tappable — the
 * user can always change their mind — but the chosen one is unmistakably the
 * one the interface is now holding.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { OnboardingGlyph, type GlyphName } from "./OnboardingGlyph";
import { Dur, Ease, Spring, useMotion } from "./onboardingMotion";
import { MIN_TOUCH } from "./onboardingTheme";

/** Selection is a light impact everywhere in the flow — one tap, one tick.
 *  (The app-wide haptics shim is currently a no-op by team decision; routing
 *  through it means the flow lights up the moment that switch is flipped.) */
export const selectHaptic = () => Haptics.selectionAsync().catch(() => {});

export interface SelectionCardProps {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle?: string;
  glyph?: GlyphName;
  /** Vertical tile (grids) or horizontal row (lists). */
  layout?: "tile" | "row";
  /** Dim because a sibling in a single-select group holds the selection. */
  recede?: boolean;
  /** A small tag inside the card — used for "Main focus" on the first goal. */
  tag?: string;
  /** Hide the check mark where the tint alone is enough (e.g. sex). */
  showCheck?: boolean;
  /** "radio" for single-select groups, "checkbox" for multi. */
  role?: "radio" | "checkbox";
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Rendered after the text block — the activity step's intensity meter. */
  children?: React.ReactNode;
}

export function SelectionCard({
  selected,
  onPress,
  title,
  subtitle,
  glyph,
  layout = "tile",
  recede = false,
  tag,
  showCheck = true,
  role = "checkbox",
  accessibilityHint,
  disabled = false,
  style,
  children,
}: SelectionCardProps) {
  const { colors } = useColors();
  const motion = useMotion();

  const press = useSharedValue(0);
  const sel = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(1);
  const dim = useSharedValue(recede ? 1 : 0);

  // The colour endpoints, resolved once per theme so the worklet interpolates
  // between two concrete rgba strings rather than re-reading the palette.
  const restFill = alpha(colors.surface, 0.72);
  const selFill = alpha(colors.primary, 0.1);
  const restLine = alpha(colors.border, 0.9);
  const selLine = alpha(colors.primary, 0.55);

  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, {
      duration: motion.dur(Dur.tap),
      easing: Ease.soft,
    });
    if (selected) {
      // The glyph acknowledges the choice; it does not celebrate it.
      pop.value = withSequence(
        withTiming(1.08, { duration: motion.dur(Dur.micro * 0.8), easing: Ease.soft }),
        withTiming(1, { duration: motion.dur(Dur.tap), easing: Ease.soft }),
      );
    }
  }, [selected, motion, sel, pop]);

  useEffect(() => {
    dim.value = withTiming(recede ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.standard,
    });
  }, [recede, motion, dim]);

  const lift = motion.dist(2);

  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [restFill, selFill]),
    borderColor: interpolateColor(sel.value, [0, 1], [restLine, selLine]),
    opacity: 1 - 0.38 * dim.value,
    transform: [
      { translateY: -lift * sel.value },
      { scale: 1 - 0.03 * press.value },
    ],
  }));

  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: sel.value,
    transform: [{ scale: 0.7 + 0.3 * sel.value }],
  }));

  const handlePress = () => {
    if (disabled) return;
    selectHaptic();
    onPress();
  };

  const glyphTone = selected ? colors.primary : colors.textTertiary;

  return (
    <Animated.View style={[styles.frame, surface, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          press.value = withSpring(1, Spring.press);
        }}
        onPressOut={() => {
          press.value = withSpring(0, Spring.press);
        }}
        disabled={disabled}
        accessibilityRole={role}
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint ?? subtitle}
        accessibilityState={{ selected, checked: selected, disabled }}
        style={[styles.pad, layout === "row" ? styles.row : styles.tile]}
      >
        {glyph && (
          <Animated.View style={glyphStyle}>
            <OnboardingGlyph name={glyph} tone={glyphTone} size={layout === "row" ? 26 : 28} />
          </Animated.View>
        )}

        <View style={layout === "row" ? styles.rowText : styles.tileText}>
          <AppText variant="callout" color={selected ? "brand" : "secondary"}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="footnote" color="tertiary" style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
          {/* Inline, never absolute: a tag that floated over the card would
              collide with a two-line title at large accessibility text sizes. */}
          {tag && selected ? (
            <Animated.View
              style={[styles.tag, { backgroundColor: alpha(colors.primary, 0.16) }, checkStyle]}
            >
              <AppText variant="caption" color="brand">
                {tag}
              </AppText>
            </Animated.View>
          ) : null}
          {children}
        </View>

        {showCheck && (
          <Animated.View
            style={[
              styles.check,
              layout === "tile" ? styles.checkTile : null,
              { borderColor: colors.primary, backgroundColor: colors.primary },
              checkStyle,
            ]}
            pointerEvents="none"
          >
            <View style={[styles.checkMark, { borderColor: colors.onPrimary }]} />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: Radius.xl, borderWidth: 1, overflow: "hidden" },
  pad: { padding: Spacing.lg, minHeight: MIN_TOUCH },
  tile: { gap: Spacing.md, alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  tileText: { gap: 2, alignSelf: "stretch" },
  rowText: { flex: 1, gap: 2 },
  subtitle: { marginTop: 1 },

  check: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkTile: { top: Spacing.lg, right: Spacing.lg },
  /** The tick, drawn as two borders on a rotated box — no icon font, so it
   *  scales with the badge and never renders as a stray glyph to a reader. */
  checkMark: {
    width: 8,
    height: 4.5,
    borderLeftWidth: 1.6,
    borderBottomWidth: 1.6,
    transform: [{ rotate: "-45deg" }],
    marginTop: -2,
  },

  tag: {
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
