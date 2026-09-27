/**
 * MediaCard — Explore's list card: a full-height media edge on the left (a
 * workout's art, an exercise's figure), the words on the right.
 *
 * WHY THE MEDIA BLEEDS TO THE EDGE
 *
 * The old cards floated a small square tile inside the card's padding, which is
 * the shape of a settings row: a thumbnail, some text, a chevron. Running the
 * media flush to the card's own edge — top, left and bottom — makes the card
 * read as one designed object instead of a form row, and it gives the art three
 * times the area without making the card any taller.
 *
 * The card never clips (Android draws `overflow: hidden` on a rounded view
 * without antialiasing). The media draws its own left corners at
 * {@link MEDIA_RADIUS}, the card's radius less its 1px border, so the two
 * curves nest exactly.
 *
 * Press feedback is a spring on the whole card rather than an opacity drop, and
 * collapses to a dim under Reduce Motion.
 */

import { useColors } from "@/components/ui";
import { LightCard, Radius, Spacing, alpha } from "@/constants/theme";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export const MEDIA_CARD_RADIUS = Radius.xl;
/** The media's corner radius: the card's, less its 1px border. */
export const MEDIA_RADIUS = MEDIA_CARD_RADIUS - 1;

const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };
const PRESSED_SCALE = 0.975;

export interface MediaCardProps {
  /** The left edge — it should stretch to the card's height (alignSelf). */
  media: React.ReactNode;
  children: React.ReactNode;
  onPress: () => void;
  /** The card is one button; it names itself as one thing. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /**
   * A control that sits ON the card but is not part of its press target — the
   * favourite heart. Rendered as a sibling of the card's button, never inside
   * it, so a screen reader can still reach it on its own.
   */
  accessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function MediaCard({
  media,
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessory,
  style,
}: MediaCardProps) {
  const { colors, isDark } = useColors();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    if (!reduced) scale.value = withSpring(PRESSED_SCALE, PRESS_SPRING);
  }, [reduced, scale]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          // The same surface as `Card`: frosted glass in dark, white in light.
          backgroundColor: isDark ? alpha(colors.surface, 0.8) : LightCard.base,
          borderColor: isDark ? alpha(colors.borderStrong, 0.55) : LightCard.border,
        },
        pressStyle,
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [styles.press, reduced && pressed && styles.pressedDim]}
      >
        {media}
        <View style={styles.body}>{children}</View>
      </Pressable>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
    </Animated.View>
  );
}

/**
 * Three rising bars, filled to the level: one for beginner, three for advanced.
 * Always paired with the level's word — the bars are for scanning a list, the
 * word is what they mean.
 */
export function LevelBars({ rank, color }: { rank: 1 | 2 | 3; color: string }) {
  return (
    <View style={styles.bars}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: 5 + i * 3, backgroundColor: i < rank ? color : alpha(color, 0.25) },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: MEDIA_CARD_RADIUS,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  press: { flexDirection: "row" },
  pressedDim: { opacity: 0.85 },
  body: {
    flex: 1,
    paddingLeft: Spacing.md + 2,
    paddingRight: Spacing.md,
    paddingVertical: 10,
  },
  accessory: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
  },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 11 },
  bar: { width: 3, borderRadius: 1.5 },
});
