/**
 * LIFE CONTEXT PANELS — the "what's ahead" UI, shared by the two surfaces that
 * render it: the WHAT'S AHEAD section of `/knows`, and the standalone `/life`
 * screen that Privacy still deep-links to.
 *
 * These were private components inside `app/life.tsx`. Folding the horizon into
 * /knows would have meant a second copy of four non-trivial pieces — the
 * coaching-mode banner, the anticipation cards, the add sheet with its kind
 * picker and date validation, and the weather/calendar signal rows — so they
 * live here instead. One definition of what an upcoming event looks like means
 * the two entry points can't drift apart visually or behaviourally.
 */
import {
  AppText,
  Button,
  Card,
  IconBadge,
  ListGroup,
  ListRow,
  Pill,
  useColors,
} from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import {
  addDays,
  isValidDate,
  KIND_META,
  todayDate,
  type LifeEventKind,
  type LifePhase,
} from "@/health-os";
import { COACHING_MODE_META, type Anticipation } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import type { LifeRow } from "./useLifeContext";
import type { UseAnticipation } from "./useAnticipation";
import { useSignals } from "./useSignals";

/** Order the kinds appear in the picker. */
const KIND_ORDER: LifeEventKind[] = [
  "travel",
  "vacation",
  "wedding",
  "competition",
  "exam_period",
  "deadline",
  "surgery",
  "medication_course",
  "illness_recovery",
  "pregnancy_due",
  "relocation",
  "anniversary",
  "holiday",
  "other",
];

/** What the add-sheet is seeded with when opened from an anticipation CTA. */
export interface AddPreset {
  kind?: LifeEventKind;
  title?: string;
}

/** A friendly default title when an anticipation CTA opens the sheet pre-set. */
export function presetTitleFor(kind: LifeEventKind): string {
  if (kind === "pregnancy_due") return "Due date";
  if (kind === "illness_recovery") return "Injury recovery";
  if (kind === "medication_course") return "Medication course";
  return "";
}

/**
 * Colour for how close an event is: green while it's happening, amber when it's
 * nearly here, brand otherwise. A hook rather than a `(colors, phase)` helper so
 * call sites don't each have to pull `colors` in just to tint one badge.
 */
export function usePhaseTone(): (phase: LifePhase) => string {
  const { colors } = useColors();
  return useCallback(
    (phase: LifePhase) =>
      phase === "active"
        ? colors.success
        : phase === "imminent"
          ? colors.warning
          : colors.primary,
    [colors],
  );
}

/* ── anticipations: Gozlin's forward read ── */

