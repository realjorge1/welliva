/**
 * SessionControls — the player's one row of controls: a wide pill for the thing
 * the phase is waiting on, and two round buttons beside it, each NAMED under
 * its disc the way a phone's call screen names its buttons.
 *
 *   [ ✓  DONE SET              ]  ( ? )    ( ‖ )
 *                                 HOW TO   PAUSE
 *   [ ⏭  SKIP REST             ]  (+20)    ( ‖ )
 *                               MORE TIME  PAUSE
 *   [ ▶  RESUME                ]  ( ☰ )    ( ■ )
 *                               ALL MOVES   END
 *
 * The row has the same geometry in every phase, so the big target never moves
 * under a thumb that has learned where it is — only its colour and words change,
 * and the colour CROSSFADES (gold while you work, water-blue while you rest).
 * Anything rarer than these three lives behind Pause.
 *
 * A round button with `attention` glows the brand colour for one second up and
 * one down, then sits dark for four: the "How to" cadence the owner set — a
 * signal that rests, never wallpaper, never a size change or a halo.
 */
import { AppText, Mono, useColors } from "@/components/ui";
import { EDGE_WHITE } from "@/components/home/surface";
import { Gradients, Palette, Spacing, alpha } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type IconName = keyof typeof Ionicons.glyphMap;

/** One control's height — the pill and the round buttons line up. */
export const CONTROL_SIZE = 56;
/** A round button's column: its disc, and room for its name under it. */
const ROUND_COLUMN = 64;
const WATER = Gradients.water[1];
/** A quiet pill's face — the player's black, so only its edge and name remain. */
const QUIET_FACE = "#000000";
/** The "How to" glow: a second up, a second down, four seconds dark. */
const GLOW_MS = 1000;
const GLOW_REST_MS = 4000;

export type PrimaryTone = "brand" | "water" | "tonal";

export interface PrimaryAction {
  label: string;
  icon: IconName;
  tone: PrimaryTone;
  onPress: () => void;
}

export interface RoundAction {
  /** Spoken name — the whole of what the button does. */
  label: string;
  /** The short name printed under the disc ("HOW TO", "END"). */
  caption: string;
  icon?: IconName;
  /** A short figure drawn instead of an icon ("+20"). */
  text?: string;
  onPress: () => void;
  disabled?: boolean;
  /** Ending: filled red, like a stop button. */
  danger?: boolean;
  attention?: boolean;
}

export interface SessionControlsProps {
  primary: PrimaryAction;
  actions: [RoundAction, RoundAction];
  /** Glance mode: the row is fading back — the pill goes quiet with it (see PrimaryPill). */
  quiet?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SessionControls({ primary, actions, quiet = false, style }: SessionControlsProps) {
  return (
    <View style={[styles.row, style]}>
      <PrimaryPill {...primary} quiet={quiet} style={styles.pillInRow} />
      <RoundButton {...actions[0]} />
      <RoundButton {...actions[1]} />
    </View>
  );
}

/**
 * The wide pill. On its own — the plan's Begin, the completion's Continue, the
 * summary's way out — it is exactly one control tall and spans its column; in
 * the player's row the row hands it the width the round buttons leave.
 *
 * QUIET (glance mode). The player fades its controls while you work. A filled
 * gold pill faded that way kept its gold and lost its words: dark ink on gold
 * dims to black on dark olive, and the owner saw "a yellow button with no
 * label" (2026-11-02 — measured off the phone: the face at #1A1404, the label
 * at ~#040300). So a quiet pill gives up its FILL instead of its words: the
 * face goes black, the edge and the label take the tone's colour, and it dims
 * the way the round buttons do — a shape with its name still on it.
 */
export function PrimaryPill({
  label,
  icon,
  tone,
  onPress,
  quiet = false,
  style,
}: PrimaryAction & { quiet?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const tint = tone === "water" ? WATER : tone === "tonal" ? colors.surfaceElevated : colors.primary;
  const fill = quiet ? QUIET_FACE : tint;
  const ink = quiet
    ? tone === "tonal"
      ? colors.text
      : tint
    : tone === "water"
      ? "#FFFFFF"
      : tone === "tonal"
        ? colors.text
        : colors.onPrimary;
  // The edge is the tone itself: invisible against its own fill, the outline
  // that keeps the pill's shape once the face goes quiet.
  const edge = tone === "tonal" ? EDGE_WHITE : tint;

  // The colour follows the phase, gliding rather than snapping — face and edge
  // together, so a phase change never flashes an outline of the next colour.
  const faceStyle = useAnimatedStyle(
    () => ({
      backgroundColor: reduced ? fill : withTiming(fill, { duration: 280 }),
      borderColor: reduced ? edge : withTiming(edge, { duration: 280 }),
    }),
    [fill, edge, reduced],
  );

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {({ pressed }) => (
        <Animated.View style={[styles.pill, faceStyle]}>
          {pressed ? <View style={[StyleSheet.absoluteFill, styles.pillPressed]} /> : null}
          <Ionicons name={icon} size={20} color={ink} />
          <AppText
            variant="headline"
            weight="800"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={1.25}
            style={[styles.pillLabel, { color: ink }]}
          >
            {label.toUpperCase()}
          </AppText>
        </Animated.View>
      )}
    </Pressable>
  );
}

function RoundButton({
  label,
  caption,
  icon,
  text,
  onPress,
  disabled = false,
  danger = false,
  attention = false,
}: RoundAction) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const beat = useSharedValue(0);
  const live = attention && !disabled && !reduced && !danger;

  useEffect(() => {
    if (!live) {
      cancelAnimation(beat);
      beat.value = withTiming(0, { duration: 240 });
      return;
    }
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: GLOW_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: GLOW_MS, easing: Easing.inOut(Easing.quad) }),
        // The dark hold is the point: a light that never rests stops being a signal.
        withDelay(GLOW_REST_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(beat);
  }, [live, beat]);

  // Premixed on the JS side: alpha() can't run inside a worklet.
  const idleFill = danger ? Palette.danger : colors.surfaceElevated;
  const liveFill = alpha(colors.primary, 0.26);
  const idleEdge = danger ? Palette.danger : EDGE_WHITE;
  const liveEdge = alpha(colors.primary, 0.9);
  const discStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(beat.value, [0, 1], [idleFill, liveFill]),
    borderColor: interpolateColor(beat.value, [0, 1], [idleEdge, liveEdge]),
  }));
  const ink = danger ? "#FFFFFF" : disabled ? colors.textTertiary : colors.text;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.roundColumn, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.round, discStyle]}>
        {text ? (
          <Mono size={14} weight="700" color={ink}>
            {text}
          </Mono>
        ) : icon ? (
          <Ionicons name={icon} size={22} color={ink} />
        ) : null}
      </Animated.View>
      <Mono
        size={9}
        tracking={0.6}
        color={colors.textSecondary}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {caption}
      </Mono>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Discs and pill share a top line; the names hang under the discs.
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs },
  pillInRow: { flex: 1, marginRight: Spacing.xs },
  pill: {
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  pillPressed: { backgroundColor: "rgba(0, 0, 0, 0.14)" },
  pillLabel: { fontSize: 15, lineHeight: 20, letterSpacing: 1.2, flexShrink: 1 },
  roundColumn: { width: ROUND_COLUMN, alignItems: "center", gap: 4 },
  round: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.45 },
});
