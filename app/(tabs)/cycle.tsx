/**
 * CYCLE — her cycle, her patterns, and what the app is doing about them.
 *
 * Top to bottom, in the order she needs it:
 *   1. the dial — where she is, what's next, today's marker
 *   2. one tap — "Period started" / "Period ended", and "Log today"
 *   3. anything that needs an answer — an unended period, a gap that looks
 *      like a missed log
 *   4. today — her own heads-ups, what she logged, what changed in her plan
 *   5. the next period — the window, the most likely day, and WHY (the
 *      cycles it was built from), plus the fertile window if she chose it
 *   6. iron, on heavy days — from foods she already eats
 *   7. what her cycle shows — her patterns, across mood, sleep and training
 *   8. worth mentioning to a doctor — only when something is
 *   9. the calendar and her cycles side by side
 *  10. where the data lives, in one honest line
 *
 * Paused in pregnancy; waiting after a birth; logging-only with menopause on
 * the profile. Not set up → the setup invitation, never a dead end.
 */
import { CycleCalendar, CycleDial, CycleHistory, DayLogSheet, PickDateSheet, useCyclePalette } from "@/components/cycle";
import { useCyclePatterns, useIronPicks } from "@/components/cycle/useCycleInsights";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { AppText, Button, Card, IconBadge, Reveal, Screen, SectionHeader, useColors } from "@/components/ui";
import { useSyncStatus } from "@/services/sync/useSyncStatus";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useCycle } from "@/contexts/CycleContext";
import {
  addDays,
  confidenceLine,
  cycleHeadline,
  dialModel,
  doctorSummary,
  ENERGY_LABEL,
  FLOW_LABEL,
  formatDay,
  formatRange,
  minDate,
  MOOD_LABEL,
  openEpisode,
  paintDays,
  shiftMonthCursor,
  SYMPTOM_LABEL,
  windowLine,
  type CycleDayLog,
  type CycleRecord,
} from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, View, useWindowDimensions } from "react-native";

type DateQuestion =
  | { kind: "start" }
  | { kind: "end"; from: string }
  | { kind: "missed"; gap: CycleRecord };

