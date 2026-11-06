/**
 * SessionComplete — the end of a session: one moment, one reading, one question.
 *
 *   ( ✕ )                                  [ 🔥 4-DAY STREAK ]
 *   ┌──────────── the flame on a floor lit end to end ───────┐
 *   └────────────────────────────────────────────────────────┘
 *   Session complete                                       ✓
 *   TODAY 7:31 AM · FULL BODY
 *   32:40 TIME
 *   ▪▪ ▪▪ ▪▪ … the session, drawn on from the left
 *   SETS 18/19        REPS 168        HELD 2:15
 *   HOW DID THAT FEEL?   [Easy] [Just right] [Hard]
 *   [ CONTINUE  → ]
 *
 * The order of arrival is the animation: the floor lights from the middle out —
 * every panel the sets spent, back on at once — the flame catches on it (the
 * app's one celebration hero: no confetti, no medallion, no word on the wall),
 * the streak chip lands, the strip draws itself on.
 * Then, after the beat the owner asked for, the one question — already answered
 * "Just right", so Continue alone is a complete reply.
 *
 * THE ANSWER SITS ON THE FLOOR and is laid out from the first frame, revealed in
 * place: mounting it late would shrink the stage mid-celebration and jolt the
 * flame upward (owner, 2026-10-15). The close button banks the session with the
 * answer as it stands — nothing is saved until one of the two is pressed.
 *
 * The streak chip shows the run as it stands now. If this workout is what keeps
 * today, the app's own flame screen marks that the moment it is logged.
 */
import { FLAME_ASPECT, Flame } from "@/components/celebration/Flame";
import { AppText, Mono, useColors } from "@/components/ui";
import { EDGE_WHITE, HOME_ORANGE, INSTRUMENT_CARD, ON_ORANGE } from "@/components/home/surface";
import { Ease } from "@/components/motion";
import { Motion, Radius, Spacing, alpha } from "@/constants/theme";
import type { SessionEffort, SessionState } from "@/models/session";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { PrimaryPill } from "./SessionControls";
import { SessionChart } from "./SessionChart";
import { SessionHero, type Stage } from "./SessionHero";
import { chartColumns } from "./sessionChartLayout";
import { formatClock, sessionTotals } from "./sessionTotals";

const EFFORT_OPTIONS: {
  key: SessionEffort;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { key: "easy", icon: "leaf-outline", label: "Easy" },
  { key: "right", icon: "checkmark-circle-outline", label: "Just right" },
  // Not a flame: the flame is this screen's hero, and a second one under it
  // would read as "hard = good".
  { key: "hard", icon: "pulse-outline", label: "Hard" },
];

/** The floor starts to light just before the flame catches… */
const FLOOR_FROM_MS = 380;
/** …and comes on in this many steps, this far apart. */
const FLOOR_STEPS = 10;
const FLOOR_STEP_MS = 60;
/** The flame starts to catch on the lit floor. */
const FLAME_DELAY_MS = 520;
/** Then the streak chip. */
const CHIP_DELAY_MS = 1150;
/** Let the celebration land before anything asks for an answer. */
const ASK_AFTER_MS = 1500;

export interface SessionCompleteProps {
  state: SessionState;
  /** The commitment run as it stands; 0 shows no chip. */
  streak: number;
  /** A short phone: the strip is left off the card so the stage keeps its room. */
  compact: boolean;
  bottomInset: number;
  onFinish: (effort: SessionEffort) => void;
}

