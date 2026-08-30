/**
 * GozlinHistorySheet — your past conversations with the coach.
 *
 * "New conversation" used to DELETE the thread, which was a strange thing for a
 * coach whose whole pitch is that it remembers you: the advice survived in the
 * memory tiers, but the exchange people actually wanted to re-read was gone.
 * Threads are filed now (GozlinMemoryStore's archive), and this is where they
 * come back.
 *
 * TAPPING A ROW RESUMES IT, rather than opening a read-only transcript. A
 * conversation you can't continue is a screenshot, and the coach can perfectly
 * well pick a thread back up — the live thread is filed on the way past, so
 * switching never costs you the one you were in.
 *
 * Rows are titled with the SAME topic title the coach header shows while you
 * are inside the thread (services/gozlin/conversationTitle) — derived from the
 * user's own words by rule, on device, never written by a model. The row you
 * tap and the header you land on therefore always say the same thing, which is
 * what makes this read as a filing cabinet rather than a log.
 *
 * ── DELETING TAKES TWO TAPS, IN PLACE ───────────────────────────────────────
 *
 * It used to take one, and that one was final: a mis-aimed thumb permanently
 * destroyed a conversation with no confirmation and no undo. The fix is not a
 * dialog — this sheet is a `Modal`, and React Native will not present a second
 * Modal over a live one, so a confirmation sheet raised from here would simply
 * never appear. The trash icon becomes a "Delete?" pill for a few seconds
 * instead, and only the second tap does anything. It expires on its own, and
 * arming one row disarms any other, so there is never more than one live
 * trigger on screen.
 */

import { AppText, Sheet } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { ArchivedConversation } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

/**
 * How long a trash button stays armed before it goes back to being a trash
 * button. Long enough to move a thumb and read the word, short enough that a
 * live delete trigger is never left sitting on a screen you walked away from.
 */
const DISARM_MS = 3500;

interface Props {
  visible: boolean;
  conversations: ArchivedConversation[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function GozlinHistorySheet({
  visible,
  conversations,
  onClose,
  onOpen,
  onDelete,
}: Props) {
  const { colors } = useColors();

  /** The row whose trash button is currently asking "Delete?", if any. */
  const [armed, setArmed] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    disarmTimer.current = null;
  }, []);

  // Closing the sheet must not leave a row armed behind it — reopening to find
  // a delete already half-pressed is exactly the surprise this is preventing.
  useEffect(() => {
    if (!visible) {
      clearTimer();
      setArmed(null);
    }
  }, [visible, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const armOrDelete = useCallback(
    (id: string) => {
      clearTimer();
      if (armed === id) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setArmed(null);
        onDelete(id);
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      setArmed(id);
      disarmTimer.current = setTimeout(() => setArmed(null), DISARM_MS);
    },
    [armed, onDelete, clearTimer],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <AppText variant="headline">Chat history</AppText>
        <AppText variant="footnote" color="tertiary" style={styles.sub}>
          {conversations.length === 0
            ? "Nothing filed yet"
            : `${conversations.length} past ${
                conversations.length === 1 ? "conversation" : "conversations"
              }`}
        </AppText>
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} header={header} maxHeightRatio={0.78}>
      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: alpha(colors.primary, 0.12) }]}>
            <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
          </View>
          <AppText variant="subhead" color="secondary" align="center" style={styles.emptyText}>
            Start a new conversation and this one gets filed here — nothing you
            say to Gozlin is thrown away.
          </AppText>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {conversations.map((c) => (
            <View key={c.id} style={styles.row}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onClose();
                  setTimeout(() => onOpen(c.id), 60);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Resume conversation: ${c.title}`}
                accessibilityHint={`${c.messages.length} messages, ${when(c.endedAt)}`}
                style={({ pressed }) => [
                  styles.rowMain,
                  pressed && { backgroundColor: alpha(colors.text, 0.06) },
                ]}
              >
                <View style={[styles.plate, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="body" weight="600" numberOfLines={1}>
                    {c.title}
                  </AppText>
                  <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                    {when(c.endedAt)} · {c.messages.length} messages
                  </AppText>
                </View>
              </Pressable>

              <Pressable
                onPress={() => armOrDelete(c.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  armed === c.id
                    ? `Confirm deleting conversation: ${c.title}`
                    : `Delete conversation: ${c.title}`
                }
                accessibilityHint={
                  armed === c.id ? "Deletes it permanently" : "Asks you to confirm"
                }
                style={({ pressed }) => [
                  styles.del,
                  armed === c.id && [
                    styles.delArmed,
                    { backgroundColor: alpha(colors.error, 0.14) },
                  ],
                  pressed && { opacity: 0.5 },
                ]}
              >
                {armed === c.id ? (
                  <AppText variant="caption" weight="700" style={{ color: colors.error }}>
                    Delete?
                  </AppText>
                ) : (
                  <Ionicons name="trash-outline" size={17} color={colors.textTertiary} />
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

/** "Today", "Yesterday", "3 days ago", then a plain date. */
function when(ts: number): string {
  const then = new Date(ts);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(then.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  sub: { marginTop: 2 },

  list: { flexGrow: 0 },
  listContent: { gap: 2, paddingBottom: Spacing.xs },

  row: { flexDirection: "row", alignItems: "center" },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  plate: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  del: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * Armed. It grows into a labelled pill rather than merely changing colour —
   * a red icon is a state you have to already know about, and a word is not.
   * `minWidth` matches the resting target so the row does not reflow when it
   * arms, which would move the very control the finger is returning to.
   */
  delArmed: {
    width: undefined,
    minWidth: 44,
    height: 30,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    marginRight: 7,
  },

  empty: { alignItems: "center", paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { marginTop: Spacing.md, lineHeight: 20 },
});
