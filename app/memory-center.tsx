/**
 * MEMORY CENTER — the trust centerpiece: a transparent window onto everything the
 * Personal Health OS remembers, where the user can see, correct, redact, tag, and
 * erase it. Reached from Profile → "What I remember" and the Gozlin header.
 *
 * Every tab is a thin, honest view over a real memory layer (docs/architecture/08):
 * Timeline = L1 events, About/Learned/Milestones = L3 facts, Preferences/Goals =
 * settings records, Conversations = L4. Corrections never mutate history — they
 * append a superseding event and recompact the affected day's summary.
 */
import {
  AppText,
  Button,
  Card,
  IconBadge,
  Pill,
  Screen,
  SectionHeader,
  useColors,
} from "@/components/ui";
import {
  useMemoryCenter,
  type EventAccent,
  type TimelineRow,
} from "@/components/memory/useMemoryCenter";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

type TabKey =
  | "timeline"
  | "about"
  | "learned"
  | "milestones"
  | "preferences"
  | "goals"
  | "conversations";

const TABS: { key: TabKey; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "about", label: "About you" },
  { key: "learned", label: "Learned" },
  { key: "milestones", label: "Milestones" },
  { key: "preferences", label: "Preferences" },
  { key: "goals", label: "Goals" },
  { key: "conversations", label: "Conversations" },
];

export default function MemoryCenterScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { colors } = useColors();
  const m = useMemoryCenter();
  const [tab, setTab] = useState<TabKey>("timeline");
  const [active, setActive] = useState<TimelineRow | null>(null);

  const accentColor = useMemo(
    () => (a: EventAccent): string => {
      const map: Record<EventAccent, string> = {
        nutrition: colors.protein,
        hydration: colors.water,
        workout: colors.fat,
        body: colors.primary,
        mind: colors.carbs,
        milestone: colors.warning,
        meta: colors.textTertiary,
      };
      return map[a];
    },
    [colors],
  );

  const header = (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.headerTitle}>
        What I remember
      </AppText>
      <View style={styles.iconBtn} />
    </View>
  );

  return (
    <>
      <Screen
        header={embedded ? undefined : header}
        gradient={!embedded}
        edges={embedded ? [] : undefined}
      >
        {/* Tab selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: on ? colors.primary : colors.surfaceSunken,
                    borderColor: on ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText
                  variant="footnote"
                  color={on ? colors.onPrimary : "secondary"}
                  style={styles.tabLabel}
                >
                  {t.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {m.loading ? (
          <Card style={styles.section}>
            <AppText color="tertiary">Reading your memory…</AppText>
          </Card>
        ) : tab === "timeline" ? (
          <TimelineTab m={m} onOpen={setActive} accentColor={accentColor} />
        ) : tab === "about" ? (
          <AboutTab m={m} />
        ) : tab === "learned" ? (
          <LearnedTab m={m} />
        ) : tab === "milestones" ? (
          <MilestonesTab m={m} />
        ) : tab === "preferences" ? (
          <PreferencesTab m={m} />
        ) : tab === "goals" ? (
          <GoalsTab m={m} />
        ) : (
          <ConversationsTab m={m} />
        )}

        {/* Forget everything */}
        <View style={styles.danger}>
          <SectionHeader title="Forget everything" subtitle="Erase all memory and start clean" />
          <Button
            label="Forget everything I know"
            variant="danger"
            icon="trash-outline"
            onPress={() =>
              Alert.alert(
                "Forget everything?",
                "This permanently erases your entire timeline, every summary, and everything Gozlin remembers. It can't be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Forget all",
                    style: "destructive",
                    onPress: () => void m.forgetEverything(),
                  },
                ],
              )
            }
          />
        </View>
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

/* ───────────────────────────── Tabs ──────────────────────────── */

type M = ReturnType<typeof useMemoryCenter>;

