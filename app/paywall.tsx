/**
 * PAYWALL — the one screen that asks for money.
 *
 * Presented as a modal from `openPaywall(lock)`. The `source` param names which
 * lock sent the user here, which does two jobs: it selects a contextual headline
 * (someone who just hit the coach cap reads about coaching, not a feature grid),
 * and it's the analytics dimension for which lock actually converts.
 *
 * WHAT IS NON-NEGOTIABLE HERE — both stores reject paywalls that get this wrong,
 * and it is also simply the honest way to charge someone:
 *
 *  • The price, the billing period and the words "renews automatically" must be
 *    visible without scrolling past the buy button.
 *  • Trial terms must say what happens when the trial ends.
 *  • A "Restore purchases" path must exist and be reachable without an account.
 *  • Cancellation must be explained, with a route to the store's own screen.
 *  • Prices come from the store (`priceString`) — NEVER hardcoded. They are
 *    localised, currency-converted and can be changed in the console without an
 *    app update. A hardcoded "$69.99" is wrong for most of the world and is a
 *    rejection on its own.
 *
 * DEGRADED STATES ARE THE NORMAL CASE IN DEVELOPMENT
 *
 * `react-native-purchases` is native, so in Expo Go and on web there is no SDK
 * and no offerings. The screen says so plainly rather than spinning forever or
 * showing an empty list — that state is what a developer sees every day until
 * the dev build lands, and it is also what a user sees if the store is down.
 */
import { AppText, Button, Card, Screen, useColors } from "@/components/ui";
import { ALWAYS_FREE_NOTE, LOCK_COPY, PRO_BENEFITS, toLockId } from "@/components/billing";
import { useBilling } from "@/contexts/BillingContext";
import { MANAGE_SUBSCRIPTION_URL, type ProPackage } from "@/services/billing";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";

