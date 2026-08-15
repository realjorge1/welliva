/**
 * CoachDeepDive — the rich modal behind every "Your coach" card.
 *
 * A calm, full-height sheet that turns a one-line coach card into the real story
 * underneath it — all of it derived from the user's own logs and the Gozlin Habit
 * Awareness report, never invented:
 *   • the tapped insight, in full
 *   • today's live calorie / hydration / workout standing
 *   • a Skia consistency heatmap of the last few months of real activity
 *   • the journey toward a weight goal (only when there's a goal + weigh-ins)
 *   • strengths and where to lean in, from evidence-backed behavior scores
 *   • the patterns Gozlin has learned and the slips it sees coming
 *
 * Entrance/exit ride Reanimated (scrim fade + sheet rise); the heatmap wipes in
 * on Skia. Everything animates on the UI thread.
 */
import { useApp } from "@/contexts/AppContext";
import { PaywallGate } from "@/components/billing";
import { useGozlinSnapshot } from "@/components/gozlin";
import { Ease } from "@/components/motion/motion";
import {
  AppText,
  Button,
  Card,
  IconBadge,
  Pill,
  ProgressBar,
  Ring,
  SectionHeader,
  useColors,
} from "@/components/ui";
import { Gradients, Motion, Radius, Spacing, alpha } from "@/constants/theme";
import type { BehaviorScore, GozlinHabitReport } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConsistencyHeatmap } from "./ConsistencyHeatmap";
import { buildConsistency } from "./consistency";
import type { CoachCard } from "./coachDeck";

type IconName = keyof typeof Ionicons.glyphMap;

const CELL = 14;
const GAP = 5;

