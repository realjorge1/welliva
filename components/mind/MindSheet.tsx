/**
 * MindSheet — logging a state of mind, in the order a person actually knows it.
 *
 * ── THE ORDER IS THE DESIGN ─────────────────────────────────────────────────
 * Three steps, and the sequence is not arbitrary:
 *
 *   1. HOW MUCH  — the valence slider. People know whether they feel good or
 *                  bad long before they know which word it is, so the vaguest
 *                  question comes first and is the only one that is required.
 *   2. WHICH WORD— the labels, re-ordered by the answer to step 1. Naming a
 *                  feeling is easier once its direction is settled, and reading
 *                  the slider back to the user is what makes the step feel like
 *                  a conversation rather than a second form.
 *   3. WHY       — the associations. Attribution is the hardest thing to ask
 *                  for and the easiest to abandon, so it comes last, where
 *                  abandoning it costs nothing: steps 2 and 3 are both skippable
 *                  and "Save" is live from step 1 onward.
 *
 * The old sheet asked four questions on one screen and treated all four as
 * equal. Three of them were dials, two of those were read by nothing, and the
 * whole thing was answerable without a thought — which is the problem, because
 * an unconsidered mood log is worse than no mood log: it puts noise into the
 * one series that has no other source of truth.
 *
 * ── WHY THE KIND PICKER IS AT THE TOP ───────────────────────────────────────
 * "Right now" and "Today overall" are genuinely different readings, not a
 * setting — a rough morning and a decent day are both true. It sits on step 1
 * because it changes the question being asked, and because a daily entry
 * additionally carries last night's sleep, which a moment cannot.
 *
 * ── NO KeyboardAvoidingView ─────────────────────────────────────────────────
 * It does nothing under edge-to-edge on Android, which is how the coach's
 * composer ended up broken. The sleep field rides the keyboard via
 * `useKeyboardInset` on the Sheet's own animated panel instead.
 */
import {
  AppText,
  Button,
  ChipGrid,
  SegmentedControl,
  Sheet,
  useColors,
  useKeyboardInset,
  type ChipGridOption,
} from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { GozlinCheckin } from "@/services/gozlin";
import {
  MIND_ASSOCIATIONS,
  labelsForValence,
  valenceAtStop,
  valenceColor,
  valenceLabel,
  valenceStopIndex,
  type MindKind,
} from "@/services/gozlin/mind";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { MoodOrb } from "./MoodOrb";
import { ValenceSlider } from "./ValenceSlider";

const ORB = 176;
const NEUTRAL_STOP = 3;

export interface MindPayload {
  kind: MindKind;
  valence: number;
  labels: string[];
  associations: string[];
  sleepHours?: number;
  /** Set when editing an existing entry. */
  id?: string;
}

interface Props {
  visible: boolean;
  /** The day's existing daily entry, prefilled when present. */
  existing?: GozlinCheckin | null;
  onClose: () => void;
  onSave: (data: MindPayload) => void;
}

type Step = 0 | 1 | 2;

function toHours(s: string): number | undefined {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 24 ? Math.round(n * 10) / 10 : undefined;
}

