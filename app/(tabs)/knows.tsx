/**
 * WHAT WELLIVA KNOWS — the transparency surface, and the app's trust centrepiece.
 *
 * IT ANSWERS ONE QUESTION: *what does Welliva understand about me?* Not "what did
 * I do" — `/logs` already owns that, merging all five ledgers into a read-only
 * day-by-day record. This screen used to open on a health-os timeline of meals,
 * workouts, water and weigh-ins, which is the same list from a different source:
 * the first thing you saw here was a worse copy of the screen one row above it in
 * the menu. The raw event record now lives at `/memory-center`, one row from the
 * bottom of this page, where it can be filtered and corrected properly.
 *
 * ONE PAGE, NO TABS. The old shell was a segmented control (Memory | Upcoming)
 * wrapping a seven-pill horizontal tab strip — nine destinations, most of them
 * one card or an empty state, and three of them scrolled off-screen. Everything
 * that mattered fits in one scroll: who you are, what Gozlin has worked out, what
 * is coming, what you've achieved, and what's being kept.
 *
 * EVERY FACT IS REVERSIBLE. A row you can't remove isn't transparency, it's a
 * receipt — so anything Welliva inferred rather than was told carries an ✕, and
 * the two irreversible actions sit alone in a footer group instead of under every
 * tab like they used to.
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import {
  AddSheet,
  AnticipationSection,
  SignalsPanel,
  UpcomingCard,
  presetTitleFor,
  useAnticipation,
  useLifeContext,
  type AddPreset,
} from "@/components/lifecontext";
import { useIntelligence } from "@/components/memory/useIntelligence";
import { useMemoryCenter } from "@/components/memory/useMemoryCenter";
import { ScreenTopBar } from "@/components/navigation";
import {
  AppText,
  Card,
  ListGroup,
  ListRow,
  ProgressBar,
  Reveal,
  Screen,
  SectionHeader,
  useColors,
} from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { IntelligenceSnapshot, ModelCard } from "@/health-os";
import type { Anticipation } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

/* ───────────────────────────────── Model ───────────────────────────────── */

/**
 * One thing Welliva holds about you.
 *
 * The `value`/`subtitle` split is a rule, not a preference: **numbers go right,
 * words go below**. A long value in the right slot has no flex, so it squeezes
 * the title column until it disappears — the classic RN row-overflow trap. Short
 * measured facts ("78 kg") are safe there; "Peanuts, shellfish, tree nuts" is not.
 */
interface Fact {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  /** Right-aligned. Numbers and single short words only. */
  value?: string;
  tone?: string;
  /** Present when the fact can be taken back. */
  onRemove?: () => void;
}

const MONTH = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `2026-08-14` → `Aug 14`, gaining a year only once it stops being obvious. */
function humanDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso.slice(0, 10);
  const thisYear = new Date().getFullYear();
  return `${MONTH[m - 1]} ${d}${y === thisYear ? "" : ` ${y}`}`;
}

