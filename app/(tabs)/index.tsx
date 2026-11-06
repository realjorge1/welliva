/**
 * HOME — the daily dashboard.
 * The calorie hero and the three macro cards (black, edge-drawn — see
 * components/home/CalorieHero and MacroTile), today's plan, the hydration log,
 * "Your week" (the streak and the last seven days in ONE card —
 * components/home/WeekTable), the check-in and fitness cards, and a coaching
 * carousel — all on the welliva design system.
 */

import { Hydration } from "@/components/hydration";
import AILogoIcon from "@/components/gozlin/AILogoIcon";
import {
  AppText,
  AscendingMeter,
  Card,
  IconBadge,
  Pill,
  Reveal,
  Screen,
  SectionHeader,
  useColors,
  type MeterGlyphName,
} from "@/components/ui";
import {
  GozlinButton,
  useGozlinMoments,
  useHabitReport,
  useRetiredBeat,
} from "@/components/gozlin";
import { ScreenTopBar } from "@/components/navigation";
import { SyncStatusPill } from "@/components/sync/SyncStatusPill";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { CoachDeepDive } from "@/components/home/CoachDeepDive";
import { CycleHomeCard, CycleOfferCard } from "@/components/cycle";
import { CalorieHero } from "@/components/home/CalorieHero";
import { CheckInBar } from "@/components/home/CheckInBar";
import { FitnessTile } from "@/components/home/FitnessTile";
import { MacroTile } from "@/components/home/MacroTile";
import { NudgeCard } from "@/components/home/NudgeCard";
import { AnchorChainChip } from "@/components/smart/AnchorChainChip";
import { useAnchorChain } from "@/components/smart/useAnchors";
import { HardDayCard } from "@/components/smart/HardDayCard";
import { useEasedToday, useHardDayMoment } from "@/components/smart/useHardDay";
import { SmartCard } from "@/components/smart/SmartCard";
import { useWhyMoment } from "@/components/smart/useWhyMoment";
import { WhySheet } from "@/components/smart/WhySheet";
import { whyMessage } from "@/services/smart/why";
import { RoughDayLink } from "@/components/smart/RoughDayLink";
import { RoughDaySheet } from "@/components/smart/RoughDaySheet";
import { UsualCard } from "@/components/smart/UsualCard";
import { FreshStartCard, WelcomeBack } from "@/components/smart/WelcomeBack";
import { useRoughDay } from "@/components/smart/useRoughDay";
import { useUsualMoment } from "@/components/smart/useUsualMoment";
import { useFreshStart, useWelcomeBack } from "@/components/smart/useWelcomeBack";
import { GoodDaysSheet } from "@/components/smart/GoodDaysSheet";
import { useGoodDaysMoment } from "@/components/smart/useGoodDays";
import { track } from "@/services/telemetry";
import { GozlinToast, useToast } from "@/components/gozlin/GozlinToast";
import { useReceipts } from "@/components/smart/receipt";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MACRO_BRIGHT } from "@/components/home/surface";
import { useEntranceTrigger, type ScrollMetrics } from "@/components/home/useEntranceTrigger";
import { WeekTable } from "@/components/home/WeekTable";
import {
  buildCoachDeck,
  buildHabitCard,
  cardFromPattern,
  retiredHabitCard,
  type CoachCard,
} from "@/components/home/coachDeck";
import { pickWeeklyInsight, WEEKLY_INSIGHT_EYEBROW } from "@/components/home/weeklyInsight";
import { useInsightLedger } from "@/components/home/useInsightLedger";
import { isInsightSeen, openInsight, unseenCards } from "@/services/gozlin/InsightLedger";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useGamification, useNutrition, useProfile, useWorkout } from "@/contexts/AppContext";
import { useDayAdjustments } from "@/contexts/domain/useDayTarget";
import { dayCalorieDelta, dayTargetNote } from "@/services/nutrition/dayTargets";
import { calculateProgress } from "@/services/NutritionService";
import { todayDate } from "@/services/OfflineStorage";
import { readCommitment, shiftDay } from "@/services/commitment";
import { pickHomeFact } from "@/services/homeFact";
import { readDayIntake } from "@/services/nutrition/todayIntake";
import { sumMacros } from "@/services/nutrition/DayTotals";
import { router } from "expo-router";
import { insightTitle } from "@/constants/RetroFont";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

/** How far the coach carousel slides left to reveal the next card on hint. */
const COACH_PEEK = 54;

