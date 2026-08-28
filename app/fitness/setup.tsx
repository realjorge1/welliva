/**
 * FITNESS SETUP — "Build your training profile".
 *
 * Six steps, every one skippable, everything editable later in Fitness
 * Settings. Asks ONLY for preference data the recommendation engine actually
 * uses — body data (weight, injuries, equipment, level) already lives in the
 * main onboarding's UserBio and is not re-asked here.
 *
 * ── WHAT MAKES THIS FEEL PAID-FOR ───────────────────────────────────────────
 * The first version was a form: a title, a card of grey tiles, Continue. Same
 * questions, but nothing ever moved and nothing ever answered you back. Three
 * things changed that, and they're the rules to keep if this screen grows:
 *
 *  1. EVERY CHOICE ANSWERS BACK. No tap is silent. Selecting a goal springs its
 *     tile into a tinted state with a check that pops in; the duration dial
 *     rolls a live number and rewrites its caption; the day strip recounts
 *     itself ("3 days · the consistency sweet spot"). The screen is a
 *     conversation, not a form.
 *  2. THE FLOW REMEMBERS. Goals seed the style suggestions (lose fat → HIIT +
 *     cardio, pre-marked as "Suggested"), and the final step plays the whole
 *     profile back as a review you can jump into. The user should feel read.
 *  3. MOTION IS STRUCTURAL, NEVER DECORATIVE. Steps enter in the direction of
 *     travel, the rail fills with a spring, a chosen tile springs and tints.
 *     NO GLOWS — no aura, no bloom, no halo: the user asked for subtle and
 *     meant it, and decorative light is the first thing that makes a screen
 *     look cheap. All of it is Reanimated (UI thread) and all of it collapses
 *     to plain fades under `useReducedMotion`.
 *
 * Nothing here writes anywhere but FitnessProfileStore, and only on Finish —
 * with one deliberate exception: the reminder toggle asks the OS for
 * notification permission the moment it's switched on, so a refusal can leave
 * the switch off instead of storing an opt-in that can never fire.
 *
 * This screen is also the "Edit training preferences" editor (Fitness Settings
 * pushes the same route), so it SEEDS ITSELF from the stored profile and
 * patches only the keys it owns. Never widen the Finish patch to the whole
 * `reminders` object: the store deep-merges, and naming a key you don't edit
 * here silently resets the one set in Fitness Settings.
 */

import { RollingNumber } from "@/components/motion";
import { AppText, Button, Screen, useColors } from "@/components/ui";
import { Motion, Radius, Spacing, alpha } from "@/constants/theme";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import {
  requestNotificationPermission,
  syncFitnessReminders,
} from "@/fitness/services/FitnessNotifications";
import {
  loadFitnessProfile,
  type FitnessProfilePatch,
} from "@/fitness/services/FitnessProfileStore";
import type { FitnessGoal, WorkoutLocation, WorkoutStyle } from "@/fitness/types";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  SlideInLeft,
  SlideInRight,
  ZoomIn,
  interpolate,
  interpolateColor,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

/* ─────────────────────────────── content ─────────────────────────────── */

/** Each goal says what it actually changes — a promise, not a label. */
const GOAL_OPTIONS: {
  id: FitnessGoal;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  effect: string;
}[] = [
  { id: "get_stronger", label: "Get stronger", icon: "barbell-outline", effect: "Heavier work, longer rests" },
  { id: "lose_fat", label: "Lose fat", icon: "flame-outline", effect: "Higher output, shorter rests" },
  { id: "build_muscle", label: "Build muscle", icon: "fitness-outline", effect: "More volume per muscle" },
  { id: "boost_endurance", label: "Boost endurance", icon: "pulse-outline", effect: "Longer, steadier efforts" },
  { id: "move_more", label: "Move more", icon: "walk-outline", effect: "Short sessions you'll keep" },
  { id: "reduce_stress", label: "Reduce stress", icon: "leaf-outline", effect: "Breath-led, low intensity" },
];

const LOCATION_OPTIONS: {
  id: WorkoutLocation;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  effect: string;
}[] = [
  { id: "home", label: "At home", icon: "home-outline", effect: "Bodyweight-first, quiet options" },
  { id: "gym", label: "At the gym", icon: "barbell-outline", effect: "Weights and machines unlocked" },
  { id: "outdoors", label: "Outdoors", icon: "sunny-outline", effect: "Runs, hills, open space" },
  { id: "anywhere", label: "Anywhere", icon: "compass-outline", effect: "We adapt to what you have" },
];

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 75, 90];

/** What a given session length buys you — shown live under the dial. */
function durationCaption(min: number): string {
  if (min <= 10) return "A focused burst — far better than skipping";
  if (min <= 15) return "Warm up, work, done. Easy to defend on a busy day";
  if (min <= 20) return "The length most people actually keep up";
  if (min <= 30) return "Room for a real warm-up and cool-down";
  if (min <= 45) return "Full sessions with proper volume";
  if (min <= 60) return "An hour — enough for strength and conditioning";
  return "Serious training time. We'll build in recovery";
}

