/**
 * GozlinMessageBubble — one turn in the coach conversation.
 *
 * No avatars, no name labels: identity is carried entirely by layout and
 * colour (the old chat-app pattern of a repeated icon/name is gone). The coach
 * speaks from the left in a soft surface bubble; you speak from the right in a
 * filled brand bubble. Structured cards hang below the coach's text, still
 * aligned to the coach column.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing } from "@/constants/theme";
import type { GozlinMessage } from "@/services/gozlin";
import React from "react";
import { StyleSheet, View } from "react-native";
import { GozlinStructuredRenderer } from "./renderers";

export function GozlinMessageBubble({ message }: { message: GozlinMessage }) {
  const { colors } = useColors();

  if (message.role === "user") {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
          <AppText variant="body" weight="500" style={{ color: colors.onPrimary }}>
            {message.content}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.coachRow}>
      <View
        style={[
          styles.coachBubble,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText variant="body">{message.content}</AppText>
      </View>
      {message.structured ? (
        <View style={styles.structured}>
          <GozlinStructuredRenderer data={message.structured} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── You — right-aligned, filled brand bubble ──
  userRow: {
    alignItems: "flex-end",
    marginVertical: Spacing.sm,
    maxWidth: "100%",
  },
  userBubble: {
    maxWidth: "84%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderBottomRightRadius: Radius.xs,
  },

  // ── Gozlin — left-aligned, soft surface bubble ──
  coachRow: {
    alignItems: "flex-start",
    marginVertical: Spacing.sm,
  },
  coachBubble: {
    maxWidth: "92%",
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderTopLeftRadius: Radius.xs,
  },
  structured: { alignSelf: "stretch", marginTop: Spacing.xs },
});
