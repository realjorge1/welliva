/**
 * EditMessageSheet — rewrite something you said, and ask again from there.
 *
 * WHY EDITING A SENT MESSAGE IS WORTH THE COMPLEXITY. In a chat with a person,
 * a typo is a typo and you send a second message. In a chat with a coach, the
 * message IS the query: a missing word ("should I train legs" → "should I train
 * legs today") produces a different answer, and the only repair available until
 * now was to type the whole thing again and leave the wrong version sitting in
 * the thread forever, being fed back to the model as context on every later
 * turn. Editing is not a courtesy here; it is how you correct the input.
 *
 * IT TRUNCATES, AND IT SAYS SO. Re-answering from an edited message means
 * everything after it is gone — an answer to a question that no longer exists
 * cannot stay in the thread, and the model would read it as fact next turn. The
 * warning line is shown BEFORE the send, not toasted after it, and it names the
 * exact number of replies at stake. Anything less is a data-loss surprise.
 *
 * THE SHEET RIDES THE KEYBOARD. It is a text field inside a bottom sheet, which
 * is the exact arrangement the platform is worst at: the keyboard covers the
 * thing you are typing into. `useKeyboardInset` pads the panel by the live
 * keyboard height on the UI thread, so it sits on top of the keys from the
 * first frame rather than being pushed there afterwards.
 */

import { AppText, Button, Sheet, useKeyboardInset } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The text as it currently stands. */
  value: string;
  /**
   * How many messages come after this one and will be dropped. Shown so the
   * cost of re-asking is visible before it is paid, never after.
   */
  replacing: number;
  onSubmit: (text: string) => void;
}

export function EditMessageSheet({ visible, onClose, value, replacing, onSubmit }: Props) {
  const { colors } = useColors();
  const [draft, setDraft] = useState(value);
  const kb = useKeyboardInset();

  // Re-seed whenever a different message is opened — the sheet is reused, so
  // the draft must not survive from the last one edited.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const trimmed = draft.trim();
  const changed = trimmed.length > 0 && trimmed !== value.trim();

  const header = (
    <View style={styles.header}>
      <AppText variant="headline">Edit your message</AppText>
      <AppText variant="footnote" color="tertiary" style={styles.sub}>
        {replacing > 0
          ? `Gozlin will answer again from here, replacing ${replacing} ${
              replacing === 1 ? "message" : "messages"
            } below it.`
          : "Gozlin will answer this again."}
      </AppText>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} header={header} style={kb.containerStyle}>
      <View style={styles.body}>
        <View
          style={[
            styles.field,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            selectTextOnFocus={false}
            placeholder="What did you mean to ask?"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text }]}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Edit your message"
          />
        </View>

        {replacing > 0 ? (
          <View style={styles.warning}>
            <Ionicons name="git-branch-outline" size={14} color={colors.textTertiary} />
            <AppText variant="caption" color="tertiary" style={styles.warningText}>
              The conversation continues from your edit. What was said after it
              is not kept.
            </AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <View style={styles.grow}>
            <Button
              label="Ask again"
              icon="arrow-up"
              iconRight
              disabled={!changed}
              onPress={() => onSubmit(trimmed)}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  sub: { marginTop: 2 },
  body: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  field: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 96,
    maxHeight: 220,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
    margin: 0,
    minHeight: Platform.OS === "ios" ? 22 : 26,
    textAlignVertical: "top",
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: Spacing.md,
  },
  warningText: { flex: 1, lineHeight: 17 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  grow: { flex: 1 },
});
