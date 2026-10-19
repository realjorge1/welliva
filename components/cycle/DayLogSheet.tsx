/**
 * DayLogSheet — everything she might note about one day, one tap each.
 *
 * Every tap saves on the spot: there is no Save button to forget, and closing
 * the sheet can't lose anything. Choosing a flow on a day outside any period
 * makes it a period day (spotting doesn't); switching "Period" off on a day in
 * the middle of one ends that period the day before, and the sheet says so
 * before she does it.
 */
import { useCycle } from "@/contexts/CycleContext";
import { AppText, Button, ChipGrid, Sheet, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import {
  daysBetween,
  ENERGIES,
  ENERGY_LABEL,
  episodeOn,
  FLOWS,
  FLOW_LABEL,
  formatDay,
  liveEpisodes,
  MOODS,
  MOOD_LABEL,
  SYMPTOMS,
  SYMPTOM_LABEL,
  type CycleMood,
  type Energy,
  type Flow,
  type OvulationTest,
  type Symptom,
} from "@/services/cycle";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { useCyclePalette } from "./cycleTheme";

export interface DayLogSheetProps {
  date: string | null;
  onClose: () => void;
}

const FLOW_OPTIONS = FLOWS.map((v) => ({ value: v, label: FLOW_LABEL[v] }));
const SYMPTOM_OPTIONS = SYMPTOMS.map((v) => ({ value: v, label: SYMPTOM_LABEL[v] }));
const MOOD_OPTIONS = MOODS.map((v) => ({ value: v, label: MOOD_LABEL[v] }));
const ENERGY_OPTIONS = ENERGIES.map((v) => ({ value: v, label: ENERGY_LABEL[v] }));
const TEST_OPTIONS: { value: OvulationTest; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
];

export function DayLogSheet({ date, onClose }: DayLogSheetProps) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const cycle = useCycle();
  const { today, data, settings, view } = cycle;

  // Hold the last date so the copy doesn't blank while the sheet slides away.
  const lastDate = React.useRef<string | null>(null);
  if (date) lastDate.current = date;
  const d = date ?? lastDate.current ?? today;

  const log = data.days[d];
  const episode = episodeOn(data.periods, d, today, view.typicalBleed);
  const inPeriod = !!episode;
  const midPeriod = !!episode && episode.start !== d;

  const subtitle = useMemo(() => {
    if (episode) return `Period day ${daysBetween(episode.start, d) + 1}`;
    const before = liveEpisodes(data.periods)
      .filter((e) => e.start <= d)
      .pop();
    return before ? `Cycle day ${daysBetween(before.start, d) + 1}` : "No period logged before this day";
  }, [episode, data.periods, d]);

  const title = d === today ? "Today" : daysBetween(d, today) === 1 ? "Yesterday" : formatDay(d, { weekday: true });

  const toggleSymptom = (s: Symptom) => {
    const current = log?.symptoms ?? [];
    void cycle.logDay(d, {
      symptoms: current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    });
  };

  return (
    <Sheet
      visible={!!date}
      onClose={onClose}
      maxHeightRatio={0.88}
      header={
        <View style={styles.header}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="footnote" color="tertiary">
            {subtitle}
          </AppText>
        </View>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.periodRow, { backgroundColor: inPeriod ? palette.wash : alpha(colors.text, 0.05) }]}>
          <View style={styles.flex}>
            <AppText variant="callout">Period</AppText>
            <AppText variant="footnote" color="tertiary">
              {midPeriod
                ? "Switching this off ends that period the day before."
                : inPeriod
                  ? "This day is part of a period."
                  : "Bleeding today? Switch it on."}
            </AppText>
          </View>
          <Switch
            value={inPeriod}
            onValueChange={(on) => void cycle.togglePeriodDay(d, on)}
            trackColor={{ true: palette.period, false: alpha(colors.text, 0.18) }}
            accessibilityLabel="Period day"
          />
        </View>

        <Group label="Flow">
          <ChipGrid<Flow>
            options={FLOW_OPTIONS}
            selected={(v) => log?.flow === v}
            onToggle={(v) => void cycle.logDay(d, { flow: log?.flow === v ? null : v })}
            tone={palette.period}
            size="sm"
          />
        </Group>

        <Group label="Body">
          <ChipGrid<Symptom>
            options={SYMPTOM_OPTIONS}
            selected={(v) => !!log?.symptoms?.includes(v)}
            onToggle={toggleSymptom}
            size="sm"
          />
        </Group>

        <Group label="Mood">
          <ChipGrid<CycleMood>
            options={MOOD_OPTIONS}
            selected={(v) => log?.mood === v}
            onToggle={(v) => void cycle.logDay(d, { mood: log?.mood === v ? null : v })}
            size="sm"
          />
        </Group>

        <Group label="Energy">
          <ChipGrid<Energy>
            options={ENERGY_OPTIONS}
            selected={(v) => log?.energy === v}
            onToggle={(v) => void cycle.logDay(d, { energy: log?.energy === v ? null : v })}
            size="sm"
          />
        </Group>

        {settings.showFertileWindow ? (
          <Group label="Ovulation test" hint="Two positive tests in different cycles teach me your own ovulation timing.">
            <ChipGrid<OvulationTest>
              options={TEST_OPTIONS}
              selected={(v) => log?.ovulationTest === v}
              onToggle={(v) => void cycle.logDay(d, { ovulationTest: log?.ovulationTest === v ? null : v })}
              tone={palette.fertile}
              size="sm"
            />
          </Group>
        ) : null}

        <AppText variant="caption" color="tertiary" align="center" style={styles.saved}>
          Saved as you tap.
        </AppText>
        <Button label="Done" variant="tonal" onPress={onClose} fullWidth />
      </ScrollView>
    </Sheet>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="caption" color="tertiary" uppercase style={styles.groupLabel}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="footnote" color="tertiary" style={styles.groupHint}>
          {hint}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 2 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  flex: { flex: 1 },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 16,
  },
  group: { marginTop: Spacing.xl },
  groupLabel: { marginBottom: Spacing.sm },
  groupHint: { marginTop: -4, marginBottom: Spacing.sm },
  saved: { marginTop: Spacing.xl, marginBottom: Spacing.md },
});