export default function PaywallScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const lock = toLockId(source);
  const copy = LOCK_COPY[lock];

  const {
    isPro,
    isAvailable,
    packages,
    isLoadingPackages,
    loadPackages,
    purchase,
    restore,
  } = useBilling();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Offerings are fetched on mount rather than at startup: it's a network call
  // that only this screen needs, and prices must be fresh at the moment of sale.
  useEffect(() => {
    if (isAvailable) void loadPackages();
  }, [isAvailable, loadPackages]);

  // Default to annual — it's first in the list (Billing.ts sorts it there) and
  // it's the plan with the margin. Only set once, so a deliberate tap sticks.
  useEffect(() => {
    if (!selectedId && packages.length > 0) setSelectedId(packages[0].id);
  }, [packages, selectedId]);

  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) ?? null,
    [packages, selectedId],
  );

  /**
   * Annual saving vs. paying monthly for a year, computed from the real store
   * prices. Only rendered when both plans are present and the maths is
   * favourable — a "Save 0%" badge on a mispriced offering is worse than none.
   */
  const savingPercent = useMemo(() => {
    const monthly = packages.find((p) => p.kind === "monthly");
    const annual = packages.find((p) => p.kind === "annual");
    if (!monthly || !annual || monthly.priceAmount <= 0) return null;
    const pct = Math.round((1 - annual.priceAmount / (monthly.priceAmount * 12)) * 100);
    return pct >= 5 ? pct : null;
  }, [packages]);

  const onPurchase = useCallback(async () => {
    if (!selected || busy) return;
    setBusy("purchase");
    setError(null);
    try {
      const outcome = await purchase(selected);
      if (outcome.status === "purchased") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
        return;
      }
      // A cancellation is a normal outcome, not an error — say nothing at all.
      if (outcome.status === "error") setError(outcome.message);
    } finally {
      setBusy(null);
    }
  }, [selected, busy, purchase, router]);

  const onRestore = useCallback(async () => {
    if (busy) return;
    setBusy("restore");
    setError(null);
    try {
      const result = await restore();
      if (result.isPro) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      } else {
        setError(
          result.message ?? "No previous purchase found for this account.",
        );
      }
    } finally {
      setBusy(null);
    }
  }, [busy, restore, router]);

  /* ── Already subscribed ───────────────────────────────────────────────────*/
  if (isPro) {
    return (
      <Screen header={<Header onClose={() => router.back()} />}>
        <Card padding="xxl" style={styles.centered}>
          <View style={[styles.heroIcon, { backgroundColor: alpha(colors.gold, 0.14) }]}>
            <Ionicons name="checkmark-circle" size={30} color={colors.gold} />
          </View>
          <AppText variant="title" align="center" style={styles.gapTop}>
            You're on Welliva Pro
          </AppText>
          <AppText variant="subhead" color="secondary" align="center" style={styles.gapTop}>
            Everything is unlocked. Thank you — it's what pays for the AI behind
            your coaching and plans.
          </AppText>
          <Button
            label="Manage subscription"
            variant="tonal"
            icon="open-outline"
            style={styles.gapLg}
            onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen header={<Header onClose={() => router.back()} />}>
      {/* ── Hero: the contextual reason they're here ──────────────────────── */}
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: alpha(colors.gold, 0.14) }]}>
          <Ionicons name={copy.icon} size={28} color={colors.gold} />
        </View>
        <AppText variant="caption" color={colors.gold} uppercase style={styles.gapTop}>
          Welliva Pro
        </AppText>
        <AppText variant="displayLg" align="center" style={styles.heroTitle}>
          {copy.title}
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          {copy.blurb}
        </AppText>
      </View>

      {/* ── Plans ─────────────────────────────────────────────────────────── */}
      {!isAvailable ? (
        <Card padding="xl">
          <AppText variant="callout">Subscriptions aren't available here</AppText>
          <AppText variant="footnote" color="secondary" style={styles.gapSm}>
            In-app purchases need the native build from the app store. Everything
            in Welliva keeps working on the free tier meanwhile.
          </AppText>
        </Card>
      ) : isLoadingPackages && packages.length === 0 ? (
        <Card padding="xxl" style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="footnote" color="tertiary" style={styles.gapTop}>
            Loading plans…
          </AppText>
        </Card>
      ) : packages.length === 0 ? (
        <Card padding="xl">
          <AppText variant="callout">Plans couldn't be loaded</AppText>
          <AppText variant="footnote" color="secondary" style={styles.gapSm}>
            Check your connection and try again. Nothing has been charged.
          </AppText>
          <Button
            label="Retry"
            variant="tonal"
            size="sm"
            style={styles.gapLg}
            onPress={() => void loadPackages()}
          />
        </Card>
      ) : (
        <View style={styles.plans}>
          {packages.map((pkg) => (
            <PlanRow
              key={pkg.id}
              pkg={pkg}
              selected={pkg.id === selectedId}
              savingPercent={pkg.kind === "annual" ? savingPercent : null}
              onSelect={() => {
                Haptics.selectionAsync().catch(() => {});
                setSelectedId(pkg.id);
              }}
            />
          ))}
        </View>
      )}

      {/* ── CTA + the renewal disclosure that must sit with it ────────────── */}
      {isAvailable && packages.length > 0 ? (
        <View style={styles.ctaBlock}>
          <Button
            label={
              selected?.trialDays
                ? `Start ${selected.trialDays}-day free trial`
                : "Continue"
            }
            size="lg"
            loading={busy === "purchase"}
            disabled={!selected || busy !== null}
            onPress={onPurchase}
          />
          {selected ? (
            <AppText variant="footnote" color="tertiary" align="center" style={styles.terms}>
              {renewalDisclosure(selected)}
            </AppText>
          ) : null}
          {error ? (
            <AppText variant="footnote" color="error" align="center" style={styles.gapSm}>
              {error}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* ── What you get ──────────────────────────────────────────────────── */}
      <Card padding="xl" style={styles.gapLg}>
        {PRO_BENEFITS.map((b, i) => (
          <View key={b.label} style={[styles.benefit, i > 0 && styles.benefitGap]}>
            <Ionicons name={b.icon} size={18} color={colors.gold} style={styles.benefitIcon} />
            <View style={styles.flex}>
              <AppText variant="subhead">{b.label}</AppText>
              {b.free ? (
                <AppText variant="footnote" color="tertiary">
                  {b.free}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
      </Card>

      {/* ── The honest note. Keeps the free tier's word of mouth intact. ─── */}
      <View style={styles.freeNote}>
        <Ionicons name="lock-open-outline" size={14} color={colors.textTertiary} />
        <AppText variant="footnote" color="tertiary" style={styles.flex}>
          {ALWAYS_FREE_NOTE}
        </AppText>
      </View>

      {/* ── Store-required footer ─────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Pressable onPress={onRestore} disabled={busy !== null} hitSlop={8}>
          <AppText variant="footnote" color="brand" style={styles.link}>
            {busy === "restore" ? "Restoring…" : "Restore purchases"}
          </AppText>
        </Pressable>
        <AppText variant="footnote" color="tertiary">
          ·
        </AppText>
        <Pressable onPress={() => router.push("/legal/terms")} hitSlop={8}>
          <AppText variant="footnote" color="brand" style={styles.link}>
            Terms
          </AppText>
        </Pressable>
        <AppText variant="footnote" color="tertiary">
          ·
        </AppText>
        <Pressable onPress={() => router.push("/legal/privacy")} hitSlop={8}>
          <AppText variant="footnote" color="brand" style={styles.link}>
            Privacy
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

/* ─────────────────────────────── Sub-views ─────────────────────────────────*/

function Header({ onClose }: { onClose: () => void }) {
  const { colors } = useColors();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.close, { backgroundColor: alpha(colors.text, 0.06) }]}
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function PlanRow({
  pkg,
  selected,
  savingPercent,
  onSelect,
}: {
  pkg: ProPackage;
  selected: boolean;
  savingPercent: number | null;
  onSelect: () => void;
}) {
  const { colors, isDark } = useColors();
  const label = pkg.kind === "annual" ? "Yearly" : pkg.kind === "monthly" ? "Monthly" : pkg.title;
  const per = pkg.kind === "annual" ? "per year" : pkg.kind === "monthly" ? "per month" : "";

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${pkg.priceString}${pkg.trialDays ? `, ${pkg.trialDays} day free trial` : ""}`}
      style={[
        styles.plan,
        {
          borderColor: selected ? colors.gold : colors.border,
          borderWidth: selected ? 2 : 1,
          backgroundColor: selected
            ? alpha(colors.gold, isDark ? 0.1 : 0.07)
            : alpha(colors.surface, isDark ? 0.5 : 1),
        },
      ]}
    >
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.gold : colors.borderStrong },
          selected && { backgroundColor: colors.gold },
        ]}
      >
        {selected ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
      </View>

      <View style={styles.flex}>
        <View style={styles.planTitleRow}>
          <AppText variant="callout">{label}</AppText>
          {savingPercent ? (
            <View style={[styles.saveBadge, { backgroundColor: colors.gold }]}>
              <AppText variant="caption" color={colors.onPrimary} style={styles.saveText}>
                SAVE {savingPercent}%
              </AppText>
            </View>
          ) : null}
        </View>
        {pkg.trialDays ? (
          <AppText variant="footnote" color="brand">
            {pkg.trialDays} days free, then {pkg.priceString}
          </AppText>
        ) : (
          <AppText variant="footnote" color="tertiary">
            {per}
          </AppText>
        )}
      </View>

      <AppText variant="headline">{pkg.priceString}</AppText>
    </Pressable>
  );
}

/**
 * The auto-renewal sentence. Store policy requires the price, the period, that
 * it renews automatically, and how to stop it — in the buy flow itself, not
 * buried in the terms document.
 */
function renewalDisclosure(pkg: ProPackage): string {
  const period = pkg.kind === "annual" ? "year" : pkg.kind === "monthly" ? "month" : "period";
  const trial = pkg.trialDays
    ? `Your ${pkg.trialDays}-day free trial converts to a paid subscription unless you cancel at least 24 hours before it ends. `
    : "";
  return (
    `${trial}${pkg.priceString} per ${period}, renewing automatically until you ` +
    `cancel. Cancel any time in your store account settings — you keep Pro until ` +
    `the end of the period you've paid for.`
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapSm: { marginTop: Spacing.sm },
  gapTop: { marginTop: Spacing.md },
  gapLg: { marginTop: Spacing.lg },

  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  hero: { alignItems: "center", paddingHorizontal: Spacing.sm, marginBottom: Spacing.xxl },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { marginTop: Spacing.xs, marginBottom: Spacing.md },

  plans: { gap: Spacing.md },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  saveBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  saveText: { fontWeight: "800" },

  ctaBlock: { marginTop: Spacing.xl },
  terms: { marginTop: Spacing.md, paddingHorizontal: Spacing.sm },

  benefit: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  benefitGap: { marginTop: Spacing.lg },
  benefitIcon: { marginTop: 2 },

  freeNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  link: { fontWeight: "600" },

  centered: { alignItems: "center" },
});
