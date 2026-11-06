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
 * ── THE LOOK (owner, 2026-10-31: "nothing close to a premium app … that screen
 * should be black") ─────────────────────────────────────────────────────────
 * A black, full-height panel — the instrument surface Home's cards are drawn
 * on — so the only colour on it is the feeling itself: the orb, the stop name,
 * the progress segments and the chips all wear the answer's colour; the
 * actions wear the app's orange (the calorie ring's, Home's accent — owner,
 * 2026-10-31: "put the app colour into that button instead of just white"), at a
 * compact 44pt; everything else is white on black. The panel holds one height through all
 * three steps, so moving between them never makes it jump under the finger.
 * The orb's glow runs past its own box on purpose (see MoodOrb.skia), and the
 * orb is sized so that glow fits the panel on the narrowest phone.
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
  ChipGrid,
  Mono,
  Sheet,
  useKeyboardInset,
  type ChipGridOption,
} from "@/components/ui";
import { HOME_ORANGE, ON_ORANGE } from "@/components/home/surface";
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
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { MoodOrb } from "./MoodOrb";
import { ORB_BLEED } from "./orbGeometry";
import { ValenceSlider } from "./ValenceSlider";

const NEUTRAL_STOP = 3;
const STEPS = 3;

/** The panel: black, white type, a faint white for everything secondary. */
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const SOFT = alpha(WHITE, 0.62);
const FAINT = alpha(WHITE, 0.4);
const EDGE = alpha(WHITE, 0.16);

const KINDS: { value: MindKind; label: string }[] = [
  { value: "momentary", label: "Right now" },
  { value: "daily", label: "Today overall" },
];

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
  const { containerStyle } = useKeyboardInset();
  const { width, height } = useWindowDimensions();

  const [kind, setKind] = useState<MindKind>("daily");
  const [step, setStep] = useState<Step>(0);
  const [stop, setStop] = useState(NEUTRAL_STOP);
  const [labels, setLabels] = useState<string[]>([]);
  const [associations, setAssociations] = useState<string[]>([]);
  const [sleep, setSleep] = useState("");

  // The orb and slider share this; it is the live value during a drag, while
  // `stop` is the settled one the rest of the sheet reads.
  const valence = useSharedValue(valenceAtStop(NEUTRAL_STOP));

  /**
   * The orb, as big as the panel allows. Its canvas is (1 + 2 × ORB_BLEED) of
   * it, and that whole canvas has to fit the panel's width — the scroll region
   * clips at its sides, and a clipped glow is exactly the boxed look this
   * replaced. On a short phone the height decides instead, so step one still
   * fits without scrolling.
   */
  const orb = Math.floor(
    Math.min(220, (width - Spacing.sm * 2 - 2) / (1 + ORB_BLEED * 2), height * 0.27),
  );

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
  const answer = valenceLabel(valenceAtStop(stop));

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
      fullHeight
      surface={BLACK}
      style={containerStyle}
      header={
        <View style={styles.head}>
          <View style={styles.eyebrow}>
            <Mono size={11} tracking={1.2} color={FAINT}>
              CHECK-IN
            </Mono>
            <Mono size={11} tracking={1.2} color={FAINT}>
              {step + 1} / {STEPS}
            </Mono>
          </View>
          <AppText variant="title" weight="700" color={WHITE} style={styles.title}>
            {stepTitle}
          </AppText>
          {/* Where you are in the three — lit in the answer's colour. */}
          <View style={styles.segments}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  { backgroundColor: i <= step ? tint : alpha(WHITE, 0.14) },
                ]}
              />
            ))}
          </View>
        </View>
      }
    >
      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {step === 0 && (
          <>
            <KindToggle value={kind} onChange={setKind} />

            <View style={[styles.orbWrap, { paddingVertical: Math.round(orb * 0.24) }]}>
              <MoodOrb size={orb} valence={valence} valenceSnapshot={valenceAtStop(stop)} />
            </View>

            {/* The stop name is the answer. It is the largest type on the step
                because it is what the user is agreeing to, not the slider. */}
            <AppText
              variant="display"
              weight="700"
              align="center"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.answer, { color: tint }]}
            >
              {answer}
            </AppText>

            <ValenceSlider
              valence={valence}
              stop={stop}
              onStopChange={(next) => setStop(next)}
            />
          </>
        )}

        {step > 0 && (
          // The answer from step one, carried forward: the words are being
          // chosen FOR this feeling, so it stays in sight.
          <View style={styles.summary}>
            <View style={[styles.summaryDot, { backgroundColor: tint }]} />
            <AppText variant="callout" weight="700" style={{ color: tint }} numberOfLines={1}>
              {answer}
            </AppText>
            <Mono size={10} tracking={0.8} color={FAINT}>
              {kind === "daily" ? "TODAY OVERALL" : "RIGHT NOW"}
            </Mono>
          </View>
        )}

        {step === 1 && (
          <>
            <AppText variant="footnote" color={SOFT}>
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
            <AppText variant="footnote" color={SOFT}>
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
                <Mono size={11} tracking={1} color={FAINT}>
                  SLEEP LAST NIGHT
                </Mono>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={sleep}
                    onChangeText={setSleep}
                    placeholder="7.5"
                    placeholderTextColor={FAINT}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    accessibilityLabel="Hours of sleep last night"
                  />
                  <AppText variant="callout" color={SOFT}>
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
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={18} color={WHITE} />
          </Pressable>
        )}
        {step < 2 ? (
          <>
            <Pressable
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save now"
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
            >
              <AppText variant="subhead" weight="700" color={HOME_ORANGE}>
                Save
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => setStep((s) => (s + 1) as Step)}
              accessibilityRole="button"
              accessibilityLabel="Next"
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
            >
              <AppText variant="subhead" weight="700" color={ON_ORANGE}>
                Next
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={ON_ORANGE} />
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel="Save entry"
            style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
          >
            <AppText variant="subhead" weight="700" color={ON_ORANGE}>
              Save entry
            </AppText>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}

