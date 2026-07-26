/**
 * WHAT'S COMING UP — the Life Context surface (P0 of the Proactive Companion).
 *
 * Where the user tells Gozlin about the future it should coach around: a wedding, a
 * surgery, an exam season, a trip, a medication course. Each entry is forward-dated and
 * auto-expires after it passes (the day-rollover sweep in AppContext). This is the
 * keystone the Anticipation engine + Coaching Modes (P1) will read.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §3.1.
 */
import {
  AppText,
  Button,
  Card,
  IconBadge,
  Pill,
  Screen,
  useColors,
} from "@/components/ui";
import { useLifeContext, type LifeRow } from "@/components/lifecontext/useLifeContext";
import { useSignals } from "@/components/lifecontext/useSignals";
import { useAnticipation, type UseAnticipation } from "@/components/lifecontext/useAnticipation";
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
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

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

/** A friendly default title when an anticipation CTA opens the add-sheet pre-set. */
function presetTitleFor(kind: LifeEventKind): string {
  if (kind === "pregnancy_due") return "Due date";
  if (kind === "illness_recovery") return "Injury recovery";
  if (kind === "medication_course") return "Medication course";
  return "";
}

export default function LifeScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { colors } = useColors();
  const lc = useLifeContext();
  const ant = useAnticipation();
  const [addPreset, setAddPreset] = useState<{ kind?: LifeEventKind; title?: string } | null>(null);

  const phaseTone = (phase: LifePhase): string =>
    phase === "active"
      ? colors.success
      : phase === "imminent"
        ? colors.warning
        : colors.primary;

  const onCta = (a: Anticipation) => {
    if (a.addKind) setAddPreset({ kind: a.addKind, title: presetTitleFor(a.addKind) });
    else router.push("/gozlin" as any);
  };

  const header = (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.headerTitle}>
        What&apos;s coming up
      </AppText>
      <Pressable
        onPress={() => router.push("/privacy" as any)}
        hitSlop={10}
        style={styles.iconBtn}
        accessibilityLabel="What Gozlin is watching"
      >
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );

  return (
    <>
      <Screen
        header={embedded ? undefined : header}
        gradient={!embedded}
        edges={embedded ? [] : undefined}
      >
        <AppText variant="subhead" color="secondary" style={styles.intro}>
          Tell Gozlin what&apos;s ahead and your plan bends around it — before it arrives.
        </AppText>

        <AnticipationSection ant={ant} onCta={onCta} />

        <SignalsPanel onSynced={() => Promise.all([lc.reload(), ant.reload()]).then(() => {})} />

        {lc.loading ? (
          <Card style={styles.block}>
            <AppText color="tertiary">Loading…</AppText>
          </Card>
        ) : lc.rows.length === 0 ? (
          <Card style={styles.block} padding="xxl">
            <View style={styles.empty}>
              <IconBadge name="calendar-outline" tone={colors.primary} size={52} />
              <AppText variant="headline" align="center" style={styles.emptyTitle}>
                Nothing on the horizon yet
              </AppText>
              <AppText variant="subhead" color="tertiary" align="center">
                Add a trip, a wedding, an exam season or a medication course and Gozlin
                will start planning around it.
              </AppText>
            </View>
          </Card>
        ) : (
          lc.rows.map((row) => (
            <LifeCard
              key={row.id}
              row={row}
              tone={phaseTone(row.phase)}
              onComplete={async () => {
                await lc.complete(row.id);
                await ant.reload();
              }}
              onDismiss={() =>
                Alert.alert(row.title, "Remove this from your horizon?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                      await lc.dismiss(row.id);
                      await ant.reload();
                    },
                  },
                ])
              }
            />
          ))
        )}

        <View style={styles.addWrap}>
          <Button
            label="Add something coming up"
            icon="add"
            variant="tonal"
            onPress={() => setAddPreset({})}
          />
        </View>
      </Screen>

      <AddSheet
        visible={addPreset !== null}
        presetKind={addPreset?.kind}
        presetTitle={addPreset?.title}
        onClose={() => setAddPreset(null)}
        onSave={async (input) => {
          await lc.add(input);
          await ant.reload();
          setAddPreset(null);
        }}
      />
    </>
  );
}

/* ── anticipations: Gozlin's forward read ── */

function AnticipationSection({
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
            <IconBadge name={modeMeta.icon as any} tone={colors.primary} size={42} solid />
            <View style={styles.flex}>
              <AppText variant="caption" color="brand" uppercase style={styles.modeKicker}>
                {modeMeta.label} mode
              </AppText>
              <AppText variant="footnote" color="secondary" style={styles.modeReason}>
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
        <IconBadge name={a.icon as any} tone={colors.primary} size={44} />
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
        <Pressable onPress={onCta} hitSlop={6} style={styles.antCta}>
          <AppText variant="footnote" color="brand" style={styles.actionLabel}>
            {a.cta ?? "Talk to Gozlin"}
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>
    </Card>
  );
}

/* ── a single upcoming card ── */

