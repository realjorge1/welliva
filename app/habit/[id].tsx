/**
 * HABIT DETAIL — hero identity, this week at a glance, the three stat tiles
 * (streak, best, last-30-days), the full history grid, and the Mark done / Undo
 * today action.
 *
 * THE HISTORY GRID IS NOT IN A CARD, deliberately. It used to be, and the cells
 * were sized in fixed points — twenty weeks at 12pt is 328pt of grid, which a
 * card on a 360pt phone gives about 280pt to. The last two months of someone's
 * history were being drawn off the right edge of the screen. Nesting a grid
 * that must span the full content width inside a card that takes 40pt of
 * padding was the whole problem, so the card is gone: the grid measures the
 * page and sizes its own cells to land flush with everything else on it.
 *
 * THE HEADER CARRIES BOTH OF THE HABIT'S OWN VERBS — edit, then delete, in that
 * order, and only for habits the user added. Edit comes first because it is the
 * one people reach for; delete sits outboard of it, behind a confirmation that
 * says in as many words that the history survives. That last part is the whole
 * design: people do not stop tracking a thing because they want the past
 * deleted, they stop because the present changed, and a tracker that treats
 * those as the same event punishes them for being honest about it.
 */
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import { HabitWeekStrip } from "@/components/habits/HabitWeekStrip";
import { GozlinToast, useToast } from "@/components/gozlin/GozlinToast";
import { ReminderMoveCard } from "@/components/smart/ReminderMoveCard";
import { useReceipts } from "@/components/smart/receipt";
import { SmartCard } from "@/components/smart/SmartCard";
import { useAnchorChoices } from "@/components/smart/useAnchors";
import { useSmartLedger, useSmartMoment } from "@/components/smart/useSmartMoment";
import {
  ANCHOR_OFFER_PRIORITY,
  KEEP_DAYS,
  anchorCopy,
  anchorReminder,
  answerFor,
  answerSmart,
  habitDayCopy,
  habitDayOffer,
  isStruggling,
  type AnchorOffer,
  type HabitDayOffer,
  type MoveSuggestion,
} from "@/services/smart";
import { useReminderMoveActions, useReminderMoves } from "@/components/smart/useReminderMoves";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { IconBadge } from "@/components/ui/IconBadge";
import { Screen } from "@/components/ui/Screen";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useSystem } from "@/contexts/AppContext";
import { canRetire, useHabits } from "@/contexts/HabitsContext";
import { frequencyLabel, retiredSummaryLine } from "@/models/habit";
import { buildHeatWeeks, monthLabels, retiredRecordFor } from "@/services/HabitService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HISTORY_WEEKS = 20;

const SOURCE_HINT: Record<string, string> = {
  water: "Tracked automatically — completes when you hit your daily water goal.",
  meals: "Tracked automatically — completes when you log a meal for the day.",
  workout: "Tracked automatically — completes when you finish a workout.",
};

