/**
 * QuestionStage — a question that holds the screen before it asks for anything.
 *
 * Everywhere else in the flow a question arrives and its options follow a beat
 * later (`OPTIONS_DELAY`). That beat is right for most screens and, repeated
 * nine times, it is also exactly what makes the flow feel like a quiz: ask,
 * answer, ask, answer, at one tempo.
 *
 * A few questions are asked differently. The question lands ALONE in the middle
 * of the stage and is simply left there — no options, no button — for a moment
 * that is long enough to read it twice. Then the answers slide up from below and
 * carry the question with them to its resting place at the top, as if they had
 * pushed it there. The pause is the anticipation; the push makes the pause feel
 * like it was going somewhere.
 *
 * HOW THE PUSH WORKS. The question and its answers are one column in normal
 * layout, exactly where they will end up. While held, the column is translated
 * DOWN by the distance that centres the question, and the answers are not
 * mounted. On the rise the answers mount (so their own staggered entrances
 * play) and the translation glides to zero — the whole column moves up together,
 * which is what makes the answers read as pushing rather than as appearing.
 * One transform, no second layout, nothing that can reflow.
 *
 * THE RULES THAT KEEP IT FROM BECOMING A WAIT:
 *  • Any tap on the stage ends the hold at once.
 *  • `hold` is read at MOUNT only. A step decides once whether it holds; a prop
 *    that flipped mid-hold (the parent re-rendering) must not cut the beat short.
 *  • A question holds the first time it is seen, never again (the step tracks
 *    that). Going back to it must not cost the pause twice.
 *  • Reduce Motion and screen readers skip the hold entirely — a centred
 *    question with invisible answers is a trap for a reader.
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ExitContext } from "./Appear";
import { OPTIONS_DELAY } from "./AnimatedQuestion";
import { Dur, Ease, Pace, useMotion } from "./onboardingMotion";
import { Gutter, Rhythm } from "./onboardingTheme";

/** Where a held question rests: a touch above the stage's true middle, where the eye puts centre. */
const OPTICAL_CENTRE = 0.44;
/** The question has been read by the time it rises, so its answers follow almost at once. */
const RISEN_OPTIONS_DELAY = 140;

export interface QuestionStageProps {
  /** Hold the question alone before its answers arrive. Read at mount only. */
  hold: boolean;
  /** The question block (and anything that belongs with it, like a scene). */
  lead: React.ReactNode;
  /** The answers. Receives the delay their entrances should start from. */
  children: (optionsDelay: number) => React.ReactNode;
  /** The answers are on their way — the step brings its action bar back here. */
  onRise?: () => void;
  /** Extra room under the content, on top of the standard tail. */
  tail?: number;
}

export function QuestionStage({ hold, lead, children, onRise, tail = 0 }: QuestionStageProps) {
  const motion = useMotion();
  const leaving = useContext(ExitContext);

  const [held] = useState(hold && !motion.reduced);
  const [risen, setRisen] = useState(!held);
  const [viewport, setViewport] = useState(0);
  const [leadHeight, setLeadHeight] = useState(0);
  const lift = useSharedValue(held ? 0 : 1);

  const onRiseRef = useRef(onRise);
  onRiseRef.current = onRise;

  const rise = useCallback(() => setRisen(true), []);

  useEffect(() => {
    if (!risen) return;
    lift.value = withTiming(1, { duration: motion.dur(Dur.rise), easing: Ease.glide });
    onRiseRef.current?.();
  }, [risen, motion, lift]);

  // The hold itself. A step that is leaving stays where it is and fades.
  useEffect(() => {
    if (risen || leaving) return;
    const t = setTimeout(rise, Pace.hold);
    return () => clearTimeout(t);
  }, [risen, leaving, rise]);

  useEffect(() => {
    if (!held) return;
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => {
        if (alive && on) rise();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [held, rise]);

  // Until both are measured a held column is invisible, so it can never be seen
  // sitting at the top for the frame before it is centred.
  const measured = !held || (viewport > 0 && leadHeight > 0);
  const offset = held
    ? Math.max(0, viewport * OPTICAL_CENTRE - leadHeight / 2 - Rhythm.crown)
    : 0;

  const column = useAnimatedStyle(() => ({
    transform: [{ translateY: offset * (1 - lift.value) }],
  }));

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: Rhythm.tail + tail }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEnabled={risen}
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
      >
        <Animated.View style={[styles.column, { opacity: measured ? 1 : 0 }, column]}>
          <View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (Math.abs(h - leadHeight) > 0.5) setLeadHeight(h);
            }}
          >
            {lead}
          </View>
          {risen ? children(held ? RISEN_OPTIONS_DELAY : OPTIONS_DELAY) : null}
        </Animated.View>
      </ScrollView>

      {!risen ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={rise}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: Gutter, paddingTop: Rhythm.crown },
  column: { gap: Rhythm.layer },
});
