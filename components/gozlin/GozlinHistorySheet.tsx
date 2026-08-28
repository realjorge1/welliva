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
 * Rows are titled with the user's own first words. Any title we generated would
 * be a summary of someone's private conversation written by us, which is both
 * presumptuous and worse at the job.
 */

import { AppText, Sheet } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { ArchivedConversation } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

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
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onDelete(c.id);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Delete conversation: ${c.title}`}
                style={({ pressed }) => [styles.del, pressed && { opacity: 0.5 }]}
              >
                <Ionicons name="trash-outline" size={17} color={colors.textTertiary} />
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
