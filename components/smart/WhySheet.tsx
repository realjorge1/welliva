/**
 * "In one sentence: why now?" — the field, and the sheet that edits it.
 *
 * WhyField is shared with sign-up's optional last question. Whatever goes in is
 * kept exactly as typed (trimmed, nothing else; services/gozlin/GozlinMemoryStore
 * `rememberMotivation`), so the box is a plain box: no autocorrect-happy
 * suggestions from us, no rewording, a length limit only.
 *
 * The sheet opens from Memory → "Who you are" and from "Change it" on a quote.
 */
import { AppText, Button, Sheet, useColors, useKeyboardInset } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { WHY_MAX_CHARS, WHY_PLACEHOLDER } from "@/services/smart/why";
import React, { useEffect, useState } from "react";
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";

export function WhyField({
  value,
  onChangeText,
  autoFocus = false,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={WHY_PLACEHOLDER}
        placeholderTextColor={colors.textTertiary}
        multiline
        autoFocus={autoFocus}
        maxLength={WHY_MAX_CHARS}
        maxFontSizeMultiplier={1.3}
        accessibilityLabel="Why now, in one sentence"
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

export function WhySheet({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  /** The words as typed. The caller trims and stores them. */
  onSave: (text: string) => void;
}) {
  const kb = useKeyboardInset();
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      style={kb.containerStyle}
      header={
        <View style={styles.header}>
          <AppText variant="title">In one sentence: why now?</AppText>
          <AppText variant="footnote" color="tertiary" style={styles.lead}>
            Kept exactly as you write it. It may be quoted back to you on a hard day, about once a
            month at most.
          </AppText>
        </View>
      }
    >
      <View style={styles.body}>
        <WhyField value={text} onChangeText={setText} autoFocus />
        <Button
          label="Save"
          disabled={!text.trim()}
          onPress={() => onSave(text)}
          style={styles.save}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 88,
  },
  input: { fontSize: 16, lineHeight: 22, textAlignVertical: "top", padding: 0 },
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm },
  lead: { marginTop: Spacing.xs },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  save: { marginTop: Spacing.lg },
});
