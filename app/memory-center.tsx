/**
 * YOUR MEMORY — the raw event record, and the only place it can be edited.
 *
 * This screen used to be the whole transparency surface: seven horizontal pill
 * tabs, of which six held a card or two of profile facts and one held the
 * timeline. Those six moved up to `/knows`, which is now a single page; what's
 * left here is the one thing that genuinely needs its own screen — every event
 * health-os has stored, filterable, with the governance the trust promise rests
 * on: correct, tag, redact.
 *
 * IT IS NOT `/logs`. Logs is read-only and merges the five feature ledgers into
 * "what you did". This reads the health-os timeline — the record Gozlin actually
 * reasons over — and it's writable, which is the whole point: you can't ask
 * someone to trust a memory they aren't allowed to correct.
 *
 * CORRECTIONS NEVER MUTATE HISTORY. An edit appends a superseding event and
 * recompacts that day's summary (docs/architecture/08), so the original stays
 * auditable and the day's stats stay true.
 *
 * VIRTUALIZED BY DAY. It used to `.map` every event ever recorded into a
 * ScrollView — fine at 40 events, a scroll-jank cliff at 4,000. A day is the
 * natural chunk: it keeps the grouped-card look while the list only mounts the
 * days near the viewport.
 */
import {
  useMemoryCenter,
  type EventAccent,
  type TimelineDay,
  type TimelineRow,
} from "@/components/memory/useMemoryCenter";
import {
  AppText,
  Button,
  Card,
  Chip,
  IconBadge,
  Pill,
  Screen,
  useColors,
} from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

/* ──────────────────────────────── Filters ──────────────────────────────── */

type FilterKey = EventAccent | "all";

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All", icon: "layers-outline" },
  { key: "nutrition", label: "Food", icon: "restaurant-outline" },
  { key: "hydration", label: "Water", icon: "water-outline" },
  { key: "workout", label: "Training", icon: "barbell-outline" },
  { key: "body", label: "Body", icon: "body-outline" },
  { key: "mind", label: "Check-ins", icon: "happy-outline" },
  { key: "milestone", label: "Moments", icon: "ribbon-outline" },
  { key: "meta", label: "Changes", icon: "options-outline" },
];

/* ───────────────────────────────── Screen ──────────────────────────────── */

