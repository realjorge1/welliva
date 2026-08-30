/**
 * GozlinMessageBubble — one turn in the coach conversation.
 *
 * No avatars, no name labels: identity is carried entirely by layout and
 * colour (the old chat-app pattern of a repeated icon/name is gone). The coach
 * speaks from the left in a soft surface bubble; you speak from the right in a
 * filled brand bubble. Structured cards hang below the coach's text, still
 * aligned to the coach column.
 *
 * ── WHAT YOU CAN DO TO A MESSAGE ────────────────────────────────────────────
 *
 * Every bubble is a Pressable that reveals its own verbs. Gozlin's replies get
 * copy, retry, a rating and the deep dive; yours get copy and edit. The newest
 * reply shows its row without being asked, because that is the one an action is
 * nearly always aimed at — see ./MessageActions for why the rest stay quiet.
 *
 * THE TAP TARGET IS THE BUBBLE, NOT AN ICON. There is no ⋯ per message and no
 * long-press: a long-press is invisible until someone tries it, and a per-message
 * overflow button is a second control competing with the sentence. Tapping the
 * thing you are talking about is the one gesture that needs no affordance.
 *
 * COPY IS CONFIRMED IN PLACE. The icon becomes a tick for a moment rather than
 * raising a toast — a toast for something the user just watched happen is
 * ceremony, and this screen already has one for things they did not.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing } from "@/constants/theme";
import type { GozlinMessage } from "@/services/gozlin";
import { copyText } from "@/utils/clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GozlinStructuredRenderer } from "./renderers";
import { MessageActions, type MessageAction } from "./MessageActions";
import { ReceiptText, ReceiptTrail } from "./ReceiptText";
import type { Receipt } from "@/services/gozlin/agent";

/** How long the copy tick stays before the icon returns. */
const COPIED_MS = 1600;

export function GozlinMessageBubble({
  message,
  onOpenReceipt,
  expanded = false,
  onRegenerate,
  onFeedback,
  onDetails,
  onEdit,
  regenerating = false,
  detailsBusy = false,
}: {
  message: GozlinMessage;
  /**
   * Raised when a backed figure is tapped. Owned by the screen rather than
   * the bubble because one sheet serves the whole conversation — a sheet per
   * bubble would mount hundreds of modals in a long history.
   */
  onOpenReceipt?: (receipt: Receipt) => void;
  /** Show the actions with no tap. The newest coach reply passes this. */
  expanded?: boolean;
  /** Answer this turn again from scratch. Coach messages only. */
  onRegenerate?: (id: string) => void;
  /** Rate the reply. Toggling the same value clears it. */
  onFeedback?: (id: string, value: "up" | "down") => void;
  /** Open the research behind the reply. */
  onDetails?: (id: string) => void;
  /** Rewrite this message and re-ask from it. User messages only. */
  onEdit?: (id: string) => void;
  regenerating?: boolean;
  detailsBusy?: boolean;
}) {
  const { colors } = useColors();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const handleCopy = useCallback(() => {
    if (!copyText(message.content)) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }, [message.content]);

  // A placeholder mid-stream has nothing to act on yet.
  const hasText = message.content.trim().length > 0;
  const showActions = hasText && (expanded || revealed);
  const toggle = useCallback(() => setRevealed((v) => !v), []);

  const copyAction: MessageAction = {
    key: "copy",
    icon: copied ? "checkmark" : "copy-outline",
    label: copied ? "Copied" : "Copy",
    active: copied,
    onPress: handleCopy,
  };

  if (message.role === "user") {
    const actions: MessageAction[] = [copyAction];
    if (onEdit) {
      actions.push({
        key: "edit",
        icon: "create-outline",
        label: "Edit and ask again",
        onPress: () => onEdit(message.id),
      });
    }

    return (
      <View style={styles.userRow}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={`You said: ${message.content}`}
          accessibilityHint="Shows what you can do with this message"
          style={({ pressed }) => [
            styles.userBubble,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9 },
          ]}
        >
          <AppText variant="body" weight="500" style={{ color: colors.onPrimary }}>
            {message.content}
          </AppText>
        </Pressable>
        {message.edited ? (
          <AppText variant="caption" color="tertiary" style={styles.editedMark}>
            edited
          </AppText>
        ) : null}
        {showActions ? <MessageActions actions={actions} align="right" /> : null}
      </View>
    );
  }

  const actions: MessageAction[] = [copyAction];
  if (onRegenerate) {
    actions.push({
      key: "retry",
      icon: "refresh-outline",
      label: "Answer again",
      busy: regenerating,
      onPress: () => onRegenerate(message.id),
    });
  }
  if (onFeedback) {
    actions.push(
      {
        key: "up",
        icon: message.feedback === "up" ? "thumbs-up" : "thumbs-up-outline",
        label: "Good answer",
        active: message.feedback === "up",
        onPress: () => onFeedback(message.id, "up"),
      },
      {
        key: "down",
        icon: message.feedback === "down" ? "thumbs-down" : "thumbs-down-outline",
        label: "Not a good answer",
        active: message.feedback === "down",
        onPress: () => onFeedback(message.id, "down"),
      },
    );
  }
  if (onDetails) {
    actions.push({
      key: "details",
      icon: "library-outline",
      label: "Details",
      showLabel: true,
      busy: detailsBusy,
      // A dive that has already been written is a re-read, not a new ask —
      // lit, so it reads as something you have rather than something to fetch.
      active: !!message.deepDive,
      onPress: () => onDetails(message.id),
    });
  }

  /**
   * ── THE CARD COMES FIRST, THEN THE COACH ──────────────────────────────────
   *
   * The structured card used to hang BELOW the sentence, which had the turn
   * backwards. The card is the update — the day counter, the readouts, the
   * risks, the one move — and the prose is the coach reacting to it. Reading
   * "Good afternoon. That's three days running." and only then arriving at the
   * data made the greeting float free of anything, and the card land as an
   * appendix to a remark that had already been made.
   *
   * The other way round, it plays the way a real check-in does: here is where
   * you are, and here is what I make of it. The reader receives the state
   * first, and the voice underneath is the coach speaking TO that state — which
   * is the entire feeling this screen exists to produce, and it cost a reorder.
   *
   * The bubble keeps its coach-column alignment and its tail either way, so it
   * is still unmistakably Gozlin talking rather than a caption on a card.
   */
  return (
    <View style={styles.coachRow}>
      {message.structured ? (
        <View style={styles.structured}>
          <GozlinStructuredRenderer data={message.structured} />
        </View>
      ) : null}
      {hasText ? (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={`Gozlin said: ${message.content}`}
          accessibilityHint="Shows what you can do with this reply"
          style={({ pressed }) => [
            styles.coachBubble,
            message.structured != null && styles.coachBubbleUnderCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.92 },
          ]}
        >
          <ReceiptText content={message.content} />
          {onOpenReceipt ? (
            <ReceiptTrail
              content={message.content}
              receipts={message.receipts}
              onOpenReceipt={onOpenReceipt}
            />
          ) : null}
        </Pressable>
      ) : null}
      {showActions ? <MessageActions actions={actions} align="left" /> : null}
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
  editedMark: { marginTop: 3, marginRight: 4 },

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
  /**
   * Speaking after a card, not before it. The tail rounds off — a notch
   * pointing up at the card underneath it would read as the card's caption —
   * and a small gap keeps the two as two objects rather than one stack.
   */
  coachBubbleUnderCard: {
    marginTop: Spacing.sm,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xs,
  },
  structured: { alignSelf: "stretch" },
});
