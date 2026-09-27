/**
 * The two cards that make the screen honest:
 *
 *   · UP NEXT — the next few notifications, read off the OS queue (not off
 *     settings), with when each fires and whether it carries a button. If the
 *     queue disagrees with what the user switched on, this is where it shows.
 *   · FROM YOUR LOCK SCREEN — the receipt for every press: what was logged, to
 *     which day, and — just as visibly — a press that could NOT be counted, and
 *     why. A button that fails silently teaches people the buttons don't work.
 */
import { AppText, Card, Divider, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import type { JournalEntry } from "@/services/notifications/journal";
import type { QueueKind, QueuedNotification } from "@/services/notifications/queue";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { agoLabel, plural, whenLabel } from "./format";

const KIND_ICON: Record<QueueKind, keyof typeof Ionicons.glyphMap> = {
  habit: "repeat",
  meal: "restaurant",
  water: "water",
  workout: "barbell",
  coach: "sparkles",
  other: "notifications",
};

function useKindTone(): Record<QueueKind, string> {
  const { colors } = useColors();
  return {
    habit: colors.warning,
    meal: colors.success,
    water: colors.water,
    workout: colors.primary,
    coach: colors.gold,
    other: colors.textTertiary,
  };
}

/** How many upcoming notifications the card lists. */
const UP_NEXT_ROWS = 5;

export function UpNextCard({ queue }: { queue: QueuedNotification[] }) {
  const { colors } = useColors();
  const tone = useKindTone();
  const rows = queue.slice(0, UP_NEXT_ROWS);

  return (
    <Card padding="lg">
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="moon-outline" size={18} color={colors.textTertiary} />
          <AppText variant="footnote" color="tertiary" style={styles.flex}>
            Nothing is scheduled on this phone right now.
          </AppText>
        </View>
      ) : (
        rows.map((q, i) => (
          <View key={q.id}>
            {i > 0 && <Divider spacing={0} />}
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: alpha(tone[q.kind], 0.14) }]}>
                <Ionicons name={KIND_ICON[q.kind]} size={14} color={tone[q.kind]} />
              </View>
              <View style={styles.flex}>
                <AppText variant="body" weight="600" numberOfLines={1}>
                  {q.title || "Reminder"}
                </AppText>
                <AppText variant="caption" color="tertiary" numberOfLines={1}>
                  {q.next ? whenLabel(q.next) : "Shortly"}
                  {q.repeats ? " · repeats" : ""}
                </AppText>
              </View>
              {q.actionable ? (
                <Ionicons
                  name="hand-left-outline"
                  size={15}
                  color={colors.textTertiary}
                  accessibilityLabel="Has a lock-screen button"
                />
              ) : null}
            </View>
          </View>
        ))
      )}
      {queue.length > UP_NEXT_ROWS ? (
        <AppText variant="caption" color="tertiary" style={styles.more}>
          and {plural(queue.length - UP_NEXT_ROWS, "more")} after that
        </AppText>
      ) : null}
    </Card>
  );
}

/** How many receipts the card lists. */
const JOURNAL_ROWS = 6;

export function LockScreenJournalCard({ journal }: { journal: JournalEntry[] }) {
  const { colors } = useColors();
  const tone = useKindTone();
  const rows = journal.slice(0, JOURNAL_ROWS);

  return (
    <Card padding="lg">
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
          <AppText variant="footnote" color="tertiary" style={styles.flex}>
            Nothing yet. When you press a button on a reminder, it shows up here —
            with where it was logged.
          </AppText>
        </View>
      ) : (
        rows.map((e, i) => (
          <View key={e.id}>
            {i > 0 && <Divider spacing={0} />}
            <View style={styles.row}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: alpha(e.ok ? tone[e.kind] : colors.warning, 0.14) },
                ]}
              >
                <Ionicons
                  name={e.ok ? "checkmark" : "alert"}
                  size={14}
                  color={e.ok ? tone[e.kind] : colors.warning}
                />
              </View>
              <View style={styles.flex}>
                <AppText variant="body" weight="600" numberOfLines={1}>
                  {e.title}
                </AppText>
                <AppText variant="caption" color={e.ok ? "tertiary" : colors.warning}>
                  {e.detail}
                </AppText>
              </View>
              <AppText variant="caption" color="tertiary">
                {agoLabel(e.at)}
              </AppText>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  more: { marginTop: Spacing.sm },
});
