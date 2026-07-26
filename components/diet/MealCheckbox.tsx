/**
 * MealCheckbox — the circular completion control.
 *
 * A single `p` shared value (0 = empty → 1 = done) drives the whole state, all
 * on the UI thread: the ring recolours to the meal's tone, a fill disc springs
 * up from the centre, and the tick strokes itself in a beat later (its
 * dash-offset trails `p`). Pressing dips the control with a quick spring so the
 * tap feels physical. Tapping again runs the exact same motion in reverse.
 */
import { Ease } from "@/components/motion/motion";
import { useColors } from "@/components/ui";
import React, { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Tick geometry inside a 28-unit box; ~20 units long, so a dasharray of 22
// fully hides it at offset 22 and reveals it at 0.
const TICK = "M8 14.5 L12.4 18.6 L20.5 9.2";
const TICK_LEN = 22;

export interface MealCheckboxProps {
  completed: boolean;
  /** Fill + ring accent when done. */
  tone: string;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
}

export function MealCheckbox({
  completed,
  tone,
  onPress,
  size = 28,
  disabled,
}: MealCheckboxProps) {
  const { colors } = useColors();
  const p = useSharedValue(completed ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    p.value = withTiming(completed ? 1 : 0, {
      duration: 360,
      easing: Ease.standard,
    });
  }, [completed, p]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      p.value,
      [0, 1],
      [colors.borderStrong, tone],
    ),
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.4 + p.value * 0.6 }],
    backgroundColor: tone,
  }));

  const tickProps = useAnimatedProps(() => {
    // Tick trails the fill: nothing until 45% done, then strokes in.
    const t = Math.max(0, Math.min(1, (p.value - 0.45) / 0.55));
    return { strokeDashoffset: TICK_LEN * (1 - t) };
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(0.86, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 12, stiffness: 320 });
      }}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
    >
      <Animated.View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 2 },
          containerStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.ring,
            { borderRadius: size / 2, borderWidth: 2 },
            ringStyle,
          ]}
        />
        <Animated.View
          style={[styles.fill, { borderRadius: size / 2 }, fillStyle]}
        />
        <Svg width={size} height={size} viewBox="0 0 28 28" style={StyleSheet.absoluteFill}>
          <AnimatedPath
            d={TICK}
            stroke="#FFFFFF"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={TICK_LEN}
            animatedProps={tickProps}
          />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  ring: { ...StyleSheet.absoluteFillObject },
  fill: { ...StyleSheet.absoluteFillObject },
});