function LifeCard({
  row,
  tone,
  onComplete,
  onDismiss,
}: {
  row: LifeRow;
  tone: string;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useColors();
  return (
    <Card style={styles.block} padding="lg">
      <View style={styles.cardRow}>
        <IconBadge name={row.icon as any} tone={tone} size={46} />
        <View style={styles.flex}>
          <AppText variant="callout" numberOfLines={1}>
            {row.title}
          </AppText>
          <View style={styles.metaRow}>
            <AppText variant="footnote" color="tertiary">
              {KIND_META[row.kind].label} · {row.whenLabel}
            </AppText>
          </View>
          {row.note ? (
            <AppText variant="footnote" color="tertiary" style={styles.note}>
              {row.note}
            </AppText>
          ) : null}
        </View>
        <Pill label={row.countdown} tone={tone} />
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={onComplete} hitSlop={6} style={styles.action}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
          <AppText variant="footnote" color="success" style={styles.actionLabel}>
            It happened
          </AppText>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={6} style={styles.action}>
          <Ionicons name="close-circle-outline" size={18} color={colors.textTertiary} />
          <AppText variant="footnote" color="tertiary" style={styles.actionLabel}>
            Remove
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

/* ── add sheet ── */

function AddSheet({
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
      style={[styles.quickChip, { borderColor: alpha(colors.primary, 0.4) }]}
    >
      <AppText variant="caption" color="brand" style={styles.quickLabel}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetScrim}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
            <AppText variant="title" style={styles.sheetTitle}>
              What&apos;s coming up?
            </AppText>

            {/* kind picker */}
            <AppText variant="caption" color="tertiary" uppercase style={styles.fieldLabel}>
              Type
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds}>
              {KIND_ORDER.map((k) => {
                const on = k === kind;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={[
                      styles.kindChip,
                      {
                        backgroundColor: on ? colors.primary : colors.surfaceSunken,
                        borderColor: on ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={KIND_META[k].icon as any}
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
              style={[styles.input, styles.inputMulti, { color: colors.text, borderColor: colors.border }]}
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

/* ── signals: weather + calendar ── */

function SignalsPanel({ onSynced }: { onSynced: () => Promise<void> | void }) {
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

  const calUnavailable = s.calendar.permission === "unavailable";
  const wxUnavailable = s.weatherStatus.permission === "unavailable";

  return (
    <Card style={styles.block} padding="lg">
      {/* weather */}
      <View style={styles.signalRow}>
        <IconBadge
          name={(s.weather?.icon as any) ?? "partly-sunny-outline"}
          tone={colors.water}
          size={42}
        />
        <View style={styles.flex}>
          {s.weather ? (
            <>
              <AppText variant="callout">
                {s.weather.condition} · {s.weather.tempC}°
              </AppText>
              {s.weatherHint ? (
                <AppText variant="footnote" color="tertiary" style={styles.signalSub}>
                  {s.weatherHint.reason}
                </AppText>
              ) : null}
            </>
          ) : (
            <>
              <AppText variant="callout">Local weather</AppText>
              <AppText variant="footnote" color="tertiary" style={styles.signalSub}>
                {wxUnavailable
                  ? "Available in the full app build."
                  : "So Gozlin can call indoor vs outdoor days."}
              </AppText>
            </>
          )}
        </View>
        {!s.weather && !wxUnavailable ? (
          <Pressable onPress={s.enableWeather} hitSlop={6} style={styles.signalAction}>
            <AppText variant="footnote" color="brand" style={styles.actionLabel}>
              {s.loadingWeather ? "…" : "Enable"}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.signalDivider, { backgroundColor: alpha(colors.text, 0.08) }]} />

      {/* calendar */}
      <View style={styles.signalRow}>
        <IconBadge
          name="calendar-outline"
          tone={s.calendar.ready ? colors.success : colors.primary}
          size={42}
        />
        <View style={styles.flex}>
          <AppText variant="callout">
            {s.calendar.ready ? "Calendar connected" : "Connect your calendar"}
          </AppText>
          <AppText variant="footnote" color="tertiary" style={styles.signalSub}>
            {calUnavailable
              ? "Available in the full app build."
              : s.calendar.ready
                ? "Gozlin imports trips & big days as they appear."
                : "Gozlin plans around your trips, exams and big days."}
          </AppText>
        </View>
        {!calUnavailable ? (
          <Pressable
            onPress={onConnect}
            hitSlop={6}
            style={styles.signalAction}
            disabled={s.connectingCalendar}
          >
            <AppText variant="footnote" color="brand" style={styles.actionLabel}>
              {s.connectingCalendar ? "…" : s.calendar.ready ? "Sync" : "Connect"}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center" },
  intro: { marginBottom: Spacing.lg },
  block: { marginBottom: Spacing.md },
  flex: { flex: 1 },
  empty: { alignItems: "center", gap: Spacing.sm },
  emptyTitle: { marginTop: Spacing.sm },
  cardRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  metaRow: { marginTop: 2 },
  note: { marginTop: 4 },
  cardActions: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(127,127,127,0.2)",
  },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionLabel: { fontWeight: "700" },
  signalRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  signalSub: { marginTop: 2 },
  signalAction: { paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  signalDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  addWrap: { marginTop: Spacing.sm },
  // anticipations
  antWrap: { marginBottom: Spacing.sm },
  modeBanner: { marginBottom: Spacing.md },
  modeKicker: { marginBottom: 2 },
  modeReason: {},
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
  sheetScrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
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
    backgroundColor: "rgba(127,127,127,0.4)",
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