const STYLE_OPTIONS: { id: WorkoutStyle; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "strength", label: "Strength", icon: "barbell-outline" },
  { id: "hiit", label: "HIIT", icon: "flash-outline" },
  { id: "cardio", label: "Cardio", icon: "heart-outline" },
  { id: "core", label: "Core", icon: "body-outline" },
  { id: "endurance", label: "Endurance", icon: "infinite-outline" },
  { id: "power", label: "Power", icon: "flame-outline" },
  { id: "mobility", label: "Mobility", icon: "accessibility-outline" },
  { id: "recovery", label: "Recovery", icon: "leaf-outline" },
];

/** Goal → the styles that serve it. Seeds step 3 so the flow feels read. */
const GOAL_STYLES: Record<FitnessGoal, WorkoutStyle[]> = {
  get_stronger: ["strength", "power"],
  lose_fat: ["hiit", "cardio"],
  build_muscle: ["strength", "core"],
  boost_endurance: ["endurance", "cardio"],
  move_more: ["mobility", "cardio"],
  reduce_stress: ["recovery", "mobility"],
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** One-tap rhythms — most people want one of these three. */
const DAY_PRESETS: { label: string; days: number[] }[] = [
  { label: "3 days", days: [0, 2, 4] },
  { label: "Weekdays", days: [0, 1, 2, 3, 4] },
  { label: "Weekends", days: [5, 6] },
];

function daysCaption(count: number): string {
  if (count === 0) return "Pick at least one so your week has a shape";
  if (count <= 2) return "A light rhythm — we'll make each one count";
  if (count <= 4) return "The consistency sweet spot";
  if (count <= 6) return "Ambitious. We'll fold in recovery sessions";
  return "Every day — so some sessions will be easy on purpose";
}

/** 17 → "5pm". The reminder copy must name the hour that will actually fire. */
function hourLabel(hour: number): string {
  const h = Math.min(23, Math.max(0, Math.trunc(hour)));
  if (h === 0) return "midnight";
  if (h === 12) return "midday";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

const STEP_META: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: "flag-outline", title: "What are you training for?", sub: "Pick as many as you like — every recommendation starts here." },
  { icon: "location-outline", title: "Where, and for how long?", sub: "We'll only suggest sessions that fit your real life." },
  { icon: "heart-outline", title: "What do you enjoy?", sub: "Workouts you like are workouts you repeat." },
  { icon: "calendar-outline", title: "Which days work?", sub: "Your calendar and reminders build around these." },
  { icon: "sparkles-outline", title: "Make it yours", sub: "The small things that make a session feel like coaching." },
  { icon: "checkmark-circle-outline", title: "Here's your profile", sub: "Tap anything to change it. You can edit all of this later." },
];

const TOTAL_STEPS = STEP_META.length;

/* ─────────────────────────────── screen ─────────────────────────────── */

