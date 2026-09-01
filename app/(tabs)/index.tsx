/**
 * HOME — the daily dashboard.
 * Hero nutrition ring, today's plan, a card-less streak strip, a redesigned
 * hydration hero and a coaching carousel — all on the Welliva design system.
 */

import WaterTracker from "@/components/WaterTracker";
import {
  AnimatedNumber,
  AppText,
  AscendingMeter,
  Card,
  IconBadge,
  Pill,
  ProgressBar,
  Reveal,
  Ring,
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
import { ActionBar, ScreenTopBar } from "@/components/navigation";
import { SyncStatusPill } from "@/components/sync/SyncStatusPill";
import { CrashTrigger, ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { CoachDeepDive } from "@/components/home/CoachDeepDive";
import { NudgeCard } from "@/components/home/NudgeCard";
import {
  buildCoachDeck,
  buildHabitCard,
  cardFromPattern,
  retiredHabitCard,
  type CoachCard,
} from "@/components/home/coachDeck";
import { pickWeeklyInsight, WEEKLY_INSIGHT_EYEBROW } from "@/components/home/weeklyInsight";
import { useBilling } from "@/contexts/BillingContext";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import { useGamification, useNutrition, useProfile, useWorkout } from "@/contexts/AppContext";
import { calculateProgress } from "@/services/NutritionService";
import { todayDate } from "@/services/OfflineStorage";
import { router } from "expo-router";
import { getMotivationalMessage } from "@/services/StreakService";
import { nextHomeGreeting } from "@/constants/HomeGreetings";
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
  const { width } = useWindowDimensions();
  const { nutritionTargets } = useProfile();
  const { consumedNutrition, todayDiet, coachInsights } = useNutrition();
  const { streakData, nudge } = useGamification();
  const { workoutPlan, workoutLog } = useWorkout();

  const { top: gozlinMoment } = useGozlinMoments("home");

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
   * THE TRIAL TRIGGER.
   *
   * The 48-hour Pro window opens here — the first moment Welliva has an
   * evidence-backed finding about this person — rather than at sign-up, when it
   * would be spent against an empty database and expire before the product had
   * anything to show. See services/billing/trial.ts.
   *
   * Firing it from the render that first shows `weekly` is deliberate: the trial
   * and the proof arrive together, so the user is looking at a true thing about
   * themselves at the exact moment the rest of the tier unlocks. The call is
   * idempotent and self-declining (already used, already subscribed, gating off),
   * so running it on every qualifying mount costs one guarded read.
   */
  const { startInsightTrial } = useBilling();
  useEffect(() => {
    if (weekly) void startInsightTrial();
  }, [weekly, startInsightTrial]);

  // A habit the user stopped tracking, on one of the handful of days it is
  // allowed to come up. Null nearly always — see GozlinTrackerHabits.
  const retiredBeat = useRetiredBeat();
  const retiredCard = useMemo(
    () => (retiredBeat ? retiredHabitCard(retiredBeat) : null),
    [retiredBeat],
  );

  // The full coach deck — distinct cards (adaptive insights + Gozlin's habit
  // card), capped at 4; more appear as the user logs more.
  const coachDeck = useMemo<CoachCard[]>(
    () => buildCoachDeck(coachInsights, habitCard, retiredCard),
    [coachInsights, habitCard, retiredCard],
  );

  // The tapped card that opens the coach deep-dive.
  const [selectedCard, setSelectedCard] = useState<CoachCard | null>(null);

  const motivation = useMemo(
    () => getMotivationalMessage(streakData),
    [streakData],
  );

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

  // Rotating time-of-day greeting, picked fresh on each app open. A greeting
  // never repeats until the other 29 in its day-part bucket have been shown.
  const [headline, setHeadline] = useState("Welcome back");
  useEffect(() => {
    let active = true;
    nextHomeGreeting().then((g) => {
      if (active) setHeadline(g);
    });
    return () => {
      active = false;
    };
  }, []);

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

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!canHintCoach) return;
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
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
    [canHintCoach, runCoachHint],
  );

  // Track where the carousel is parked so the peek always leans toward content.
  const onCoachScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      coachScrollX.current = e.nativeEvent.contentOffset.x;
    },
    [],
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

  const calorieTarget = nutritionTargets?.calories || 2000;
  const caloriePct = nutritionTargets
    ? calculateProgress(consumedNutrition.calories, nutritionTargets.calories)
    : 0;
  const remaining = Math.max(
    0,
    Math.round(calorieTarget - consumedNutrition.calories),
  );

  const macros = [
    {
      key: "protein",
      label: "Protein",
      tone: colors.protein,
      current: consumedNutrition.proteinG,
      target: nutritionTargets?.proteinG || 50,
    },
    {
      key: "carbs",
      label: "Carbs",
      tone: colors.carbs,
      current: consumedNutrition.carbsG,
      target: nutritionTargets?.carbsG || 250,
    },
    {
      key: "fat",
      label: "Fat",
      tone: colors.fat,
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
  const workoutGlyph = !todayWorkoutDone && isRestToday ? "rest" : null;

  // Coach carousel: each card ~82% of the viewport so the next one peeks.
  const coachW = Math.round(width * 0.82);

  const header = (
    <Reveal index={0}>
      <ScreenTopBar
        style={styles.topBar}
        // Home is the ONLY screen with a greeting — everywhere else the top line
        // belongs to the menu button alone.
        greeting={headline}
        // The app name stands in for a screen name here: "Home" would be
        // redundant on the screen you land on.
        title={
          <>
            <AppText variant="headline" color="brand" style={styles.brand} numberOfLines={1}>
              Welliva
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
      {/* Dev-only: open with ?crash=1 or ?crash=tab:home to verify this
          screen's ErrorBoundary catches without taking the app down. */}
      {__DEV__ && <CrashTrigger surface="tab:home" />}
      {/* `bottomInset` is the no-footer figure: the end of the content plus the
          device's own inset, kept from when nothing floated here. The Action Bar
          does float here now, and `Screen` raises the inset to NAV_CLEARANCE for
          exactly as long as a footer is mounted — so this number stays honest
          rather than being hand-tuned to whatever is currently docked. */}
      <Screen
        gutter={false}
        header={header}
        onScroll={onScroll}
        bottomInset={Spacing.xxl}
        footer={<ActionBar />}
      >
      {/* ── Hero: calories + macros ── */}
      <Reveal index={1}>
        <Card style={styles.gutter} padding="xxl">
          <View style={styles.heroRow}>
            <Ring
              progress={caloriePct / 100}
              size={132}
              strokeWidth={12}
              gradient={Gradients.calories}
            >
              <AnimatedNumber
                value={Math.round(consumedNutrition.calories)}
                variant="metric"
              />
              <AppText variant="caption" color="tertiary" uppercase>
                kcal eaten
              </AppText>
            </Ring>

            {/* The ring and this block are ONE centred group, not two things
                pinned to opposite edges of the card. Stretching them apart put
                the dial against the left rule and the figures against the
                right, which reads as two separate cards sharing a box.

                Centred text rather than a label-left/figure-right table: this
                column is ~140pt on a 390pt screen and under 90pt on a small
                one, and a two-column row at that width either overflows or
                truncates its label. Stacked and centred, every width fits. */}
            <View style={styles.heroInfo}>
              <View style={styles.stat}>
                <AppText variant="caption" color="tertiary" uppercase align="center">
                  Target
                </AppText>
                <AppText
                  variant="headline"
                  align="center"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {calorieTarget.toLocaleString()}
                  <AppText variant="footnote" color="tertiary">
                    {" "}
                    kcal
                  </AppText>
                </AppText>
              </View>

              <View style={[styles.statRule, { backgroundColor: colors.divider }]} />

              <View style={styles.stat}>
                <AppText variant="caption" color="tertiary" uppercase align="center">
                  Remaining
                </AppText>
                <AppText
                  variant="headline"
                  color="calories"
                  align="center"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {remaining.toLocaleString()}
                  <AppText variant="footnote" color="tertiary">
                    {" "}
                    kcal
                  </AppText>
                </AppText>
              </View>

              <Pill
                label={`${caloriePct}% of goal`}
                tone={colors.calories}
                size="sm"
                icon="flame-outline"
                style={styles.heroPill}
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Macros */}
          <View style={styles.macroRow}>
            {macros.map((m) => {
              const pct = m.target > 0 ? m.current / m.target : 0;
              return (
                <View key={m.key} style={styles.macroCol}>
                  <View style={styles.macroHead}>
                    <View style={[styles.macroDot, { backgroundColor: m.tone }]} />
                    <AppText variant="footnote" color="secondary">
                      {m.label}
                    </AppText>
                  </View>
                  <AppText variant="headline" align="center" numberOfLines={1}>
                    {Math.round(m.current)}
                    <AppText variant="footnote" color="tertiary">
                      {" "}
                      / {m.target}g
                    </AppText>
                  </AppText>
                  <ProgressBar
                    progress={pct}
                    tone={m.tone}
                    height={6}
                    style={styles.macroBar}
                  />
                </View>
              );
            })}
          </View>
        </Card>
      </Reveal>

      {/* ── Within reach: the one record/near-miss in range (MomentEngine).
             Renders nothing on most days — see components/home/NudgeCard. ── */}
      {nudge && (
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
                    : isRestToday
                      ? "Rest day"
                      : todayWorkout
                        ? todayWorkout.focus
                        : "No plan"
                }
                caption={
                  todayWorkoutDone
                    ? `${todayWorkouts.percent}% done · ${todayWorkouts.minutes} min`
                    : isRestToday
                      ? "Recovery counts"
                      : todayWorkout
                        ? `~${todayWorkout.totalDurationMinutes} min`
                        : "Set a plan"
                }
                icon={isRestToday && !todayWorkoutDone ? "bed-outline" : "fitness"}
                tone={
                  todayWorkoutDone || isRestToday
                    ? colors.success
                    : todayWorkout
                      ? colors.fat
                      : colors.warning
                }
                progress={workoutProgress}
                glyph={workoutGlyph}
                glyphLabel="Rest day — nothing scheduled"
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

      {/* ── Streak (card-less strip) ── */}
      <Reveal index={4}>
        <View style={[styles.gutter, styles.streakBlock]}>
          <View style={styles.streakStrip}>
            <StreakStat
              icon="flame"
              tone={colors.calories}
              value={streakData.currentStreak}
              label="Day streak"
            />
            <View style={[styles.streakSep, { backgroundColor: colors.border }]} />
            <StreakStat
              icon="trophy"
              tone={colors.gold}
              value={streakData.longestStreak}
              label="Best streak"
            />
            <View style={[styles.streakSep, { backgroundColor: colors.border }]} />
            <StreakStat
              icon="calendar-clear"
              tone={colors.success}
              value={streakData.totalActiveDays}
              label="Active days"
            />
          </View>
          {!!motivation && (
            <AppText
              variant="footnote"
              color="tertiary"
              align="center"
              style={styles.streakMotivation}
              numberOfLines={1}
            >
              {motivation}
            </AppText>
          )}
        </View>
      </Reveal>

      {/* ── Hydration ── */}
      <Reveal index={5}>
        <View style={styles.section}>
          <View style={styles.gutter}>
            <SectionHeader title="Hydration" weight="700" />
          </View>
          <WaterTracker />
        </View>
      </Reveal>

      {/* ── This week's insight ───────────────────────────────────────────
             Promoted out of the carousel and given its own moment. The engine
             that produces this is what Pro is sold on, and it used to be three
             taps deep in a modal — which meant the people deciding whether to
             pay for it had never seen it work on their own data. */}
      {weekly && (
        <Reveal index={6}>
          <View style={[styles.section, styles.gutter]}>
            <Pressable
              onPress={() => setSelectedCard(cardFromPattern(weekly.pattern, "weekly-insight"))}
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
      {coachDeck.length > 0 && (
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
                      onPress={() =>
                        retiredBeat && insight.id === retiredCard?.id
                          ? router.navigate({
                              pathname: "/gozlin",
                              params: { prompt: retiredBeat.prompt },
                            } as never)
                          : setSelectedCard(insight)
                      }
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
        onClose={() => setSelectedCard(null)}
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
          <Pill label="Gozlin" tone={colors.primary} size="sm" icon="sparkles" />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        )}
      </View>
      <AppText variant="callout" style={styles.coachTitle} numberOfLines={1}>
        {insight.title}
      </AppText>
      <AppText
        variant="subhead"
        color="secondary"
        style={styles.coachMsg}
        numberOfLines={2}
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

function StreakStat({
  icon,
  tone,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.streakStat}>
      <View style={[styles.streakIcon, { backgroundColor: alpha(tone, 0.14) }]}>
        <Ionicons name={icon} size={17} color={tone} />
      </View>
      <AppText variant="display" style={styles.streakValue}>
        {value}
      </AppText>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  weeklyHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  weeklyMessage: { marginTop: 2 },
  flex: { flex: 1 },
  gutter: { marginHorizontal: Spacing.screen },
  nudgeBlock: { marginHorizontal: Spacing.screen, marginTop: Spacing.xl },

  // Header
  topBar: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  brand: { fontWeight: "900", marginTop: 3, letterSpacing: -0.2 },
  syncPill: { marginTop: Spacing.sm },

  // Hero
  // One centred group. `justifyContent: center` + a shrinkable (not flexed)
  // info column is what keeps the two pieces together in the middle of the
  // card instead of stretched to its two rules — with the gap, not the card
  // width, deciding how far apart they sit.
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xxl,
  },
  heroInfo: { flexShrink: 1, gap: Spacing.md, alignItems: "center" },
  stat: { alignSelf: "stretch", gap: 1 },
  statRule: { height: 1, alignSelf: "stretch" },
  heroPill: { marginTop: Spacing.xs },
  divider: { height: 1, marginVertical: Spacing.xl },
  macroRow: { flexDirection: "row", gap: Spacing.lg },
  // Centred, not left-aligned: a label and a figure that describe a bar belong
  // over the middle of it. Left-aligned they read as three ragged columns
  // pulling the whole card toward its left edge.
  macroCol: { flex: 1, gap: 6, alignItems: "center" },
  macroHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  // alignSelf is load-bearing: the column centres its children, which would
  // otherwise shrink the bar to nothing.
  macroBar: { marginTop: 2, alignSelf: "stretch" },

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

  // Streak strip
  streakBlock: { marginTop: Spacing.xxxl },
  streakStrip: { flexDirection: "row", alignItems: "center" },
  streakStat: { flex: 1, alignItems: "center", gap: 5 },
  streakIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  streakValue: { fontWeight: "800", marginTop: 2 },
  streakSep: { width: 1, height: 44, opacity: 0.9 },
  streakMotivation: { marginTop: Spacing.lg },

  // Sections
  section: { marginTop: Spacing.xxxl },

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