/** `lose_weight` → `Lose weight`. */
function humanize(s: string): string {
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ───────────────────────────────── Screen ──────────────────────────────── */

export default function KnowsScreen() {
  const { colors } = useColors();
  const m = useMemoryCenter();
  const lc = useLifeContext();
  const ant = useAnticipation();
  const intel = useIntelligence();
  const [addPreset, setAddPreset] = useState<AddPreset | null>(null);

  const { identity, patterns, episodes, conversationCount } = m.memory;
  const bio = m.userBio;
  const goals = m.userGoals;
  // Pulled out so the fact-builders can depend on the stable callbacks rather
  // than on `m`, which the hook rebuilds every render.
  const { clearMotivation, removePreference } = m;

  /** Who you are — the facts you told Welliva, plus what it's aiming at. */
  const you = useMemo<Fact[]>(() => {
    const out: Fact[] = [];

    if (identity.motivation) {
      out.push({
        key: "why",
        icon: "heart-outline",
        title: identity.motivation,
        subtitle: "Your why",
        tone: colors.error,
        onRemove: () => void clearMotivation(),
      });
    }
    if (bio?.primaryGoal) {
      out.push({
        key: "goal",
        icon: "flag-outline",
        title: "Goal",
        subtitle: humanize(bio.primaryGoal),
      });
    }
    if (goals.targetWeightKg != null) {
      out.push({
        key: "target",
        icon: "locate-outline",
        title: "Target weight",
        value: `${goals.targetWeightKg} kg`,
      });
    }
    if (goals.weeklyWorkoutsTarget != null) {
      out.push({
        key: "workouts",
        icon: "barbell-outline",
        title: "Weekly workouts",
        value: `${goals.weeklyWorkoutsTarget} / week`,
      });
    }
    if (goals.dailyWaterMl != null) {
      out.push({
        key: "water",
        icon: "water-outline",
        title: "Daily water",
        value: `${(goals.dailyWaterMl / 1000).toFixed(1)} L`,
        tone: colors.water,
      });
    }
    if (goals.journeyStartedAt) {
      out.push({
        key: "started",
        icon: "calendar-outline",
        title: "Journey started",
        value: humanDate(goals.journeyStartedAt),
      });
    }

    // Free-text health facts you told Gozlin. The text is the title because a
    // sentence right-aligned in the value slot would crush the row.
    for (const c of identity.constraints) {
      out.push({
        key: `constraint-${c}`,
        icon: "alert-circle-outline",
        title: c,
        subtitle: "Something you told Gozlin",
        tone: colors.warning,
      });
    }
    for (const p of identity.preferences) {
      out.push({
        key: `pref-${p}`,
        icon: "thumbs-up-outline",
        title: p,
        subtitle: "A preference you mentioned",
        onRemove: () => void removePreference(p),
      });
    }

    return out;
  }, [identity, bio, goals, colors, clearMotivation, removePreference]);

  /** How you eat and train — the settings-owned half, read-only here. */
  const setup = useMemo<Fact[]>(() => {
    const out: Fact[] = [];
    if (bio?.dietaryRestriction && bio.dietaryRestriction !== "none") {
      out.push({
        key: "diet",
        icon: "leaf-outline",
        title: "Diet",
        subtitle: humanize(bio.dietaryRestriction),
        tone: colors.protein,
      });
    }
    if (bio?.allergies?.length) {
      out.push({
        key: "allergies",
        icon: "warning-outline",
        title: "Allergies",
        subtitle: bio.allergies.join(", "),
        tone: colors.error,
      });
    }
    if (bio?.foodDislikes?.length) {
      out.push({
        key: "dislikes",
        icon: "close-circle-outline",
        title: "Foods you avoid",
        subtitle: bio.foodDislikes.join(", "),
      });
    }
    if (bio?.cuisinePreference) {
      out.push({
        key: "cuisine",
        icon: "restaurant-outline",
        title: "Cuisine",
        subtitle: humanize(bio.cuisinePreference),
      });
    }
    if (bio?.region) {
      out.push({
        key: "region",
        icon: "globe-outline",
        title: "Region",
        value: bio.region,
      });
    }
    if (bio?.equipment?.length) {
      out.push({
        key: "equipment",
        icon: "fitness-outline",
        title: "Equipment",
        subtitle: bio.equipment.join(", "),
        tone: colors.fat,
      });
    }
    return out;
  }, [bio, colors]);

  const onCta = (a: Anticipation) => {
    if (a.addKind) setAddPreset({ kind: a.addKind, title: presetTitleFor(a.addKind) });
    else router.push("/gozlin" as never);
  };

  const header = (
    <ScreenTopBar
      title="Memory"
      style={styles.topBar}
      right={
        <Pressable
          onPress={() => router.push("/privacy" as never)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Trust — what Welliva is allowed to see"
          style={styles.iconBtn}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      }
    />
  );

  if (m.loading) {
    return (
      <Screen header={header}>
        <Card style={styles.block}>
          <AppText color="tertiary">Reading your memory…</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <Screen header={header}>
        {/* The marquee: what the learning models currently believe. */}
        <Reveal index={0}>
          <IntelligenceHero snap={intel.snapshot} loading={intel.loading} />
        </Reveal>

        {/* The honest headline: a count of what's held, and where it's held. */}
        <Reveal index={1}>
          <View style={styles.strip}>
            <StatCell value={String(you.length + setup.length)} label={"things\nknown"} />
            <Rule />
            <StatCell value={String(patterns.length)} label={"patterns\nspotted"} />
            <Rule />
            <StatCell value={String(m.days.length)} label={"days\nremembered"} />
            <Rule />
            <StatCell
              value={`${Math.round((intel.snapshot?.confidence ?? 0) * 100)}%`}
              label={"how well I\nknow you"}
              brand
            />
          </View>
          <AppText variant="footnote" color="tertiary" align="center" style={styles.stripNote}>
            All of it is stored on this device. Anything here can be changed or erased.
          </AppText>
        </Reveal>

        {/* ── The models themselves, each against its own gate ── */}
        {intel.snapshot ? (
          <Reveal index={2}>
            <View style={styles.block}>
              <SectionHeader
                title="How I'm learning you"
                subtitle="Each one starts on the population average and is fitted to you"
              />
              <Card padding="lg" style={styles.modelCard}>
                {intel.snapshot.models.map((model, i) => (
                  <ModelRow key={model.id} model={model} first={i === 0} />
                ))}
              </Card>
            </View>
          </Reveal>
        ) : null}

        {/* ── Who you are ── */}
        <Reveal index={3}>
          <View style={styles.block}>
            <SectionHeader title="Who you are" subtitle="What you've told Welliva, and what it's aiming at" />
            {you.length === 0 ? (
              <ListGroup>
                <ListRow
                  icon="chatbubbles-outline"
                  tone={colors.textTertiary}
                  title="Nothing yet"
                  subtitle="Tell Gozlin why you're here and it'll remember it here."
                  onPress={() => router.push("/gozlin" as never)}
                />
              </ListGroup>
            ) : (
              <ListGroup>
                {you.map((f) => (
                  <FactRow key={f.key} fact={f} />
                ))}
              </ListGroup>
            )}
          </View>
        </Reveal>

        {/* ── How you eat and train ── */}
        {setup.length > 0 && (
          <Reveal index={4}>
            <View style={styles.block}>
              <SectionHeader title="How you eat and train" subtitle="Set during onboarding — change any of it in Settings" />
              <ListGroup>
                {setup.map((f) => (
                  <FactRow key={f.key} fact={f} />
                ))}
                <ListRow
                  icon="settings-outline"
                  tone={colors.textSecondary}
                  title="Edit in Settings"
                  onPress={() => router.push("/settings" as never)}
                />
              </ListGroup>
            </View>
          </Reveal>
        )}

        {/* ── What Gozlin worked out on its own ── */}
        <Reveal index={5}>
          <View style={styles.block}>
            <SectionHeader
              title="What I've noticed"
              subtitle="Patterns Gozlin spotted in your behaviour — dismiss any that aren't you"
            />
            <ListGroup>
              {patterns.length === 0 ? (
                <ListRow
                  icon="bulb-outline"
                  tone={colors.textTertiary}
                  title="Still learning"
                  subtitle="Keep logging and the patterns Gozlin spots will show up here."
                />
              ) : (
                patterns.map((p) => (
                  <ListRow
                    key={p.message}
                    icon="bulb-outline"
                    tone={colors.carbs}
                    title={p.message}
                    subtitle="Spotted by Gozlin"
                    right={
                      <RemoveButton
                        label={`Dismiss: ${p.message}`}
                        onPress={() => void m.dismissPattern(p.message)}
                      />
                    }
                  />
                ))
              )}
            </ListGroup>
          </View>
        </Reveal>

        {/* ── The horizon: what it's planning around ── */}
        <Reveal index={6}>
          <View style={styles.block}>
            <SectionHeader
              title="What's ahead"
              subtitle="Tell Gozlin what's coming and your plan bends around it"
              actionLabel="Add"
              onAction={() => setAddPreset({})}
            />

            <AnticipationSection ant={ant} onCta={onCta} />

            {lc.loading ? null : lc.rows.length === 0 ? (
              <ListGroup style={styles.ahead}>
                <ListRow
                  icon="calendar-outline"
                  tone={colors.textTertiary}
                  title="Nothing on the horizon"
                  subtitle="Add a trip, a wedding, an exam season or a medication course."
                  onPress={() => setAddPreset({})}
                />
              </ListGroup>
            ) : (
              lc.rows.map((row) => (
                <UpcomingCard
                  key={row.id}
                  row={row}
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

            <SignalsPanel
              onSynced={() => Promise.all([lc.reload(), ant.reload()]).then(() => {})}
            />
          </View>
        </Reveal>

        {/* ── Milestones, with dates a human wrote ── */}
        <Reveal index={7}>
          <View style={styles.block}>
            <SectionHeader title="Your story" subtitle="The moments Welliva keeps" />
            <ListGroup>
              {episodes.length === 0 ? (
                <ListRow
                  icon="ribbon-outline"
                  tone={colors.textTertiary}
                  title="No milestones yet"
                  subtitle="First streaks and goals reached are remembered here."
                />
              ) : (
                [...episodes]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((e) => (
                    <ListRow
                      key={e.id}
                      icon="ribbon-outline"
                      tone={colors.warning}
                      title={e.summary}
                      subtitle={humanDate(e.date)}
                      right={
                        <RemoveButton
                          label={`Forget: ${e.summary}`}
                          onPress={() => void m.forgetEpisode(e.id)}
                        />
                      }
                    />
                  ))
              )}
            </ListGroup>
          </View>
        </Reveal>

        {/* ── The raw record, one tap away instead of underfoot ── */}
        <Reveal index={8}>
          <View style={styles.block}>
            <SectionHeader title="What's kept" />
            <ListGroup>
              <ListRow
                icon="time-outline"
                title="Full record"
                subtitle={
                  m.eventCount === 0
                    ? "Nothing recorded yet"
                    : "Every event, with what you can correct or remove"
                }
                value={m.eventCount > 0 ? String(m.eventCount) : undefined}
                chevron
                onPress={() => router.push("/memory-center" as never)}
              />
              <ListRow
                icon="chatbubbles-outline"
                title="Conversations with Gozlin"
                subtitle={`${conversationCount} message${conversationCount === 1 ? "" : "s"} kept on this device`}
                onPress={() => router.push("/gozlin" as never)}
              />
            </ListGroup>
          </View>
        </Reveal>

        {/* ── The two irreversible things, alone at the bottom ── */}
        <Reveal index={9}>
          <View style={styles.block}>
            <SectionHeader title="Erase" subtitle="Neither of these can be undone" />
            <ListGroup>
              {conversationCount > 0 ? (
                <ListRow
                  icon="chatbubble-ellipses-outline"
                  destructive
                  title="Clear conversation history"
                  subtitle="Removes your chat with Gozlin. Your logs and facts stay."
                  onPress={() =>
                    Alert.alert(
                      "Clear conversations?",
                      "This removes your chat history with Gozlin.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Clear",
                          style: "destructive",
                          onPress: () => void m.clearConversations(),
                        },
                      ],
                    )
                  }
                />
              ) : null}
              <ListRow
                icon="trash-outline"
                destructive
                title="Forget everything"
                subtitle="Erases your timeline, every summary, and everything Gozlin remembers."
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
            </ListGroup>
          </View>
        </Reveal>
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

/* ─────────────────────────────── Sub-components ─────────────────────────── */

function FactRow({ fact }: { fact: Fact }) {
  return (
    <ListRow
      icon={fact.icon}
      tone={fact.tone}
      title={fact.title}
      subtitle={fact.subtitle}
      value={fact.value}
      right={
        fact.onRemove ? (
          <RemoveButton label={`Forget: ${fact.title}`} onPress={fact.onRemove} />
        ) : undefined
      }
    />
  );
}

/**
 * The ✕ on a fact Welliva inferred or was told in passing. It lives in the row's
 * `right` slot, which also suppresses the chevron — correct, since these rows go
 * nowhere.
 */
function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
    </Pressable>
  );
}

/**
 * THE INTELLIGENCE HERO — what the learning models currently believe, in one
 * sentence, in the coach's voice.
 *
 * The lead line is CHOSEN, not concatenated. Five models can each have
 * something to say, and a panel that says all five says nothing; the ranking
 * below is "which of these would a good coach open with today". The learned
 * maintenance figure wins whenever it exists because it is the single most
 * credibility-building sentence the product can produce — and it only exists
 * once the Kalman filter's own gate has passed, so it can't be said early.
 */
function IntelligenceHero({
  snap,
  loading,
}: {
  snap: IntelligenceSnapshot | null;
  loading: boolean;
}) {
  const { colors } = useColors();

  const lead = useMemo(() => {
    if (!snap) return null;
    if (snap.tdee?.disclosure) return snap.tdee.disclosure;
    if (snap.drift) {
      return snap.drift.direction === "decline"
        ? `Something shifted in ${snap.drift.label}. I've seen it, and I'm coaching around it rather than pretending it didn't happen.`
        : `${snap.drift.label.charAt(0).toUpperCase()}${snap.drift.label.slice(1)} genuinely stepped up — that's a real change, not a good week.`;
    }
    if (snap.adherence.action.kind === "shrink") return snap.adherence.action.reason;
    if (snap.training.fitted) {
      return `Your fatigue clears in about ${snap.training.tau2} days, which is your number, not the average. I time your hard days around it.`;
    }
    if (snap.delivery.best && snap.outcomes.resolved >= 20) {
      return `You respond best when I'm ${snap.delivery.best.arm.replace("nudge:", "")}. I've stopped guessing at that.`;
    }
    return "I'm still working you out. Every meal, session and weigh-in you log moves these from the population average toward you.";
  }, [snap]);

  if (loading || !snap) {
    return (
      <Card padding="lg" style={styles.hero}>
        <AppText variant="caption" color="brand" uppercase>
          Intelligence
        </AppText>
        <AppText variant="body" color="tertiary" style={styles.heroLead}>
          {loading ? "Reading what I've learned…" : "Finish setting up your profile and I'll start learning."}
        </AppText>
      </Card>
    );
  }

  const confident = snap.models.filter((m) => m.confident).length;

  return (
    <Card padding="lg" style={[styles.hero, { borderColor: alpha(colors.primary, 0.25) }]}>
      <View style={styles.heroHead}>
        <AppText variant="caption" color="brand" uppercase>
          Intelligence
        </AppText>
        <AppText variant="caption" color="tertiary">
          {confident} of {snap.models.length} learned
        </AppText>
      </View>

      <AppText variant="bodyLg" style={styles.heroLead}>
        {lead}
      </AppText>

      {/* One pip per model — filled once that model has passed its own gate. */}
      <View style={styles.pips}>
        {snap.models.map((model) => (
          <View
            key={model.id}
            style={[
              styles.pip,
              {
                backgroundColor: model.confident
                  ? colors.primary
                  : alpha(colors.primary, 0.18),
              },
            ]}
          />
        ))}
      </View>
    </Card>
  );
}

/**
 * One model's standing: what it does, how far along it is, and what it has
 * concluded — or exactly what it still needs before it's allowed to conclude
 * anything. The `detail` string carries both cases, because a gate that is
 * explained ("9 of 14 weigh-ins") reads as rigour, while a blank one reads as
 * a broken feature.
 */
function ModelRow({ model, first }: { model: ModelCard; first: boolean }) {
  const { colors } = useColors();
  return (
    <View style={[styles.model, !first && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.modelHead}>
        <AppText variant="callout" style={styles.flex}>
          {model.label}
        </AppText>
        <AppText
          variant="caption"
          color={model.confident ? "brand" : "tertiary"}
          style={styles.modelState}
        >
          {model.confident ? "LEARNED" : "LEARNING"}
        </AppText>
      </View>

      <AppText variant="footnote" color="tertiary" style={styles.modelBlurb}>
        {model.blurb}
      </AppText>

      <ProgressBar
        progress={model.progress}
        gradient={colors.brandGradient}
        height={5}
        style={styles.modelBar}
      />

      <AppText variant="footnote" color={model.confident ? "secondary" : "tertiary"}>
        {model.detail}
      </AppText>
    </View>
  );
}

/** One figure in the header strip. Card-less, like Home's streak row. */
function StatCell({
  value,
  label,
  brand,
}: {
  value: string;
  label: string;
  brand?: boolean;
}) {
  const { colors } = useColors();
  return (
    <View style={styles.cell}>
      {/* `title`, not `metric`: four figures across a 360dp phone, and 32pt
          numbers next to a two-line label is where this strip starts to clip. */}
      <AppText variant="title" color={brand ? colors.primary : "primary"} numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color="tertiary" align="center" style={styles.cellLabel}>
        {label}
      </AppText>
    </View>
  );
}

function Rule() {
  const { colors } = useColors();
  return <View style={[styles.rule, { backgroundColor: alpha(colors.text, 0.1) }]} />;
}

const styles = StyleSheet.create({
  topBar: { paddingTop: Spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  // Hero
  hero: { marginTop: Spacing.lg, borderWidth: 1 },
  heroHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  heroLead: { lineHeight: 24 },
  pips: { flexDirection: "row", gap: 6, marginTop: Spacing.lg },
  pip: { flex: 1, height: 4, borderRadius: 2 },

  flex: { flex: 1 },

  // Model list
  modelCard: { gap: 0 },
  model: { paddingVertical: Spacing.lg },
  modelHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  modelState: { fontWeight: "700" },
  modelBlurb: { marginTop: 2, lineHeight: 17 },
  modelBar: { marginTop: Spacing.md, marginBottom: Spacing.sm },

  strip: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: Spacing.xl,
  },
  cell: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 2 },
  cellLabel: { marginTop: 4, lineHeight: 14 },
  rule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: Spacing.xs,
    borderRadius: Radius.xs,
  },
  stripNote: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg },

  block: { marginTop: Spacing.xxl },
  ahead: { marginBottom: Spacing.md },
  pressed: { opacity: 0.6 },
});

/**
 * LEVEL 3 — route-level boundary. A throw inside this screen is contained here:
 * the menu stays live and every other destination stays usable.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:knows" />;
}
