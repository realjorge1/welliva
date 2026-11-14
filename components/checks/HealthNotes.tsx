/**
 * "WORTH MENTIONING TO A DOCTOR" — on Home, for everyone.
 *
 * The cycle screen has had this section since 2026-10-15. This is its twin for
 * the rest of what people log: weight falling without trying or very fast,
 * eating under the app's own floor, check-ins low on most days, and the same
 * spot hurting after workouts. What each note may say, and when, is
 * services/checks/doctorNotes; this gathers the inputs and shows the result.
 *
 * Renders nothing at all when there is nothing to say, which is almost always.
 * "Got it" puts a note away until its evidence changes (services/checks/store).
 * Nothing here is counted by analytics.
 */
import { AppText, Card, SectionHeader, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useNutrition, useProfile, useSystem } from "@/contexts/AppContext";
import { loadFitnessProfile, subscribeFitnessProfile } from "@/fitness/services/FitnessProfileStore";
import type { PainMemory } from "@/fitness/types";
import { healthNotes, visibleNotes, type DismissedNotes, type HealthNote } from "@/services/checks/doctorNotes";
import { dismissHealthNote, loadDismissedNotes, subscribeDismissedNotes } from "@/services/checks/store";
import { addDays } from "@/services/cycle/dates";
import { loadCheckins } from "@/services/gozlin/GozlinMemoryStore";
import { subscribeMindEntries } from "@/services/gozlin/MindService";
import { readEntryValence } from "@/services/gozlin/mind";
import { calorieFloor } from "@/services/NutritionService";
import type { IntakeRecord } from "@/services/nutrition/IntakeLedger";
import { getFoodLogRange } from "@/services/nutrition/foodLogStore";
import { hasRecordedIntake } from "@/services/nutrition/recordedIntake";
import { KEYS, readJSON } from "@/services/OfflineStorage";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/** The eating check reads 14 closed days; one more covers a day that closes late. */
const SLOT_DAYS = 15;

type Mood = { date: string; valence: number | null };

/** Which meal slots had something recorded, by day, for the last SLOT_DAYS days. */
async function readSlots(today: string): Promise<Record<string, (string | null)[]>> {
  const from = addDays(today, -SLOT_DAYS);
  const out: Record<string, (string | null)[]> = {};
  const add = (date: string, slot: string | null) => {
    if (date < from || date >= today) return;
    (out[date] ??= []).push(slot);
  };
  try {
    const ledger = await readJSON<Record<string, IntakeRecord[]>>(KEYS.INTAKE_LEDGER, {});
    for (const [date, records] of Object.entries(ledger)) {
      if (Array.isArray(records)) for (const r of records) add(date, r.slot ?? null);
    }
  } catch (e) {
    console.log("[checks] could not read the meal ledger", e);
  }
  try {
    for (const e of await getFoodLogRange(from, addDays(today, -1))) add(e.date, e.slot ?? null);
  } catch (e) {
    console.log("[checks] could not read the food log", e);
  }
  return out;
}

const toMoods = (list: readonly { date: string; valence?: number; mood?: number }[]): Mood[] =>
  list.map((c) => ({ date: c.date, valence: readEntryValence(c) }));

export function HealthNotes({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  const { bodyLogs, userBio, userGoals } = useProfile();
  const { dietHistory } = useNutrition();
  const { currentDate } = useSystem();

  const [moods, setMoods] = useState<Mood[]>([]);
  const [pain, setPain] = useState<PainMemory[]>([]);
  const [slots, setSlots] = useState<Record<string, (string | null)[]>>({});
  const [dismissed, setDismissed] = useState<DismissedNotes | null>(null);

  useEffect(() => {
    let alive = true;
    void loadCheckins().then((c) => alive && setMoods(toMoods(c)));
    void loadFitnessProfile().then((p) => alive && setPain(p.painHistory ?? []));
    void loadDismissedNotes().then((d) => alive && setDismissed(d));
    const stops = [
      subscribeMindEntries((c) => alive && setMoods(toMoods(c))),
      subscribeFitnessProfile((p) => alive && setPain(p.painHistory ?? [])),
      subscribeDismissedNotes((d) => alive && setDismissed(d)),
    ];
    return () => {
      alive = false;
      stops.forEach((s) => s());
    };
  }, []);

  // Re-read the meal slots when a day closes (dietHistory changes) or the date turns.
  useEffect(() => {
    let alive = true;
    void readSlots(currentDate).then((s) => alive && setSlots(s));
    return () => {
      alive = false;
    };
  }, [currentDate, dietHistory]);

  const notes = useMemo<HealthNote[]>(() => {
    if (!userBio || !dismissed) return [];
    const intake: Record<string, number> = {};
    for (const e of dietHistory) if (hasRecordedIntake(e)) intake[e.date] = e.consumedCalories ?? 0;
    const all = healthNotes({
      today: currentDate,
      bio: userBio,
      targetWeightKg: userGoals?.targetWeightKg ?? null,
      weighIns: (bodyLogs ?? []).map((b) => ({ date: b.date, kg: b.weightKg })),
      intake,
      slotsByDate: slots,
      calorieFloor: calorieFloor(userBio),
      moods,
      pain,
    });
    return visibleNotes(all, dismissed, currentDate);
  }, [userBio, userGoals?.targetWeightKg, bodyLogs, dietHistory, slots, moods, pain, dismissed, currentDate]);

  if (!notes.length) return null;

  return (
    <View style={style}>
      <SectionHeader title="Worth mentioning to a doctor" weight="700" />
      {notes.map((note) => (
        <Card key={note.id} padding="lg" style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="medical-outline" size={16} color={colors.warning} />
            <AppText variant="callout" style={styles.flex}>
              {note.title}
            </AppText>
          </View>
          <AppText variant="footnote" color="secondary" style={styles.body}>
            {note.body}
          </AppText>
          <Pressable
            onPress={() => void dismissHealthNote(note.id, note.signature, currentDate)}
            accessibilityRole="button"
            accessibilityLabel={`Got it: ${note.title}`}
            accessibilityHint="Hides this until something new shows up"
            hitSlop={8}
            style={styles.action}
          >
            <AppText variant="footnote" color="tertiary" weight="600">
              Got it
            </AppText>
          </Pressable>
        </Card>
      ))}
      <AppText variant="caption" color="tertiary" style={styles.foot}>
        These are what your logs show, not a diagnosis.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginBottom: Spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  body: { marginTop: Spacing.sm },
  action: { alignSelf: "flex-end", marginTop: Spacing.md, paddingVertical: 2 },
  foot: { marginTop: Spacing.xs },
});