export default function CycleScreen() {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const { width } = useWindowDimensions();
  const cycle = useCycle();
  const { view, data, settings, today } = cycle;
  const s = view.status;
  const p = view.prediction;
  const sync = useSyncStatus();
  const patterns = useCyclePatterns();
  const iron = useIronPicks(view.iron !== null);

  const [logDate, setLogDate] = useState<string | null>(null);
  const [question, setQuestion] = useState<DateQuestion | null>(null);
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));

  const model = useMemo(
    () => dialModel({ episodes: data.periods, view, today, showFertile: settings.showFertileWindow }),
    [data.periods, view, today, settings.showFertileWindow],
  );
  const paint = useMemo(
    () => paintDays({ episodes: data.periods, days: data.days, view, today, showFertile: settings.showFertileWindow }),
    [data.periods, data.days, view, today, settings.showFertileWindow],
  );
  const open = useMemo(() => openEpisode(data.periods), [data.periods]);

  const dialSize = Math.min(300, Math.round(width - Spacing.screen * 2 - 48));
  const headline = cycleHeadline(view, settings.showFertileWindow);

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.headerTitle}>
        Cycle
      </AppText>
      {settings.enabled ? (
        <Pressable
          hitSlop={12}
          onPress={() => router.push("/cycle/settings" as never)}
          accessibilityRole="button"
          accessibilityLabel="Cycle settings"
          style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons name="options-outline" size={19} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );

  if (!cycle.ready) return <Screen header={header}>{null}</Screen>;

  if (!settings.enabled) {
    return (
      <Screen header={header}>
        <Card padding="xl" style={styles.block}>
          <IconBadge name="water" tone={palette.period} size={48} />
          <AppText variant="title" style={styles.setupTitle}>
            Track your cycle, privately
          </AppText>
          <AppText variant="body" color="secondary">
            Two questions to start. Predictions that learn your rhythm and say how sure they are, a
            plan that eases off on the days you log cramps or a heavy flow, and patterns from your own
            logs that no period app can see.
          </AppText>
          <Button
            label="Set it up"
            onPress={() => router.replace("/cycle/setup" as never)}
            fullWidth
            style={styles.setupCta}
          />
        </Card>
      </Screen>
    );
  }

  const backupLine = !settings.backupOn
    ? "Kept on this phone only"
    : sync.cloudDisabled
      ? "Saved on this phone (backup is part of welliva Pro)"
      : "Backed up with your account";

  const centerEyebrow = s.inPeriod ? "Period day" : s.cycleDay !== null ? "Cycle day" : "Cycle";
  const centerSub = s.inPeriod
    ? `usually ${view.typicalBleed} days`
    : s.lateBy > 0
      ? `late by ${s.lateBy} ${s.lateBy === 1 ? "day" : "days"}`
      : p && s.predicting
        ? `of about ${p.cycleLength}`
        : s.cycleDay === null
          ? "log your period"
          : " ";

  const dialLabel = `${headline.eyebrow}. ${headline.title}. ${headline.detail}`;

  const paused = view.mode === "pregnancy";
  const showPeriodStarted = !paused && !s.inPeriod;
  const showPeriodEnded = !paused && s.inPeriod && s.periodOpen && !s.periodStale;

  return (
    <>
      <Screen header={header}>
        {/* ── 1. The dial ─────────────────────────────────────────────── */}
        <Reveal index={0}>
          <View style={styles.hero}>
            {paused ? (
              <Card padding="xl" style={styles.pausedCard}>
                <IconBadge name="pause-circle-outline" tone={palette.period} size={44} />
                <AppText variant="headline" style={styles.setupTitle}>
                  Paused while you&apos;re pregnant
                </AppText>
                <AppText variant="subhead" color="secondary">
                  Your history is kept safe here. When you take pregnancy off your profile, tracking
                  picks up again, and the first period after the birth starts it fresh.
                </AppText>
                <Button
                  label="Body & health details"
                  variant="tonal"
                  size="sm"
                  onPress={() => router.push("/settings?edit=1" as never)}
                  style={styles.setupCta}
                />
              </Card>
            ) : (
              <>
                <CycleDial
                  model={model}
                  size={dialSize}
                  todayTone={s.inPeriod ? palette.period : colors.primary}
                  animate="always"
                  accessibilityLabel={dialLabel}
                >
                  <AppText variant="caption" color="tertiary" uppercase>
                    {centerEyebrow}
                  </AppText>
                  <AppText
                    variant="displayLg"
                    style={[styles.bigNumber, { fontSize: Math.round(dialSize * 0.2), lineHeight: Math.round(dialSize * 0.25) }]}
                  >
                    {s.periodDay ?? s.cycleDay ?? "–"}
                  </AppText>
                  <AppText variant="footnote" color="secondary">
                    {centerSub}
                  </AppText>
                </CycleDial>
                <AppText variant="headline" align="center" style={styles.heroTitle}>
                  {headline.title}
                </AppText>
                {headline.detail ? (
                  <AppText variant="subhead" color="secondary" align="center">
                    {headline.detail}
                  </AppText>
                ) : null}
              </>
            )}
          </View>
        </Reveal>

        {/* ── 2. One tap ──────────────────────────────────────────────── */}
        {!paused ? (
          <Reveal index={1}>
            <View style={styles.actions}>
              {showPeriodStarted ? (
                <Button
                  label="Period started"
                  icon="water"
                  onPress={() => void cycle.startPeriod()}
                  style={styles.flex}
                  accessibilityHint="Logs today as the first day of your period"
                />
              ) : showPeriodEnded ? (
                <Button
                  label="Period ended"
                  icon="checkmark-circle-outline"
                  onPress={() => void cycle.endPeriod()}
                  style={styles.flex}
                  accessibilityHint="Logs today as the last day of your period"
                />
              ) : null}
              <Button
                label="Log today"
                icon="create-outline"
                variant="tonal"
                onPress={() => setLogDate(today)}
                style={styles.flex}
              />
            </View>
            {showPeriodStarted || showPeriodEnded ? (
              <Pressable
                onPress={() =>
                  setQuestion(
                    showPeriodEnded && open ? { kind: "end", from: open.start } : { kind: "start" },
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={
                  showPeriodEnded ? "Pick the day your period ended" : "Pick the day your period started"
                }
                hitSlop={8}
                style={styles.otherDay}
              >
                <AppText variant="footnote" color="brand" weight="600">
                  {showPeriodEnded ? "Ended on another day?" : "Started on another day?"}
                </AppText>
              </Pressable>
            ) : null}
          </Reveal>
        ) : null}

        {/* ── 3. Questions that need an answer ────────────────────────── */}
        {s.periodStale && open ? (
          <Reveal index={2}>
            <Card padding="lg" style={styles.block}>
              <AppText variant="callout">Has your period ended?</AppText>
              <AppText variant="footnote" color="secondary" style={styles.cardBody}>
                It started {formatDay(open.start, { weekday: true })} and hasn&apos;t been ended. Until
                you say, I&apos;m assuming it lasted your usual {view.typicalBleed} days.
              </AppText>
              <Button
                label="Pick the last day"
                size="sm"
                variant="tonal"
                onPress={() => setQuestion({ kind: "end", from: open.start })}
                style={styles.cardCta}
              />
            </Card>
          </Reveal>
        ) : null}

        {view.gaps.map((gap) => (
          <Reveal index={2} key={gap.start}>
            <Card padding="lg" style={styles.block}>
              <AppText variant="callout">
                A long gap: {formatRange(gap.start, addDays(gap.nextStart, -1))}
              </AppText>
              <AppText variant="footnote" color="secondary" style={styles.cardBody}>
                {gap.length} days between two periods. Did you have one in between that you
                didn&apos;t log? I&apos;ve left this gap out of your predictions until you say.
              </AppText>
              <View style={styles.gapActions}>
                <Button
                  label="Yes, add it"
                  size="sm"
                  onPress={() => setQuestion({ kind: "missed", gap })}
                />
                <Button
                  label="One long cycle"
                  size="sm"
                  variant="tonal"
                  onPress={() => void cycle.answerGap(gap.start, "long")}
                />
                <Button
                  label="A pause"
                  size="sm"
                  variant="ghost"
                  onPress={() => void cycle.answerGap(gap.start, "pause")}
                  accessibilityHint="Pregnancy, illness or a break from logging. Never counted."
                />
              </View>
            </Card>
          </Reveal>
        ))}

        {/* ── 4. Today ────────────────────────────────────────────────── */}
        {!paused && (view.headsUps.length > 0 || view.ease || view.todayLog) ? (
          <Reveal index={3}>
            <View style={styles.section}>
              <SectionHeader title="Today" subtitle="From your own logs" weight="700" />
              <Card padding="lg">
                {view.headsUps.map((h) => (
                  <View key={h.id} style={styles.lineRow}>
                    <Ionicons name="sparkles-outline" size={16} color={palette.period} />
                    <AppText variant="subhead" style={styles.flex}>
                      {h.text}
                    </AppText>
                  </View>
                ))}
                {view.todayLog ? (
                  <Pressable
                    onPress={() => setLogDate(today)}
                    style={styles.lineRow}
                    accessibilityRole="button"
                    accessibilityLabel={`${todaySummary(view.todayLog)}. Edit today's log`}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.textTertiary} />
                    <AppText variant="subhead" color="secondary" style={styles.flex}>
                      {todaySummary(view.todayLog)}
                    </AppText>
                  </Pressable>
                ) : null}
                {view.ease ? (
                  <Pressable
                    onPress={() => router.navigate("/exercise" as never)}
                    accessibilityRole="button"
                    accessibilityLabel="See today's lighter workout"
                    style={styles.lineRow}
                  >
                    <Ionicons name="barbell-outline" size={16} color={colors.primary} />
                    <AppText variant="subhead" style={styles.flex}>
                      {view.ease.auto
                        ? "Today's workout is lighter, because of what you logged."
                        : "A lighter version of today's workout is one tap away."}
                    </AppText>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </Pressable>
                ) : null}
              </Card>
            </View>
          </Reveal>
        ) : null}

        {/* ── 5. The next period ──────────────────────────────────────── */}
        {p && s.predicting && !s.inPeriod ? (
          <Reveal index={4}>
            <View style={styles.section}>
              <SectionHeader title="Next period" weight="700" />
              <Card padding="lg">
                <AppText variant="callout">
                  {s.lateBy > 0
                    ? `Expected ${formatRange(p.earliest, p.latest)}, now ${s.lateBy} ${
                        s.lateBy === 1 ? "day" : "days"
                      } past that`
                    : windowLine(p)}
                </AppText>
                <AppText variant="footnote" color="secondary" style={styles.cardBody}>
                  {confidenceLine(p)}
                </AppText>
                <View style={[styles.rule, { backgroundColor: colors.divider }]} />
                <AppText variant="footnote" color="secondary">
                  Periods usually last {p.periodLength} days
                  {p.periodBasis > 0 ? " (from the ones you've ended)" : " (what you told me)"}.
                </AppText>
                {settings.showFertileWindow ? (
                  <View style={[styles.fertile, { backgroundColor: palette.fertileSoft }]}>
                    <AppText variant="footnote" weight="700" style={{ color: palette.fertile }}>
                      Fertile window {formatRange(p.fertileStart, p.fertileEnd)}
                    </AppText>
                    <AppText variant="caption" color="secondary">
                      Ovulation around {formatDay(p.ovulation)}
                      {p.lutealPersonal ? ", from your own ovulation tests" : ""}. An estimate, not birth
                      control.
                    </AppText>
                  </View>
                ) : null}
              </Card>
            </View>
          </Reveal>
        ) : null}

        {/* ── 6. Iron ─────────────────────────────────────────────────── */}
        {view.iron && iron.picks.length > 0 ? (
          <Reveal index={5}>
            <View style={styles.section}>
              <SectionHeader
                title="Iron for heavy days"
                subtitle={
                  view.iron === "anemia"
                    ? "With anaemia on your profile, periods are worth eating for"
                    : "Heavy bleeding uses up iron"
                }
                weight="700"
              />
              <Card padding="lg">
                <AppText variant="footnote" color="tertiary" style={styles.ironLead}>
                  {iron.fromLog ? "From foods you already eat:" : "Good sources that fit how you eat:"}
                </AppText>
                {iron.picks.map((pick) => (
                  <View key={pick.name} style={styles.ironRow}>
                    <View style={[styles.ironDot, { backgroundColor: palette.period }]} />
                    <AppText variant="subhead" style={styles.flex} numberOfLines={1}>
                      {pick.name}
                    </AppText>
                    <AppText variant="footnote" color="secondary">
                      {pick.ironMg} mg · {pick.portion}
                    </AppText>
                  </View>
                ))}
                <AppText variant="caption" color="tertiary" style={styles.ironTip}>
                  Pair them with vitamin C (an orange, tomatoes, peppers) and keep tea and coffee away
                  from those meals, so more of the iron is absorbed.
                </AppText>
              </Card>
            </View>
          </Reveal>
        ) : null}

        {/* ── 7. What her cycle shows ─────────────────────────────────── */}
        <Reveal index={6}>
          <View style={styles.section}>
            <SectionHeader title="What your cycle shows" subtitle="Patterns from your own logs" weight="700" />
            {patterns.length ? (
              <Card padding="none">
                {patterns.map((pt, i) => (
                  <View
                    key={pt.id}
                    style={[
                      styles.patternRow,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
                    ]}
                  >
                    <IconBadge name={pt.icon as never} tone={palette.period} size={36} />
                    <View style={styles.flex}>
                      <AppText variant="callout">{pt.title}</AppText>
                      <AppText variant="footnote" color="secondary" style={styles.cardBody}>
                        {pt.body}
                      </AppText>
                    </View>
                  </View>
                ))}
              </Card>
            ) : (
              <Card padding="lg">
                <AppText variant="subhead" color="secondary">
                  After two or three cycles of logs, your own patterns show up here: when symptoms tend
                  to come, and how your mood, sleep and training move with your cycle.
                </AppText>
              </Card>
            )}
          </View>
        </Reveal>

        {/* ── 8. Worth mentioning to a doctor ─────────────────────────── */}
        {view.notes.length ? (
          <Reveal index={7}>
            <View style={styles.section}>
              <SectionHeader title="Worth mentioning to a doctor" weight="700" />
              {view.notes.map((note) => (
                <Card key={note.id} padding="lg" style={styles.noteCard}>
                  <View style={styles.lineRow}>
                    <Ionicons name="medical-outline" size={16} color={colors.warning} />
                    <AppText variant="callout" style={styles.flex}>
                      {note.title}
                    </AppText>
                  </View>
                  <AppText variant="footnote" color="secondary" style={styles.cardBody}>
                    {note.body}
                  </AppText>
                  <View style={styles.noteActions}>
                    <Pressable
                      onPress={() =>
                        void Share.share({
                          message: doctorSummary({
                            data,
                            cycles: view.cycles,
                            prediction: p,
                            notes: view.allNotes,
                            today,
                          }),
                        }).catch(() => undefined)
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Share a summary for your doctor"
                      hitSlop={8}
                    >
                      <AppText variant="footnote" color="brand" weight="700">
                        Share a summary
                      </AppText>
                    </Pressable>
                    <Pressable
                      onPress={() => void cycle.dismissNote(note.id, note.signature)}
                      accessibilityRole="button"
                      accessibilityLabel={`Got it: ${note.title}`}
                      accessibilityHint="Hides this until something new shows up"
                      hitSlop={8}
                    >
                      <AppText variant="footnote" color="tertiary" weight="600">
                        Got it
                      </AppText>
                    </Pressable>
                  </View>
                </Card>
              ))}
              <AppText variant="caption" color="tertiary" style={styles.noteFoot}>
                These are what your logs show, not a diagnosis.
              </AppText>
            </View>
          </Reveal>
        ) : null}

        {/* ── 9. Calendar and history ─────────────────────────────────── */}
        <Reveal index={8}>
          <View style={styles.section}>
            <SectionHeader title="Calendar" subtitle="Tap a day to log or edit it" weight="700" />
            <Card padding="lg">
              <CycleCalendar
                cursor={cursor}
                onPrev={() => setCursor((c) => shiftMonthCursor(c, -1))}
                onNext={() => setCursor((c) => shiftMonthCursor(c, 1))}
                today={today}
                paint={paint}
                showFertile={settings.showFertileWindow}
                onSelect={setLogDate}
              />
            </Card>
          </View>
        </Reveal>

        {view.cycles.length > 0 || s.cycleDay !== null ? (
          <Reveal index={9}>
            <View style={styles.section}>
              <SectionHeader title="Your cycles" weight="700" />
              <Card padding="lg">
                <CycleHistory
                  cycles={view.cycles}
                  typicalBleed={view.typicalBleed}
                  current={
                    s.cycleDay !== null && !paused
                      ? {
                          start: addDays(today, -(s.cycleDay - 1)),
                          day: s.cycleDay,
                          expected: p?.cycleLength ?? s.ringDays,
                        }
                      : null
                  }
                />
              </Card>
            </View>
          </Reveal>
        ) : null}

        {/* ── 10. Where it lives ──────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push("/cycle/settings" as never)}
          accessibilityRole="button"
          accessibilityLabel={`${backupLine}. Opens cycle settings`}
          style={styles.privacy}
        >
          <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
          <AppText variant="caption" color="tertiary" style={styles.flex}>
            {backupLine}. Never shared or sold.{" "}
            {cycle.shareWithGozlin ? "Gozlin can see your cycle day." : "Gozlin can't see it."} Change this in
            cycle settings.
          </AppText>
        </Pressable>
      </Screen>

      <DayLogSheet date={logDate} onClose={() => setLogDate(null)} />

      <PickDateSheet
        visible={question !== null}
        today={today}
        title={
          question?.kind === "end"
            ? "When did it end?"
            : question?.kind === "missed"
              ? "When did that period start?"
              : "When did it start?"
        }
        body={
          question?.kind === "end"
            ? "The last day you bled."
            : question?.kind === "missed"
              ? "Your best guess is fine. You can adjust it on the calendar."
              : undefined
        }
        confirmLabel={question?.kind === "end" ? "That's the last day" : "Log it"}
        earliest={
          question?.kind === "end"
            ? question.from
            : question?.kind === "missed"
              ? addDays(question.gap.start, 15)
              : addDays(today, -59)
        }
        latest={
          question?.kind === "end"
            ? minDate(today, addDays(question.from, 13))
            : question?.kind === "missed"
              ? addDays(question.gap.nextStart, -10)
              : today
        }
        initial={
          question?.kind === "missed"
            ? addDays(question.gap.start, Math.round(question.gap.length / 2))
            : null
        }
        onConfirm={(date) => {
          if (question?.kind === "end") void cycle.endPeriod(date);
          else void cycle.startPeriod(date);
        }}
        onClose={() => setQuestion(null)}
      />
    </>
  );
}

function todaySummary(log: CycleDayLog): string {
  const bits: string[] = [];
  if (log.flow) bits.push(`${FLOW_LABEL[log.flow].toLowerCase()} flow`);
  if (log.symptoms?.length) bits.push(log.symptoms.map((s) => SYMPTOM_LABEL[s].toLowerCase()).join(", "));
  if (log.mood) bits.push(`mood: ${MOOD_LABEL[log.mood].toLowerCase()}`);
  if (log.energy) bits.push(`${ENERGY_LABEL[log.energy].toLowerCase()} energy`);
  return bits.length ? `Logged: ${bits.join(" · ")}` : "Nothing logged yet today";
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerTitle: { flex: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  block: { marginTop: Spacing.lg },
  setupTitle: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  setupCta: { marginTop: Spacing.xl },
  hero: { alignItems: "center", marginTop: Spacing.lg },
  pausedCard: { alignSelf: "stretch" },
  bigNumber: { fontWeight: "800", letterSpacing: -1 },
  heroTitle: { marginTop: Spacing.xl },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xxl },
  otherDay: { alignSelf: "center", marginTop: Spacing.md, paddingVertical: 4 },
  cardBody: { marginTop: 4 },
  cardCta: { marginTop: Spacing.md, alignSelf: "flex-start" },
  gapActions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  section: { marginTop: Spacing.xxxl },
  lineRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: 6 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  fertile: { marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, gap: 2 },
  ironLead: { marginBottom: Spacing.sm },
  ironRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: 6 },
  ironDot: { width: 6, height: 6, borderRadius: 3 },
  ironTip: { marginTop: Spacing.md },
  patternRow: { flexDirection: "row", gap: Spacing.md, padding: Spacing.lg, alignItems: "flex-start" },
  noteCard: { marginBottom: Spacing.sm },
  noteActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md },
  noteFoot: { marginTop: Spacing.xs },
  privacy: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
    marginTop: Spacing.xxxl,
    marginBottom: Spacing.lg,
  },
});

/**
 * LEVEL 3 — route-level boundary, so a throw in this screen lands here and the
 * rest of the app stays usable.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="cycle" />;
}