export default function HabitDetailScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getView, toggleToday, updateHabit, deleteHabit, paused } = useHabits();
  const { currentDate } = useSystem();

  // The width the page actually gives its content, measured once on layout.
  // The grid can't be sized from a constant — screen gutters, safe areas and
  // font scale all move it — so it's measured rather than assumed.
  const [contentWidth, setContentWidth] = useState(0);
  const onMeasure = (e: LayoutChangeEvent) =>
    setContentWidth(e.nativeEvent.layout.width);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reminders that move themselves: this habit's offer, if it has one and the
  // quiet layer lets it through today (services/smart). Hooks before the
  // not-found return below.
  const moves = useReminderMoves();
  const ownMoves = useMemo(
    () => moves.filter((m) => m.target.kind === "habit" && m.target.habitId === String(id)),
    [moves, id],
  );
  // …and a weekday it keeps being missed on: "Move it off Thursdays?"
  const ownView = getView(String(id));
  const dayOffer = useMemo(
    () =>
      ownView
        ? habitDayOffer({ habit: ownView.habit, done: ownView.done, paused, today: currentDate })
        : null,
    [ownView, paused, currentDate],
  );
  // …and, when it's struggling, one offer to tie it to something they already
  // do. Asked once: any answer ends it.
  const [topAnchor] = useAnchorChoices(String(id));
  const { answers } = useSmartLedger();
  const anchorOffer = useMemo<AnchorOffer | null>(() => {
    if (!ownView || !topAnchor) return null;
    const offerId = `anchor-offer:${ownView.habit.id}`;
    if (answerFor(answers, offerId)) return null;
    if (!isStruggling(ownView.habit, ownView.done, paused, currentDate)) return null;
    return {
      id: offerId,
      feature: "anchor",
      kind: "offer",
      priority: ANCHOR_OFFER_PRIORITY,
      habitId: ownView.habit.id,
      habitName: ownView.habit.name,
      anchor: topAnchor,
    };
  }, [ownView, topAnchor, answers, paused, currentDate]);
  const candidates = useMemo<(MoveSuggestion | HabitDayOffer | AnchorOffer)[]>(
    () => [...ownMoves, ...(dayOffer ? [dayOffer] : []), ...(anchorOffer ? [anchorOffer] : [])],
    [ownMoves, dayOffer, anchorOffer],
  );
  const offer = useSmartMoment("habit", candidates);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const show = useReceipts(toast);
  const { move, keep } = useReminderMoveActions({ show });

  // Undo runs seconds later: it must act on the habit as it is THEN (new
  // notification ids), not as it was when the move was made.
  const latestView = useRef(getView);
  latestView.current = getView;
  const moveOffDay = useCallback(
    async (o: HabitDayOffer) => {
      const habit = latestView.current(o.habitId)?.habit;
      if (!habit) return;
      const before = habit.days;
      await updateHabit({ ...habit, days: before.filter((d) => d !== o.weekday) });
      await answerSmart({ id: o.id, feature: "hard-day", answer: "accepted" });
      show({
        message: habitDayCopy(o).done,
        onUndo: async () => {
          const now = latestView.current(o.habitId)?.habit;
          if (now) await updateHabit({ ...now, days: before });
          await answerSmart({ id: o.id, feature: "hard-day", answer: "declined", coolDownDays: KEEP_DAYS });
        },
      });
    },
    [updateHabit, show],
  );
  const tieToAnchor = useCallback(
    async (o: AnchorOffer) => {
      const habit = latestView.current(o.habitId)?.habit;
      if (!habit) return;
      const prior = { anchor: habit.anchor ?? null, reminder: habit.reminder };
      await updateHabit({
        ...habit,
        anchor: {
          kind: o.anchor.kind,
          label: o.anchor.label,
          ...(o.anchor.habitId ? { habitId: o.anchor.habitId } : {}),
        },
        reminder: anchorReminder(o.anchor),
      });
      await answerSmart({ id: o.id, feature: "anchor", answer: "accepted" });
      show({
        message: `${anchorCopy(o.anchor).accept}. Reminder moved to match.`,
        onUndo: async () => {
          const now = latestView.current(o.habitId)?.habit;
          if (now) await updateHabit({ ...now, ...prior });
          await answerSmart({ id: o.id, feature: "anchor", answer: "declined" });
        },
      });
    },
    [updateHabit, show],
  );

  const view = getView(String(id));
  if (!view) {
    return (
      <Screen>
        <AppText variant="headline" style={{ marginTop: Spacing.huge }}>
          Habit not found
        </AppText>
        <Button label="Back" variant="tonal" onPress={() => router.back()} style={{ marginTop: Spacing.xl }} />
      </Screen>
    );
  }

  const { habit, stats, done } = view;
  const weeks = buildHeatWeeks(habit, done, currentDate, HISTORY_WEEKS, paused);
  const months = monthLabels(weeks);
  const isManual = habit.source === "manual";
  const quota = habit.weeklyGoal != null;
  const removable = canRetire(habit);

  // What the confirmation promises stays. Built from the SAME frozen record the
  // retirement itself will store, so the sheet cannot describe a past that the
  // archive then remembers differently.
  const kept = removable ? retiredRecordFor(habit, done) : null;

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }} />
      {/* Edit, then delete. The auto-tracked habits get neither: there is
          nothing to edit about "completes when you log a meal", and removing
          one would only make the tracker disagree with the app. */}
      {isManual && (
        <Pressable
          hitSlop={12}
          onPress={() => router.push(`/habit/new?id=${habit.id}` as any)}
          accessibilityRole="button"
          accessibilityLabel="Edit habit"
          style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons name="pencil" size={17} color={colors.text} />
        </Pressable>
      )}
      {removable && (
        <Pressable
          hitSlop={12}
          onPress={() => setConfirmDelete(true)}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${habit.name}`}
          accessibilityHint="Stops tracking this habit. Its history is kept."
          style={[
            styles.iconBtn,
            styles.headerGap,
            { backgroundColor: alpha(colors.error, 0.12) },
          ]}
        >
          <Ionicons name="trash-outline" size={17} color={colors.error} />
        </Pressable>
      )}
    </View>
  );

  return (
    <>
    <Screen header={header}>
      {/* Hero identity. It also doubles as the ruler: it's a full-width block
          with no gutter of its own, so its measured width IS the width the
          history grid below has to fit into. */}
      <View style={styles.hero} onLayout={onMeasure}>
        <IconBadge name={habit.icon as any} tone={habit.color} size={72} />
        <AppText variant="display" align="center" style={{ marginTop: Spacing.lg }}>
          {habit.name}
        </AppText>
        <AppText variant="subhead" color="secondary" align="center" style={{ marginTop: 2 }}>
          {frequencyLabel(habit.days, habit.weeklyGoal)}
        </AppText>
      </View>

      {/* This week — the goal's home. Sits above the stat tiles because it is
          the only figure on this page that is still in play. */}
      <Card padding="lg" style={styles.weekCard}>
        <HabitWeekStrip habit={habit} stats={stats} done={done} today={currentDate} />
      </Card>

      {/* A reminder that could move to when this habit actually happens —
          shown only when the pattern is steady and the quiet layer allows it. */}
      {offer && isManual && offer.feature === "reminder-move" && (
        <ReminderMoveCard move={offer} where="own" onMove={move} onKeep={keep} style={styles.offer} />
      )}
      {offer && isManual && offer.feature === "anchor" && (
        <SmartCard
          icon="link-outline"
          message={anchorCopy(offer.anchor).strugglingOffer}
          source={anchorCopy(offer.anchor).source}
          primary={{ label: anchorCopy(offer.anchor).accept, onPress: () => void tieToAnchor(offer) }}
          secondary={{
            label: anchorCopy(offer.anchor).decline,
            onPress: () => void answerSmart({ id: offer.id, feature: "anchor", answer: "declined" }),
          }}
          style={styles.offer}
        />
      )}
      {offer && isManual && offer.feature === "hard-day" && (
        <SmartCard
          icon="calendar-outline"
          message={habitDayCopy(offer).message}
          source={habitDayCopy(offer).source}
          primary={{ label: habitDayCopy(offer).accept, onPress: () => void moveOffDay(offer) }}
          secondary={{
            label: habitDayCopy(offer).decline,
            onPress: () =>
              void answerSmart({
                id: offer.id,
                feature: "hard-day",
                answer: "declined",
                coolDownDays: KEEP_DAYS,
              }),
          }}
          style={styles.offer}
        />
      )}

      {/* Stat tiles */}
      <View style={styles.tiles}>
        <StatTile
          icon="flame"
          tone="#FF9F45"
          value={`${stats.currentStreak}`}
          label={quota ? "week streak" : "day streak"}
        />
        <StatTile icon="trophy" tone="#E9C16B" value={`${stats.bestStreak}`} label="best" />
        <StatTile icon="stats-chart" tone={habit.color} value={`${stats.last30Pct}%`} label="last 30 days" />
      </View>

      {/* History — no card; the grid sizes itself to the page. */}
      <View style={styles.historyHead}>
        <AppText variant="headline">History</AppText>
        <AppText variant="footnote" color="tertiary">
          {HISTORY_WEEKS} weeks
        </AppText>
      </View>
      {contentWidth > 0 && (
        <HabitHeatmap
          weeks={weeks}
          color={habit.color}
          fitWidth={contentWidth}
          gap={3}
          months={months}
          dayLabels
        />
      )}

      {/* Action */}
      {isManual ? (
        <Button
          label={stats.doneToday ? "Undo today" : "Mark today done"}
          icon={stats.doneToday ? "arrow-undo" : "checkmark"}
          variant={stats.doneToday ? "tonal" : "primary"}
          size="lg"
          onPress={() => toggleToday(habit.id)}
          style={{ marginTop: Spacing.xxl }}
        />
      ) : (
        <Card padding="xl" style={{ marginTop: Spacing.xxl }}>
          <View style={styles.hintRow}>
            <Ionicons name="flash" size={16} color={habit.color} />
            <AppText variant="subhead" color="secondary" style={{ flex: 1 }}>
              {SOURCE_HINT[habit.source]}
            </AppText>
          </View>
        </Card>
      )}

      {/* Deleting is a decision about the FUTURE, and the sheet says so. The
          reassurance line is not boilerplate: it quotes this habit's own record
          back, because "your history is kept" is an abstraction and "43 days,
          almost every day for 9 weeks" is the thing the user is actually afraid
          of losing. */}
      <ConfirmSheet
        visible={confirmDelete}
        title={`Stop tracking ${habit.name}?`}
        body="It comes off your habits list and its reminders stop. You can always add it back later."
        reassurance={
          kept && kept.totalDone > 0
            ? `Your record stays: ${kept.totalDone} day${
                kept.totalDone === 1 ? "" : "s"
              } done, ${retiredSummaryLine(kept)}. Gozlin still remembers it.`
            : "Nothing is erased from Gozlin's memory — only the tracker stops."
        }
        confirmLabel="Delete habit"
        cancelLabel="Keep tracking it"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          // Leave BEFORE the delete lands. This screen is addressed by the
          // habit's id; the moment it retires, `getView` returns undefined and
          // the page would flash its "Habit not found" state on the way out.
          router.back();
          void deleteHabit(habit.id);
        }}
      />
    </Screen>
    {/* Outside the scroll region, so it floats over the page, not its end. */}
    <GozlinToast controller={toast} topOffset={insets.top} />
    </>
  );
}

function StatTile({
  icon,
  tone,
  value,
  label,
}: {
  icon: string;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <Card padding="lg" style={styles.tile}>
      <Ionicons name={icon as any} size={18} color={tone} />
      <AppText variant="title" style={{ marginTop: Spacing.xs }}>
        {value}
      </AppText>
      <AppText variant="footnote" color="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerGap: { marginLeft: Spacing.sm },
  hero: {
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  weekCard: { marginBottom: Spacing.sm },
  offer: { marginBottom: Spacing.sm },
  tiles: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: "center",
  },
  historyHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