export function AnticipationSection({
  ant,
  onCta,
}: {
  ant: UseAnticipation;
  onCta: (a: Anticipation) => void;
}) {
  const { colors } = useColors();
  if (ant.loading) return null;

  const modeMeta = COACHING_MODE_META[ant.mode];
  const showMode = ant.mode !== "normal";
  if (!showMode && ant.anticipations.length === 0) return null;

  return (
    <View style={styles.antWrap}>
      {showMode ? (
        <Card style={styles.modeBanner} padding="lg">
          <View style={styles.cardRow}>
            <IconBadge name={modeMeta.icon as never} tone={colors.primary} size={42} solid />
            <View style={styles.flex}>
              <AppText variant="caption" color="brand" uppercase style={styles.modeKicker}>
                {modeMeta.label} mode
              </AppText>
              <AppText variant="footnote" color="secondary">
                {ant.modeReason}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      {ant.anticipations.map((a) => (
        <AnticipationCard key={a.id} a={a} onCta={() => onCta(a)} />
      ))}
    </View>
  );
}

function AnticipationCard({ a, onCta }: { a: Anticipation; onCta: () => void }) {
  const { colors } = useColors();
  return (
    <Card style={styles.block} padding="lg">
      <View style={styles.cardRow}>
        <IconBadge name={a.icon as never} tone={colors.primary} size={44} />
        <View style={styles.flex}>
          <AppText variant="callout">{a.title}</AppText>
          <AppText variant="subhead" color="secondary" style={styles.antMsg}>
            {a.message}
          </AppText>
        </View>
      </View>
      <View style={styles.antFooter}>
        <View style={styles.flex}>
          <AppText variant="caption" color="tertiary">
            {a.explanation}
          </AppText>
        </View>
        <Pressable
          onPress={onCta}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={a.cta ?? "Talk to Gozlin"}
          style={styles.antCta}
        >
          <AppText variant="footnote" color="brand" style={styles.actionLabel}>
            {a.cta ?? "Talk to Gozlin"}
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>
    </Card>
  );
}

/* ── a single upcoming event ── */

export function UpcomingCard({
  row,
  onComplete,
  onDismiss,
}: {
  row: LifeRow;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useColors();
  const tone = usePhaseTone()(row.phase);

  return (
    <Card style={styles.block} padding="lg">
      <View style={styles.cardRow}>
        <IconBadge name={row.icon as never} tone={tone} size={46} />
        <View style={styles.flex}>
          <AppText variant="callout" numberOfLines={1}>
            {row.title}
          </AppText>
          <AppText variant="footnote" color="tertiary" style={styles.metaRow}>
            {KIND_META[row.kind].label} · {row.whenLabel}
          </AppText>
          {row.note ? (
            <AppText variant="footnote" color="tertiary" style={styles.note}>
              {row.note}
            </AppText>
          ) : null}
        </View>
        <Pill label={row.countdown} tone={tone} />
      </View>
      <View style={[styles.cardActions, { borderTopColor: colors.divider }]}>
        <Pressable
          onPress={onComplete}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${row.title} happened`}
          style={styles.action}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
          <AppText variant="footnote" color="success" style={styles.actionLabel}>
            It happened
          </AppText>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${row.title}`}
          style={styles.action}
        >
          <Ionicons name="close-circle-outline" size={18} color={colors.textTertiary} />
          <AppText variant="footnote" color="tertiary" style={styles.actionLabel}>
            Remove
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

/* ── signals: weather + calendar + wearable ── */

/**
 * The outside senses, as list rows rather than bespoke cards: they're
 * connect-once switches, which is exactly what a settings-style row is for.
 */
export function SignalsPanel({ onSynced }: { onSynced: () => Promise<void> | void }) {
  const { colors } = useColors();
  const s = useSignals();

  const onConnect = async () => {
    const proposed = await s.connectCalendar();
    if (proposed === null) {
      Alert.alert(
        "Calendar not connected",
        "Grant calendar access in the full app build to let Gozlin plan around your schedule.",
      );
      return;
    }
    await onSynced();
    Alert.alert(
      "Calendar connected",
      proposed > 0
        ? `Added ${proposed} upcoming event${proposed === 1 ? "" : "s"} to your horizon.`
        : "No upcoming trips or big days found yet — they'll appear here as you add them.",
    );
  };

  /**
   * Connect Apple Health / Health Connect.
   *
   * The "nothing came back" case gets its own sentence because it is genuinely
   * common and not a failure: HealthKit cannot report a declined READ permission
   * (see health-os/signals/wearable/providers/appleHealth.ts), so a refusal and
   * an empty store both arrive here as null. One sentence covers both truthfully,
   * where "connected!" would be a lie in one of them.
   */
  const onConnectWearable = async () => {
    const snap = await s.connectWearable();
    if (!snap) {
      Alert.alert(
        "No health data yet",
        "Nothing came back from your health store — either access wasn't granted, or there's no sleep or heart data on this device yet. You can still log last night's sleep by hand, and recovery will use it.",
      );
      return;
    }
    Alert.alert(
      "Health connected",
      snap.sleepHours !== undefined
        ? `Read ${snap.sleepHours.toFixed(1)}h of sleep from last night. Recovery will use it from now on.`
        : "Recovery will use your sleep and heart data from now on.",
    );
  };

  const calUnavailable = s.calendar.permission === "unavailable";
  const wxUnavailable = s.weatherStatus.permission === "unavailable";
  const wearUnavailable = s.wearable.permission === "unavailable";

  const action = (label: string) => (
    <AppText variant="footnote" color="brand" style={styles.actionLabel}>
      {label}
    </AppText>
  );

  return (
    <ListGroup>
      <ListRow
        icon={(s.weather?.icon as never) ?? "partly-sunny-outline"}
        tone={colors.water}
        title={s.weather ? `${s.weather.condition} · ${s.weather.tempC}°` : "Local weather"}
        subtitle={
          s.weather
            ? s.weatherHint?.reason
            : wxUnavailable
              ? "Available in the full app build."
              : "So Gozlin can call indoor vs outdoor days."
        }
        onPress={!s.weather && !wxUnavailable ? () => void s.enableWeather() : undefined}
        right={
          !s.weather && !wxUnavailable ? action(s.loadingWeather ? "…" : "Enable") : undefined
        }
      />
      <ListRow
        icon="calendar-outline"
        tone={s.calendar.ready ? colors.success : colors.primary}
        title={s.calendar.ready ? "Calendar connected" : "Connect your calendar"}
        subtitle={
          calUnavailable
            ? "Available in the full app build."
            : s.calendar.ready
              ? "Gozlin imports trips and big days as they appear."
              : "Gozlin plans around your trips, exams and big days."
        }
        onPress={calUnavailable ? undefined : () => void onConnect()}
        disabled={s.connectingCalendar}
        right={
          calUnavailable
            ? undefined
            : action(s.connectingCalendar ? "…" : s.calendar.ready ? "Sync" : "Connect")
        }
      />
      <ListRow
        icon="heart-outline"
        tone={s.wearable.ready ? colors.success : colors.primary}
        title={
          wearUnavailable
            ? Platform.OS === "android"
              ? "Health Connect — coming soon"
              : "Apple Health — coming soon"
            : s.wearable.ready
              ? "Health app connected"
              : Platform.OS === "android"
                ? "Connect Health Connect"
                : "Connect Apple Health"
        }
        subtitle={
          wearUnavailable
            ? // Named plainly rather than dressed up: it is off, and the manual
              // path is the working alternative today.
              "Not in this build yet. Log last night's sleep by hand and recovery still uses it."
            : s.wearable.ready
              ? s.wearableSnapshot?.sleepHours !== undefined
                ? `Last night: ${s.wearableSnapshot.sleepHours.toFixed(1)}h. Read on device, never uploaded.`
                : "Sleep and heart data stay on your device — only the recovery score is used."
              : "Sleep, HRV and resting heart rate make recovery real instead of a training-load guess."
        }
        onPress={wearUnavailable ? undefined : () => void onConnectWearable()}
        disabled={wearUnavailable || s.connectingWearable}
        right={
          wearUnavailable
            ? undefined
            : action(s.connectingWearable ? "…" : s.wearable.ready ? "Refresh" : "Connect")
        }
      />
    </ListGroup>
  );
}

/* ── add sheet ── */

export function AddSheet({
  visible,
  presetKind,
  presetTitle,
  onClose,
  onSave,
}: {
  visible: boolean;
  presetKind?: LifeEventKind;
  presetTitle?: string;
  onClose: () => void;
  onSave: (input: {
    kind: LifeEventKind;
    title: string;
    window: { start: string; end?: string };
    note?: string;
  }) => Promise<void>;
}) {
  const { colors } = useColors();
  const [kind, setKind] = useState<LifeEventKind>("travel");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(addDays(todayDate(), 7));
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // When opened from an anticipation CTA, seed the kind/title; otherwise start fresh.
  useEffect(() => {
    if (!visible) return;
    setKind(presetKind ?? "travel");
    setTitle(presetTitle ?? "");
    setStart(addDays(todayDate(), 7));
    setEnd("");
    setNote("");
  }, [visible, presetKind, presetTitle]);

  const isRange = !KIND_META[kind].pointEvent;

  const reset = () => {
    setKind("travel");
    setTitle("");
    setStart(addDays(todayDate(), 7));
    setEnd("");
    setNote("");
  };

  const error = useMemo(() => {
    if (!title.trim()) return "Give it a name";
    if (!isValidDate(start)) return "Start date must be YYYY-MM-DD";
    if (isRange && end && !isValidDate(end)) return "End date must be YYYY-MM-DD";
    if (isRange && end && end < start) return "End can’t be before start";
    return null;
  }, [title, start, end, isRange]);

  const save = async () => {
    if (error) return;
    setSaving(true);
    try {
      await onSave({
        kind,
        title: title.trim(),
        window: isRange && end ? { start, end } : { start },
        note: note.trim() || undefined,
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  const quick = (days: number, label: string) => (
    <Pressable
      key={label}
      onPress={() => setStart(addDays(todayDate(), days))}
      accessibilityRole="button"
      accessibilityLabel={`Set the date to ${label.toLowerCase()}`}
      style={[styles.quickChip, { borderColor: alpha(colors.primary, 0.4) }]}
    >
      <AppText variant="caption" color="brand" style={styles.quickLabel}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.sheetScrim, { backgroundColor: colors.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
            <AppText variant="title" style={styles.sheetTitle}>
              What&apos;s coming up?
            </AppText>

            {/* kind picker */}
            <AppText variant="caption" color="tertiary" uppercase style={styles.fieldLabel}>
              Type
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kinds}
            >
              {KIND_ORDER.map((k) => {
                const on = k === kind;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    accessibilityRole="button"
                    accessibilityLabel={KIND_META[k].label}
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.kindChip,
                      {
                        backgroundColor: on ? colors.primary : colors.surfaceSunken,
                        borderColor: on ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={KIND_META[k].icon as never}
                      size={14}
                      color={on ? colors.onPrimary : colors.textSecondary}
                      style={styles.kindIcon}
                    />
                    <AppText variant="footnote" color={on ? colors.onPrimary : "secondary"}>
                      {KIND_META[k].label}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* title */}
            <AppText variant="caption" color="tertiary" uppercase style={styles.fieldLabel}>
              Name
            </AppText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Sister's wedding in Lisbon"
              placeholderTextColor={colors.textTertiary}
              maxFontSizeMultiplier={1.3}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />

            {/* date(s) */}
            <AppText variant="caption" color="tertiary" uppercase style={styles.fieldLabel}>
              {isRange ? "Start date" : "Date"}
            </AppText>
            <TextInput
              value={start}
              onChangeText={setStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              maxFontSizeMultiplier={1.3}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <View style={styles.quickRow}>
              {quick(7, "In a week")}
              {quick(30, "In a month")}
              {quick(90, "In 3 months")}
            </View>

            {isRange ? (
              <>
                <AppText variant="caption" color="tertiary" uppercase style={styles.fieldLabel}>
                  End date (optional)
                </AppText>
                <TextInput
                  value={end}
                  onChangeText={setEnd}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  maxFontSizeMultiplier={1.3}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </>
            ) : null}

            {/* note */}
            <AppText variant="caption" color="tertiary" uppercase style={styles.fieldLabel}>
              Note (optional)
            </AppText>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything Gozlin should know"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxFontSizeMultiplier={1.3}
              style={[
                styles.input,
                styles.inputMulti,
                { color: colors.text, borderColor: colors.border },
              ]}
            />

            {error ? (
              <AppText variant="footnote" color="warning" style={styles.error}>
                {error}
              </AppText>
            ) : null}

            <View style={styles.sheetActions}>
              <Button label="Cancel" variant="ghost" onPress={onClose} style={styles.sheetBtn} />
              <Button
                label="Add"
                onPress={save}
                loading={saving}
                disabled={!!error}
                style={styles.sheetBtn}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.md },
  cardRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  metaRow: { marginTop: 2 },
  note: { marginTop: 4 },
  cardActions: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionLabel: { fontWeight: "700" },

  // anticipations
  antWrap: { marginBottom: Spacing.sm },
  modeBanner: { marginBottom: Spacing.md },
  modeKicker: { marginBottom: 2 },
  antMsg: { marginTop: 4 },
  antFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(127,127,127,0.2)",
  },
  antCta: { flexDirection: "row", alignItems: "center", gap: 2 },

  // sheet
  sheetScrim: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    maxHeight: "92%",
    paddingTop: Spacing.sm,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  sheetBody: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.huge },
  sheetTitle: { marginBottom: Spacing.lg },
  fieldLabel: { marginBottom: Spacing.xs, marginTop: Spacing.md },
  kinds: { gap: Spacing.sm, paddingVertical: 2 },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  kindIcon: { marginRight: 5 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  inputMulti: { minHeight: 64, textAlignVertical: "top" },
  quickRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  quickChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  quickLabel: { fontWeight: "700" },
  error: { marginTop: Spacing.md },
  sheetActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xl },
  sheetBtn: { flex: 1 },
});
