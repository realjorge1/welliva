/**
 * ExperienceAnswerSheet — answering "how did the new exercise sit with you?"
 * in one tap. docs/gozlin/11-trying-something-new.md §7.1.
 *
 * ONE TAP IS A WHOLE ANSWER. The first row saves on touch; "Nothing much" is
 * as complete as "Very sore", because a question whose honest answer is "fine"
 * and that then asks for more is a form, not a coach. Everything under it —
 * whether they liked it, a word or two from the mood log, a line in their own
 * words — is offered only after the answer is already kept, and all of it is
 * optional.
 *
 * THEIR WORDS ARE SCREENED. A line typed here never reaches the model, so it
 * would skip the clinical screen that every chat message passes. The hook runs
 * the same screen before keeping it, and whatever it says is shown here
 * verbatim — "a rash after the new move" gets the same referral it would get
 * in the chat.
 *
 * A Sheet, not a document: this is a decision (the ui/Sheet rule). It rides
 * the keyboard the same way EditMessageSheet does.
 */

import { AppText, Button, Chip, Sheet, useColors, useKeyboardInset } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { sayDay } from "@/services/gozlin/agent";
import type { ClinicalRisk } from "@/services/gozlin/agent";
import type { CuriosityEntry, Enjoyed, Soreness } from "@/services/gozlin/novelty";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import type { ChipAnswer } from "./useCuriosity";

const SORENESS: { value: Soreness; label: string }[] = [
  { value: 0, label: "Nothing much" },
  { value: 1, label: "A bit sore" },
  { value: 2, label: "Quite sore" },
  { value: 3, label: "Very sore" },
];

const ENJOYED: { value: Enjoyed; label: string }[] = [
  { value: "yes", label: "Liked it" },
  { value: "mixed", label: "Mixed" },
  { value: "no", label: "Not for me" },
];

/**
 * Words from the mood log's own vocabulary (services/gozlin/mind.ts) that fit
 * a new movement. Reused, not invented, so a "Drained" here means what it
 * means in every other check-in.
 */
const FEELINGS = ["Proud", "Satisfied", "Tired", "Drained", "Frustrated"] as const;
const MAX_FEELINGS = 2;
const NOTE_MAX = 140;

interface Props {
  visible: boolean;
  entry: CuriosityEntry | null;
  onClose: () => void;
  onAnswer: (patch: ChipAnswer, recordId?: string) => Promise<{ id: string; clinical: ClinicalRisk | null }>;
  onNotNow: () => void;
  onStopAsking: () => void;
}

export function ExperienceAnswerSheet({ visible, entry, onClose, onAnswer, onNotNow, onStopAsking }: Props) {
  const { colors } = useColors();
  const kb = useKeyboardInset();
  const [recordId, setRecordId] = useState<string | undefined>();
  const [soreness, setSoreness] = useState<Soreness | null>(null);
  const [enjoyed, setEnjoyed] = useState<Enjoyed | null>(null);
  const [feelings, setFeelings] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [referral, setReferral] = useState<string | null>(null);
  const idRef = useRef<string | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());

  // A fresh question is a fresh sheet.
  useEffect(() => {
    if (!visible) return;
    idRef.current = undefined;
    setRecordId(undefined);
    setSoreness(null);
    setEnjoyed(null);
    setFeelings([]);
    setNote("");
    setNoteSaved(false);
    setReferral(null);
  }, [visible, entry?.id]);

  if (!entry) return null;

  // Saves run one after another: a second tap before the first save returns
  // would otherwise have no record id yet and create a second record.
  const save = (patch: ChipAnswer) => {
    chain.current = chain.current.then(async () => {
      try {
        const r = await onAnswer(patch, idRef.current);
        idRef.current = r.id;
        setRecordId(r.id);
        if (r.clinical) setReferral(r.clinical.reply);
      } catch (e) {
        console.error("[followups] answer failed:", e);
      }
    });
  };

  const header = (
    <View style={styles.header}>
      <AppText variant="caption" color="secondary" style={styles.eyebrow}>
        {entry.novelty === "harder" ? "A STEP UP ON YOUR LOG" : "FIRST TIME ON YOUR LOG"}
      </AppText>
      <AppText variant="headline">How did the {entry.label} sit with you?</AppText>
      <AppText variant="footnote" color="tertiary" style={styles.sub}>
        {sayDay(entry.triedOn)}. New movements often show up a day or two later — any answer helps,
        &ldquo;fine&rdquo; included.
      </AppText>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} header={header} style={kb.containerStyle}>
      <View style={styles.body}>
        <View style={styles.row}>
          {SORENESS.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              size="sm"
              active={soreness === s.value}
              onPress={() => {
                setSoreness(s.value);
                void save({ soreness: s.value });
              }}
            />
          ))}
        </View>

        {recordId ? (
          <>
            <View style={styles.saved}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <AppText variant="footnote" color="secondary">
                Kept. Anything else? All optional.
              </AppText>
            </View>

            <View style={styles.row}>
              {ENJOYED.map((e) => (
                <Chip
                  key={e.value}
                  label={e.label}
                  size="sm"
                  active={enjoyed === e.value}
                  onPress={() => {
                    const next = enjoyed === e.value ? null : e.value;
                    setEnjoyed(next);
                    void save({ enjoyed: next });
                  }}
                />
              ))}
            </View>

            <View style={styles.row}>
              {FEELINGS.map((f) => {
                const on = feelings.includes(f);
                return (
                  <Chip
                    key={f}
                    label={f}
                    size="sm"
                    active={on}
                    onPress={() => {
                      const next = on
                        ? feelings.filter((x) => x !== f)
                        : [...feelings, f].slice(-MAX_FEELINGS);
                      setFeelings(next);
                      void save({ feelings: next });
                    }}
                  />
                );
              })}
            </View>

            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={note}
                onChangeText={(t) => {
                  setNote(t);
                  setNoteSaved(false);
                }}
                maxLength={NOTE_MAX}
                multiline
                placeholder="In your own words, if you like"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel="How it went, in your own words"
              />
            </View>

            {referral ? (
              <View
                style={[
                  styles.referral,
                  { backgroundColor: alpha(colors.warning, 0.1), borderColor: alpha(colors.warning, 0.3) },
                ]}
              >
                <Ionicons name="medkit-outline" size={16} color={colors.warning} />
                <AppText variant="footnote" style={styles.referralText}>
                  {referral}
                </AppText>
              </View>
            ) : null}

            <View style={styles.actions}>
              {note.trim() && !noteSaved ? (
                <Button
                  label="Keep these words"
                  variant="tonal"
                  size="sm"
                  onPress={() => {
                    setNoteSaved(true);
                    void save({ note });
                  }}
                />
              ) : null}
              <View style={styles.grow}>
                <Button label="Done" size="sm" onPress={onClose} fullWidth />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            <Button label="Not now" variant="ghost" size="sm" onPress={onNotNow} />
            <Button label="Don't ask me these" variant="ghost" size="sm" onPress={onStopAsking} />
          </View>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs, paddingBottom: Spacing.md, gap: 2 },
  eyebrow: { letterSpacing: 1 },
  sub: { marginTop: 2 },
  body: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.md },
  row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  saved: { flexDirection: "row", alignItems: "center", gap: 6 },
  field: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 64,
    maxHeight: 140,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
    margin: 0,
    minHeight: Platform.OS === "ios" ? 22 : 26,
    textAlignVertical: "top",
  },
  referral: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  referralText: { flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  grow: { flex: 1 },
});