export default function MemoryCenterScreen() {
  const { colors } = useColors();
  const m = useMemoryCenter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [active, setActive] = useState<TimelineRow | null>(null);

  const accentColor = useMemo(
    () =>
      (a: EventAccent): string =>
        ({
          nutrition: colors.protein,
          hydration: colors.water,
          workout: colors.fat,
          body: colors.primary,
          mind: colors.carbs,
          milestone: colors.warning,
          meta: colors.textTertiary,
        })[a],
    [colors],
  );

  /** Days with the filter applied; a day whose every row was filtered out goes too. */
  const days = useMemo<TimelineDay[]>(() => {
    if (filter === "all") return m.days;
    return m.days
      .map((d) => ({ ...d, rows: d.rows.filter((r) => r.accent === filter) }))
      .filter((d) => d.rows.length > 0);
  }, [m.days, filter]);

  const shown = useMemo(() => days.reduce((n, d) => n + d.rows.length, 0), [days]);

  const header = (
    <>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <AppText variant="title">Full record</AppText>
          <AppText variant="footnote" color="tertiary" style={styles.headerSub}>
            {m.loading
              ? "Reading…"
              : filter === "all"
                ? `${m.eventCount} event${m.eventCount === 1 ? "" : "s"} stored on this device`
                : `${shown} of ${m.eventCount} events`}
          </AppText>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            icon={f.icon}
            size="sm"
            active={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ScrollView>
    </>
  );

  return (
    <>
      <Screen header={header} scroll={false}>
        <FlatList
          data={days}
          keyExtractor={(d) => d.date}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          initialNumToRender={6}
          windowSize={9}
          removeClippedSubviews
          ListEmptyComponent={
            m.loading ? null : (
              <Card padding="xxl" style={styles.empty}>
                <IconBadge name="time-outline" muted size={48} />
                <AppText variant="headline" align="center" style={styles.emptyTitle}>
                  {filter === "all" ? "Nothing remembered yet" : "Nothing in this filter"}
                </AppText>
                <AppText variant="subhead" color="tertiary" align="center">
                  {filter === "all"
                    ? "As you log, it shows up here — every meal, workout, weigh-in and check-in."
                    : "Switch the filter to see the rest of your memory."}
                </AppText>
              </Card>
            )
          }
          ListFooterComponent={
            days.length > 0 ? (
              <AppText variant="caption" color="tertiary" align="center" style={styles.footNote}>
                Tap any entry to correct, tag or remove it. Corrections are appended —
                the original is always kept.
              </AppText>
            ) : null
          }
          renderItem={({ item }) => (
            <DayBlock day={item} onOpen={setActive} accentColor={accentColor} />
          )}
        />
      </Screen>

      <EventSheet
        row={active}
        onClose={() => setActive(null)}
        onRedact={(r) => {
          setActive(null);
          void m.redactEvent(r.id, r.date);
        }}
        onTag={(r, tags) => {
          setActive(null);
          void m.tagEvent(r.id, tags);
        }}
        onCorrect={(r, value) => {
          setActive(null);
          if (r.correct) void m.correctEvent(r.id, r.date, r.correct.field, value);
        }}
        accentColor={accentColor}
      />
    </>
  );
}

/* ──────────────────────────────── One day ──────────────────────────────── */

function DayBlock({
  day,
  onOpen,
  accentColor,
}: {
  day: TimelineDay;
  onOpen: (r: TimelineRow) => void;
  accentColor: (a: EventAccent) => string;
}) {
  const { colors } = useColors();
  return (
    <View style={styles.dayBlock}>
      <View style={styles.dayHead}>
        <AppText variant="footnote" color="secondary" style={styles.dayLabel} uppercase>
          {day.label}
        </AppText>
        <View style={[styles.dayRule, { backgroundColor: colors.divider }]} />
      </View>

      <Card padding="none" style={styles.dayCard}>
        {day.rows.map((row, i) => (
          <Pressable
            key={row.id}
            onPress={() => onOpen(row)}
            accessibilityRole="button"
            accessibilityLabel={`${row.title}${row.detail ? `. ${row.detail}` : ""}. ${row.provenance}`}
            accessibilityHint="Opens options to correct, tag or remove this entry"
            style={({ pressed }) => [
              styles.eventRow,
              i < day.rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.divider,
              },
              pressed && { backgroundColor: alpha(colors.text, 0.05) },
            ]}
          >
            <IconBadge
              name={row.icon as keyof typeof Ionicons.glyphMap}
              tone={accentColor(row.accent)}
              size={38}
            />
            <View style={styles.flex}>
              <AppText variant="callout">{row.title}</AppText>
              <View style={styles.metaRow}>
                {row.detail ? (
                  <AppText variant="footnote" color="secondary">
                    {row.detail}
                  </AppText>
                ) : null}
                <AppText variant="caption" color="tertiary">
                  {row.provenance}
                </AppText>
              </View>
              {row.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {row.tags.map((t) => (
                    <Pill key={t} label={t} size="sm" icon="pricetag" />
                  ))}
                </View>
              )}
            </View>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

/* ─────────────────────────────── Event sheet ───────────────────────────── */

function EventSheet({
  row,
  onClose,
  onRedact,
  onTag,
  onCorrect,
  accentColor,
}: {
  row: TimelineRow | null;
  onClose: () => void;
  onRedact: (r: TimelineRow) => void;
  onTag: (r: TimelineRow, tags: string[]) => void;
  onCorrect: (r: TimelineRow, value: number) => void;
  accentColor: (a: EventAccent) => string;
}) {
  const { colors } = useColors();
  const [tagText, setTagText] = useState("");
  const [correctText, setCorrectText] = useState("");

  // Reset inputs whenever a new row opens.
  React.useEffect(() => {
    setTagText("");
    setCorrectText(row?.correct ? String(row.correct.value) : "");
  }, [row]);

  if (!row) return null;

  const addTag = () => {
    const t = tagText.trim();
    if (!t) return;
    onTag(row, Array.from(new Set([...row.tags, t])));
  };

  const saveCorrection = () => {
    const v = parseFloat(correctText);
    if (!Number.isNaN(v)) onCorrect(row, v);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: colors.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        {/* Swallows taps so they don't reach the scrim behind and dismiss the sheet. */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <IconBadge
              name={row.icon as keyof typeof Ionicons.glyphMap}
              tone={accentColor(row.accent)}
              size={44}
            />
            <View style={styles.flex}>
              <AppText variant="headline">{row.title}</AppText>
              <AppText variant="footnote" color="tertiary" style={styles.subtle}>
                {row.date} · {row.provenance}
              </AppText>
            </View>
          </View>

          {row.detail && (
            <AppText variant="body" color="secondary" style={styles.sheetDetail}>
              {row.detail}
            </AppText>
          )}

          {/* Correct (append-only) */}
          {row.correct && (
            <View style={styles.sheetBlock}>
              <AppText variant="footnote" color="secondary" style={styles.blockLabel}>
                Correct {row.correct.label}
              </AppText>
              <View style={styles.inlineInput}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surfaceSunken, color: colors.text, borderColor: colors.border },
                  ]}
                  value={correctText}
                  onChangeText={setCorrectText}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textTertiary}
                  maxFontSizeMultiplier={1.3}
                />
                <Button label="Save" size="sm" fullWidth={false} onPress={saveCorrection} />
              </View>
              <AppText variant="caption" color="tertiary" style={styles.hint}>
                Your edit is appended — the original is kept, and the day&apos;s stats recompute.
              </AppText>
            </View>
          )}

          {/* Tag */}
          <View style={styles.sheetBlock}>
            <AppText variant="footnote" color="secondary" style={styles.blockLabel}>
              Add a tag
            </AppText>
            <View style={styles.inlineInput}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surfaceSunken, color: colors.text, borderColor: colors.border },
                ]}
                value={tagText}
                onChangeText={setTagText}
                placeholder="e.g. travel, sick, vacation"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                maxFontSizeMultiplier={1.3}
              />
              <Button label="Tag" size="sm" variant="tonal" fullWidth={false} onPress={addTag} />
            </View>
          </View>

          {/* Redact */}
          <Button
            label="Remove from my memory"
            variant="ghost"
            icon="eye-off-outline"
            onPress={() => onRedact(row)}
            style={styles.sheetBlock}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtle: { marginTop: 2 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  headerSub: { marginTop: 2 },
  iconBtn: { width: 34, height: 40, alignItems: "flex-start", justifyContent: "center" },

  filters: { gap: Spacing.sm, paddingTop: Spacing.lg, paddingBottom: Spacing.md },

  list: { paddingBottom: Spacing.huge },

  dayBlock: { marginBottom: Spacing.xl },
  dayHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  dayLabel: { fontWeight: "700" },
  dayRule: { flex: 1, height: StyleSheet.hairlineWidth },
  dayCard: { overflow: "hidden", borderRadius: Radius.xl },

  eventRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: 2,
    alignItems: "center",
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.xs },

  empty: { alignItems: "center", gap: Spacing.md, marginTop: Spacing.xxl },
  emptyTitle: { marginTop: Spacing.sm },
  footNote: { marginTop: Spacing.sm, paddingHorizontal: Spacing.xl, lineHeight: 17 },

  // Event sheet
  scrim: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  sheetDetail: { marginTop: -Spacing.xs },
  sheetBlock: { marginTop: Spacing.xs },
  blockLabel: { marginBottom: Spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  inlineInput: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  hint: { marginTop: Spacing.xs },
});
