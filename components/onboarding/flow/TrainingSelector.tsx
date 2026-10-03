/**
 * TrainingSelector — the training step as a coaching conversation.
 *
 * Experience, equipment, which DAYS, then how the workouts get planned — the
 * same choice the meal step offers ("Plan them for me" / "Let me choose") —
 * and, for someone who wants to choose, the workouts themselves. They are
 * DISCLOSED: only the first is on screen to begin with, answering it brings
 * the next into place, and so on. Answered questions stay visible above
 * rather than collapsing away — the user can change an answer without
 * navigating backwards, which is the difference between a conversation and an
 * interrogation.
 *
 * Days are weekdays, not a count. "3 days" used to become Mon/Wed/Fri behind
 * the user's back while their reminders went to whatever days setup stored;
 * the days picked here are the days the plan, the reminders and the weekly
 * target all use.
 *
 * The reveal state is owned by the STEP, not by this component, because the
 * action bar has to know whether "Continue" means "show me the next question"
 * or "I'm done with training" — and the step owns the action bar.
 *
 * The equipment rule is untouched: "Bodyweight & mat" is the `none` value and
 * selecting it clears everything else; clearing the last item falls back to it.
 * That logic stays in the step's `toggleEquipment`, where it already lived.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AnimatedText } from "./AnimatedText";
import { MultiSelectGrid, OptionRail, type GridOption } from "./MultiSelectGrid";
import { Dur, Ease, Pace, Stagger, useMotion } from "./onboardingMotion";
import { selectHaptic } from "./SelectionCard";
import { MIN_TOUCH, Rhythm } from "./onboardingTheme";

/* ───────────────────────────── Day selector ────────────────────────────── */

/**
 * A refined horizontal selector rather than five buttons: one track, one thumb
 * that slides between positions. The thumb is a transform, so the numbers never
 * move and the row never reflows as the choice changes.
 */
