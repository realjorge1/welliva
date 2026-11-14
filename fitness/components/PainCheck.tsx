/**
 * "ANYTHING HURT?" — one optional tap on the session summary.
 *
 * No / Sore muscles / Sharp or joint pain, and for pain, where. "No" and "Sore
 * muscles" save on the tap; pain asks where first. Once saved, the card says in
 * one line what changes (services/training/pain painReceipt) and offers to change
 * the answer, which replaces it for this session.
 *
 * A pain answer rests that area in the plan for two weeks: the write lands in
 * the fitness profile, whose change feed rebuilds the week
 * (contexts/domain/useWorkoutState). It is never asked in the player itself:
 * the player keeps its one question.
 *
 * Nothing here is counted by analytics: where it hurts is health information.
 */
import { AppText, Button, ChipGrid, Mono, useColors, type ChipGridOption } from "@/components/ui";
import { HOME_ORANGE, INSTRUMENT_CARD } from "@/components/home/surface";
import { Spacing } from "@/constants/theme";
import { loadFitnessProfile, rememberPain } from "@/fitness/services/FitnessProfileStore";
import type { PainMemory } from "@/fitness/types";
import { todayDate } from "@/services/OfflineStorage";
import { PAIN_AREAS, answerFor, painReceipt } from "@/services/training/pain";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

type Answer = PainMemory["answer"];

const ANSWERS: readonly ChipGridOption<Answer>[] = [
  { value: "none", label: "No" },
  { value: "sore", label: "Sore muscles" },
  { value: "pain", label: "Sharp or joint pain" },
];

const AREAS: readonly ChipGridOption<string>[] = PAIN_AREAS.map((a) => ({ value: a.id, label: a.label }));

export function PainCheck({ runId, date }: { runId: string; date: string }) {
  const { colors } = useColors();
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<PainMemory | null>(null);
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<Answer | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadFitnessProfile().then((p) => {
      if (!alive) return;
      setSaved(answerFor(p.painHistory, runId));
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [runId]);

  const save = async (answer: Answer, where: string[] = []) => {
    if (busy) return;
    setBusy(true);
    const memory: PainMemory = {
      runId,
      date,
      answer,
      ...(answer === "pain" ? { areas: where } : {}),
      at: new Date().toISOString(),
    };
    try {
      await rememberPain(memory);
      setSaved(memory);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const pick = (answer: Answer) => {
    setChoice(answer);
    if (answer !== "pain") void save(answer);
    else setAreas(saved?.answer === "pain" ? (saved.areas ?? []) : []);
  };

  const toggleArea = (id: string) =>
    setAreas((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  if (!loaded) return null;

  const showReceipt = saved && !editing;

  return (
    <View style={INSTRUMENT_CARD}>
      <View style={styles.head}>
        <View style={styles.square} />
        <Mono size={11} tracking={0.6} color={colors.textSecondary}>
          ANYTHING HURT?
        </Mono>
      </View>

      {showReceipt ? (
        <>
          <AppText variant="callout" color="secondary" style={styles.line}>
            {painReceipt(saved, todayDate())}
          </AppText>
          <Pressable
            onPress={() => {
              setEditing(true);
              setChoice(saved.answer);
              setAreas(saved.areas ?? []);
            }}
            accessibilityRole="button"
            accessibilityLabel="Change your answer"
            hitSlop={8}
            style={styles.change}
          >
            <AppText variant="footnote" color="brand" weight="700">
              Change answer
            </AppText>
          </Pressable>
        </>
      ) : (
        <>
          <AppText variant="footnote" color="tertiary" style={styles.line}>
            Optional. Pain in one spot rests it in your plan for two weeks.
          </AppText>
          <ChipGrid
            options={ANSWERS}
            selected={(v) => v === choice}
            onToggle={pick}
            style={styles.grid}
          />
          {choice === "pain" ? (
            <>
              <AppText variant="footnote" color="secondary" style={styles.where}>
                Where?
              </AppText>
              <ChipGrid
                options={AREAS}
                selected={(v) => areas.includes(v)}
                onToggle={toggleArea}
                size="sm"
                style={styles.grid}
              />
              <Button
                label="Save"
                variant="tonal"
                onPress={() => void save("pain", areas)}
                disabled={areas.length === 0 || busy}
                fullWidth
                style={styles.save}
              />
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 20 },
  square: { width: 8, height: 8, borderRadius: 2, backgroundColor: HOME_ORANGE },
  line: { marginTop: Spacing.sm },
  grid: { marginTop: Spacing.md },
  where: { marginTop: Spacing.md },
  save: { marginTop: Spacing.md },
  change: { alignSelf: "flex-start", marginTop: Spacing.md, paddingVertical: 2 },
});