export function MindSheet({ visible, existing, onClose, onSave }: Props) {
  const { colors } = useColors();
  const { containerStyle } = useKeyboardInset();

  const [kind, setKind] = useState<MindKind>("daily");
  const [step, setStep] = useState<Step>(0);
  const [stop, setStop] = useState(NEUTRAL_STOP);
  const [labels, setLabels] = useState<string[]>([]);
  const [associations, setAssociations] = useState<string[]>([]);
  const [sleep, setSleep] = useState("");

  // The orb and slider share this; it is the live value during a drag, while
  // `stop` is the settled one the rest of the sheet reads.
  const valence = useSharedValue(valenceAtStop(NEUTRAL_STOP));

  // Prefill from the day's existing entry each time the sheet opens. Only a
  // daily entry is ever prefilled — a moment is by definition a new reading, so
  // presenting the last one as a starting point would bias it.
  useEffect(() => {
    if (!visible) return;
    const k: MindKind = "daily";
    const v = existing?.valence ?? valenceAtStop(NEUTRAL_STOP);
    const s = valenceStopIndex(v);
    setKind(k);
    setStep(0);
    setStop(s);
    setLabels(existing?.labels ?? []);
    setAssociations(existing?.associations ?? []);
    setSleep(existing?.sleepHours != null ? String(existing.sleepHours) : "");
    valence.value = v;
  }, [visible, existing, valence]);

  // Moving off "Today overall" drops the sleep figure, because a moment cannot
  // carry one — better to clear it visibly than to silently discard it on save.
  useEffect(() => {
    if (kind === "momentary") setSleep("");
  }, [kind]);

  const labelOptions = useMemo<ChipGridOption[]>(
    () =>
      labelsForValence(valenceAtStop(stop)).map((l) => ({
        value: l.value,
        label: l.value,
      })),
    [stop],
  );

  const associationOptions = useMemo<ChipGridOption[]>(
    () =>
      MIND_ASSOCIATIONS.map((a) => ({
        value: a.value,
        label: a.label,
        icon: a.icon as ChipGridOption["icon"],
      })),
    [],
  );

  const toggle = (list: string[], set: (v: string[]) => void) => (value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const tint = valenceColor(valenceAtStop(stop));

  const handleSave = () => {
    onSave({
      kind,
      valence: valenceAtStop(stop),
      labels,
      associations,
      ...(kind === "daily" ? { sleepHours: toHours(sleep) } : {}),
      ...(kind === "daily" && existing?.id ? { id: existing.id } : {}),
    });
    onClose();
  };

  const stepTitle =
    step === 0
      ? kind === "momentary"
        ? "How do you feel right now?"
        : "How have you felt overall today?"
      : step === 1
        ? "What best describes this feeling?"
        : "What's having the biggest impact on you?";

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.92}
      style={containerStyle}
      header={
        <View style={styles.head}>
          <AppText variant="headline">{stepTitle}</AppText>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === step ? tint : alpha(colors.text, 0.16),
                    width: i === step ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {step === 0 && (
          <>
            <SegmentedControl<MindKind>
              label="What you're logging"
              options={[
                { value: "momentary", label: "Right now" },
                { value: "daily", label: "Today overall" },
              ]}
              value={kind}
              onChange={setKind}
            />

            <View style={styles.orbWrap}>
              <MoodOrb
                size={ORB}
                valence={valence}
                valenceSnapshot={valenceAtStop(stop)}
              />
            </View>

            {/* The stop name is the answer. It is the largest type on the step
                because it is what the user is agreeing to, not the slider. */}
            <AppText variant="title" align="center" style={{ color: tint }}>
              {valenceLabel(valenceAtStop(stop))}
            </AppText>

            <ValenceSlider
              valence={valence}
              stop={stop}
              onStopChange={(next) => setStop(next)}
            />
          </>
        )}

        {step === 1 && (
          <>
            <AppText variant="footnote" color="secondary">
              Pick as many as fit, or none. The list leads with words that match
              where you put the slider.
            </AppText>
            <ChipGrid
              options={labelOptions}
              selected={(v) => labels.includes(v)}
              onToggle={toggle(labels, setLabels)}
              tone={tint}
              size="sm"
              maxPerRow={3}
            />
          </>
        )}

        {step === 2 && (
          <>
            <AppText variant="footnote" color="secondary">
              This is what turns a mood trend into something welliva can actually
              tell you about.
            </AppText>
            <ChipGrid
              options={associationOptions}
              selected={(v) => associations.includes(v)}
              onToggle={toggle(associations, setAssociations)}
              tone={tint}
              size="sm"
              maxPerRow={2}
            />

            {kind === "daily" && (
              <View style={styles.field}>
                <AppText variant="subhead" color="secondary">
                  Sleep last night
                </AppText>
                <View
                  style={[
                    styles.inputWrap,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    value={sleep}
                    onChangeText={setSleep}
                    placeholder="7.5"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    style={[styles.input, { color: colors.text }]}
                  />
                  <AppText variant="callout" color="tertiary">
                    hours
                  </AppText>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Save is live from step one. The two steps after it are elaboration, and
          a flow that withholds the button until the end teaches people that
          logging a mood is a chore with a length. */}
      <View style={styles.actions}>
        {step > 0 && (
          <Pressable
            onPress={() => setStep((s) => (s - 1) as Step)}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.back, { borderColor: colors.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
        {step < 2 ? (
          <>
            <Button
              label="Save"
              variant="tonal"
              onPress={handleSave}
              style={styles.flex}
            />
            <Button
              label="Next"
              onPress={() => setStep((s) => (s + 1) as Step)}
              style={styles.flex}
            />
          </>
        ) : (
          <Button label="Save entry" onPress={handleSave} style={styles.flex} />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: Spacing.sm },
  dots: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  body: { gap: Spacing.lg, paddingBottom: Spacing.md },
  orbWrap: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm },
  field: { gap: Spacing.xs, marginTop: Spacing.sm },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  input: { flex: 1, fontSize: 17, padding: 0, margin: 0 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  back: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
});
