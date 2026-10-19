/**
 * CYCLE SETUP — two questions, then it's tracking.
 *
 *   1. When did your last period start?   (today first; "not sure" is an answer)
 *   2. How long does it usually last?     (her period, and her whole cycle —
 *                                          either can be "not sure")
 *
 * Both answers are only a starting point: the prediction treats them as a
 * prior that her logs take over from (services/cycle/predict). The privacy
 * promise sits on the last step, where she says yes — it's the moment the
 * terms matter, so it's the moment they're stated, in full and in plain words.
 */
import { DateStrip, useCyclePalette } from "@/components/cycle";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { AppText, Button, Card, Chip, Screen, Stepper, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useCycle } from "@/contexts/CycleContext";
import { useSyncStatus } from "@/services/sync/useSyncStatus";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const CYCLE_RANGE = { min: 18, max: 60, start: 28 };
const PERIOD_RANGE = { min: 1, max: 12, start: 5 };

export default function CycleSetupScreen() {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const cycle = useCycle();
  const sync = useSyncStatus();
  const [step, setStep] = useState<1 | 2>(1);
  const [lastStart, setLastStart] = useState<string | null>(null);
  const [unsureStart, setUnsureStart] = useState(false);
  const [periodDays, setPeriodDays] = useState<number | null>(PERIOD_RANGE.start);
  const [cycleDays, setCycleDays] = useState<number | null>(CYCLE_RANGE.start);
  const [saving, setSaving] = useState(false);

  const canNext = unsureStart || !!lastStart;

  const finish = async () => {
    setSaving(true);
    try {
      await cycle.enable({
        lastStart: unsureStart ? null : lastStart,
        usualCycleDays: cycleDays,
        usualPeriodDays: periodDays,
      });
      router.replace("/cycle" as never);
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        hitSlop={12}
        onPress={() => (step === 2 ? setStep(1) : router.back())}
        accessibilityRole="button"
        accessibilityLabel={step === 2 ? "Back to the first question" : "Close"}
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name={step === 2 ? "chevron-back" : "close"} size={20} color={colors.text} />
      </Pressable>
      <View style={styles.progress}>
        {[1, 2].map((n) => (
          <View
            key={n}
            style={[
              styles.progressBar,
              { backgroundColor: n <= step ? palette.period : alpha(colors.text, 0.12) },
            ]}
          />
        ))}
      </View>
      <AppText variant="footnote" color="tertiary" style={styles.stepCount}>
        {step} of 2
      </AppText>
    </View>
  );

  const backupWords = sync.cloudDisabled
    ? "It's saved on this phone (backup across devices is part of welliva Pro)."
    : "It's backed up with your account, like the rest of your data, so a new phone doesn't lose it.";

  return (
    <Screen header={header}>
      {step === 1 ? (
        <View style={styles.step}>
          <AppText variant="display" style={styles.question}>
            When did your last period start?
          </AppText>
          <AppText variant="body" color="secondary">
            The first day of bleeding. Your best guess is fine.
          </AppText>
          <View style={styles.strip}>
            <DateStrip
              today={cycle.today}
              days={60}
              value={unsureStart ? null : lastStart}
              onChange={(d) => {
                setLastStart(d);
                setUnsureStart(false);
              }}
            />
          </View>
          <Chip
            label="I don't remember"
            active={unsureStart}
            onPress={() => {
              setUnsureStart((v) => !v);
              setLastStart(null);
            }}
            tone={palette.period}
            style={styles.unsure}
          />
          <Button
            label="Next"
            onPress={() => setStep(2)}
            disabled={!canNext}
            fullWidth
            style={styles.cta}
          />
        </View>
      ) : (
        <View style={styles.step}>
          <AppText variant="display" style={styles.question}>
            How long does it usually last?
          </AppText>
          <AppText variant="body" color="secondary">
            A starting point. Your own logs take over within a few cycles.
          </AppText>

          <LengthCard
            title="Your period"
            hint="Days of bleeding"
            value={periodDays}
            range={PERIOD_RANGE}
            onChange={setPeriodDays}
          />
          <LengthCard
            title="Your whole cycle"
            hint="From the first day of one period to the first day of the next"
            value={cycleDays}
            range={CYCLE_RANGE}
            onChange={setCycleDays}
          />

          <Card padding="lg" style={styles.promise}>
            <View style={styles.promiseHead}>
              <Ionicons name="lock-closed" size={16} color={palette.period} />
              <AppText variant="callout">Private by design</AppText>
            </View>
            <AppText variant="footnote" color="secondary" style={styles.promiseLine}>
              {backupWords} It&apos;s never shared or sold, and there are no ads.
            </AppText>
            <AppText variant="footnote" color="secondary" style={styles.promiseLine}>
              Gozlin can&apos;t see it unless you switch that on. Reminders don&apos;t say
              &ldquo;period&rdquo; on your lock screen.
            </AppText>
            <AppText variant="footnote" color="secondary" style={styles.promiseLine}>
              Export it or delete it whenever you like, from cycle settings.
            </AppText>
          </Card>

          <Button
            label="Start tracking"
            onPress={() => void finish()}
            loading={saving}
            fullWidth
            style={styles.cta}
          />
        </View>
      )}
    </Screen>
  );
}

function LengthCard({
  title,
  hint,
  value,
  range,
  onChange,
}: {
  title: string;
  hint: string;
  value: number | null;
  range: { min: number; max: number; start: number };
  onChange: (v: number | null) => void;
}) {
  const palette = useCyclePalette();
  const current = value ?? range.start;
  return (
    <Card padding="lg" style={styles.lengthCard}>
      <View style={styles.lengthHead}>
        <View style={styles.flex}>
          <AppText variant="callout">{title}</AppText>
          <AppText variant="footnote" color="tertiary">
            {hint}
          </AppText>
        </View>
      </View>
      <View style={styles.lengthControls}>
        <Stepper
          label={title}
          value={value === null ? "–" : `${value} days`}
          valueWidth={92}
          onDecrement={() => onChange(Math.max(range.min, current - 1))}
          onIncrement={() => onChange(Math.min(range.max, current + 1))}
          canDecrement={value === null || value > range.min}
          canIncrement={value === null || value < range.max}
        />
        <Chip
          label="Not sure"
          size="sm"
          active={value === null}
          onPress={() => onChange(value === null ? range.start : null)}
          tone={palette.period}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  stepCount: { minWidth: 36, textAlign: "right" },
  step: { marginTop: Spacing.xl },
  question: { marginBottom: Spacing.sm },
  strip: { marginTop: Spacing.xxl },
  unsure: { alignSelf: "flex-start", marginTop: Spacing.lg },
  cta: { marginTop: Spacing.xxl },
  flex: { flex: 1 },
  lengthCard: { marginTop: Spacing.xl },
  lengthHead: { flexDirection: "row", alignItems: "center" },
  lengthControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  promise: { marginTop: Spacing.xl },
  promiseHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  promiseLine: { marginTop: Spacing.sm },
});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="cycle-setup" />;
}