export default function HomeScreen() {
  const { colors } = useColors();
  const { width, height: windowHeight } = useWindowDimensions();
  const { nutritionTargets, bodyLogs } = useProfile();
  const { consumedNutrition, todayDiet, coachInsights } = useNutrition();
  const { streakData, nudge } = useGamification();
  const { workoutPlan, workoutLog } = useWorkout();

  const { top: gozlinMoment } = useGozlinMoments("home");

  // "Your usual?" — a meal eaten the same way most days, offered around its
  // usual time while nothing is logged for it yet. Like every smart moment it
  // asks the quiet layer first (services/smart): one here a day at most.
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const showSmartReceipt = useReceipts(toast);
  const usualMoment = useUsualMoment("home", showSmartReceipt);
  // "Next: vitamins?" right after the thing a habit is tied to gets logged.
  const chain = useAnchorChain("home");

  // The rough-day button: one tap makes today gentle (services/smart/roughDay).
  // `gentleToday` is what the rest of this screen reads to stop pushing.
  const roughDay = useRoughDay();
  const gentleToday = roughDay.rough !== null;
  const [roughSheetOpen, setRoughSheetOpen] = useState(false);
  const openRoughSheet = useCallback(() => {
    track("smart_moment", { feature: "rough-day", result: "shown" });
    setRoughSheetOpen(true);
  }, []);
  const showToast = toast.show;
  const clearRough = roughDay.clear;
  const roughFooter = useMemo(
    () => (
      <RoughDayLink
        rough={gentleToday}
        onOpen={openRoughSheet}
        onOk={() => {
          void clearRough();
          showToast("Back to a normal day");
        }}
      />
    ),
    [gentleToday, openRoughSheet, clearRough, showToast],
  );

  // Back after a week or more, or a thin week ending on a Monday or the 1st.
  const welcomeBack = useWelcomeBack();
  const freshStart = useFreshStart();

  // The weekday that keeps getting missed, the evening before it.
  const hardDay = useHardDayMoment("home", showSmartReceipt);
  // Today's session isn't the full one (a short weekday, a fresh-start week).
  const easedToday = useEasedToday();

  // Their own reason, quoted back word for word on a wobbly day, rarely.
  const whyMoment = useWhyMoment();
  const [whySheetOpen, setWhySheetOpen] = useState(false);
  // The welcome-back screen's quote spends the same once-a-month allowance.
  const welcomeShowing = welcomeBack.welcome != null;
  const welcomeWords = whyMoment.welcomeWords;
  const noteQuoted = whyMoment.noteQuoted;
  useEffect(() => {
    if (welcomeShowing && welcomeWords) noteQuoted();
  }, [welcomeShowing, welcomeWords, noteQuoted]);

  // Habit Awareness report powers the extra "habits" coach card + the deep-dive.
  const habitReport = useHabitReport();
  const habitCard = useMemo(() => buildHabitCard(habitReport), [habitReport]);

  /**
   * The week's one insight, promoted out of the carousel.
   *
   * It is the SAME finding the deep-dive leads with, deliberately: this card is
   * the free proof that the paid layer is real, so it has to be a true thing
   * about the user rather than a teaser for one. Null on a young account — see
   * pickWeeklyInsight, which stays silent rather than inventing a pattern.
   */
  const weekly = useMemo(() => pickWeeklyInsight(habitReport, todayDate()), [habitReport]);

  /**
   * INSIGHTS ARE NOTIFICATIONS. Opened once, gone until there is a new one.
   *
   * The ledger records what has been opened (services/gozlin/InsightLedger, which
   * also says what makes an insight "new"). Nothing here renders until it has
   * been read: filtering against a ledger that has not loaded yet would flash
   * every insight the user already opened, then hide it.
   */
  const { ledger, ready: ledgerReady } = useInsightLedger();
  const insightDay = todayDate();
  // What their best days have in common: at most one new finding a week. Asked
  // for after the other moments, so it only takes the day's slot if they don't.
  const goodDays = useGoodDaysMoment();
  const goodDayCard = goodDays.card;
  const [goodDaysOpen, setGoodDaysOpen] = useState(false);
  const weeklyCard = useMemo(
    () => (weekly ? cardFromPattern(weekly.pattern, "weekly-insight") : null),
    [weekly],
  );
  const showWeekly =
    ledgerReady && !!weeklyCard && !isInsightSeen(ledger, weeklyCard, insightDay);

  // A habit the user stopped tracking, on one of the handful of days it is
  // allowed to come up. Null nearly always — see GozlinTrackerHabits.
  const retiredBeat = useRetiredBeat();
  const retiredCard = useMemo(
    () => (retiredBeat ? retiredHabitCard(retiredBeat) : null),
    [retiredBeat],
  );

  // The full coach deck — distinct cards (adaptive insights + Gozlin's habit
  // card), capped at 4; more appear as the user logs more.
  const fullDeck = useMemo<CoachCard[]>(
    () => buildCoachDeck(coachInsights, habitCard, retiredCard),
    [coachInsights, habitCard, retiredCard],
  );

  // Filtered AFTER the deck is curated, not before: the deck is a considered
  // four, and filtering first would backfill it from the cards it left out.
  // What the user has opened simply leaves; the rest keep their places.
  const coachDeck = useMemo<CoachCard[]>(() => {
    if (!ledgerReady) return [];
    const unseen = unseenCards(fullDeck, ledger, insightDay);
    // It leads while it waits, and the deck stays a considered four.
    return goodDayCard ? [goodDayCard, ...unseen].slice(0, 4) : unseen;
  }, [fullDeck, ledger, ledgerReady, insightDay, goodDayCard]);

  // The tapped card that opens the coach deep-dive.
  const [selectedCard, setSelectedCard] = useState<CoachCard | null>(null);

  // FILED WHEN THE DIVE CLOSES, not when it opens: the card leaving Home while
  // its own sheet is still rising behind the scrim reads as a glitch, and
  // leaving after the user is back on Home reads as "done, filed".
  const closeDeepDive = useCallback(() => {
    if (selectedCard) void openInsight(selectedCard, todayDate());
    setSelectedCard(null);
  }, [selectedCard]);

  const todayWorkout = useMemo(() => {
    if (!workoutPlan) return null;
    const d = new Date().getDay();
    const dayIndex = d === 0 ? 6 : d - 1;
    return workoutPlan.sessions.find((s) => s.dayOfWeek === dayIndex) || null;
  }, [workoutPlan]);

  /**
   * Everything logged TODAY, aggregated.
   *
   * Aggregated rather than `find`-ed because a second session in a day is a
   * real thing people do, and the tile used to read the first entry only — so a
   * 40% morning session followed by a full evening one still showed 40%. The
   * card says "Workout"; it has to mean every workout.
   */
  const todayWorkouts = useMemo(() => {
    const todayStr = todayDate();
    const logs = workoutLog.filter((l) => l.date === todayStr);
    return {
      count: logs.length,
      minutes: logs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
      // Best completion of the day: two sessions can't make each other worse,
      // and averaging would punish a deliberate short second session.
      percent: logs.reduce((max, l) => Math.max(max, l.completionPercent ?? 0), 0),
    };
  }, [workoutLog]);
  const todayWorkoutDone = todayWorkouts.count > 0;

  /**
   * IS TODAY A REST DAY? Only answerable when a plan exists.
   *
   * The local generator emits TRAINING DAYS ONLY — it hard-codes
   * `isRestDay: false` and simply omits the other days — so `todayWorkout`
   * being null on a planned week means "nothing scheduled", i.e. rest. The tile
   * used to read that as "No plan / Set a plan", which told four users in seven
   * every week that they had no plan when they were looking at one. The
   * `isRestDay` half is kept for AI-generated plans, which may state rest days
   * explicitly rather than by omission.
   */
  const isRestToday = !!workoutPlan && (!todayWorkout || todayWorkout.isRestDay);

  // Coach carousel "peek" hint — when the section scrolls into view, the track
  // slides to reveal a neighbouring card, then snaps back with an elastic band.
  // It slides left to reveal the *next* card, unless the carousel is already at
  // its right end (where sliding left would only bare an empty wall) — there it
  // slides right instead, drawing the eye back to the *previous* card.
  const coachTranslate = useRef(new Animated.Value(0)).current;
  const coachArmed = useRef(true);
  const canHintCoach = coachDeck.length >= 2;

  // Live horizontal geometry of the carousel, so the hint knows which side
  // still has a hidden card to reveal.
  const coachScrollX = useRef(0);
  const coachViewportW = useRef(0);
  const coachContentW = useRef(0);

  const runCoachHint = useCallback(() => {
    const maxX = Math.max(0, coachContentW.current - coachViewportW.current);
    // At (or past) the right end, peek right to reveal the previous card;
    // otherwise peek left to reveal the next one.
    const atEnd = maxX > 1 && coachScrollX.current >= maxX - 4;
    const peek = atEnd ? COACH_PEEK : -COACH_PEEK;
    Animated.sequence([
      Animated.timing(coachTranslate, {
        toValue: peek,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Low friction → overshoots past rest and settles: the rubber-band snap.
      Animated.spring(coachTranslate, {
        toValue: 0,
        friction: 4.5,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, [coachTranslate]);

  /**
   * CARDS THAT PLAY ON ARRIVAL. Scroll down to Your week on a kept day and its
   * flame catches; scroll down to Fitness and its line draws on, left to right.
   * Each card gets a trigger (components/home/useEntranceTrigger) — one shared
   * value to read, 0 wait / 1 play / 2 show finished — and this screen feeds
   * them all the latest scroll metrics from ONE ref. The rules for when are in
   * components/home/scrollEntrance.
   *
   * Refs and shared values only, on purpose: this runs on every scroll event,
   * and a `useState` here would re-render the whole of Home sixty times a second
   * to ask a question whose answer changes twice.
   */
  const scrollMetrics = useRef<ScrollMetrics>({ y: 0, h: windowHeight });
  const weekIn = useEntranceTrigger(scrollMetrics);
  const fitnessIn = useEntranceTrigger(scrollMetrics);
  const stepWeek = weekIn.step;
  const stepFitness = fitnessIn.step;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      scrollMetrics.current = { y: contentOffset.y, h: layoutMeasurement.height };
      stepWeek();
      stepFitness();
      if (!canHintCoach) return;
      // The coach carousel is the last section, so "reached the bottom of the
      // scroll" is the moment it's fully in view — fire the peek hint there.
      const distanceToBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (coachArmed.current && distanceToBottom <= 24) {
        coachArmed.current = false;
        runCoachHint();
      } else if (!coachArmed.current && distanceToBottom > 140) {
        // Scrolled well back up from the bottom — re-arm so it replays next time.
        coachArmed.current = true;
      }
    },
    [canHintCoach, runCoachHint, stepWeek, stepFitness],
  );

  // Track where the carousel is parked so the peek always leans toward content.
  const onCoachScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      coachScrollX.current = e.nativeEvent.contentOffset.x;
    },
    [],
  );

  // The top line: ONE true fact about the last day, in the display face. Yesterday
  // is read once from the intake ledger; null (not zero) when nothing was logged.
  const [yesterdayIntake, setYesterdayIntake] = useState<{ calories: number; proteinG: number } | null>(null);
  const dayKey = todayDate();
  // A day can have its own calorie target (services/nutrition/dayTargets).
  const dayAdjustments = useDayAdjustments();
  const todayDelta = dayCalorieDelta(dayKey, dayAdjustments);
  useEffect(() => {
    let active = true;
    readDayIntake(shiftDay(dayKey, -1)).then(({ intake, foodLog }) => {
      if (!active || !intake || !foodLog) return;
      const m = sumMacros(intake, foodLog);
      setYesterdayIntake(m.calories > 0 ? { calories: m.calories, proteinG: m.proteinG } : null);
    });
    return () => {
      active = false;
    };
  }, [dayKey]);
  const commitment = useMemo(() => readCommitment(streakData, dayKey), [streakData, dayKey]);
  const fact = useMemo(
    () =>
      pickHomeFact({
        hour: new Date().getHours(),
        today: dayKey,
        yesterday: shiftDay(dayKey, -1),
        streak: commitment.streak,
        keptToday: commitment.keptToday,
        atRisk: commitment.atRisk,
        totalDays: commitment.totalDays,
        yesterdayIntake,
        targets: nutritionTargets
          ? {
              calories: nutritionTargets.calories + dayCalorieDelta(shiftDay(dayKey, -1), dayAdjustments),
              proteinG: nutritionTargets.proteinG,
            }
          : null,
        workouts: workoutLog,
        nowMs: Date.now(),
        waterMl: consumedNutrition.waterMl ?? 0,
        waterGoalMl: nutritionTargets?.waterMl ?? null,
        weighIns: bodyLogs ?? [],
      }),
    [commitment, dayKey, dayAdjustments, yesterdayIntake, nutritionTargets, workoutLog, consumedNutrition.waterMl, bodyLogs],
  );

  // "Friday, 29 Aug" — the plan card's scope, spelled out rather than implied.
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "short",
      }),
    [],
  );

  const calorieTarget = (nutritionTargets?.calories || 2000) + todayDelta;
  const caloriePct = nutritionTargets
    ? calculateProgress(consumedNutrition.calories, calorieTarget)
    : 0;
  const remaining = Math.max(
    0,
    Math.round(calorieTarget - consumedNutrition.calories),
  );

  const macros = [
    {
      key: "protein",
      label: "Protein",
      tone: MACRO_BRIGHT.protein,
      current: consumedNutrition.proteinG,
      target: nutritionTargets?.proteinG || 50,
    },
    {
      key: "carbs",
      label: "Carbs",
      tone: MACRO_BRIGHT.carbs,
      current: consumedNutrition.carbsG,
      target: nutritionTargets?.carbsG || 250,
    },
    {
      key: "fat",
      label: "Fat",
      tone: MACRO_BRIGHT.fat,
      current: consumedNutrition.fatG,
      target: nutritionTargets?.fatG || 65,
    },
  ];

  // ── Today's plan progress (real — from the schedule + logs) ──
  const dietMeals = useMemo(() => {
    const s = todayDiet?.schedule;
    if (!s) return { consumed: 0, total: 0 };
    const meals = [s.breakfast, s.lunch, s.dinner, ...s.snacks].filter(
      (m): m is NonNullable<typeof m> => m != null,
    );
    return { consumed: meals.filter((m) => m.isConsumed).length, total: meals.length };
  }, [todayDiet]);
  const dietProgress = dietMeals.total > 0 ? dietMeals.consumed / dietMeals.total : 0;

  const workoutProgress = useMemo(() => {
    // A completed session always wins, including one done on a rest day —
    // training when the plan didn't ask you to is not zero progress.
    if (todayWorkoutDone) return Math.min(1, todayWorkouts.percent / 100);
    if (isRestToday) return 1; // recovery counts as a full day
    return 0;
  }, [todayWorkoutDone, todayWorkouts.percent, isRestToday]);

  /**
   * A rest day has no progress to draw, so it draws a resting face instead.
   *
   * The meter used to score an untrained rest day 1.0 and light every bar. It
   * was defensible arithmetic — recovery IS the plan for today — and it was a
   * bad reading: five full bars is the app's own symbol for "you did the work",
   * and putting it on the day you did none of it undercuts the days you did.
   * The glyph says the true thing in the same space: nothing was asked for.
   *
   * A session logged on a rest day takes the meter back — that IS progress, and
   * showing someone a snoozing face after they went and trained anyway would be
   * the same mistake pointing the other way.
   */
  const workoutGlyph = !todayWorkoutDone && (isRestToday || gentleToday) ? "rest" : null;

  // Coach carousel: each card ~82% of the viewport so the next one peeks.
  const coachW = Math.round(width * 0.82);

  const header = (
    <Reveal index={0} pointerEvents="box-none">
      <ScreenTopBar
        style={styles.topBar}
        // Home is the ONLY screen with a centre line: one fact, no greeting.
        greeting={fact.text}
        // What the folded island says once the wordmark below has folded away.
        compactTitle="welliva"
        // The app name stands in for a screen name here: "Home" would be
        // redundant on the screen you land on.
        title={
          <>
            <AppText variant="headline" color="brand" style={styles.brand} numberOfLines={1}>
              welliva
            </AppText>
            {/* Only ever visible when something hasn't reached the cloud. */}
            <SyncStatusPill style={styles.syncPill} />
          </>
        }
        trailing={<GozlinButton prompt={gozlinMoment?.prompt} />}
      />
    </Reveal>
  );

  return (
    <>
      {/* No `bottomInset` any more. It used to be hand-tuned down to the
          no-footer figure and then raised again by `footer`; the Deck floats
          over every destination now, so `Screen`'s own NAV_CLEARANCE default is
          the honest number and there is nothing left for a screen to tune. */}
      <Screen gutter={false} header={header} floatingHeader onScroll={onScroll}>
      {/* ── Hero: calories. ONE big black card — the ring, Target, Remaining and
             % of goal together (components/home/CalorieHero). ── */}
      <Reveal index={1}>
        <CalorieHero
          style={styles.gutter}
          eaten={consumedNutrition.calories}
          target={calorieTarget}
          remaining={remaining}
          percent={caloriePct}
          gentle={gentleToday}
          targetNote={dayTargetNote(todayDelta)}
        />
      </Reveal>

      {/* ── Macros: protein, carbs and fat as three small cards of their own — a
             dot-matrix figure, the target in the regular face, and a graduated bar
             in each macro's own colour (components/home/MacroTile). ── */}
      <Reveal index={2}>
        <View style={[styles.gutter, styles.macroRow]}>
          {macros.map((m) => (
            <MacroTile
              key={m.key}
              label={m.label}
              tone={m.tone}
              current={m.current}
              target={m.target}
            />
          ))}
        </View>
      </Reveal>

      {/* ── Within reach: the one record/near-miss in range (MomentEngine).
             Renders nothing on most days — see components/home/NudgeCard. ── */}
      {nudge && !gentleToday && (
        <Reveal index={2}>
          {/* `nudgeBlock`, not `gutter`: the shared gutter style carries no
              vertical margin, so this card used to sit flush against the hero
              above it and the two read as one shape with a seam through it.
              Everything else on this screen states its own top margin; this was
              the one block that didn't. */}
          <View style={styles.nudgeBlock}>
            <NudgeCard nudge={nudge} />
          </View>
        </Reveal>
      )}

      {chain.moment && (
        <Reveal index={2}>
          <View style={styles.nudgeBlock}>
            <AnchorChainChip
              name={chain.moment.view.habit.name}
              icon={chain.moment.view.habit.icon}
              color={chain.moment.view.habit.color}
              onDone={() => void chain.done(chain.moment!)}
              onDismiss={() => chain.dismiss(chain.moment!)}
            />
          </View>
        </Reveal>
      )}

      {/* ── Your usual? — around a meal's usual time, until it's logged. ── */}
      {usualMoment.usual && (
        <Reveal index={2}>
          <View style={styles.nudgeBlock}>
            <UsualCard
              usual={usualMoment.usual}
              onLog={usualMoment.logIt}
              onNotMine={usualMoment.notMine}
            />
          </View>
        </Reveal>
      )}

      {/* ── Today's plan ──────────────────────────────────────────────────
             Both meters are counted from logs written today, and the header
             says so. The card carried no title at all before, which left two
             progress meters floating with no stated scope — read as lifetime
             totals by anyone who hadn't trained today, and reported as broken
             for exactly that reason. A meter with no subject is a decoration. */}
      <Reveal index={3}>
        <View style={styles.section}>
          <View style={styles.gutter}>
            <SectionHeader title="Today" subtitle={todayLabel} weight="700" />
          </View>
          <Card style={styles.planCard} padding="lg">
            <View style={styles.planRow}>
              <PlanTile
                label="Workout"
                value={
                  todayWorkoutDone
                    ? todayWorkouts.count > 1
                      ? `${todayWorkouts.count} sessions`
                      : "Completed"
                    : gentleToday
                      ? roughDay.rough?.workout === "walk"
                        ? "A gentle walk"
                        : roughDay.rough?.workout === "rest"
                          ? "Resting"
                          : "Walk or rest"
                      : isRestToday
                        ? "Rest day"
                        : todayWorkout
                          ? todayWorkout.focus
                          : "No plan"
                }
                caption={
                  todayWorkoutDone
                    ? `${todayWorkouts.percent}% done · ${todayWorkouts.minutes} min`
                    : gentleToday
                      ? "Your plan can wait"
                      : isRestToday
                        ? "Recovery counts"
                        : todayWorkout
                          ? // Eased: the Fitness tab builds it, so no figure for the full one here.
                            easedToday
                            ? "Eased today"
                            : `~${todayWorkout.totalDurationMinutes} min`
                          : "Set a plan"
                }
                icon={(isRestToday || gentleToday) && !todayWorkoutDone ? "bed-outline" : "fitness"}
                tone={
                  todayWorkoutDone || isRestToday || gentleToday
                    ? colors.success
                    : todayWorkout
                      ? colors.fat
                      : colors.warning
                }
                progress={workoutProgress}
                glyph={workoutGlyph}
                glyphLabel={gentleToday ? "A gentle day — no workout asked for" : "Rest day — nothing scheduled"}
              />
              <View style={[styles.planSep, { backgroundColor: colors.divider }]} />
              <PlanTile
                label="Diet"
                value={
                  todayDiet?.hasScheduledDiet && todayDiet.schedule
                    ? todayDiet.schedule.dietName
                    : "Not set"
                }
                caption={
                  todayDiet?.hasScheduledDiet
                    ? dietMeals.total > 0
                      ? `${dietMeals.consumed} of ${dietMeals.total} meals`
                      : // A scheduled day with no meals in it has nothing ready.
                        "Nothing scheduled"
                    : "Add today's meals"
                }
                icon={todayDiet?.hasScheduledDiet ? "restaurant" : "add-circle-outline"}
                tone={todayDiet?.hasScheduledDiet ? colors.protein : colors.warning}
                progress={dietProgress}
              />
            </View>
          </Card>
        </View>
      </Reveal>

      {/* ── Cycle — a calm ring for anyone tracking one; for a woman who isn't
             yet, the invitation, answered once. Both render nothing otherwise. ── */}
      <Reveal index={3}>
        <CycleHomeCard style={styles.cycleBlock} />
        <CycleOfferCard style={styles.cycleBlock} />
      </Reveal>

      {/* ── Hydration — the log card (components/hydration). Before Your week:
             the thing you tap through the day sits above the thing you read. ── */}
      <Reveal index={4}>
        <View style={styles.section}>
          <Hydration />
        </View>
      </Reveal>

      {/* ── Your week — the streak and the last seven days in ONE card: the
             flame and the count, a flame per day where it was kept, and what was
             eaten, trained and drunk (components/home/WeekTable). It used to be a
             streak strip here and a separate table further down, telling the
             same week twice. Its own Reveal, directly under the scroll region, so
             `onLayout` says where it sits: the flame lights as it scrolls in. ── */}
      {welcomeBack.freshMoment && welcomeBack.freshMoment.kind !== "welcome" && (
        <Reveal index={5}>
          <View style={styles.nudgeBlock}>
            <FreshStartCard
              kind={welcomeBack.freshMoment.kind}
              onStartFresh={() => void welcomeBack.startFresh(welcomeBack.freshMoment!)}
              onPickUp={() => void welcomeBack.pickUp(welcomeBack.freshMoment!)}
            />
          </View>
        </Reveal>
      )}
      {whyMoment.why && (
        <Reveal index={5}>
          <View style={styles.nudgeBlock}>
            <SmartCard
              icon="heart-outline"
              message={whyMessage(whyMoment.why, whyMoment.whyAt)}
              source="Your own words. You can change or remove them in Memory."
              primary={{ label: "Still true", onPress: whyMoment.stillTrue }}
              secondary={{ label: "Change it", onPress: () => setWhySheetOpen(true) }}
              tertiary={{ label: "Not now", onPress: whyMoment.notNow }}
            />
          </View>
        </Reveal>
      )}
      {hardDay.moment && (
        <Reveal index={5}>
          <View style={styles.nudgeBlock}>
            <HardDayCard
              moment={hardDay.moment}
              onAccept={(m) => void hardDay.accept(m)}
              onDecline={(m) => void hardDay.decline(m)}
            />
          </View>
        </Reveal>
      )}
      <Reveal index={5} onLayout={weekIn.onLayout}>
        <WeekTable
          streak={streakData}
          entrance={weekIn.value}
          freshStart={freshStart?.since}
          footer={roughFooter}
          style={[styles.gutter, styles.weekBlock]}
        />
      </Reveal>

      {/* ── Check in · Fitness ───────────────────────────────────────────────
             How you feel, logged by hand, and how much you have moved, watched
             over time. Each reads real records (see components/home) and
             neither draws a number it did not read. ── */}
      <Reveal index={6}>
        <View style={[styles.section, styles.gutter]}>
          <CheckInBar />
        </View>
      </Reveal>

      {/* Its own Reveal, directly under the scroll region, so `onLayout` hands
          back where the card truly sits on the page: that is what lets the line
          draw itself on as the page scrolls it into view. */}
      <Reveal index={6} onLayout={fitnessIn.onLayout}>
        <View style={[styles.gutter, styles.trackGap]}>
          <FitnessTile log={workoutLog} today={dayKey} entrance={fitnessIn.value} />
        </View>
      </Reveal>

      {/* ── This week's insight ───────────────────────────────────────────
             Promoted out of the carousel and given its own moment. The engine
             that produces this is what Pro is sold on, and it used to be three
             taps deep in a modal — which meant the people deciding whether to
             pay for it had never seen it work on their own data. */}
      {showWeekly && !gentleToday && weekly && weeklyCard && (
        <Reveal index={6}>
          <View style={[styles.section, styles.gutter]}>
            <Pressable
              onPress={() => setSelectedCard(weeklyCard)}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKLY_INSIGHT_EYEBROW}: ${weekly.pattern.message}`}
              accessibilityHint="Opens everything your coach has learned about you"
            >
              <Card padding="lg">
                <View style={styles.weeklyHead}>
                  <IconBadge
                    name={(weekly.pattern.icon ?? "sparkles") as never}
                    tone={colors.primary}
                    size={38}
                  />
                  <View style={styles.flex}>
                    <AppText variant="caption" color="tertiary" uppercase>
                      {WEEKLY_INSIGHT_EYEBROW}
                    </AppText>
                    <AppText variant="callout" style={styles.weeklyMessage}>
                      {weekly.pattern.message}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              </Card>
            </Pressable>
          </View>
        </Reveal>
      )}

      {/* ── Coach (card-less carousel — tap any card for the deep-dive) ── */}
      {coachDeck.length > 0 && !gentleToday && (
        <Reveal index={7}>
          <View style={styles.section}>
            <View style={styles.gutter}>
              <SectionHeader title="Your coach" subtitle="Tap a card for the full picture" weight="700" />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={coachW + Spacing.md}
              snapToAlignment="start"
              contentContainerStyle={styles.coachScroll}
              scrollEventThrottle={32}
              onScroll={onCoachScroll}
              onLayout={(e) => {
                coachViewportW.current = e.nativeEvent.layout.width;
              }}
              onContentSizeChange={(w) => {
                coachContentW.current = w;
              }}
            >
              <Animated.View
                style={[styles.coachTrack, { transform: [{ translateX: coachTranslate }] }]}
              >
                {coachDeck.map((insight) => {
                  const tone =
                    insight.tone === "positive"
                      ? colors.success
                      : insight.tone === "warning"
                        ? colors.warning
                        : colors.primary;
                  return (
                    <CoachCardView
                      key={insight.id}
                      insight={insight}
                      tone={tone}
                      width={coachW}
                      // The retired-habit card is a question, so it opens the
                      // conversation rather than a read-only deep dive. Every
                      // other card is a finding, and findings open the dive.
                      onPress={() => {
                        if (retiredBeat && insight.id === retiredCard?.id) {
                          // It opens a conversation, not the dive, so there is
                          // no close to file it on — file it on the tap.
                          void openInsight(insight, todayDate());
                          router.navigate({
                            pathname: "/gozlin",
                            params: { prompt: retiredBeat.prompt },
                          } as never);
                        } else if (insight.identity) {
                          setGoodDaysOpen(true);
                        } else {
                          setSelectedCard(insight);
                        }
                      }}
                    />
                  );
                })}
              </Animated.View>
            </ScrollView>
          </View>
        </Reveal>
      )}
      </Screen>

      <CoachDeepDive
        insight={selectedCard}
        report={habitReport}
        onClose={closeDeepDive}
      />
      <GoodDaysSheet
        visible={goodDaysOpen}
        report={goodDays.report}
        findings={goodDays.findings}
        onClose={() => {
          // Filed on close, like every other insight: "done", not a card vanishing
          // behind its own sheet.
          setGoodDaysOpen(false);
          goodDays.read();
        }}
      />
      <GozlinToast controller={toast} topOffset={insets.top} />
      <RoughDaySheet
        visible={roughSheetOpen}
        onClose={() => setRoughSheetOpen(false)}
        onConfirm={(reason) => {
          setRoughSheetOpen(false);
          void roughDay.mark(reason);
          toast.show("Today's a gentle day. Take care.", { icon: "leaf" });
        }}
        canProtect={roughDay.canProtectToday}
        usedThisMonth={roughDay.usedThisMonth}
        perMonth={roughDay.perMonth}
      />
      <WhySheet
        visible={whySheetOpen}
        initial={whyMoment.why ?? ""}
        onClose={() => setWhySheetOpen(false)}
        onSave={(text) => {
          setWhySheetOpen(false);
          void whyMoment.change(text);
        }}
      />
      <WelcomeBack
        visible={welcomeBack.welcome != null}
        today={dayKey}
        why={whyMoment.welcomeWords}
        whyAt={whyMoment.whyAt}
        onStartFresh={() => {
          if (welcomeBack.welcome) void welcomeBack.startFresh(welcomeBack.welcome);
        }}
        onPickUp={() => {
          if (welcomeBack.welcome) void welcomeBack.pickUp(welcomeBack.welcome);
        }}
      />
    </>
  );
}

/* ── Local pieces ── */

function PlanTile({
  label,
  value,
  caption,
  icon,
  tone,
  progress,
  glyph,
  glyphLabel,
}: {
  label: string;
  value: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  progress: number;
  /** Drawn instead of the meter when a filled meter would mean nothing. */
  glyph?: MeterGlyphName | null;
  glyphLabel?: string;
}) {
  return (
    <View style={styles.planTile}>
      <View style={styles.planTileHead}>
        <IconBadge name={icon} tone={tone} size={38} />
        <AscendingMeter
          progress={progress}
          tone={tone}
          height={26}
          glyph={glyph}
          glyphLabel={glyphLabel}
        />
      </View>
      <AppText variant="caption" color="tertiary" uppercase style={styles.planLabel}>
        {label}
      </AppText>
      <AppText variant="callout" numberOfLines={1} style={styles.planValue}>
        {value}
      </AppText>
      <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.planCaption}>
        {caption}
      </AppText>
    </View>
  );
}

function CoachCardView({
  insight,
  tone,
  width,
  onPress,
}: {
  insight: CoachCard;
  tone: string;
  width: number;
  onPress: () => void;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${insight.title}. ${insight.message}`}
      style={({ pressed }) => [
        styles.coachCard,
        {
          width,
          backgroundColor: alpha(tone, 0.1),
          borderColor: alpha(tone, 0.22),
        },
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.coachHead}>
        <IconBadge name={insight.icon as any} tone={tone} size={40} />
        {insight.isHabit ? (
          <Pill label="Gozlin" tone={colors.primary} size="sm" iconNode={<AILogoIcon size={11} />} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        )}
      </View>
      <AppText
        variant="callout"
        style={[styles.coachTitle, insightTitle]}
        numberOfLines={insight.identity ? 2 : 1}
      >
        {insight.title}
      </AppText>
      <AppText
        variant="subhead"
        color="secondary"
        style={styles.coachMsg}
        // A finding's two numbers and its caveat ARE the card; never clip them.
        numberOfLines={insight.identity ? undefined : 2}
      >
        {insight.message}
      </AppText>
      <View style={styles.coachFoot}>
        <AppText variant="caption" style={{ color: tone }}>
          View details
        </AppText>
        <Ionicons name="arrow-forward" size={13} color={tone} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  weeklyHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  weeklyMessage: { marginTop: 2 },
  flex: { flex: 1 },
  gutter: { marginHorizontal: Spacing.screen },
  nudgeBlock: { marginHorizontal: Spacing.screen, marginTop: Spacing.xl },
  cycleBlock: { marginHorizontal: Spacing.screen, marginTop: Spacing.xl },

  // Header
  topBar: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  brand: { fontWeight: "900", marginTop: 3, letterSpacing: -0.2 },
  syncPill: { marginTop: Spacing.sm },

  // Hero — the card itself is components/home/CalorieHero; the three macro
  // cards beneath it share the row, and the phone's width, equally.
  macroRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },

  // Plan
  planCard: { marginHorizontal: Spacing.screen },
  planRow: { flexDirection: "row", alignItems: "stretch", gap: Spacing.lg },
  planTile: { flex: 1 },
  planSep: { width: 1 },
  planTileHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planLabel: { marginTop: Spacing.md },
  planValue: { marginTop: 3 },
  planCaption: { marginTop: 2 },

  // Your week — the streak and the table, one card
  weekBlock: { marginTop: Spacing.xxxl },

  // Sections
  section: { marginTop: Spacing.xxxl },

  // Check in · Fitness — one family of cards, one rhythm. Fitness is its own
  // Reveal (its line needs to know where it sits on the page), so the gap
  // between the two is a margin.
  trackGap: { marginTop: Spacing.md },

  // Coach carousel
  coachScroll: { paddingHorizontal: Spacing.screen },
  coachTrack: { flexDirection: "row", gap: Spacing.md },
  coachCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    minHeight: 150,
  },
  coachHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coachTitle: {},
  coachMsg: { flex: 1 },
  coachFoot: { flexDirection: "row", alignItems: "center", gap: 4 },
});

/**
 * LEVEL 3 — route-level boundary. Expo Router honours this named export, so a
 * throw inside this screen is contained here: the tab bar stays live and every
 * other tab stays usable. Only what this file couldn't render is lost.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:home" />;
}