export function DaySelector({
  options,
  value,
  onChange,
  style,
}: {
  options: number[];
  value: number;
  onChange: (v: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.indexOf(value));
  // The track pads itself by 4pt on every side, so the travel lane is narrower
  // than the measured width — using the raw width would walk the thumb off the end.
  const cell = width > 0 ? (width - 8) / options.length : 0;
  const pos = useSharedValue(index);

  useEffect(() => {
    pos.value = motion.reduced
      ? index
      : withSpring(index, { damping: 20, stiffness: 180, mass: 0.8 });
  }, [index, motion.reduced, pos]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * cell }],
    opacity: cell > 0 ? 1 : 0,
  }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        { backgroundColor: alpha(colors.surfaceSunken, 0.8), borderColor: alpha(colors.border, 0.9) },
        style,
      ]}
      accessibilityRole="radiogroup"
    >
      <Animated.View
        style={[
          styles.thumb,
          { width: cell, backgroundColor: alpha(colors.primary, 0.18), borderColor: alpha(colors.primary, 0.5) },
          thumb,
        ]}
        pointerEvents="none"
      />
      {options.map((d) => {
        const active = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => {
              selectHaptic();
              onChange(d);
            }}
            style={styles.cell}
            accessibilityRole="radio"
            accessibilityLabel={`${d} days a week`}
            accessibilityState={{ selected: active, checked: active }}
          >
            <AppText variant="callout" color={active ? "brand" : "tertiary"}>
              {d}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─────────────────────────── Weekday picker ────────────────────────────── */

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Seven day tokens, Monday first. The step keeps at least one selected. */
export function WeekdayPicker({
  days,
  onToggle,
}: {
  days: readonly number[];
  onToggle: (day: number) => void;
}) {
  const { colors } = useColors();
  return (
    <View style={styles.weekdays}>
      {LETTERS.map((letter, i) => {
        const on = days.includes(i);
        return (
          <Pressable
            key={WEEKDAYS[i]}
            onPress={() => {
              selectHaptic();
              onToggle(i);
            }}
            hitSlop={4}
            style={[
              styles.weekday,
              {
                borderColor: on ? alpha(colors.primary, 0.6) : alpha(colors.border, 0.9),
                backgroundColor: on ? alpha(colors.primary, 0.18) : alpha(colors.surface, 0.72),
              },
            ]}
            accessibilityRole="checkbox"
            accessibilityLabel={WEEKDAYS[i]}
            accessibilityState={{ checked: on }}
          >
            <AppText variant="callout" weight="600" color={on ? "brand" : "tertiary"}>
              {letter}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ────────────────────────────── One phase ──────────────────────────────── */

function Phase({
  title,
  revealed,
  delay,
  children,
}: {
  title: string;
  revealed: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  const motion = useMotion();
  const p = useSharedValue(revealed ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(revealed ? 1 : 0, {
      duration: motion.dur(Dur.content),
      easing: Ease.soft,
    });
  }, [revealed, motion, p]);

  // Hoisted: worklets close over plain values only (see BuildingAnimation).
  const rise = motion.dist(14);
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: rise * (1 - p.value) }],
  }));

  // Unrevealed phases are not in the page yet: no focus stop, no reader stop.
  return (
    <Animated.View
      style={[styles.phase, style]}
      pointerEvents={revealed ? "auto" : "none"}
      accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? "auto" : "no-hide-descendants"}
    >
      <AnimatedText variant="headline" delay={delay} duration={Dur.ui} when={revealed}>
        {title}
      </AnimatedText>
      {children}
    </Animated.View>
  );
}

/* ─────────────────────────────── The step ──────────────────────────────── */

export interface TrainingSelectorProps<E extends string, Q extends string, M extends string, W extends string> {
  experienceOptions: GridOption<E>[];
  experience: E;
  onExperience: (v: E) => void;

  equipmentOptions: GridOption<Q>[];
  equipment: readonly Q[];
  onEquipment: (v: Q) => void;

  /** Training weekdays, 0 = Mon. */
  days: readonly number[];
  onToggleDay: (day: number) => void;
  /** "Mon, Wed, Fri — rest days between help you recover." */
  daysCaption: string;

  /** "Plan them for me" / "Let me choose". */
  modeOptions: GridOption<M>[];
  mode: M;
  onMode: (v: M) => void;
  /** The mode that asks for picks. */
  chooseMode: M;

  /** Library workouts to pick from; null while they load. */
  workoutOptions: GridOption<W>[] | null;
  picks: readonly W[];
  onTogglePick: (v: W) => void;
  /** "Mon: Morning Ignition · Wed: Gozlin plans · …" */
  picksCaption: string;

  /** 1–5 — how many questions are on screen. Owned by the step. */
  revealed: number;
  /** Called when answering a question should bring the next one into place. */
  onRevealNext: () => void;

  /** Content width available for measured grids. */
  width: number;
  delay?: number;
}

export function TrainingSelector<E extends string, Q extends string, M extends string, W extends string>({
  experienceOptions,
  experience,
  onExperience,
  equipmentOptions,
  equipment,
  onEquipment,
  days,
  onToggleDay,
  daysCaption,
  modeOptions,
  mode,
  onMode,
  chooseMode,
  workoutOptions,
  picks,
  onTogglePick,
  picksCaption,
  revealed,
  onRevealNext,
  width,
  delay = 0,
}: TrainingSelectorProps<E, Q, M, W>) {
  const { colors } = useColors();
  const [touchedExperience, setTouchedExperience] = useState(false);
  const [touchedMode, setTouchedMode] = useState(false);

  return (
    <View style={styles.phases}>
      <Phase title="How familiar are you with training?" revealed delay={delay}>
        <MultiSelectGrid
          options={experienceOptions}
          selected={touchedExperience ? [experience] : []}
          onToggle={(v) => {
            setTouchedExperience(true);
            onExperience(v);
            if (revealed < 2) setTimeout(onRevealNext, Pace.advance);
          }}
          width={width}
          columns={3}
          role="radio"
          delay={delay + Stagger.layer}
          recedeUnselected
        />
      </Phase>

      <Phase
        title="What do you have available?"
        revealed={revealed >= 2}
        delay={Stagger.layer}
      >
        <OptionRail
          options={equipmentOptions}
          selected={equipment}
          onToggle={(v) => {
            onEquipment(v);
            // Longer than a single-select hand-over: equipment is multi-select, so
            // the next question must not arrive before a second tap could land.
            if (revealed < 3) setTimeout(onRevealNext, Pace.handover + 100);
          }}
          delay={revealed >= 2 ? Stagger.layer * 1.5 : 0}
        />
        <AppText variant="footnote" color="tertiary">
          Pick everything you can reach. Bodyweight is always enough on its own.
        </AppText>
      </Phase>

      <Phase title="Which days can you train?" revealed={revealed >= 3} delay={Stagger.layer}>
        <WeekdayPicker
          days={days}
          onToggle={(d) => {
            onToggleDay(d);
            // Multi-select: the next question waits long enough for a second tap.
            if (revealed < 4) setTimeout(onRevealNext, Pace.handover + 100);
          }}
        />
        <View style={styles.dayNote}>
          <View style={[styles.dot, { backgroundColor: alpha(colors.primary, 0.7) }]} />
          <AppText variant="footnote" color="tertiary" style={styles.flex}>
            {daysCaption}
          </AppText>
        </View>
      </Phase>

      <Phase title="How should we plan your workouts?" revealed={revealed >= 4} delay={Stagger.layer}>
        <MultiSelectGrid
          options={modeOptions}
          selected={touchedMode ? [mode] : []}
          onToggle={(v) => {
            setTouchedMode(true);
            onMode(v);
            if (v === chooseMode && revealed < 5) setTimeout(onRevealNext, Pace.advance);
          }}
          width={width}
          columns={1}
          role="radio"
          delay={revealed >= 4 ? Stagger.layer * 1.5 : 0}
          recedeUnselected
        />
      </Phase>

      {mode === chooseMode && (
        <Phase title="Pick workouts you'd enjoy" revealed={revealed >= 5} delay={Stagger.layer}>
          {workoutOptions ? (
            <MultiSelectGrid
              options={workoutOptions}
              selected={picks}
              onToggle={onTogglePick}
              width={width}
              columns={1}
              delay={revealed >= 5 ? Stagger.layer * 1.5 : 0}
            />
          ) : (
            <AppText variant="footnote" color="tertiary">
              Finding workouts that fit your level and kit…
            </AppText>
          )}
          <View style={styles.dayNote}>
            <View style={[styles.dot, { backgroundColor: alpha(colors.primary, 0.7) }]} />
            <AppText variant="footnote" color="tertiary" style={styles.flex}>
              {picksCaption}
            </AppText>
          </View>
        </Phase>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  phases: { gap: Rhythm.question },
  phase: { gap: Spacing.lg },

  track: {
    flexDirection: "row",
    borderRadius: Radius.pill,
    borderWidth: 1,
    padding: 4,
    minHeight: MIN_TOUCH + 6,
    alignItems: "center",
  },
  thumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: MIN_TOUCH },

  dayNote: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 3 },

  weekdays: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  weekday: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