/** "Right now" or "Today overall" — white on black, the chosen one filled. */
function KindToggle({
  value,
  onChange,
}: {
  value: MindKind;
  onChange: (kind: MindKind) => void;
}) {
  return (
    <View style={styles.toggle} accessibilityRole="radiogroup">
      {KINDS.map((k) => {
        const on = k.value === value;
        return (
          <Pressable
            key={k.value}
            onPress={() => onChange(k.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={k.label}
            style={[styles.toggleItem, on && styles.toggleOn]}
          >
            <AppText variant="subhead" weight="700" color={on ? BLACK : SOFT} numberOfLines={1}>
              {k.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact on purpose: 52 read as oversized against the sheet's type. */
const BUTTON_H = 44;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  eyebrow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { letterSpacing: -0.4 },
  segments: { flexDirection: "row", gap: 6, marginTop: Spacing.xs },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  body: {
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  toggle: {
    flexDirection: "row",
    alignSelf: "center",
    padding: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: EDGE,
    backgroundColor: BLACK,
  },
  toggleItem: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
  toggleOn: { backgroundColor: WHITE },
  // No overflow clip anywhere on the orb's way to the panel: its glow runs past
  // its box on purpose.
  orbWrap: { alignItems: "center", justifyContent: "center" },
  answer: { letterSpacing: -0.6 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: EDGE,
  },
  summaryDot: { width: 10, height: 10, borderRadius: 5 },
  field: { gap: Spacing.sm, marginTop: Spacing.sm },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: EDGE,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: BLACK,
  },
  input: { flex: 1, fontSize: 17, padding: 0, margin: 0, color: WHITE },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(WHITE, 0.1),
  },
  back: {
    width: BUTTON_H,
    height: BUTTON_H,
    borderRadius: BUTTON_H / 2,
    borderWidth: 1,
    borderColor: EDGE,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    flex: 1,
    height: BUTTON_H,
    borderRadius: BUTTON_H / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  btnGhost: { borderWidth: 1, borderColor: alpha(HOME_ORANGE, 0.55) },
  btnPrimary: { backgroundColor: HOME_ORANGE },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