function TimelineTab({
  m,
  onOpen,
  accentColor,
}: {
  m: M;
  onOpen: (r: TimelineRow) => void;
  accentColor: (a: EventAccent) => string;
}) {
  const { colors } = useColors();
  if (m.days.length === 0) {
    return <Empty icon="time-outline" text="Nothing on your timeline yet. As you log, it shows up here — every meal, workout, weigh-in and check-in." />;
  }
  return (
    <View style={styles.section}>
      <AppText variant="footnote" color="tertiary" style={styles.count}>
        {m.eventCount} events remembered
      </AppText>
      {m.days.map((day) => (
        <View key={day.date} style={styles.dayBlock}>
          <AppText variant="footnote" color="secondary" style={styles.dayLabel} uppercase>
            {day.label}
          </AppText>
          <Card padding="none">
            {day.rows.map((row, i) => (
              <Pressable
                key={row.id}
                onPress={() => onOpen(row)}
                style={[
                  styles.eventRow,
                  i < day.rows.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.divider,
                  },
                ]}
              >
                <IconBadge name={row.icon as keyof typeof Ionicons.glyphMap} tone={accentColor(row.accent)} size={38} />
                <View style={styles.flex}>
                  <AppText variant="callout">{row.title}</AppText>
                  <View style={styles.metaRow}>
                    {row.detail && (
                      <AppText variant="footnote" color="secondary">
                        {row.detail}
                      </AppText>
                    )}
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
      ))}
    </View>
  );
}

function AboutTab({ m }: { m: M }) {
  const id = m.memory.identity;
  const hasAny = id.motivation || id.preferences.length > 0 || id.constraints.length > 0;
  if (!hasAny) {
    return <Empty icon="person-outline" text="Tell Gozlin why you're here and what matters to you, and it'll remember it here." />;
  }
  return (
    <View style={styles.section}>
      {id.motivation && (
        <FactCard
          icon="heart-outline"
          title="Your why"
          value={id.motivation}
          onRemove={() => void m.clearMotivation()}
        />
      )}
      {id.preferences.map((p) => (
        <FactCard
          key={p}
          icon="thumbs-up-outline"
          title="Preference"
          value={p}
          onRemove={() => void m.removePreference(p)}
        />
      ))}
      {id.constraints.map((c) => (
        <FactCard key={c} icon="alert-circle-outline" title="Constraint" value={c} />
      ))}
    </View>
  );
}

function LearnedTab({ m }: { m: M }) {
  if (m.memory.patterns.length === 0) {
    return <Empty icon="sparkles-outline" text="As Gozlin watches your habits, the patterns it learns about you appear here — and you can dismiss any of them." />;
  }
  return (
    <View style={styles.section}>
      {m.memory.patterns.map((p) => (
        <FactCard
          key={p.message}
          icon="bulb-outline"
          title="What I've learned"
          value={p.message}
          onRemove={() => void m.dismissPattern(p.message)}
        />
      ))}
    </View>
  );
}

function MilestonesTab({ m }: { m: M }) {
  if (m.memory.episodes.length === 0) {
    return <Empty icon="flag-outline" text="Your milestones — first streaks, goals reached — will be remembered here." />;
  }
  return (
    <View style={styles.section}>
      {[...m.memory.episodes]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => (
          <FactCard
            key={e.id}
            icon="ribbon-outline"
            title={e.date}
            value={e.summary}
            onRemove={() => void m.forgetEpisode(e.id)}
          />
        ))}
    </View>
  );
}

function PreferencesTab({ m }: { m: M }) {
  const bio = m.userBio;
  const rows: { label: string; value: string }[] = [];
  if (bio?.cuisinePreference) rows.push({ label: "Cuisine", value: bio.cuisinePreference });
  if (bio?.region) rows.push({ label: "Region", value: bio.region });
  if (bio?.dietaryRestriction && bio.dietaryRestriction !== "none")
    rows.push({ label: "Diet", value: bio.dietaryRestriction });
  if (bio?.allergies?.length) rows.push({ label: "Allergies", value: bio.allergies.join(", ") });
  if (bio?.foodDislikes?.length) rows.push({ label: "Avoids", value: bio.foodDislikes.join(", ") });
  if (bio?.equipment?.length) rows.push({ label: "Equipment", value: bio.equipment.join(", ") });

  return (
    <View style={styles.section}>
      {rows.length === 0 ? (
        <Empty icon="options-outline" text="Your cuisine, region, dislikes and equipment will show here." />
      ) : (
        <Card>
          {rows.map((r, i) => (
            <KeyValue key={r.label} label={r.label} value={r.value} divider={i < rows.length - 1} />
          ))}
        </Card>
      )}
      <Button
        label="Edit preferences in Settings"
        variant="ghost"
        icon="settings-outline"
        onPress={() => router.push("/settings")}
        style={styles.editLink}
      />
    </View>
  );
}

function GoalsTab({ m }: { m: M }) {
  const g = m.userGoals;
  const bio = m.userBio;
  const rows: { label: string; value: string }[] = [];
  if (bio?.primaryGoal) rows.push({ label: "Primary goal", value: bio.primaryGoal.replace(/_/g, " ") });
  if (g.targetWeightKg != null) rows.push({ label: "Target weight", value: `${g.targetWeightKg} kg` });
  if (g.weeklyWorkoutsTarget != null)
    rows.push({ label: "Weekly workouts", value: `${g.weeklyWorkoutsTarget} / week` });
  if (g.dailyWaterMl != null)
    rows.push({ label: "Daily water", value: `${(g.dailyWaterMl / 1000).toFixed(2)} L` });
  if (g.journeyStartedAt) rows.push({ label: "Journey started", value: g.journeyStartedAt.slice(0, 10) });

  return (
    <View style={styles.section}>
      {rows.length === 0 ? (
        <Empty icon="flag-outline" text="Set a goal and Gozlin will track it here." />
      ) : (
        <Card>
          {rows.map((r, i) => (
            <KeyValue key={r.label} label={r.label} value={r.value} divider={i < rows.length - 1} />
          ))}
        </Card>
      )}
      <Button
        label="Edit goals in Settings"
        variant="ghost"
        icon="settings-outline"
        onPress={() => router.push("/settings")}
        style={styles.editLink}
      />
    </View>
  );
}

function ConversationsTab({ m }: { m: M }) {
  return (
    <View style={styles.section}>
      <Card>
        <View style={styles.cardHead}>
          <IconBadge name="chatbubbles-outline" tone={undefined} muted size={40} />
          <View style={styles.flex}>
            <AppText variant="callout">Your conversations with Gozlin</AppText>
            <AppText variant="footnote" color="tertiary" style={styles.subtle}>
              {m.memory.conversationCount} messages kept on this device
            </AppText>
          </View>
        </View>
        {m.memory.conversationCount > 0 && (
          <Button
            label="Clear conversation history"
            variant="ghost"
            icon="trash-outline"
            onPress={() =>
              Alert.alert("Clear conversations?", "This removes your chat history with Gozlin.", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: () => void m.clearConversations() },
              ])
            }
            style={styles.editLink}
          />
        )}
      </Card>
    </View>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <Card style={styles.section}>
      <View style={styles.emptyWrap}>
        <IconBadge name={icon as keyof typeof Ionicons.glyphMap} muted size={48} />
        <AppText variant="footnote" color="tertiary" align="center" style={styles.emptyText}>
          {text}
        </AppText>
      </View>
    </Card>
  );
}

