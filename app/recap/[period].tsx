/**
 * MONTHLY RECAP — "Welliva Wrapped" (the full screen, modal).
 *
 * A playful, narrative, shareable recap of one calendar month: a hero with the
 * vibe title + headline + a ring of active days, then per-domain cards
 * (Training / Nutrition / Hydration / Consistency / Body), the strongest week +
 * standout day, milestones unlocked, month-over-month deltas, a Gozlin sign-off,
 * and a Share button. Every number is computed from real persisted logs and ALL
 * copy comes from MonthlyRecapService — this screen is presentation only.
 */

import {
  AnimatedNumber,
  AppText,
  Button,
  Card,
  IconBadge,
  Pill,
  ProgressBar,
  Reveal,
  Ring,
  Screen,
  Stat,
  useColors,
} from "@/components/ui";
import { Confetti } from "@/components/Confetti";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useSystem } from "@/contexts/AppContext";
import { recapShareText, recapSignoff } from "@/services/MonthlyRecapService";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";

export default function RecapScreen() {
  const { colors } = useColors();
  const { period } = useLocalSearchParams<{ period: string }>();
  const { buildRecap, markRecapSeen } = useSystem();

  const periodKey = period ?? "";
  const recap = useMemo(() => buildRecap(periodKey), [buildRecap, periodKey]);

  // Opening the recap counts as "seen" — clears the Profile banner.
  useEffect(() => {
    if (periodKey) markRecapSeen(periodKey);
  }, [periodKey, markRecapSeen]);

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <AppText variant="caption" color="brand" uppercase>
          Welliva Wrapped
        </AppText>
        <AppText variant="headline">{recap.label}</AppText>
      </View>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={[styles.closeBtn, { borderColor: alpha(colors.primary, 0.4) }]}
      >
        <Ionicons name="close" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );

  if (!recap.hasActivity) {
    return (
      <Screen header={header}>
        <Card padding="xl">
          <View style={styles.emptyWrap}>
            <IconBadge name="calendar-outline" muted size={48} />
            <AppText variant="headline" align="center" style={styles.emptyTitle}>
              {recap.headline}
            </AppText>
            <AppText variant="subhead" color="tertiary" align="center">
              Nothing was logged in {recap.label}. Your story picks up the next
              time you show up.
            </AppText>
          </View>
        </Card>
      </Screen>
    );
  }

  const onShare = () => {
    Share.share({ message: recapShareText(recap) }).catch(() => {});
  };

  return (
    <>
      <Screen header={header}>
        {/* Hero */}
        <Reveal index={0}>
          <Card style={styles.block} padding="xxl">
            <View style={styles.heroInner}>
              <Pill label={recap.vibeTitle} tone={colors.primary} />
              <AppText variant="display" align="center" style={styles.headline}>
                {recap.headline}
              </AppText>
              <Ring
                progress={recap.hero.total > 0 ? recap.hero.value / recap.hero.total : 0}
                size={168}
                strokeWidth={14}
                gradient={colors.brandGradient}
                style={styles.heroRing}
              >
                <AnimatedNumber value={recap.hero.value} variant="displayLg" />
                <AppText variant="footnote" color="secondary">
                  {recap.hero.label}
                </AppText>
                <AppText variant="caption" color="tertiary">
                  {recap.hero.sub}
                </AppText>
              </Ring>
            </View>
          </Card>
        </Reveal>

        {/* Training */}
        <Reveal index={1}>
          <DomainCard icon="barbell" tone={colors.calories} title="Training">
            <StatRow
              stats={[
                { value: recap.training.workouts, label: "Workouts" },
                { value: recap.training.totalReps.toLocaleString(), label: "Reps" },
                { value: `${recap.training.avgCompletion}%`, label: "Avg" },
              ]}
            />
            {recap.training.bestDay && (
              <FootNote
                icon="flash"
                tone={colors.calories}
                text={`Best day · ${recap.training.bestDay.label} · ${recap.training.bestDay.reps.toLocaleString()} reps`}
              />
            )}
          </DomainCard>
        </Reveal>

        {/* Nutrition */}
        <Reveal index={2}>
          <DomainCard icon="restaurant" tone={colors.protein} title="Nutrition">
            <StatRow
              stats={[
                { value: recap.nutrition.mealsLogged, label: "Meals" },
                { value: recap.nutrition.perfectDays, label: "Perfect days" },
                { value: recap.nutrition.partialDays, label: "Partial days" },
              ]}
            />
            {recap.nutrition.proteinAdherence != null && (
              <FootNote
                icon="egg"
                tone={colors.protein}
                text={`Protein · ${recap.nutrition.proteinGoalDays} on-target days · ${recap.nutrition.proteinAdherence}% avg adherence`}
              />
            )}
          </DomainCard>
        </Reveal>

        {/* Hydration — only when there's a real dated signal for the month */}
        {recap.hydration.tracked && (
          <Reveal index={3}>
            <DomainCard icon="water" tone={colors.water} title="Hydration">
              <StatRow
                stats={[{ value: recap.hydration.goalDays, label: "Goal days" }]}
              />
            </DomainCard>
          </Reveal>
        )}

        {/* Consistency */}
        <Reveal index={4}>
          <DomainCard icon="flame" tone={colors.calories} title="Consistency">
            <StatRow
              stats={[
                { value: recap.consistency.activeDays, label: "Active days" },
                { value: recap.consistency.bestStreak, label: "Best run" },
                {
                  value: recap.consistency.strongestWeek?.label.replace("Week ", "W") ?? "—",
                  label: "Top week",
                },
              ]}
            />
            <View style={styles.weeks}>
              {recap.consistency.weeks.map((w) => {
                const strong = recap.consistency.strongestWeek?.index === w.index;
                return (
                  <View key={w.index} style={styles.weekRow}>
                    <AppText variant="caption" color="tertiary" style={styles.weekLabel}>
                      {w.rangeLabel}
                    </AppText>
                    <ProgressBar
                      progress={w.activeDays / 7}
                      gradient={strong ? colors.brandGradient : undefined}
                      tone={strong ? undefined : colors.surfaceSunken}
                      height={8}
                      style={styles.flex}
                    />
                    <AppText
                      variant="caption"
                      color={strong ? "brand" : "tertiary"}
                      style={styles.weekCount}
                    >
                      {w.activeDays}
                    </AppText>
                  </View>
                );
              })}
            </View>
            {recap.consistency.standoutDay && (
              <FootNote
                icon="star"
                tone={colors.gold}
                text={`Standout · ${recap.consistency.standoutDay.label} · ${recap.consistency.standoutDay.note}`}
              />
            )}
          </DomainCard>
        </Reveal>

        {/* Body */}
        {recap.body.weighIns > 0 && (
          <Reveal index={5}>
            <DomainCard icon="body" tone={colors.fat} title="Body">
              {recap.body.deltaKg != null && recap.body.direction ? (
                <View style={styles.bodyRow}>
                  <Ionicons
                    name={
                      recap.body.direction === "down"
                        ? "trending-down"
                        : recap.body.direction === "up"
                          ? "trending-up"
                          : "remove"
                    }
                    size={28}
                    color={colors.fat}
                  />
                  <View style={styles.flex}>
                    <AppText variant="title">
                      {recap.body.direction === "flat"
                        ? "Held steady"
                        : `${recap.body.direction === "down" ? "Down" : "Up"} ${Math.abs(recap.body.deltaKg)} kg`}
                    </AppText>
                    <AppText variant="footnote" color="tertiary">
                      {recap.body.startKg} → {recap.body.endKg} kg · {recap.body.weighIns} check-ins
                    </AppText>
                  </View>
                </View>
              ) : (
                <FootNote
                  icon="body"
                  tone={colors.fat}
                  text={`${recap.body.weighIns} check-in${recap.body.weighIns === 1 ? "" : "s"} logged — keep the trend honest.`}
                />
              )}
            </DomainCard>
          </Reveal>
        )}

        {/* Milestones */}
        {(recap.milestones.achievements.length > 0 ||
          recap.milestones.challenges.length > 0 ||
          recap.milestones.trophy) && (
          <Reveal index={6}>
            <DomainCard icon="ribbon" tone={colors.gold} title="Milestones">
              {recap.milestones.trophy && (
                <View
                  style={[
                    styles.trophyRow,
                    { backgroundColor: alpha(colors.gold, 0.14) },
                  ]}
                >
                  <Ionicons name="trophy" size={18} color={colors.gold} />
                  <AppText variant="callout" style={styles.flex}>
                    {recap.milestones.trophy.title}
                  </AppText>
                  <AppText variant="caption" color="tertiary">
                    {recap.milestones.trophy.score} pts
                  </AppText>
                </View>
              )}
              {recap.milestones.achievements.length > 0 && (
                <View style={styles.pillWrap}>
                  {recap.milestones.achievements.map((a) => (
                    <Pill key={a.id} label={a.name} tone={a.color} size="sm" icon="medal" />
                  ))}
                </View>
              )}
              {recap.milestones.challenges.map((c) => (
                <View key={c.id} style={styles.challengeRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <AppText variant="footnote" color="secondary" style={styles.flex}>
                    {c.title}
                  </AppText>
                </View>
              ))}
            </DomainCard>
          </Reveal>
        )}

        {/* Month-over-month */}
        {recap.deltas.hasPrior && recap.deltas.items.length > 0 && (
          <Reveal index={7}>
            <DomainCard icon="stats-chart" tone={colors.water} title={`vs ${recap.deltas.priorMonthName}`}>
              {recap.deltas.items.map((d) => (
                <View key={d.key} style={styles.deltaRow}>
                  <Ionicons
                    name={d.delta >= 0 ? "arrow-up" : "arrow-down"}
                    size={15}
                    color={d.delta >= 0 ? colors.success : colors.textTertiary}
                  />
                  <AppText
                    variant="footnote"
                    color={d.delta >= 0 ? "secondary" : "tertiary"}
                  >
                    {d.text}
                  </AppText>
                </View>
              ))}
            </DomainCard>
          </Reveal>
        )}

        {/* Gozlin sign-off */}
        <Reveal index={8}>
          <Card style={styles.block} padding="lg">
            <View style={styles.signoffRow}>
              <IconBadge name="sparkles-outline" tone={colors.primary} size={44} />
              <AppText variant="subhead" color="secondary" style={styles.flex}>
                {recapSignoff(recap)}
              </AppText>
            </View>
          </Card>
        </Reveal>

        {/* Share */}
        <Reveal index={9}>
          <Button
            label="Share my recap"
            icon="share-outline"
            onPress={onShare}
            style={styles.shareBtn}
          />
        </Reveal>
      </Screen>

      {/* Moderate flourish over the hero — overlays on top (pointerEvents none),
          respects reduced-motion internally, fires once on mount then fades. */}
      <Confetti tierColor={colors.primary} intensity={0.65} />
    </>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

function DomainCard({
  icon,
  tone,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.block} padding="lg">
      <View style={styles.domainHead}>
        <IconBadge name={icon} tone={tone} size={40} />
        <AppText variant="headline">{title}</AppText>
      </View>
      {children}
    </Card>
  );
}

function StatRow({
  stats,
}: {
  stats: { value: string | number; label: string }[];
}) {
  const { colors } = useColors();
  return (
    <View style={styles.statRow}>
      {stats.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <View style={[styles.vline, { backgroundColor: colors.divider }]} />}
          <Stat value={s.value} label={s.label} style={styles.flex} />
        </React.Fragment>
      ))}
    </View>
  );
}

function FootNote({
  icon,
  tone,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  text: string;
}) {
  const { colors } = useColors();
  return (
    <View style={[styles.footNote, { borderTopColor: colors.divider }]}>
      <Ionicons name={icon} size={15} color={tone} />
      <AppText variant="footnote" color="secondary" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },
  vline: { width: 1, height: 34 },

  header: { paddingTop: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.lg },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  // Hero
  heroInner: { alignItems: "center", gap: Spacing.md },
  headline: { marginTop: Spacing.xs },
  heroRing: { marginTop: Spacing.md },

  // Domain cards
  domainHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statRow: { flexDirection: "row", alignItems: "center" },
  footNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },

  // Consistency weeks
  weeks: { marginTop: Spacing.lg, gap: Spacing.sm },
  weekRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  weekLabel: { width: 64 },
  weekCount: { width: 20, textAlign: "right", fontWeight: "700" },

  // Body
  bodyRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  // Milestones
  trophyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  challengeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // Deltas
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 5,
  },

  // Sign-off
  signoffRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  shareBtn: { marginTop: Spacing.sm },

  // Empty
  emptyWrap: { alignItems: "center", gap: Spacing.sm },
  emptyTitle: { marginTop: Spacing.sm },
});