export default function FitnessSetupScreen() {
  const { colors } = useColors();
  const { profile, ready, update } = useFitnessProfile();
  const reduced = useReducedMotion();

  const [step, setStep] = useState(0);
  /** +1 forward, -1 back — the step body enters from the side you came from. */
  const [dir, setDir] = useState(1);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [location, setLocation] = useState<WorkoutLocation>("anywhere");
  const [duration, setDuration] = useState(20);
  const [stylesSel, setStylesSel] = useState<WorkoutStyle[]>([]);
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [milestone, setMilestone] = useState("");
  const [workoutReminders, setWorkoutReminders] = useState(false);
  const [saved, setSaved] = useState(false);

  /** Styles are seeded from goals exactly once — never fight a real choice. */
  const seededStyles = useRef(false);

  /**
   * This screen is BOTH first-run setup and the "Edit training preferences"
   * editor (Fitness Settings pushes the same route). As an editor it must open
   * on what's already stored — otherwise Finish writes hardcoded defaults over
   * a real profile. Seeded exactly once, and only for a profile that has been
   * through setup, so a first run still starts on the friendly defaults.
   */
  const seededProfile = useRef(false);
  useEffect(() => {
    if (!ready || seededProfile.current) return;
    seededProfile.current = true;
    if (!profile.setupComplete) return;
    setGoals(profile.goals);
    setLocation(profile.location);
    setDuration(profile.typicalDurationMin);
    setStylesSel(profile.preferredStyles);
    setDays(profile.daysAvailable);
    setMilestone(profile.milestone ?? "");
    setWorkoutReminders(profile.reminders.workouts);
    // Styles are already real choices here — don't let the goal seeder fight them.
    if (profile.preferredStyles.length > 0) seededStyles.current = true;
  }, [ready, profile]);

  const suggestedStyles = useMemo(() => {
    const out = new Set<WorkoutStyle>();
    for (const g of goals) for (const s of GOAL_STYLES[g]) out.add(s);
    return out;
  }, [goals]);

  useEffect(() => {
    if (step !== 2 || seededStyles.current) return;
    seededStyles.current = true;
    if (stylesSel.length === 0 && suggestedStyles.size > 0) {
      setStylesSel([...suggestedStyles]);
    }
  }, [step, stylesSel.length, suggestedStyles]);

  const toggleIn = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const tap = () => Haptics.selectionAsync().catch(() => {});

  /**
   * The reminder hour lives in Fitness Settings; setup never sets it, it only
   * honours whatever is stored (17:00 for a first run). Copy reads from this so
   * the promise on the toggle matches the notification that actually arrives.
   */
  const reminderHour = profile.reminders.hour;

  /**
   * Turning reminders ON asks the OS immediately, and a refusal leaves the
   * toggle OFF. The alternative — accept the tap, discover the denial at Finish,
   * and store `workouts: true` anyway — leaves a switch that reads "on" and can
   * never fire. Turning OFF never prompts.
   */
  const toggleReminders = useCallback(async () => {
    tap();
    if (workoutReminders) {
      setWorkoutReminders(false);
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert(
        "Notifications are off",
        "Turn notifications on for Welliva in your device settings, then switch training-day reminders back on here.",
      );
      return;
    }
    setWorkoutReminders(true);
  }, [workoutReminders]);

  const finish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const chosenDays = [...days].sort((a, b) => a - b);
    const patch: FitnessProfilePatch = {
      setupComplete: true,
      goals,
      location,
      typicalDurationMin: duration,
      preferredStyles: stylesSel,
      daysAvailable: chosenDays,
      milestone: milestone.trim() || undefined,
      // Only the key this screen owns. Hydration, stretch, the weekly summary
      // and the hour are set in Fitness Settings — the store deep-merges, so
      // naming them here (as this once did) would silently wipe them every time
      // someone re-opened "Edit training preferences".
      reminders: { workouts: workoutReminders },
    };
    await update(patch);

    // ALWAYS re-sync, never only when the toggle is on: the schedule also has to
    // be torn down when reminders are switched off, and re-laid when the
    // training days changed underneath an already-on reminder.
    const result = await syncFitnessReminders(await loadFitnessProfile());
    if (workoutReminders && result.status !== "ok") {
      // Opted in but nothing was scheduled — say so rather than let the profile
      // claim a reminder that will never arrive.
      await update({ reminders: { workouts: false } });
      Alert.alert(
        result.status === "no-days" ? "No training days picked" : "Reminders couldn't be set",
        result.status === "no-days"
          ? "Pick at least one training day and we'll nudge you on those days."
          : "Turn notifications on for Welliva in your device settings, then switch reminders on in Fitness Settings.",
      );
    }

    // Land the save before leaving: a flow this long deserves a full stop.
    setSaved(true);
    setTimeout(() => router.back(), 1150);
  }, [goals, location, duration, stylesSel, days, milestone, workoutReminders, update]);

  const goTo = useCallback((target: number, direction: number) => {
    setDir(direction);
    setStep(target);
  }, []);

  const next = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step >= TOTAL_STEPS - 1) void finish();
    else goTo(step + 1, 1);
  }, [step, finish, goTo]);

  const back = useCallback(() => {
    if (step === 0) router.back();
    else goTo(step - 1, -1);
  }, [step, goTo]);

  const meta = STEP_META[step];

  /* ── step bodies ── */

  const bodies: React.ReactNode[] = [
    // 0 — goals
    <View key="goals" style={styles.tileGrid}>
      {GOAL_OPTIONS.map((g, i) => (
        <SelectTile
          key={g.id}
          index={i}
          selected={goals.includes(g.id)}
          label={g.label}
          caption={g.effect}
          icon={g.icon}
          onPress={() => {
            tap();
            setGoals((v) => toggleIn(v, g.id));
          }}
        />
      ))}
    </View>,

    // 1 — location + duration
    <View key="where">
      <GroupLabel>Usual spot</GroupLabel>
      <View style={styles.tileGrid}>
        {LOCATION_OPTIONS.map((l, i) => (
          <SelectTile
            key={l.id}
            index={i}
            selected={location === l.id}
            label={l.label}
            caption={l.effect}
            icon={l.icon}
            onPress={() => {
              tap();
              setLocation(l.id);
            }}
          />
        ))}
      </View>
      <GroupLabel style={styles.groupGap}>Time per session</GroupLabel>
      <DurationDial value={duration} onChange={setDuration} />
    </View>,

    // 2 — styles
    <View key="styles">
      {suggestedStyles.size > 0 && (
        <View style={styles.suggestNote}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <AppText variant="footnote" color="secondary" style={styles.flex}>
            {"Pre-picked from your goals — change anything you don't fancy."}
          </AppText>
        </View>
      )}
      <View style={styles.chipWrap}>
        {STYLE_OPTIONS.map((s, i) => (
          <ChoiceChip
            key={s.id}
            index={i}
            selected={stylesSel.includes(s.id)}
            label={s.label}
            icon={s.icon}
            badge={suggestedStyles.has(s.id) ? "Suggested" : undefined}
            onPress={() => {
              tap();
              setStylesSel((v) => toggleIn(v, s.id));
            }}
          />
        ))}
      </View>
      <LiveCaption
        text={
          stylesSel.length === 0
            ? "Nothing picked — we'll draw from the whole library"
            : `${stylesSel.length} picked · we'll lead with these and still mix it up`
        }
      />
    </View>,

    // 3 — days
    <View key="days">
      <View style={styles.dayRow}>
        {DAY_LETTERS.map((letter, i) => (
          <DayToken
            key={`${letter}-${i}`}
            letter={letter}
            name={DAY_LABELS[i]}
            selected={days.includes(i)}
            onPress={() => {
              tap();
              setDays((v) => toggleIn(v, i));
            }}
          />
        ))}
      </View>
      <View style={styles.presetRow}>
        {DAY_PRESETS.map((p) => {
          const on =
            p.days.length === days.length && p.days.every((d) => days.includes(d));
          return (
            <Pressable
              key={p.label}
              onPress={() => {
                tap();
                setDays(p.days);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Set `}
              style={[
                styles.preset,
                {
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? alpha(colors.primary, 0.12) : "transparent",
                },
              ]}
            >
              <AppText variant="footnote" color={on ? "brand" : "tertiary"} weight="600">
                {p.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <LiveCaption
        text={`${days.length} ${days.length === 1 ? "day" : "days"} · ${daysCaption(days.length)}`}
      />
    </View>,

    // 4 — personalise
    <View key="extras" style={styles.toggleList}>
      <ComingSoonRow
        icon="mic-outline"
        label="Voice guidance"
        sub="Coming soon — spoken cues for sets, rests and what's next"
      />
      <ToggleRow
        icon="notifications-outline"
        label="Training-day reminders"
        sub={
          days.length > 0
            ? `A ${hourLabel(reminderHour)} nudge on ${days.length} ${days.length === 1 ? "day" : "days"} a week`
            : "Pick your training days first — the nudge lands on those"
        }
        value={workoutReminders}
        onToggle={() => void toggleReminders()}
      />
      <GroupLabel style={styles.groupGap}>{"A milestone you're chasing"}</GroupLabel>
      <TextInput
        value={milestone}
        onChangeText={setMilestone}
        placeholder={'e.g. "first full push-up"'}
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: "transparent", borderColor: colors.border },
        ]}
        accessibilityLabel="Milestone"
        returnKeyType="done"
      />
      <AppText variant="footnote" color="tertiary">
        {"Optional — Gozlin will reference it when you're close."}
      </AppText>
    </View>,

    // 5 — review
    <Review
      key="review"
      goals={goals}
      location={location}
      duration={duration}
      stylesSel={stylesSel}
      days={days}
      reminders={workoutReminders}
      reminderHour={reminderHour}
      milestone={milestone}
      onEdit={(target) => goTo(target, target > step ? 1 : -1)}
    />,
  ];

  if (saved) return <SavedCurtain />;

  return (
    <Screen
      bottomInset={Spacing.xxxl}
      header={
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Close setup"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          <StepRail step={step} total={TOTAL_STEPS} />

          {step < TOTAL_STEPS - 1 ? (
            <Pressable
              onPress={next}
              hitSlop={10}
              style={styles.skipBtn}
              accessibilityRole="button"
              accessibilityLabel="Skip this step"
            >
              <AppText variant="footnote" color="tertiary" weight="600">
                Skip
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.skipBtn} />
          )}
        </View>
      }
    >
      {/* Hero: a flat tinted step icon that pops on change. No glow, no aura —
          the motion is the pop and nothing else. */}
      <View style={styles.hero}>
        <Animated.View
          key={`icon-${step}`}
          entering={reduced ? FadeIn.duration(160) : ZoomIn.springify().damping(13).stiffness(170)}
          style={[styles.heroIcon, { backgroundColor: alpha(colors.primary, 0.14) }]}
        >
          <Ionicons name={meta.icon} size={28} color={colors.primary} />
        </Animated.View>
      </View>

      <Animated.View
        key={`head-${step}`}
        entering={reduced ? FadeIn.duration(180) : FadeIn.duration(320).delay(60)}
      >
        <AppText variant="display" align="center" style={styles.title}>
          {meta.title}
        </AppText>
        <AppText variant="body" color="secondary" align="center" style={styles.sub}>
          {meta.sub}
        </AppText>
      </Animated.View>

      <Animated.View
        key={`body-${step}`}
        entering={
          reduced
            ? FadeIn.duration(180)
            : (dir > 0 ? SlideInRight : SlideInLeft)
                .duration(Motion.duration.slow)
                .easing(Easing.bezier(0.05, 0.7, 0.1, 1))
        }
      >
        <View style={styles.body}>{bodies[step]}</View>
      </Animated.View>

      <View style={styles.footer}>
        {step > 0 && (
          <Button label="Back" variant="ghost" fullWidth={false} onPress={back} />
        )}
        <Button
          label={step === TOTAL_STEPS - 1 ? "Start training" : "Continue"}
          icon={step === TOTAL_STEPS - 1 ? "checkmark" : "arrow-forward"}
          iconRight
          size="lg"
          onPress={next}
          accessibilityLabel={
            step === TOTAL_STEPS - 1
              ? "Save profile and start training"
              : `Continue, step ${step + 1} of ${TOTAL_STEPS}`
          }
          style={styles.flex}
        />
      </View>
    </Screen>
  );
}

/* ───────────────────────────── progress rail ───────────────────────────── */

/**
 * Segmented rail instead of dots: dots say "there are five of these", a rail
 * says "you are 60% through". Each segment fills with a spring as it's passed,
 * and the active one keeps a faint pulse so the eye knows where it is.
 */
function StepRail({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.rail} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: step + 1 }}>
      {Array.from({ length: total }).map((_, i) => (
        <RailSegment key={i} state={i < step ? "done" : i === step ? "active" : "todo"} />
      ))}
    </View>
  );
}

/**
 * Segments are equal-width and never animate a LAYOUT property — width/flex
 * would push a layout pass onto every frame of a 60fps animation. Colour, a
 * vertical scale (a transform, so it's free) and an opacity breath say the same
 * three things — done / here / to come — entirely on the UI thread.
 */
function RailSegment({ state }: { state: "done" | "active" | "todo" }) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const fill = useSharedValue(state === "todo" ? 0 : 1);
  const pulse = useSharedValue(state === "active" && !reduced ? 1 : 0);

  useEffect(() => {
    fill.value = withSpring(state === "todo" ? 0 : 1, { damping: 18, stiffness: 180 });
    if (state === "active" && !reduced) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(state === "todo" ? 0 : 1, { duration: 200 });
    }
  }, [state, reduced, fill, pulse]);

  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], [colors.border, colors.primary]),
    opacity: state === "active" ? 0.55 + pulse.value * 0.45 : 1,
    transform: [
      { scaleY: state === "active" ? interpolate(fill.value, [0, 1], [1, 1.75]) : 1 },
    ],
  }));

  return <Animated.View style={[styles.railSeg, barStyle]} />;
}

/* ────────────────────────────── option tiles ────────────────────────────── */

/**
 * A choice that answers back: springs under the finger, warms into the brand
 * tint when chosen, and pops a check. `index` staggers the entrance so a grid
 * assembles itself rather than appearing all at once.
 */
function SelectTile({
  selected,
  label,
  caption,
  icon,
  onPress,
  index = 0,
}: {
  selected: boolean;
  label: string;
  caption?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  index?: number;
}) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    on.value = withSpring(selected ? 1 : 0, { damping: 16, stiffness: 200 });
  }, [selected, on]);

  // Mixed OUTSIDE the worklet: `alpha()` is plain JS, and a worklet can only
  // call functions marked as worklets — reaching for it on the UI thread throws
  // ("Tried to synchronously call a non-worklet function"). Strings capture
  // into the closure just fine, so every colour a worklet needs is premixed.
  const tintOff = alpha(colors.primary, 0);
  const tintOn = alpha(colors.primary, 0.13);
  const iconOff = alpha(colors.primary, 0.07);
  const iconOn = alpha(colors.primary, 0.2);

  const tileStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [tintOff, tintOn]),
    borderColor: interpolateColor(on.value, [0, 1], [colors.border, colors.primary]),
    transform: [{ scale: reduced ? 1 : 1 - press.value * 0.03 + on.value * 0.01 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [iconOff, iconOn]),
  }));

  return (
    <Animated.View
      entering={reduced ? FadeIn.duration(160) : FadeIn.duration(260).delay(index * 45)}
      style={styles.tileWrap}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => (press.value = withTiming(1, { duration: 90 }))}
        onPressOut={() => (press.value = withTiming(0, { duration: 160 }))}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={caption ? `${label}. ${caption}` : label}
      >
        <Animated.View style={[styles.tile, tileStyle]}>
          {icon && (
            <Animated.View style={[styles.tileIcon, iconStyle]}>
              <Ionicons
                name={icon}
                size={19}
                color={selected ? colors.primary : colors.textTertiary}
              />
            </Animated.View>
          )}
          <AppText variant="callout" color={selected ? "brand" : "secondary"} numberOfLines={1}>
            {label}
          </AppText>
          {caption && (
            <AppText variant="caption" color="tertiary" numberOfLines={2} style={styles.tileCaption}>
              {caption}
            </AppText>
          )}
          {selected && (
            <Animated.View
              entering={reduced ? FadeIn.duration(120) : ZoomIn.springify().damping(12).stiffness(220)}
              style={styles.tileCheck}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Pill variant of the same idea, for the style picker. */
function ChoiceChip({
  selected,
  label,
  icon,
  badge,
  onPress,
  index = 0,
}: {
  selected: boolean;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: string;
  onPress: () => void;
  index?: number;
}) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    on.value = withSpring(selected ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [selected, on]);

  // Premixed on the JS side — see the note in SelectTile.
  const tintOff = alpha(colors.primary, 0);
  const tintOn = alpha(colors.primary, 0.14);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [tintOff, tintOn]),
    borderColor: interpolateColor(on.value, [0, 1], [colors.border, colors.primary]),
    transform: [{ scale: reduced ? 1 : 1 - press.value * 0.04 }],
  }));

  return (
    // Half-width so eight chips of wildly different label lengths ("HIIT" vs
    // "Endurance") land in four even rows. Free-flowing wrap left a ragged
    // right edge that read as broken layout rather than a deliberate cloud.
    <Animated.View
      entering={reduced ? FadeIn.duration(150) : FadeIn.duration(240).delay(index * 40)}
      style={styles.chipCell}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => (press.value = withTiming(1, { duration: 90 }))}
        onPressOut={() => (press.value = withTiming(0, { duration: 160 }))}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={badge ? `${label}, ${badge}` : label}
      >
        <Animated.View style={[styles.chip, chipStyle]}>
          {icon && (
            <Ionicons
              name={icon}
              size={15}
              color={selected ? colors.primary : colors.textTertiary}
            />
          )}
          <AppText
            variant="callout"
            color={selected ? "brand" : "secondary"}
            numberOfLines={1}
            style={styles.flex}
          >
            {label}
          </AppText>
          {badge && !selected && (
            <View style={[styles.chipBadge, { backgroundColor: alpha(colors.primary, 0.16) }]}>
              <AppText variant="caption" color="brand">
                ★
              </AppText>
            </View>
          )}
          {selected && <Ionicons name="checkmark" size={15} color={colors.primary} />}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * A weekday token that fills solid when chosen.
 *
 * It used to clip a LinearGradient inside a round `overflow: hidden` parent.
 * Android does not antialias that clip, so the circle came out visibly jagged —
 * and a transparent border over the clipped fill left a ragged ring on top of
 * it. One animated background colour on one view has no clip to alias, so the
 * circle is as smooth as the renderer can draw. The border stays a real colour
 * at a constant width, so nothing reflows when it's picked.
 */
function DayToken({
  letter,
  name,
  selected,
  onPress,
}: {
  letter: string;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.value = withSpring(selected ? 1 : 0, { damping: 15, stiffness: 220 });
  }, [selected, on]);

  // Premixed off the UI thread — worklets can't call `alpha()`. Fading from a
  // ZERO-ALPHA PRIMARY (not "transparent") keeps the midpoints in the brand
  // hue; interpolating out of rgba(0,0,0,0) greys the fill on the way in.
  const fillOff = alpha(colors.primary, 0);

  const tokenStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [fillOff, colors.primary]),
    borderColor: interpolateColor(on.value, [0, 1], [colors.border, colors.primary]),
    transform: [{ scale: reduced ? 1 : interpolate(on.value, [0, 1], [1, 1.05]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      style={styles.dayPress}
    >
      <Animated.View style={[styles.dayToken, tokenStyle]}>
        <AppText
          variant="callout"
          weight="700"
          style={{ color: selected ? "#FFFFFF" : colors.textSecondary }}
        >
          {letter}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

/* ───────────────────────────── duration dial ───────────────────────────── */

const DIAL_ITEM = 76;

/**
 * A snapping dial rather than eight identical tiles. The centred value scales
 * up and the neighbours fade back, so choosing a length feels like turning
 * something — and the big number + caption above it change as you turn.
 */
function DurationDial({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [width, setWidth] = useState(0);
  const scrollX = useSharedValue(DURATION_OPTIONS.indexOf(value) * DIAL_ITEM);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // Seat the dial on the current value once we know how wide the stage is.
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    const i = Math.max(0, DURATION_OPTIONS.indexOf(value));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: i * DIAL_ITEM, animated: false }));
  };

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / DIAL_ITEM);
    const picked = DURATION_OPTIONS[Math.min(DURATION_OPTIONS.length - 1, Math.max(0, i))];
    if (picked !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(picked);
    }
  };

  const pad = Math.max(0, (width - DIAL_ITEM) / 2);

  return (
    <View onLayout={onLayout}>
      <View style={styles.dialReadout}>
        <RollingNumber value={value} textStyle={styles.dialNumber} />
        <AppText variant="callout" color="tertiary" style={styles.dialUnit}>
          min
        </AppText>
      </View>
      <LiveCaption text={durationCaption(value)} align="center" />

      <View style={styles.dialStage}>
        {/* The seat: a fixed frame the chosen value settles into. */}
        <View
          pointerEvents="none"
          style={[styles.dialSeat, { borderColor: colors.primary, backgroundColor: alpha(colors.primary, 0.1) }]}
        />
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={DIAL_ITEM}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={settle}
          contentContainerStyle={{ paddingHorizontal: pad }}
        >
          {DURATION_OPTIONS.map((min, i) => (
            <DialItem
              key={min}
              min={min}
              index={i}
              scrollX={scrollX}
              reduced={reduced}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(min);
                scrollRef.current?.scrollTo({ x: i * DIAL_ITEM, animated: true });
              }}
            />
          ))}
        </Animated.ScrollView>
      </View>
    </View>
  );
}

function DialItem({
  min,
  index,
  scrollX,
  reduced,
  onPress,
}: {
  min: number;
  index: number;
  scrollX: { value: number };
  reduced: boolean;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const distance = useDerivedValue(() => Math.abs(scrollX.value - index * DIAL_ITEM));

  const itemStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: reduced ? 1 : interpolate(distance.value, [0, DIAL_ITEM, DIAL_ITEM * 2], [1.12, 0.88, 0.82], "clamp") },
    ],
    opacity: interpolate(distance.value, [0, DIAL_ITEM, DIAL_ITEM * 2], [1, 0.5, 0.28], "clamp"),
  }));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${min} minutes`}>
      <Animated.View style={[styles.dialItem, itemStyle]}>
        <AppText variant="title" weight="700" style={{ color: colors.text }}>
          {min}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

/* ──────────────────────────────── toggles ──────────────────────────────── */

/** A real switch — track and knob, spring-driven — not a checkmark icon. */
function ToggleRow({
  icon,
  label,
  sub,
  value,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  value: boolean;
  onToggle: () => void;
}) {
  const { colors } = useColors();
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    on.value = withSpring(value ? 1 : 0, { damping: 17, stiffness: 260 });
  }, [value, on]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.surfaceMuted, colors.primary]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(on.value, [0, 1], [2, 22]) }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={sub}
    >
      <View style={[styles.toggleIcon, { backgroundColor: alpha(colors.primary, value ? 0.16 : 0.08) }]}>
        <Ionicons name={icon} size={18} color={value ? colors.primary : colors.textTertiary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="callout">{label}</AppText>
        <AppText variant="footnote" color="tertiary">
          {sub}
        </AppText>
      </View>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * A row for a feature that is announced but not built yet — dimmed, inert, and
 * with NO switch at all. A disabled-looking switch still invites a tap and
 * still implies the feature is one tap away; the absence of one, plus a
 * "Soon" pill, says the honest thing. Excluded from the accessibility tree's
 * controls (it's static text, not a switch) so a screen reader doesn't offer to
 * toggle something that can't move.
 */
function ComingSoonRow({
  icon,
  label,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
}) {
  const { colors } = useColors();

  return (
    <View
      style={[styles.toggleRow, styles.comingSoonRow]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}. ${sub}`}
    >
      <View style={[styles.toggleIcon, { backgroundColor: alpha(colors.textTertiary, 0.08) }]}>
        <Ionicons name={icon} size={18} color={colors.textTertiary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="callout" color="tertiary">
          {label}
        </AppText>
        <AppText variant="footnote" color="tertiary">
          {sub}
        </AppText>
      </View>
      <View style={[styles.soonPill, { borderColor: colors.border }]}>
        <AppText variant="caption" color="tertiary" weight="600">
          Soon
        </AppText>
      </View>
    </View>
  );
}

/* ──────────────────────────────── review ──────────────────────────────── */

/** The profile played back, every line a doorway to the step that set it. */
function Review({
  goals,
  location,
  duration,
  stylesSel,
  days,
  reminders,
  reminderHour,
  milestone,
  onEdit,
}: {
  goals: FitnessGoal[];
  location: WorkoutLocation;
  duration: number;
  stylesSel: WorkoutStyle[];
  days: number[];
  reminders: boolean;
  reminderHour: number;
  milestone: string;
  onEdit: (step: number) => void;
}) {
  const { colors } = useColors();
  const labelOf = <T extends string>(list: { id: T; label: string }[], ids: T[]) =>
    ids.map((id) => list.find((o) => o.id === id)?.label).filter(Boolean).join(" · ");

  const extras = reminders ? `Reminders at ${hourLabel(reminderHour)}` : null;

  const rows: { step: number; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    {
      step: 0,
      icon: "flag-outline",
      label: "Training for",
      value: goals.length ? labelOf(GOAL_OPTIONS, goals) : "Anything — we'll suggest a mix",
    },
    {
      step: 1,
      icon: "location-outline",
      label: "Where",
      value: LOCATION_OPTIONS.find((l) => l.id === location)?.label ?? "Anywhere",
    },
    { step: 1, icon: "time-outline", label: "Session length", value: `${duration} minutes` },
    {
      step: 2,
      icon: "heart-outline",
      label: "Styles",
      value: stylesSel.length ? labelOf(STYLE_OPTIONS, stylesSel) : "The whole library",
    },
    {
      step: 3,
      icon: "calendar-outline",
      label: "Training days",
      value: days.length
        ? [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(" · ")
        : "Not set yet",
    },
    {
      step: 4,
      icon: "sparkles-outline",
      label: "Extras",
      value:
        [extras, milestone.trim()].filter(Boolean).join(" · ") || "None — that's fine too",
    },
  ];

  return (
    <View>
      <View style={styles.reviewHead}>
        <View style={styles.reviewStat}>
          <AppText variant="metric" style={styles.reviewNum}>
            {days.length}
          </AppText>
          <AppText variant="caption" color="tertiary" uppercase>
            days a week
          </AppText>
        </View>
        <View style={[styles.reviewDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.reviewStat}>
          <AppText variant="metric" style={styles.reviewNum}>
            {duration}
          </AppText>
          <AppText variant="caption" color="tertiary" uppercase>
            minutes each
          </AppText>
        </View>
        <View style={[styles.reviewDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.reviewStat}>
          <AppText variant="metric" style={styles.reviewNum}>
            {days.length * duration}
          </AppText>
          <AppText variant="caption" color="tertiary" uppercase>
            min weekly
          </AppText>
        </View>
      </View>

      {rows.map((r, i) => (
        <Animated.View key={`${r.label}-${i}`} entering={FadeIn.duration(240).delay(i * 55)}>
          <Pressable
            onPress={() => onEdit(r.step)}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}: ${r.value}. Tap to change.`}
            style={[styles.reviewRow, { borderTopColor: colors.divider }]}
          >
            <Ionicons name={r.icon} size={17} color={colors.textTertiary} />
            <View style={styles.flex}>
              <AppText variant="caption" color="tertiary" uppercase>
                {r.label}
              </AppText>
              <AppText variant="callout" numberOfLines={2}>
                {r.value}
              </AppText>
            </View>
            <Ionicons name="pencil" size={14} color={colors.textTertiary} />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

/* ─────────────────────────────── saved state ─────────────────────────────── */

/** The full stop: a check that lands, then back to the dashboard. */
function SavedCurtain() {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  return (
    <Screen scroll={false} bottomInset={0}>
      <View style={styles.curtain}>
        <Animated.View
          entering={reduced ? FadeIn.duration(200) : ZoomIn.springify().damping(12).stiffness(150)}
          style={[styles.curtainBadge, { backgroundColor: alpha(colors.primary, 0.16) }]}
        >
          <Ionicons name="checkmark" size={40} color={colors.primary} />
        </Animated.View>
        <Animated.View entering={FadeIn.duration(300).delay(140)}>
          <AppText variant="title" align="center" style={styles.curtainTitle}>
            Your profile is set
          </AppText>
          <AppText variant="body" color="secondary" align="center">
            {"Today's recommendation is already rebuilding around it."}
          </AppText>
        </Animated.View>
      </View>
    </Screen>
  );
}

/* ──────────────────────────────── small bits ──────────────────────────────── */

function GroupLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <AppText variant="caption" color="tertiary" uppercase style={[styles.groupLabel, style]}>
      {children}
    </AppText>
  );
}

/** A line that rewrites itself as choices change — the flow talking back. */
function LiveCaption({ text, align = "left" }: { text: string; align?: "left" | "center" }) {
  return (
    <Animated.View key={text} entering={FadeIn.duration(240)} style={styles.liveCaption}>
      <AppText variant="footnote" color="secondary" align={align}>
        {text}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  skipBtn: { minWidth: 32, alignItems: "flex-end" },

  rail: { flex: 1, flexDirection: "row", gap: 5, alignItems: "center" },
  railSeg: { flex: 1, height: 4, borderRadius: 2 },

  hero: { alignItems: "center", justifyContent: "center", height: 96, marginTop: Spacing.sm },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  title: { marginTop: Spacing.md },
  sub: { marginTop: Spacing.xs, marginBottom: Spacing.xl },
  body: { marginBottom: Spacing.xl },

  tileGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: Spacing.sm },
  tileWrap: { width: "48.5%" },
  tile: {
    minHeight: 108,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: 6,
    justifyContent: "center",
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tileCaption: { marginTop: -2 },
  tileCheck: { position: "absolute", top: Spacing.sm, right: Spacing.sm },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.sm,
  },
  /** Half-width cells: eight chips, four even rows, no ragged edge. */
  chipCell: { width: "48.5%" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    minHeight: 46,
  },
  chipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  suggestNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  dayRow: { flexDirection: "row", justifyContent: "space-between" },
  dayPress: { flex: 1, alignItems: "center" },
  dayToken: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  presetRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  preset: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  dialReadout: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 4 },
  dialNumber: { fontSize: 40, lineHeight: 48, fontWeight: "800" },
  dialUnit: { marginBottom: 4 },
  dialStage: { height: 64, justifyContent: "center", marginTop: Spacing.sm },
  dialSeat: {
    position: "absolute",
    alignSelf: "center",
    width: DIAL_ITEM - 12,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  dialItem: { width: DIAL_ITEM, height: 52, alignItems: "center", justifyContent: "center" },

  groupLabel: { marginBottom: Spacing.sm },
  groupGap: { marginTop: Spacing.xl },
  liveCaption: { marginTop: Spacing.md },

  toggleList: { gap: Spacing.sm },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  track: { width: 46, height: 26, borderRadius: 13, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF" },
  /** Dimmed back so an unbuilt feature reads as inert next to a live toggle. */
  comingSoonRow: { opacity: 0.55 },
  soonPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },

  reviewHead: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg },
  reviewStat: { flex: 1, alignItems: "center", gap: 2 },
  reviewNum: { fontVariant: ["tabular-nums"] },
  reviewDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  curtain: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg },
  curtainBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  curtainTitle: { marginBottom: Spacing.xs },

  footer: { flexDirection: "row", gap: Spacing.md, alignItems: "center" },
});
