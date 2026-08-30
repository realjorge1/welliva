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
 * ── IT LISTS EVERY CHAT, INCLUDING THE ONE YOU ARE IN ───────────────────────
 *
 * It used to list only the ARCHIVE, and the archive only fills when somebody
 * taps "New conversation". So the overwhelmingly common way to use the coach —
 * open it, talk, close it, come back tomorrow and keep talking — produced a
 * "Chat history" that was empty forever, and a menu row that looked broken.
 * Nothing was lost; the one conversation that existed simply had nowhere to be
 * listed, because it had not been filed yet.
 *
 * The live thread is the first row now, under its own heading, and tapping it
 * just closes the sheet — you are already there. That is the arrangement every
 * chat app converged on, for the same reason: a history that omits the present
 * cannot be navigated by, because the thing you are looking at is missing.
 *
 * The rest are grouped by when they ended, into three headings and no more:
 * Today, Yesterday, Earlier. Rolling windows ("Previous 7 days", "Previous 30
 * days") sound tidy and read as arithmetic — you have to work out which side of
 * a boundary a thread fell on. Two headings people never have to think about,
 * and one honest bin for everything else, where each row carries its own date
 * so the heading does not have to be precise on its behalf.
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

/**
 * How long a trash button stays armed before it goes back to being a trash
 * button. Long enough to move a thumb and read the word, short enough that a
 * live delete trigger is never left sitting on a screen you walked away from.
 */
const DISARM_MS = 3500;

/**
 * The thread on screen right now, as a row. Not an `ArchivedConversation`
 * because it has not ended: there is no `endedAt` to bucket it by and nothing
 * to reopen.
 */
export interface CurrentThread {
  title: string;
  /** How many messages are in it, the briefing opener included. */
  count: number;
}

interface Props {
  visible: boolean;
  conversations: ArchivedConversation[];
  /** Omit (or pass null) when the live thread holds nothing anybody said. */
  current?: CurrentThread | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function GozlinHistorySheet({
  visible,
  conversations,
  current,
  onClose,
  onOpen,
  onDelete,
}: Props) {
  const { colors } = useColors();

  /**
   * Filed threads under their headings, newest first.
   *
   * Sorted rather than trusted: the store writes newest-first today, and a list
   * that silently mis-groups if that ever changes is worse than one that pays
   * for a sort of at most ARCHIVE_CAP entries.
   */
  const groups = useMemo(() => {
    const out: { label: string; items: ArchivedConversation[] }[] = [];
    for (const c of [...conversations].sort((a, b) => b.endedAt - a.endedAt)) {
      const label = bucket(c.endedAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [conversations]);

  const total = conversations.length + (current ? 1 : 0);

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
          {total === 0
            ? "Nothing here yet"
            : `${total} ${total === 1 ? "conversation" : "conversations"}`}
        </AppText>
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} header={header} maxHeightRatio={0.78}>
      {total === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: alpha(colors.primary, 0.12) }]}>
            <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
          </View>
          <AppText variant="subhead" color="secondary" align="center" style={styles.emptyText}>
            Say something to Gozlin and it shows up here. Every chat is kept —
            this one, and every one you start after it.
          </AppText>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {current ? (
            <>
              <GroupLabel>Current chat</GroupLabel>
              {/* No delete and no reopen: this is the thread behind the sheet.
                Tapping it closes, which is the honest no-op — and removing it
                lives on the menu's "Delete this chat". */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Current conversation: ${current.title}`}
                accessibilityHint="You are already in this one. Closes the list."
                style={({ pressed }) => [
                  styles.rowMain,
                  styles.currentRow,
                  { backgroundColor: alpha(colors.primary, 0.1) },
                  pressed && { backgroundColor: alpha(colors.primary, 0.18) },
                ]}
              >
                <View style={[styles.plate, { backgroundColor: colors.primary }]}>
                  <Ionicons name="chatbubble-ellipses" size={17} color={colors.onPrimary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="body" weight="600" numberOfLines={1}>
                    {current.title}
                  </AppText>
                  <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                    Open now · {current.count}{" "}
                    {current.count === 1 ? "message" : "messages"}
                  </AppText>
                </View>
              </Pressable>
            </>
          ) : null}

          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <GroupLabel>{g.label}</GroupLabel>
              {g.items.map((c) => (
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
                        {g.label === EARLIER ? `${dateLabel(c.endedAt)} · ` : ""}
                        {c.messages.length}{" "}
                        {c.messages.length === 1 ? "message" : "messages"}
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
            </React.Fragment>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

/** A bucket's heading. Quiet, uppercase, and never a row you can press. */
function GroupLabel({ children }: { children: string }) {
  return (
    <AppText variant="caption" weight="700" color="tertiary" style={styles.groupLabel}>
      {children.toUpperCase()}
    </AppText>
  );
}

/** The only three headings this list has. */
const EARLIER = "Earlier";

/**
 * Which heading a finished thread sits under.
 *
 * Three, deliberately. "Today" and "Yesterday" are the two a person can locate
 * without counting; past that, a heading cannot be more useful than the date on
 * the row itself, so everything else goes in one bin and the rows say when.
 */
function bucket(ts: number): string {
  const then = new Date(ts);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return EARLIER;
}

/**
 * The date on an "Earlier" row — "12 Aug", or "12 Aug 2025" once the year stops
 * being obvious. This is what lets the heading stay vague without the list
 * losing its bearings.
 */
function dateLabel(ts: number): string {
  const then = new Date(ts);
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(then.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
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

  groupLabel: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    letterSpacing: 0.6,
  },

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
  /**
   * `rowMain` carries `flex: 1` because it normally sits beside a trash button
   * in a flex ROW. The current chat has no trash button and sits directly in
   * the scroll column, where that same `flex: 1` resolves against no height at
   * all. Reset it, or the row collapses.
   */
  currentRow: { flex: 0, alignSelf: "stretch" },
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
