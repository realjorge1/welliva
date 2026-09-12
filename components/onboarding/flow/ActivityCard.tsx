/**
 * ActivityCard / ActivityDeck — five levels, one card at a time.
 *
 * The brief asks for a single large central card with an intensity
 * visualisation, browsed like physical cards rather than swiped like a dating
 * app. The literal reading — show one level, hide the other four — fails the
 * user: reaching "Extra active" would cost four taps and they could never see
 * the scale they are placing themselves on.
 *
 * So the deck is an ACCORDION. All five levels are always present as quiet
 * one-line rows; the chosen one expands in place into the large card, with its
 * description and its intensity meter illuminating node by node. Choosing a
 * different level collapses one card and opens another — the "card leaves, next
 * card arrives" motion the brief is after — but it always costs exactly one tap
 * and the scale is always legible.
 *
 * The detail block MEASURES itself once, from an absolutely-positioned copy
 * inside the clipped wrapper. A fixed height was the obvious alternative and it
 * is wrong on a small display: "Physical job or hard training most days" is one
 * line on a 15 Pro and two on an SE, so any constant either clips the second
 * line or leaves a hole under the first.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Appear } from "./Appear";
import { Dur, Ease, Spring, Stagger, useMotion } from "./onboardingMotion";
import { selectHaptic } from "./SelectionCard";
import { MIN_TOUCH } from "./onboardingTheme";

const NODES = 5;

/* ─────────────────────────── Intensity meter ───────────────────────────── */

export function IntensityNodes({
  level,
  open,
  tone,
  idle,
}: {
  level: number;
  open: boolean;
  tone: string;
  idle: string;
}) {
  return (
    <View
      style={styles.meter}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: NODES }, (_, i) => (
        <IntensityNode key={i} lit={i < level} index={i} open={open} tone={tone} idle={idle} />
      ))}
    </View>
  );
}

function IntensityNode({
  lit,
  index,
  open,
  tone,
  idle,
}: {
  lit: boolean;
  index: number;
  open: boolean;
  tone: string;
  idle: string;
}) {
  const motion = useMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    // Nodes illuminate in sequence, left to right — the meter fills like a
    // level rising, never like five lights switching on together.
    p.value = withDelay(
      motion.delay(open && lit ? index * 70 : 0),
      withTiming(open && lit ? 1 : 0, {
        duration: motion.dur(Dur.ui),
        easing: Ease.soft,
      }),
    );
  }, [open, lit, index, motion, p]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [idle, tone]),
    transform: [{ scaleY: 0.55 + 0.45 * p.value }],
  }));

  return <Animated.View style={[styles.node, { height: 8 + index * 3 }, style]} />;
}

/* ───────────────────────────── One card ────────────────────────────────── */

export interface ActivityCardProps {
  label: string;
  description: string;
  /** 1–5. Drives how many meter nodes light. */
  level: number;
  selected: boolean;
  onPress: () => void;
  /** Dim because a sibling holds the selection. */
  recede?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ActivityCard({
  label,
  description,
  level,
  selected,
  onPress,
  recede = false,
  style,
}: ActivityCardProps) {
  const { colors } = useColors();
  const motion = useMotion();

  const [detailHeight, setDetailHeight] = useState(0);
  const open = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(0);
  const dim = useSharedValue(recede ? 1 : 0);

  const restFill = alpha(colors.surface, 0.6);
  const openFill = alpha(colors.primary, 0.1);
  const restLine = alpha(colors.border, 0.85);
  const openLine = alpha(colors.primary, 0.5);

  useEffect(() => {
    open.value = withTiming(selected ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.soft,
    });
  }, [selected, motion, open]);

  useEffect(() => {
    dim.value = withTiming(recede ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.standard,
    });
  }, [recede, motion, dim]);

  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(open.value, [0, 1], [restFill, openFill]),
    borderColor: interpolateColor(open.value, [0, 1], [restLine, openLine]),
    opacity: 1 - 0.35 * dim.value,
    transform: [{ scale: 1 - 0.02 * press.value }],
  }));

  const detail = useAnimatedStyle(() => ({
    height: detailHeight * open.value,
    opacity: open.value,
  }));

  return (
    <Animated.View style={[styles.card, surface, style]}>
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
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ selected, checked: selected }}
        style={styles.cardPad}
      >
        <AppText variant="callout" color={selected ? "brand" : "secondary"}>
          {label}
        </AppText>
        <Animated.View style={[styles.detail, detail]}>
          {/* Absolute so it lays out at its natural height even while the
              wrapper is collapsed to zero; a normal flex child would be
              squashed and report the wrong height on the first open. */}
          <View
            style={styles.detailMeasure}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              if (h > 0 && h !== detailHeight) setDetailHeight(h);
            }}
          >
            <AppText variant="footnote" color="tertiary" numberOfLines={2}>
              {description}
            </AppText>
            <IntensityNodes
              level={level}
              open={selected}
              tone={colors.primary}
              idle={alpha(colors.border, 1)}
            />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────────────────────── The deck ────────────────────────────────── */

export interface ActivityOption<T extends string> {
  value: T;
  label: string;
  desc: string;
  level: number;
}

export interface ActivityDeckProps<T extends string> {
  options: ActivityOption<T>[];
  value: T | null;
  onSelect: (value: T) => void;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function ActivityDeck<T extends string>({
  options,
  value,
  onSelect,
  delay = 0,
  style,
}: ActivityDeckProps<T>) {
  return (
    <View style={[styles.deck, style]} accessibilityRole="radiogroup">
      {options.map((option, i) => (
        <Appear key={option.value} delay={delay + i * Stagger.item} duration={Dur.content}>
          <ActivityCard
            label={option.label}
            description={option.desc}
            level={option.level}
            selected={value === option.value}
            onPress={() => onSelect(option.value)}
            recede={value !== null && value !== option.value}
          />
        </Appear>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { gap: Spacing.sm },
  card: { borderRadius: Radius.xl, borderWidth: 1, overflow: "hidden" },
  cardPad: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: MIN_TOUCH,
    justifyContent: "center",
  },
  detail: { overflow: "hidden" },
  detailMeasure: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },

  meter: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 20 },
  node: { width: 18, borderRadius: 2 },
});