function FactCard({
  icon,
  title,
  value,
  onRemove,
}: {
  icon: string;
  title: string;
  value: string;
  onRemove?: () => void;
}) {
  const { colors } = useColors();
  return (
    <Card padding="lg" style={styles.factCard}>
      <View style={styles.cardHead}>
        <IconBadge name={icon as keyof typeof Ionicons.glyphMap} tone={colors.primary} size={38} />
        <View style={styles.flex}>
          <AppText variant="caption" color="tertiary" uppercase>
            {title}
          </AppText>
          <AppText variant="callout" style={styles.subtle}>
            {value}
          </AppText>
        </View>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function KeyValue({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const { colors } = useColors();
  return (
    <View style={[styles.kv, divider && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <AppText variant="footnote" color="tertiary">
        {label}
      </AppText>
      <AppText variant="callout" style={styles.kvValue}>
        {value}
      </AppText>
    </View>
  );
}

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
    const next = Array.from(new Set([...row.tags, t]));
    onTag(row, next);
  };

  const saveCorrection = () => {
    const v = parseFloat(correctText);
    if (!Number.isNaN(v)) onCorrect(row, v);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <IconBadge name={row.icon as keyof typeof Ionicons.glyphMap} tone={accentColor(row.accent)} size={44} />
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
                  style={[styles.input, { backgroundColor: colors.surfaceSunken, color: colors.text, borderColor: colors.border }]}
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
                style={[styles.input, { backgroundColor: colors.surfaceSunken, color: colors.text, borderColor: colors.border }]}
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
  section: { marginTop: Spacing.lg },
  subtle: { marginTop: 2 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: "center" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  // Tabs
  tabs: { gap: Spacing.sm, paddingVertical: Spacing.xs, paddingRight: Spacing.md },
  tab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  tabLabel: { fontWeight: "700" },

  // Timeline
  count: { marginBottom: Spacing.md },
  dayBlock: { marginBottom: Spacing.lg },
  dayLabel: { marginBottom: Spacing.sm, marginLeft: Spacing.xs, fontWeight: "700" },
  eventRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: 2, alignItems: "center" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.xs },

  // Facts
  factCard: { marginBottom: Spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  // Key/value
  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  kvValue: { flexShrink: 1, textAlign: "right" },

  editLink: { marginTop: Spacing.md, alignSelf: "flex-start" },

  // Empty
  emptyWrap: { alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.lg },
  emptyText: { lineHeight: 19, maxWidth: 280 },

  // Danger
  danger: { marginTop: Spacing.xxl },

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