export function CoachDeepDive({
  insight,
  report,
  onClose,
}: {
  insight: CoachCard | null;
  report: GozlinHabitReport;
  onClose: () => void;
}) {
  const { colors } = useColors();
  const app = useApp();
  const { twin } = useGozlinSnapshot();

  const [heatWidth, setHeatWidth] = useState(0);

  // ── Entrance / exit (UI thread) ──
  const enter = useSharedValue(0);
  useEffect(() => {
    if (insight) {
      enter.value = 0;
      enter.value = withTiming(1, {
        duration: Motion.duration.slow,
        easing: Ease.decelerate,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insight?.id]);

  const requestClose = useCallback(
    (after?: () => void) => {
      enter.value = withTiming(
        0,
        { duration: Motion.duration.base, easing: Ease.accelerate },
        (fin) => {
          if (fin) {
            runOnJS(onClose)();
            if (after) runOnJS(after)();
          }
        },
      );
    },
    [enter, onClose],
  );

  const scrimStyle = useAnimatedStyle(() => ({ opacity: enter.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 44 }],
  }));

  const tone =
    insight?.tone === "positive"
      ? colors.success
      : insight?.tone === "warning"
        ? colors.warning
        : colors.primary;

  // ── Today's live meal adherence (today isn't in history yet) ──
  const todayDietAdh = useMemo(() => {
    const s = app.todayDiet?.schedule;
    if (!s) return 0;
    const meals = [s.breakfast, s.lunch, s.dinner, ...s.snacks].filter(
      (m): m is NonNullable<typeof m> => m != null,
    );
    if (meals.length === 0) return 0;
    return meals.filter((m) => m.isConsumed).length / meals.length;
  }, [app.todayDiet]);

  // ── Heatmap matrix from real logs (weeks sized to the measured width) ──
  const consistency = useMemo(() => {
    const weeks = heatWidth > 0
      ? Math.max(8, Math.min(18, Math.floor((heatWidth + GAP) / (CELL + GAP))))
      : 12;
    return buildConsistency({
      dietHistory: app.dietHistory,
      workoutLog: app.workoutLog,
      today: app.currentDate,
      weeks,
      liveToday: { dietAdh: todayDietAdh, workoutDone: twin.today.workout.done },
    });
  }, [
    heatWidth,
    app.dietHistory,
    app.workoutLog,
    app.currentDate,
    todayDietAdh,
    twin.today.workout.done,
  ]);

  const onHeatLayout = useCallback((e: LayoutChangeEvent) => {
    setHeatWidth(e.nativeEvent.layout.width);
  }, []);

  // ── Strengths & focus, from evidence-backed behavior scores ──
  const strengths = useMemo(
    () =>
      [...report.behaviorScores]
        .filter((s) => s.score >= 60)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2),
    [report.behaviorScores],
  );
  const focus = useMemo(
    () =>
      [...report.behaviorScores]
        .filter((s) => s.score < 55)
        .sort((a, b) => a.score - b.score)
        .slice(0, 2),
    [report.behaviorScores],
  );

  const body = twin.body;
  const showJourney =
    body.goalProgress != null && body.startWeightKg != null && body.goalWeightKg != null;

  return (
    <Modal
      visible={!!insight}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => requestClose()}
    >
      <View style={styles.root}>
        <AnimatedPressable
          style={[styles.scrim, { backgroundColor: colors.overlay }, scrimStyle]}
          onPress={() => requestClose()}
        />

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border },
            sheetStyle,
          ]}
        >
          <SafeAreaView edges={[]} style={styles.flex}>
            {/* Grabber + close */}
            <View style={styles.topBar}>
              <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
              <Pressable
                onPress={() => requestClose()}
                hitSlop={12}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceSunken }]}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
            >
              {/* ── Hero: the tapped insight, in full ── */}
              <View style={styles.hero}>
                <IconBadge name={(insight?.icon ?? "sparkles") as IconName} tone={tone} size={64} />
                <AppText variant="title" style={styles.heroTitle}>
                  {insight?.title}
                </AppText>
                <AppText variant="body" color="secondary" style={styles.heroMsg}>
                  {insight?.message}
                </AppText>
                {insight?.isHabit && (
                  <Pill label="From your habits" tone={colors.primary} size="sm" icon="pulse" />
                )}
              </View>

              {/* ── Today, in numbers ── */}
              <SectionHeader title="Today, in numbers" />
              <Card style={styles.block}>
                <View style={styles.trio}>
                  <MiniRing
                    pct={twin.today.calories.pct}
                    gradient={Gradients.calories}
                    label="Calories"
                  />
                  <MiniRing
                    pct={twin.today.water.pct}
                    gradient={Gradients.water}
                    label="Hydration"
                  />
                  <WorkoutRing workout={twin.today.workout} />
                </View>
              </Card>

              {/* ── Consistency heatmap (real logs) ── */}
              <SectionHeader
                title="Your consistency"
                subtitle={`${consistency.activeDays} active ${
                  consistency.activeDays === 1 ? "day" : "days"
                } in the last ${consistency.matrix.length} weeks`}
              />
              <Card style={styles.block}>
                <View onLayout={onHeatLayout} style={styles.heatWrap}>
                  {heatWidth > 0 && (
                    <ConsistencyHeatmap
                      matrix={consistency.matrix}
                      accent={colors.primary}
                      cell={CELL}
                      gap={GAP}
                      animKey={`${insight?.id}-${consistency.matrix.length}`}
                    />
                  )}
                </View>
                <View style={styles.legend}>
                  <AppText variant="caption" color="tertiary">
                    Less
                  </AppText>
                  <View style={styles.legendCells}>
                    {[0.12, 0.35, 0.6, 0.85, 1].map((v) => (
                      <View
                        key={v}
                        style={[
                          styles.legendCell,
                          { backgroundColor: alpha(colors.primary, 0.22 + 0.78 * v) },
                        ]}
                      />
                    ))}
                  </View>
                  <AppText variant="caption" color="tertiary">
                    More
                  </AppText>
                </View>
              </Card>

              {/* ── Journey to goal (only with a goal + weigh-ins) ── */}
              {showJourney && (
                <>
                  <SectionHeader title="Journey to goal" />
                  <Card style={styles.block}>
                    <View style={styles.journeyHead}>
                      <AppText variant="headline">
                        {Math.round((body.goalProgress ?? 0) * 100)}%
                      </AppText>
                      <AppText variant="footnote" color="tertiary">
                        of the way there
                      </AppText>
                    </View>
                    <ProgressBar
                      progress={body.goalProgress ?? 0}
                      gradient={colors.brandGradient}
                      height={10}
                      style={styles.journeyBar}
                    />
                    <View style={styles.journeyLabels}>
                      <JourneyPoint label="Start" value={`${fmtKg(body.startWeightKg)} kg`} />
                      <JourneyPoint
                        label="Now"
                        value={`${fmtKg(body.currentWeightKg)} kg`}
                        emphasize
                      />
                      <JourneyPoint label="Goal" value={`${fmtKg(body.goalWeightKg)} kg`} />
                    </View>
                  </Card>
                </>
              )}

              {/* ── Strengths & focus (behavior scores) ── */}
              {report.dataLimited ? (
                <Card style={styles.block}>
                  <View style={styles.limitedRow}>
                    <IconBadge name="sparkles-outline" tone={colors.primary} size={40} />
                    <AppText variant="subhead" color="secondary" style={styles.flex}>
                      {report.headline}
                    </AppText>
                  </View>
                </Card>
              ) : (
                <>
                  {strengths.length > 0 && (
                    <>
                      <SectionHeader title="You're strong here" subtitle="Keep doing this" />
                      <Card style={styles.block}>
                        {strengths.map((s, i) => (
                          <DomainRow
                            key={s.domain}
                            score={s}
                            kind="strength"
                            divider={i < strengths.length - 1}
                          />
                        ))}
                      </Card>
                    </>
                  )}
                  {focus.length > 0 && (
                    <>
                      <SectionHeader title="Where to lean in" subtitle="A little more of this" />
                      <Card style={styles.block}>
                        {focus.map((s, i) => (
                          <DomainRow
                            key={s.domain}
                            score={s}
                            kind="focus"
                            divider={i < focus.length - 1}
                          />
                        ))}
                      </Card>
                    </>
                  )}
                </>
              )}

              {/* ── The depth: learned patterns + predicted slips ──
                  Everything above this point is today's own numbers and the
                  insight the user already tapped — free, because it is what
                  brings them back daily. What follows is the accumulated
                  "Gozlin knows you" layer, and it is what Pro sells. One gate
                  wraps both sections so a free user gets a single calm card
                  rather than two stacked upsells. */}
              {/* Guarded on there being something to show: with no patterns and
                  no risks yet (a brand-new account) the gate would advertise
                  depth that does not exist for anyone, free or paid. */}
              {(report.patterns.length > 0 || report.risks.length > 0) && (
              <PaywallGate lock="insights">
              {/* ── What Gozlin has learned ── */}
              {report.patterns.length > 0 && (
                <>
                  <SectionHeader title="What I've learned about you" />
                  <Card style={styles.block}>
                    {report.patterns.slice(0, 3).map((p, i) => (
                      <View
                        key={i}
                        style={[
                          styles.learnRow,
                          i < Math.min(3, report.patterns.length) - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: colors.divider,
                          },
                        ]}
                      >
                        <Ionicons
                          name={(p.icon ?? "ellipse-outline") as IconName}
                          size={17}
                          color={colors.primary}
                          style={styles.learnIcon}
                        />
                        <AppText variant="subhead" color="secondary" style={styles.flex}>
                          {p.message}
                        </AppText>
                      </View>
                    ))}
                  </Card>
                </>
              )}

              {/* ── What I see coming ── */}
              {report.risks.length > 0 && (
                <>
                  <SectionHeader title="What I see coming" />
                  <Card style={styles.block}>
                    {report.risks.slice(0, 2).map((r, i) => {
                      const c =
                        r.likelihood >= 0.66
                          ? colors.error
                          : r.likelihood >= 0.4
                            ? colors.warning
                            : colors.textSecondary;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.riskRow,
                            i < Math.min(2, report.risks.length) - 1 && {
                              borderBottomWidth: 1,
                              borderBottomColor: colors.divider,
                            },
                          ]}
                        >
                          <View style={[styles.riskIcon, { backgroundColor: alpha(c, 0.14) }]}>
                            <Ionicons name={r.icon as IconName} size={15} color={c} />
                          </View>
                          <View style={styles.flex}>
                            <View style={styles.riskHead}>
                              <AppText variant="callout" style={styles.flex}>
                                {r.title}
                              </AppText>
                              <View style={[styles.whenPill, { backgroundColor: alpha(c, 0.14) }]}>
                                <AppText variant="caption" style={{ color: c }}>
                                  {r.whenLabel}
                                </AppText>
                              </View>
                            </View>
                            {r.why.length > 0 && (
                              <AppText variant="caption" color="tertiary">
                                {r.why.join(" · ")}
                              </AppText>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                </>
              )}
              </PaywallGate>
              )}

              {/* ── CTA ── */}
              <Button
                label="Talk to Gozlin about this"
                icon="chatbubbles"
                onPress={() => requestClose(() => router.push("/gozlin"))}
                style={styles.cta}
              />
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ── Local pieces ── */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MiniRing({
  pct,
  gradient,
  label,
}: {
  pct: number;
  gradient: readonly [string, string, ...string[]];
  label: string;
}) {
  return (
    <View style={styles.mini}>
      <Ring progress={pct} size={72} strokeWidth={7} gradient={gradient}>
        <AppText variant="callout">{Math.round(Math.min(pct, 2) * 100)}%</AppText>
      </Ring>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
    </View>
  );
}

function WorkoutRing({
  workout,
}: {
  workout: { planned: string | null; done: boolean; minutes: number };
}) {
  const { colors } = useColors();
  const done = workout.done;
  const rest = !workout.planned;
  const progress = done || rest ? 1 : 0;
  const gradient = done
    ? Gradients.protein
    : rest
      ? ([colors.textTertiary, colors.textTertiary] as const)
      : Gradients.fat;
  const icon: IconName = done ? "checkmark" : rest ? "bed-outline" : "barbell-outline";
  return (
    <View style={styles.mini}>
      <Ring progress={progress} size={72} strokeWidth={7} gradient={gradient}>
        <Ionicons name={icon} size={22} color={done ? colors.success : colors.textSecondary} />
      </Ring>
      <AppText variant="caption" color="tertiary" uppercase>
        {done ? "Trained" : rest ? "Rest" : "Workout"}
      </AppText>
    </View>
  );
}

function DomainRow({
  score,
  kind,
  divider,
}: {
  score: BehaviorScore;
  kind: "strength" | "focus";
  divider: boolean;
}) {
  const { colors } = useColors();
  const c = kind === "strength" ? colors.success : colors.primary;
  return (
    <View
      style={[
        styles.domainRow,
        divider && { borderBottomWidth: 1, borderBottomColor: colors.divider },
      ]}
    >
      <View style={[styles.domainIcon, { backgroundColor: alpha(c, 0.14) }]}>
        <Ionicons name={score.icon as IconName} size={16} color={c} />
      </View>
      <View style={styles.flex}>
        <View style={styles.domainHead}>
          <AppText variant="callout">{score.label}</AppText>
          <View style={[styles.tag, { backgroundColor: alpha(c, 0.14) }]}>
            <Ionicons
              name={kind === "strength" ? "arrow-up" : "add"}
              size={11}
              color={c}
            />
            <AppText variant="caption" style={{ color: c }}>
              {kind === "strength" ? "Keep it up" : "Do more"}
            </AppText>
          </View>
        </View>
        <ProgressBar progress={score.score / 100} tone={c} height={6} style={styles.domainBar} />
        {score.drivers.length > 0 && (
          <AppText variant="caption" color="tertiary">
            {score.drivers.join(" · ")}
          </AppText>
        )}
      </View>
    </View>
  );
}

function JourneyPoint({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.journeyPoint}>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
      <AppText variant={emphasize ? "callout" : "footnote"} color={emphasize ? undefined : "secondary"}>
        {value}
      </AppText>
    </View>
  );
}

function fmtKg(kg: number | null): string {
  return kg == null ? "—" : (Math.round(kg * 10) / 10).toString();
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    height: "94%",
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Fixed height so the absolutely-positioned close button sits fully inside the
  // bar — Android drops touches on any child that overflows its parent's bounds.
  topBar: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  closeBtn: {
    position: "absolute",
    right: Spacing.xl,
    top: 9,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.huge,
  },

  hero: { alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.lg },
  heroTitle: { textAlign: "center" },
  heroMsg: { textAlign: "center", lineHeight: 24 },

  block: { marginTop: Spacing.sm, marginBottom: Spacing.lg },

  trio: { flexDirection: "row", justifyContent: "space-around" },
  mini: { alignItems: "center", gap: Spacing.sm },

  heatWrap: { alignItems: "center", paddingVertical: Spacing.xs },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  legendCells: { flexDirection: "row", gap: 3 },
  legendCell: { width: 12, height: 12, borderRadius: 3 },

  journeyHead: { flexDirection: "row", alignItems: "baseline", gap: Spacing.sm },
  journeyBar: { marginTop: Spacing.md },
  journeyLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  journeyPoint: { gap: 2 },

  limitedRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  domainRow: { flexDirection: "row", gap: Spacing.md, paddingVertical: Spacing.md },
  domainIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  domainHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  domainBar: { marginBottom: 5 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },

  learnRow: { flexDirection: "row", gap: Spacing.sm, paddingVertical: Spacing.md },
  learnIcon: { marginTop: 1 },

  riskRow: { flexDirection: "row", gap: Spacing.md, paddingVertical: Spacing.md },
  riskIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  riskHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: 2 },
  whenPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },

  cta: { marginTop: Spacing.sm },
});
