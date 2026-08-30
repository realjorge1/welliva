/**
 * THE ACTION BAR — one floating capsule at the screen base, two halves.
 *
 *   ╭──────────────────────────────────────────────────╮
 *   │ ╭──────────────────────────────────────╮  ╭────╮ │
 *   │ │  ▶  Start Push Day        ~42 min    │  │ +  │ │
 *   │ ╰──────────────────────────────────────╯  ╰────╯ │
 *   ╰──────────────────────────────────────────────────╯
 *        THE NEXT MOVE (contextual)          QUICK LOG (fixed)
 *
 * WHY IT EXISTS. The swipe menu is a good answer to "where else can I go" and
 * no answer at all to "what do I do now" — so a first-run user lands on a
 * dashboard of numbers with nothing asking for a decision, and an experienced
 * one pays a swipe plus three taps to log a meal. Those are two different
 * problems, which is why this control has two halves rather than one.
 *
 *   · LEFT is contextual and labelled. It names a verb and a noun, derived from
 *     today's real state by `resolveNextMove` — never a generic "Get started".
 *     At 8am it reads "Log breakfast"; at 6pm the same control reads "Start
 *     Push Day". That's the whole premium effect, and it costs a priority
 *     ladder over state the screens already compute.
 *   · RIGHT is fixed forever, so muscle memory has somewhere to live. It opens
 *     the quick-log sheet, which doubles as the app's capability map — five
 *     verbs on one surface is the fastest honest answer to "what does this do".
 *
 * NOT A TAB BAR. Two labelled destinations at the screen base would rebuild the
 * bar this app deliberately deleted and set up a second navigation system to
 * compete with the drawer for authority. Neither half here is a destination:
 * one does today's next thing, the other opens a sheet.
 *
 * IT LIVES INSIDE THE PAGE, NOT OVER THE APP. Mounted through `Screen`'s
 * `footer` slot (or as a child of a hand-rolled screen's own root), so it rides
 * the drawer's translate/scale with the content it belongs to. Hoisting it
 * above the drawer would leave it hanging in mid-air over the open menu.
 */

import { enterFade, exitFade, settleLayout } from "@/components/motion";
import {
  CheckinModal,
  GozlinActionSheet,
  WeighInModal,
  useOpenThread,
  useQuickLog,
  type ActionSheetOption,
} from "@/components/gozlin";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useNutrition, useProfile, useSystem, useWorkout } from "@/contexts/AppContext";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import type { WorkoutSession } from "@/models/workout";
import type { SessionState } from "@/models/session";
import { SessionService } from "@/services/SessionService";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveNextMove, WATER_TAP_ML, type MealSlot } from "./nextMove";

const sessionService = SessionService.getInstance();

/** Inner control height. The tray is this plus its own padding, top and bottom. */
const CONTROL = 52;
/** Breathing room between the tray and the device's home indicator. */
const BASE_GAP = Spacing.sm;

/* ───────────────────────────── the state ──────────────────────────────── */

/**
 * Everything the ladder needs, gathered once.
 *
 * It reads four context slices, and that's deliberate rather than sloppy: the
 * bar's whole claim is that it knows the state of the day, and the day is
 * spread across diet, training, profile and the clock. The slices are the same
 * ones the host screens already subscribe to, so on Home, Diet and Fitness this
 * costs no additional re-render — see the AppContext split.
 */
