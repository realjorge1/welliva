/**
 * CrossFade — one region, different content, no cut.
 *
 * Used where a screen asks a SEQUENCE of questions in the same place (food:
 * dietary style → cuisine → meals). The outgoing answer is lifted out of the
 * layout and faded away while the incoming one is already rising into it, so
 * the two overlap for ~180ms and the region never flashes empty. The container
 * animates its own height between the two, so a taller question does not snap
 * the screen open.
 *
 * This is the in-screen sibling of `OnboardingTransition`, which does the same
 * job between whole steps.
 */
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Dur, Ease, Travel, useMotion } from "./onboardingMotion";

export interface CrossFadeProps {
  /** Changing this swaps the content. */
  contentKey: string | number;
  children: React.ReactNode;
  /** Direction of travel: forward rises, back drops. */
  direction?: "forward" | "back";
  style?: StyleProp<ViewStyle>;
}

export function CrossFade({
  contentKey,
  children,
  direction = "forward",
  style,
}: CrossFadeProps) {
  const motion = useMotion();
  const [outgoing, setOutgoing] = useState<React.ReactNode>(null);
  const prev = useRef<{ key: string | number; node: React.ReactNode }>({
    key: contentKey,
    node: children,
  });
  const enter = useSharedValue(1);
  const leave = useSharedValue(0);

  const outMs = motion.dur(Dur.ui * 0.6);
  const inMs = motion.dur(Dur.ui);
  const travel = motion.dist(Travel.rise) * (direction === "forward" ? 1 : -1);

  // The latest children, tracked OUTSIDE the effect. They are a new element on
  // every parent render, so putting them in the dependency array would re-run
  // the effect constantly — and its cleanup would then clear the timeout that
  // retires the outgoing layer before it could ever fire, stranding a ghost
  // copy on screen forever. The effect depends on the KEY, which is the only
  // thing that actually means "swap".
  const latest = useRef(children);
  latest.current = children;

  useEffect(() => {
    if (prev.current.key === contentKey) return;
    setOutgoing(prev.current.node);
    prev.current = { key: contentKey, node: latest.current };

    leave.value = 1;
    leave.value = withTiming(0, { duration: outMs, easing: Ease.exit });
    enter.value = 0;
    enter.value = withTiming(1, { duration: inMs, easing: Ease.soft });

    // Retire the old layer only once it is fully invisible; keeping it a frame
    // longer is cheaper than a flash.
    const t = setTimeout(() => setOutgoing(null), outMs + 40);
    return () => clearTimeout(t);
  }, [contentKey, enter, leave, outMs, inMs]);

  // Keep the snapshot current while the key is unchanged, so the next swap
  // captures what is actually on screen rather than a stale render.
  useEffect(() => {
    if (prev.current.key === contentKey) prev.current.node = latest.current;
  });

  const inStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: travel * (1 - enter.value) }],
  }));

  const outStyle = useAnimatedStyle(() => ({
    opacity: leave.value,
    transform: [{ translateY: -travel * 0.55 * (1 - leave.value) }],
  }));

  return (
    <Animated.View
      style={style}
      layout={LinearTransition.duration(motion.dur(Dur.ui)).easing(Ease.soft)}
    >
      {outgoing !== null && (
        <Animated.View
          style={[styles.outgoing, outStyle]}
          pointerEvents="none"
          // Already gone as far as the user is concerned; keep it out of the
          // accessibility tree so the reader never lands on a ghost.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {outgoing}
        </Animated.View>
      )}
      <Animated.View style={inStyle}>{children}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outgoing: { ...StyleSheet.absoluteFillObject, bottom: undefined },
});