/** "7:31 AM", in the phone's own style. */
function clockTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "TODAY 7:31 AM", or the date when the session began on another day. */
function startedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TODAY";
  const today = new Date().toDateString() === d.toDateString();
  const day = today ? "Today" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day} ${clockTime(d)}`.toUpperCase();
}

export function SessionComplete({ state, streak, compact, bottomInset, onFinish }: SessionCompleteProps) {
  const { colors } = useColors();
  const [effort, setEffort] = useState<SessionEffort>("right");
  const [asking, setAsking] = useState(false);
  const reveal = useSharedValue(0);
  const reduced = useReducedMotion();

  // The floor lights from the flame outward as it catches — the panels a set
  // spent, all on at once for the whole session.
  const [floorLit, setFloorLit] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    let lit = 0;
    let step: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      step = setInterval(() => {
        lit += 1;
        setFloorLit(lit / FLOOR_STEPS);
        if (lit >= FLOOR_STEPS && step) clearInterval(step);
      }, FLOOR_STEP_MS);
    }, FLOOR_FROM_MS);
    return () => {
      clearTimeout(start);
      if (step) clearInterval(step);
    };
  }, [reduced]);

  useEffect(() => {
    const id = setTimeout(() => setAsking(true), ASK_AFTER_MS);
    return () => clearTimeout(id);
  }, []);
  // The block's entrance (a 25pt drop on the slow decelerate), played where it already stands.
  useEffect(() => {
    if (!asking) return;
    reveal.value = withTiming(1, { duration: Motion.duration.slow, easing: Ease.decelerate });
  }, [asking, reveal]);
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * -25 }],
  }));

  const columns = useMemo(
    () =>
      chartColumns({
        exercises: state.exercises,
        results: state.results,
        phase: "COMPLETE",
        exerciseIndex: state.currentExerciseIndex,
        set: state.currentSet,
        timer: 0,
      }),
    [state.exercises, state.results, state.currentExerciseIndex, state.currentSet],
  );

  const totals = useMemo(() => {
    const timed = new Set(
      state.exercises.filter((e) => e.exerciseType === "timed").map((e) => e.exerciseId),
    );
    return sessionTotals(state.results, (id) => timed.has(id), {
      setsTotal: state.exercises.reduce((sum, e) => sum + e.sets, 0),
      movesTotal: state.exercises.length,
    });
  }, [state.exercises, state.results]);

  const stats: { label: string; value: string; unit?: string }[] = [
    { label: "Sets", value: `${totals.setsDone}`, unit: `/${totals.setsTotal}` },
  ];
  if (totals.reps > 0) stats.push({ label: "Reps", value: `${totals.reps}` });
  if (totals.heldSeconds > 0) stats.push({ label: "Held", value: formatClock(totals.heldSeconds) });
  if (stats.length < 2) {
    stats.push({ label: "Moves", value: `${totals.movesDone}`, unit: `/${totals.movesTotal}` });
  }

  const finish = () => onFinish(effort);

  return (
    <View
      style={[
        styles.root,
        compact && styles.rootCompact,
        { paddingBottom: Math.max(bottomInset, Spacing.lg) },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={finish}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close and save this workout"
          style={({ pressed }) => [
            styles.close,
            { backgroundColor: colors.surfaceElevated },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
        {streak > 0 ? (
          <Reanimated.View
            entering={ZoomIn.delay(CHIP_DELAY_MS).springify().damping(13).stiffness(180)}
            style={styles.streak}
            accessible
            accessibilityLabel={`${streak} day streak`}
          >
            <Ionicons name="flame" size={13} color={ON_ORANGE} />
            <Mono size={11} weight="700" tracking={0.6} color={ON_ORANGE}>
              {`${streak}-DAY STREAK`}
            </Mono>
          </Reanimated.View>
        ) : null}
      </View>

      <SessionHero
        style={[styles.hero, compact && styles.heroCompact]}
        glow={HOME_ORANGE}
        floor={{ lit: floorLit, color: HOME_ORANGE, flood: true }}
        renderFigure={(stage) => <FlameOnFloor stage={stage} />}
      />

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <AppText variant="headline" weight="600" numberOfLines={1} style={styles.flex}>
            Session complete
          </AppText>
          <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
        </View>
        <Mono size={11} tracking={0.6} color={colors.textTertiary} numberOfLines={1}>
          {`${startedLabel(state.startedAt)} · ${state.sessionLabel.toUpperCase()}`}
        </Mono>
        <View
          style={styles.timeRow}
          accessible
          accessibilityLabel={`Time ${formatClock(state.elapsedSeconds)}`}
        >
          <Text
            style={[styles.time, compact && styles.timeCompact, { color: colors.text }]}
            maxFontSizeMultiplier={1.15}
          >
            {formatClock(state.elapsedSeconds)}
          </Text>
          <Mono size={11} tracking={0.6} color={colors.textTertiary}>
            TIME
          </Mono>
        </View>
        {compact ? null : <SessionChart columns={columns} cursor={null} stripHeight={30} drawOn />}
        <View style={[styles.rule, { backgroundColor: colors.divider }]} />
        <View style={styles.stats}>
          {stats.map((s) => (
            <View
              key={s.label}
              style={styles.stat}
              accessible
              accessibilityLabel={`${s.label} ${s.value}${s.unit ?? ""}`}
            >
              <Mono size={10} tracking={0.6} color={colors.textTertiary}>
                {s.label.toUpperCase()}
              </Mono>
              <View style={styles.statRow}>
                <AppText variant={compact ? "headline" : "title"} weight="500" style={styles.statValue}>
                  {s.value}
                </AppText>
                {s.unit ? (
                  <Mono size={11} color={colors.textTertiary}>
                    {s.unit}
                  </Mono>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>

      <Reanimated.View
        style={[styles.answer, revealStyle]}
        // Invisible until asked: not tappable, and not read out either.
        pointerEvents={asking ? "auto" : "none"}
        accessibilityElementsHidden={!asking}
        importantForAccessibility={asking ? "auto" : "no-hide-descendants"}
      >
        <Mono size={11} tracking={0.6} color={colors.textSecondary}>
          HOW DID THAT FEEL?
        </Mono>
        <View style={styles.effortRow}>
          {EFFORT_OPTIONS.map((opt) => {
            const active = opt.key === effort;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setEffort(opt.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={opt.label}
                style={({ pressed }) => [
                  styles.effort,
                  compact && styles.effortCompact,
                  {
                    borderColor: active ? colors.primary : EDGE_WHITE,
                    backgroundColor: active ? alpha(colors.primary, 0.14) : colors.surface,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={opt.icon} size={16} color={active ? colors.primary : colors.textTertiary} />
                <AppText
                  variant="footnote"
                  weight="600"
                  color={active ? "brand" : "secondary"}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Reanimated.View>

      <PrimaryPill label="Continue" icon="arrow-forward" tone="brand" onPress={finish} />
    </View>
  );
}

/** The flame stands on the stage's floor, its foot on the line. */
function FlameOnFloor({ stage }: { stage: Stage }) {
  const size = Math.round(
    Math.max(48, Math.min(150, (stage.floorY * 0.66) / FLAME_ASPECT, stage.width * 0.42)),
  );
  const height = size * FLAME_ASPECT;
  return (
    <View
      style={[
        styles.flame,
        { left: (stage.width - size) / 2, top: stage.floorY - height * 0.936 },
      ]}
    >
      <Flame size={size} entrance="ignite" delay={FLAME_DELAY_MS} flickerCycles={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, paddingHorizontal: Spacing.screen, gap: Spacing.md },
  // A 569dp phone: everything around the stage a notch tighter, so the stage
  // keeps a real room and Continue stays on the screen at a large font.
  rootCompact: { gap: Spacing.sm + 2 },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ scale: 0.96 }] },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: HOME_ORANGE,
  },
  // The stage gives way before Continue does.
  hero: { flex: 1, minHeight: 96 },
  heroCompact: { minHeight: 72 },
  flame: { position: "absolute" },
  card: { ...INSTRUMENT_CARD, paddingTop: Spacing.md, paddingBottom: Spacing.md, gap: 2 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  timeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  time: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "500",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  timeCompact: { fontSize: 38, lineHeight: 44 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: Spacing.sm, marginBottom: Spacing.md },
  stats: { flexDirection: "row", gap: Spacing.md },
  stat: { flex: 1, gap: 2 },
  statRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  statValue: { fontVariant: ["tabular-nums"] },
  answer: { gap: Spacing.sm },
  effortRow: { flexDirection: "row", gap: Spacing.sm },
  effort: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  effortCompact: { height: 40 },
});