function useNextMove(currentHref: string | null, checkedInToday: boolean) {
  const { todayDiet, consumedNutrition, addWater } = useNutrition();
  const { userGoals, nutritionTargets, bodyLogs } = useProfile();
  const { workoutPlan, workoutLog } = useWorkout();
  const { currentDate } = useSystem();
  const { profile, ready: profileReady } = useFitnessProfile();

  /**
   * Re-derived on the minute rather than on render alone. Without this the bar
   * would keep saying "Log breakfast" at two in the afternoon on a screen left
   * open — the one failure that would prove it does NOT know what time it is.
   */
  const [minutesOfDay, setMinutesOfDay] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setMinutesOfDay(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  /**
   * A coach conversation left mid-exchange. Re-read on the same minute tick the
   * clock above runs on, and on every navigation — walking off the coach screen
   * is precisely when a thread becomes one you left.
   */
  const openConversation = useOpenThread(minutesOfDay);

  // A guided session abandoned mid-flight. Same liveness test the Fitness
  // screen's resume card uses — a stale or finished session is not resumable.
  const [savedSession, setSavedSession] = useState<SessionState | null>(null);
  useEffect(() => {
    let mounted = true;
    void sessionService.loadSession().then((s) => {
      if (!mounted) return;
      const isLive =
        !!s &&
        s.phase !== "COMPLETE" &&
        s.phase !== "SUMMARY" &&
        s.exercises.length > 0 &&
        s.startedAt.slice(0, 10) === currentDate;
      setSavedSession(isLive ? s : null);
    });
    return () => {
      mounted = false;
    };
  }, [currentDate, workoutLog.length]);

  const todayDayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const todaySession: WorkoutSession | null = useMemo(
    () => workoutPlan?.sessions.find((s) => s.dayOfWeek === todayDayIndex) ?? null,
    [workoutPlan, todayDayIndex],
  );

  // Only ever used for the finished-day preview, so a rest day correctly
  // yields null and the caption falls back to "See your record".
  const tomorrowFocus = useMemo(() => {
    const next = (todayDayIndex + 1) % 7;
    const s = workoutPlan?.sessions.find((x) => x.dayOfWeek === next);
    return s && !s.isRestDay ? s.focus : null;
  }, [workoutPlan, todayDayIndex]);

  /**
   * The three timed slots, in slot order. Snacks are excluded on purpose — they
   * have no hour, so they can never be "due" and would only add noise.
   */
  const meals = useMemo<MealSlot[]>(() => {
    const s = todayDiet?.schedule;
    if (!s) return [];
    const slots: [MealSlot["type"], typeof s.breakfast][] = [
      ["breakfast", s.breakfast],
      ["lunch", s.lunch],
      ["dinner", s.dinner],
    ];
    return slots
      .filter((entry): entry is [MealSlot["type"], NonNullable<typeof entry[1]>] =>
        entry[1] != null,
      )
      .map(([type, m]) => ({ type, name: m.name, consumed: m.isConsumed }));
  }, [todayDiet]);

  const waterGoalMl = userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? 2500;

  /**
   * Whole days since the most recent body log, or null if there has never been
   * one. Computed off the date strings rather than timestamps so it counts
   * calendar days the way the user does — a weigh-in last night and one this
   * morning is one day apart, not zero.
   */
  const daysSinceWeighIn = useMemo(() => {
    const latest = [...(bodyLogs ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (!latest?.date) return null;
    const ms = Date.parse(`${currentDate}T00:00:00`) - Date.parse(`${latest.date}T00:00:00`);
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.round(ms / 86_400_000));
  }, [bodyLogs, currentDate]);

  // Only meaningful with a plan: the generator emits training days ONLY, so a
  // missing session on a real plan means rest, not a hole in the schedule.
  const isRestDay = !!workoutPlan && (!todaySession || !!todaySession.isRestDay);

  const move = useMemo(
    () =>
      resolveNextMove({
        minutesOfDay,
        savedSession: savedSession
          ? {
              label: savedSession.sessionLabel,
              index: savedSession.currentExerciseIndex,
              total: savedSession.exercises.length,
            }
          : null,
        meals,
        hasScheduledDiet: !!todayDiet?.hasScheduledDiet,
        todaySession:
          todaySession && !todaySession.isRestDay
            ? {
                focus: todaySession.focus,
                minutes: todaySession.totalDurationMinutes,
              }
            : null,
        hasPlan: !!workoutPlan,
        workoutDoneToday: workoutLog.some((l) => l.date === currentDate),
        isRestDay,
        // Until the stored profile has been read, assume setup is done: a bar
        // that flashes "Personalize training" for one frame on every cold start
        // and then swaps is worse than one that arrives a beat late.
        setupComplete: profileReady ? profile.setupComplete : true,
        checkedInToday,
        daysSinceWeighIn,
        openConversation,
        waterMl: consumedNutrition.waterMl,
        waterGoalMl,
        tomorrowFocus,
        currentHref,
      }),
    [
      currentHref,
      minutesOfDay,
      savedSession,
      meals,
      todayDiet?.hasScheduledDiet,
      todaySession,
      workoutPlan,
      workoutLog,
      currentDate,
      isRestDay,
      profileReady,
      profile.setupComplete,
      checkedInToday,
      daysSinceWeighIn,
      openConversation,
      consumedNutrition.waterMl,
      waterGoalMl,
      tomorrowFocus,
    ],
  );

  return {
    move,
    todaySession,
    addWater,
    waterMl: consumedNutrition.waterMl,
    waterGoalMl,
  };
}

/* ────────────────────────────── the control ───────────────────────────── */

export interface ActionBarProps {
  /**
   * Hide the bar entirely — for a screen that temporarily owns its own bottom
   * edge. It is NOT the way to opt a screen out permanently; simply don't mount
   * it there.
   */
  hidden?: boolean;
}

export function ActionBar({ hidden }: ActionBarProps) {
  const { colors, isDark } = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The live path, so the ladder can skip a move that would only navigate to
  // the screen already on show — see `currentHref` in nextMove.ts.
  const pathname = usePathname();
  const quickLog = useQuickLog();
  const { move, todaySession, addWater, waterMl, waterGoalMl } = useNextMove(
    pathname ?? null,
    quickLog.todayCheckin != null,
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [weighInOpen, setWeighInOpen] = useState(false);

  /**
   * A one-line confirmation shown ABOVE the tray, for writes that change
   * nothing else on the screen you're standing on.
   *
   * IT IS LOCAL, AND NOT `GozlinToast`, FOR A CONCRETE REASON. That toast is
   * `position: absolute; top: …`, and everything this component renders sits
   * inside `Screen`'s footer — a ZERO-HEIGHT box pinned to the bottom edge. A
   * top-anchored child of that box lands below the bottom of the screen, so the
   * water confirmation was drawn perfectly and never once visible, which is
   * exactly what "water logging doesn't work" looked like from the outside.
   * Anchoring the confirmation to the bar means it cannot be mispositioned by
   * whatever container the bar is docked in — and it appears where the finger
   * and the eye already are, which beats the top of the screen anyway.
   */
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useCallback((message: string) => {
    setConfirmation(message);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmation(null), 1900);
  }, []);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  /**
   * Work parked until the quick-log sheet has actually unmounted.
   *
   * ONLY THE ROWS THAT OPEN ANOTHER MODAL USE THIS. The sheet is a `Modal`, and
   * React Native silently refuses to present a second Modal over a live one —
   * that's what made weigh-in and check-in look dead. Navigation and writes
   * have no such constraint, so they run on the tap: routing everything through
   * the queue made those rows depend on the close animation completing for no
   * reason at all, which is a failure mode bought for nothing.
   */
  const pending = useRef<(() => void) | null>(null);
  const queue = useCallback((fn: () => void) => {
    pending.current = fn;
  }, []);
  const runQueued = useCallback(() => {
    const fn = pending.current;
    pending.current = null;
    // Null on a dismissal — scrim, back or drag — which must do nothing.
    fn?.();
  }, []);

  /**
   * The player's launch contract, unchanged — the same parallel id/set/rep
   * lists the Fitness screen's own start button builds. Shared by the Next
   * Move's `startSession` and the sheet's workout row so the two can't drift.
   */
  const startTodaySession = useCallback(() => {
    if (!todaySession) return;
    router.push({
      pathname: "/guided-session",
      params: {
        exerciseIds: todaySession.exercises.map((e) => e.exerciseId).join(","),
        sessionLabel: todaySession.dayLabel,
        workoutSessionId: todaySession.id,
        sets: todaySession.exercises.map((e) => e.sets).join(","),
        reps: todaySession.exercises.map((e) => e.reps).join(","),
      },
    });
  }, [todaySession, router]);

  const runMove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const action = move.action;
    switch (action.kind) {
      case "resume":
        router.push({ pathname: "/guided-session", params: { resume: "1" } });
        return;
      case "startSession":
        startTodaySession();
        return;
      // A menu destination is a root screen: switch to it, never push, or the
      // hamburger grows a back stack behind it.
      case "route":
        router.navigate(action.href as never);
        return;
      case "push":
        router.push(action.href as never);
        return;
      case "water":
        addWater(action.ml);
        confirm(`${action.ml} ml logged`);
        return;
      // Nothing is open over these, so they present immediately — the queue is
      // only needed for a row picked from inside the sheet.
      case "checkin":
        setCheckinOpen(true);
        return;
      case "weighin":
        setWeighInOpen(true);
        return;
    }
  }, [move, router, addWater, startTodaySession, confirm]);

  /**
   * The fixed half — always these five rows, in this order, on every screen.
   *
   * THE LIST DOES NOT CHANGE WITH THE SCREEN. An earlier version dropped the
   * meal row on Diet and the workout row on Fitness, on the theory that a row
   * leading to the screen you're on is dead weight. In the hand it read as the
   * sheet being broken — the rows you'd learned were simply missing, and the
   * remaining ones looked unresponsive by association. This sheet's second job
   * is to BE the map of what the app can record, and a map that hides the
   * region you're standing in is not a map.
   *
   * So every row goes somewhere it can do its job from anywhere:
   *   · a meal opens the food logger, not the Diet dashboard — the dashboard is
   *     where you'd land and still have to find the thing you meant
   *   · a workout starts today's session outright when the plan has one
   *   · water writes on the spot and says so
   */
  const quickOptions = useMemo<ActionSheetOption[]>(
    () => [
      {
        key: "meal",
        label: "Log a meal",
        caption: "Describe it or snap a photo",
        icon: "restaurant-outline",
        navigates: true,
        onPress: () => router.push("/diet/log-food" as never),
      },
      {
        key: "water",
        label: "Log water",
        caption: `Add a ${WATER_TAP_ML} ml glass`,
        icon: "water-outline",
        tone: colors.water,
        // The running total, so the row proves it counted even after the sheet
        // has gone — and shows the number it is about to move.
        badge: `${(waterMl / 1000).toFixed(1)} / ${(waterGoalMl / 1000).toFixed(1)} L`,
        onPress: () => {
          addWater(WATER_TAP_ML);
          confirm(`${WATER_TAP_ML} ml logged`);
        },
      },
      {
        key: "workout",
        label: todaySession ? `Start ${todaySession.focus}` : "Start a workout",
        caption: todaySession
          ? `Today's session · ~${todaySession.totalDurationMinutes} min`
          : "Browse and pick one",
        icon: "barbell-outline",
        tone: colors.protein,
        navigates: true,
        onPress: () =>
          todaySession ? startTodaySession() : router.navigate("/exercise" as never),
      },
      // These two, and only these two, must wait for the sheet's Modal to go.
      {
        key: "weighin",
        label: "Log a weigh-in",
        caption: "Weight, waist & goal",
        icon: "scale-outline",
        tone: colors.fat,
        onPress: () => queue(() => setWeighInOpen(true)),
      },
      {
        key: "checkin",
        label: quickLog.todayCheckin ? "Update today's check-in" : "Check in",
        caption: "Mood, energy, stress & sleep",
        icon: "sunny-outline",
        tone: colors.calories,
        onPress: () => queue(() => setCheckinOpen(true)),
      },
    ],
    [
      router,
      addWater,
      colors,
      quickLog.todayCheckin,
      todaySession,
      startTodaySession,
      queue,
      confirm,
      waterMl,
      waterGoalMl,
    ],
  );

  if (hidden) return null;

  const primary = move.tone === "primary";
  /**
   * "Start here" appears exactly while there is nothing set up — it is derived
   * from the rung, not from a stored "seen it" flag. Building a plan removes
   * the condition, so the hint retires itself and can never come back to haunt
   * an established account. That's the whole first-run coach mark, with no
   * overlay, no tooltip and nothing to dismiss.
   */
  const showIntro = move.id === "build-plan";

  return (
    <>
      {/* NO ENTRANCE ANIMATION. The bar used to zoom in on a spring, and it
          replayed on every screen switch — the drawer swaps root screens, so
          the bar remounts each time and bounced on arrival. A fixture that
          re-announces itself every time you navigate reads as a notification,
          not as furniture. It's simply there. */}
      <View
        style={[styles.dock, { paddingBottom: insets.bottom + BASE_GAP }]}
        pointerEvents="box-none"
      >
        {showIntro && !confirmation && (
          <Animated.View entering={enterFade()} style={styles.introWrap}>
            <View
              style={[styles.intro, { backgroundColor: alpha(colors.primary, 0.16) }]}
            >
              <AppText variant="caption" weight="700" color="brand" uppercase>
                Start here
              </AppText>
            </View>
          </Animated.View>
        )}

        {/* Sits in the flow directly above the tray, so it can't be positioned
            off-screen by whatever container the bar happens to be docked in. */}
        {confirmation && (
          <Animated.View
            entering={enterFade()}
            exiting={exitFade()}
            style={styles.introWrap}
          >
            <View
              style={[
                styles.confirm,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <AppText variant="caption" weight="700" numberOfLines={1}>
                {confirmation}
              </AppText>
            </View>
          </Animated.View>
        )}

        <BlurView
          intensity={isDark ? 40 : 60}
          tint={isDark ? "dark" : "light"}
          style={[
            styles.tray,
            {
              backgroundColor: alpha(colors.surface, isDark ? 0.72 : 0.82),
              borderColor: colors.border,
            },
          ]}
        >
          {/* ── The next move ── */}
          <Pressable
            onPress={runMove}
            accessibilityRole="button"
            accessibilityLabel={
              move.caption ? `${move.label}. ${move.caption}` : move.label
            }
            style={({ pressed }) => [
              styles.primary,
              !primary && {
                backgroundColor: alpha(colors.text, 0.06),
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            {primary && (
              <LinearGradient
                colors={colors.brandGradient as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}

            {/* Keyed on the rung so the label crossfades when the day moves on
                — the bar changing its mind must read as a thought, not a pop.
                The row settles its own width so a long label doesn't snap. */}
            <Animated.View
              key={move.id}
              entering={enterFade()}
              exiting={exitFade()}
              layout={settleLayout()}
              style={styles.primaryRow}
            >
              <Ionicons
                name={move.icon}
                size={19}
                color={primary ? colors.onPrimary : colors.text}
              />
              <AppText
                variant="callout"
                weight="700"
                numberOfLines={1}
                style={[styles.flex, primary && { color: colors.onPrimary }]}
              >
                {move.label}
              </AppText>
              {move.caption ? (
                <AppText
                  variant="footnote"
                  numberOfLines={1}
                  color={primary ? undefined : "tertiary"}
                  style={primary ? { color: alpha(colors.onPrimary, 0.75) } : undefined}
                >
                  {move.caption}
                </AppText>
              ) : null}
            </Animated.View>
          </Pressable>

          {/* ── Quick log: fixed forever, so muscle memory has a home ── */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setSheetOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Quick log"
            accessibilityHint="Log a meal, water, a workout, a weigh-in or a check-in"
            style={({ pressed }) => [
              styles.quick,
              {
                backgroundColor: alpha(colors.text, 0.07),
                borderColor: colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={24} color={colors.text} />
          </Pressable>
        </BlurView>
      </View>

      <GozlinActionSheet
        visible={sheetOpen}
        title="Quick log"
        subtitle="Everything Welliva keeps track of, in one place."
        options={quickOptions}
        onClose={() => setSheetOpen(false)}
        // The picked row runs HERE, not on the tap — see `pending` above.
        onClosed={runQueued}
      />

      <CheckinModal
        visible={checkinOpen}
        existing={quickLog.todayCheckin}
        onClose={() => setCheckinOpen(false)}
        onSave={quickLog.saveCheckin}
      />

      <WeighInModal
        visible={weighInOpen}
        currentWeightKg={quickLog.currentWeightKg}
        goalWeightKg={quickLog.goalWeightKg}
        onClose={() => setWeighInOpen(false)}
        onSave={quickLog.saveWeighIn}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.screen,
  },

  introWrap: { alignItems: "center", marginBottom: Spacing.sm },
  intro: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  confirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "92%",
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },

  // A glass tray holding two solid controls, rather than one slab split by a
  // line: the padding is what makes the primary read as a button sitting IN
  // something, which is what keeps it from looking like a docked toolbar.
  tray: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
    padding: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    // Android's BlurView degrades to a plain view on older versions, so the
    // tray's own translucent fill has to carry the separation there by itself —
    // which is why the background and the hairline are set explicitly and not
    // left to the blur.
    overflow: "hidden",
  },

  primary: {
    flex: 1,
    height: CONTROL,
    borderRadius: Radius.pill,
    overflow: "hidden",
    justifyContent: "center",
  },
  primaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },

  quick: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
});
