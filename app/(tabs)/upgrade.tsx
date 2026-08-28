/**
 * UPGRADE — the one place Welliva asks for money, and the one place a
 * subscription can be read, changed or brought back.
 *
 * IT IS A MENU DESTINATION, NOT A MODAL. Subscription state used to be split
 * across Settings (plan row, restore, manage) and a modal paywall a lock pushed
 * you into. That meant the answer to "what am I paying for, and until when?"
 * lived three taps deep inside a screen about notifications, while the screen
 * that could actually sell something only ever appeared as an interruption. Now
 * every lock in the app opens THIS route with its own `source`, and the menu
 * opens it cold — one surface, one set of prices, one place to cancel.
 *
 * THE PICKER: THREE CARDS AND A PERIOD SWITCH
 *
 * Free, Plus and Pro are three cards of the same shape, each carrying its own
 * price and its own button — the shape Google's own plan pickers settled on, and
 * for good reasons worth stating:
 *
 *  · ONE CARD, ONE DECISION. A radio list with a shared button at the bottom
 *    makes you hold "which did I pick?" in your head while you scroll the
 *    benefits. A button inside each card means the thing you just read about is
 *    the thing the button buys.
 *  · FREE IS A CARD. Staying is a real choice, and "3 messages a day" sitting
 *    directly above "25 a day" is what makes the ask land. Hiding the tier
 *    someone is on reads as a trap.
 *  · ANNUAL IS ALWAYS QUOTED PER MONTH, with the monthly price struck through
 *    beside it and the real yearly charge spelled out underneath. Per-month is
 *    the only unit in which two plans can be compared at a glance — but quoting
 *    a year's price as though it were monthly, without saying what actually
 *    leaves the account today, is the dishonest version of this same layout and
 *    is what teaches people to distrust an annual toggle.
 *
 * WHAT IS NON-NEGOTIABLE HERE — both stores reject storefronts that get this
 * wrong, and it is also simply the honest way to charge someone:
 *
 *  • The price, the billing period and the words "renews automatically" must be
 *    visible with the buy button, not a scroll away from it. Hence the
 *    disclosure inside each paid card, under its own button.
 *  • Trial terms must say what happens when the trial ends.
 *  • A "Restore purchases" path must exist and be reachable without an account.
 *  • Cancellation must be explained, with a route to the store's own screen.
 *  • Prices come from the store (`priceString`) — localised, currency-converted,
 *    changeable in the console without an app update. The list prices in
 *    services/billing/pricing.ts are shown ONLY where no offering can ever load
 *    (Expo Go, web, no key) and are labelled as USD list prices when they are;
 *    every buy button is disabled in that state, because nothing can be bought.
 *
 * DEGRADED STATES ARE THE NORMAL CASE IN DEVELOPMENT
 *
 * `react-native-purchases` is native, so in Expo Go and on web there is no SDK
 * and no offerings. The screen says so plainly rather than spinning forever —
 * that state is what a developer sees every day until the dev build lands, and
 * it is also what a user sees if the store is down. The cards still render in
 * full, feature lists and all: they are the honest description of the product
 * even when nothing can be bought.
 *
 * THERE IS NO COMPARISON TABLE
 *
 * There was one, under the cards, and it is gone. A three-column grid made the
 * reader carry a row label on the left and a cell on the right at the same
 * time, scan sideways, and work out for themselves which column had changed —
 * and it printed every shared feature three times to say nothing. Each card now
 * carries its own difference instead: `PLAN_IDENTITY[tier].highlights` is
 * strictly WHAT THAT TIER ADDS TO THE ONE BELOW, headed with that question and
 * closed by an "Everything in Free / Plus" line that inherits the rest in one
 * row rather than a column of identical ticks. The argument for a plan now sits
 * on the card whose own button buys it, which is the point of card-shaped
 * pickers in the first place.
 */
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import {
  ALWAYS_FREE_NOTE,
  bestAnnualSaving,
  countLoggedDays,
  FREE_PRICE,
  historyReachLine,
  LOCK_COPY,
  PLAN_CARD_ORDER,
  PLAN_IDENTITY,
  priceView,
  PRO_VALUE_NOTE,
  proUpsell,
  renewalDisclosure,
  toLockId,
  type PaidTier,
  type PriceView,
} from "@/components/billing";
import { ScreenTopBar } from "@/components/navigation";
import {
  AppText,
  Button,
  Card,
  Pill,
  Reveal,
  Screen,
  SegmentedControl,
  useColors,
} from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useApp } from "@/contexts/AppContext";
import { useBilling } from "@/contexts/BillingContext";
import {
  getDevTierOverride,
  LIST_CURRENCY,
  MANAGE_SUBSCRIPTION_URL,
  resetAllowances,
  resetUsage,
  setDevTierOverride,
  TIER_NAME,
  TIER_SHORT_NAME,
  tierAtLeast,
  type BillingPeriod,
  type PlanOption,
  type Tier,
} from "@/services/billing";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";

/**
 * The two periods the storefront sells. A package with any other cadence (a
 * weekly or lifetime SKU someone adds in the console) is deliberately NOT shown
 * here — it would need its own price line, its own renewal sentence and its own
 * saving maths, and a storefront that renders one it doesn't understand is worse
 * than one that ignores it.
 */
const PERIODS: BillingPeriod[] = ["monthly", "annual"];

/** The tier the picker points at. Only one card may wear the badge. */
const RECOMMENDED: PaidTier = "pro";

export default function UpgradeScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const lock = toLockId(source);
  const copy = LOCK_COPY[lock];

  const {
    entitlement,
    isSubscriber,
    isTrialing,
    trialHoursLeft,
    gatingActive,
    isAvailable,
    plans,
    isLoadingPlans,
    loadPlans,
    purchase,
    restore,
  } = useBilling();

  const currentTier = entitlement.tier;

  /**
   * The one line on this screen that is about THIS person.
   *
   * `useApp()` rather than a narrower slice because the count spans three
   * domains (diet, body, training) and this screen is not a hot path — it
   * renders once, when someone is deciding whether to pay.
   *
   * Silent unless the user genuinely has history their tier is hiding; see
   * `historyReachLine`. A storefront that invents a personal fact is worse than
   * one that doesn't try.
   */
  const { dietHistory, bodyLogs, workoutLog } = useApp();
  const personalLine = useMemo(
    () => historyReachLine(countLoggedDays(dietHistory, bodyLogs, workoutLog), currentTier),
    [dietHistory, bodyLogs, workoutLog, currentTier],
  );

  // Annual leads: it is the plan with the margin, and at these prices it is also
  // genuinely the better deal — the switch opens on the answer we'd defend.
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [busy, setBusy] = useState<"restore" | Tier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Offerings are fetched on mount rather than at startup: it's a network call
  // that only this screen needs, and prices must be fresh at the moment of sale.
  useEffect(() => {
    if (isAvailable) void loadPlans();
  }, [isAvailable, loadPlans]);

  const planFor = useCallback(
    (tier: PaidTier, p: BillingPeriod): PlanOption | null =>
      plans.find((x) => x.tier === tier && x.period === p) ?? null,
    [plans],
  );

  /** Nothing can be bought until the store has answered with real prices. */
  const canBuy = isAvailable && plans.length > 0;

  const bestSaving = useMemo(() => bestAnnualSaving(["plus", "pro"], plans), [plans]);
  /**
   * The line under the Pro button. `proUpsell` quotes the price gap only while
   * that gap is small enough for "only" to be honest; at the current prices it
   * declines, and the card argues what Pro does instead. Never leave the top
   * card with no argument at all — it is the one being asked to justify itself.
   */
  const upsell = useMemo(() => proUpsell(plans, period) ?? PRO_VALUE_NOTE, [plans, period]);

  /**
   * A free trial is a NEW-customer offer, but the store reports it on the
   * product regardless of who's asking. Someone already subscribed (a Plus
   * member moving up to Pro) will be charged today, so the trial must not be
   * shown to them — on the card, on the button, or in the disclosure.
   */
  const trialOffered = !isSubscriber;

  const onPurchase = useCallback(
    async (tier: PaidTier) => {
      const plan = planFor(tier, period);
      if (!plan || busy) return;
      setBusy(tier);
      setError(null);
      setNotice(null);
      try {
        const outcome = await purchase(plan);
        if (outcome.status === "purchased") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          // Deliberately stays on this screen: the cards re-render from the new
          // entitlement, so the receipt IS the screen.
          setNotice(
            tier === "pro"
              ? `You're on ${TIER_NAME.pro}. Everything is unlocked.`
              : `You're on ${TIER_NAME.plus}. Your whole app is unlocked.`,
          );
          return;
        }
        // A cancellation is a normal outcome, not an error — say nothing at all.
        if (outcome.status === "error") setError(outcome.message);
      } finally {
        setBusy(null);
      }
    },
    [planFor, period, busy, purchase],
  );

  const onRestore = useCallback(async () => {
    if (busy) return;
    setBusy("restore");
    setError(null);
    setNotice(null);
    try {
      const result = await restore();
      if (result.tier !== "free") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setNotice(`${TIER_NAME[result.tier]} restored on this device.`);
      } else {
        setError(
          result.message ??
            "No active subscription was found for the store account signed in on this device.",
        );
      }
    } finally {
      setBusy(null);
    }
  }, [busy, restore]);

  const header = (
    <ScreenTopBar
      title="Upgrade"
      titleRight={
        <Pill
          label={TIER_SHORT_NAME[currentTier].toUpperCase()}
          tone={currentTier === "free" ? colors.textTertiary : colors.gold}
          icon={currentTier === "free" ? undefined : "checkmark-circle"}
        />
      }
      style={styles.headerRow}
    />
  );

  return (
    <Screen header={header} bottomInset={Spacing.xxl}>
      {/* ── Where you are now ─────────────────────────────────────────────── */}
      <Reveal index={0}>
        {isSubscriber ? (
          <CurrentPlanCard
            tier={currentTier}
            expiresAt={entitlement.expiresAt}
            willRenew={entitlement.willRenew}
            onManage={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
          />
        ) : (
          /* NO ICON ABOVE THE HEADLINE. A badge floating over the title was
             decoration standing where the argument should be: it said nothing
             the sentence beneath it didn't say better, and it pushed the prices
             — the only thing anyone opens this screen for — further down the
             page. The words are the hero. */
          <View style={styles.hero}>
            <AppText variant="displayLg" align="center" style={styles.heroTitle}>
              {copy.title}
            </AppText>
            <AppText variant="body" color="secondary" align="center">
              {copy.blurb}
            </AppText>
            {/* A live trial is stated plainly, with the clock and what happens
                when it stops. Someone enjoying Pro for free must never be left
                to discover the ending on their own — and "nothing will be
                charged" is the sentence that makes the offer trustworthy rather
                than suspicious, since no card was ever taken. */}
            {isTrialing ? (
              <View style={[styles.personal, { borderColor: alpha(colors.gold, 0.55) }]}>
                <Ionicons name="hourglass-outline" size={14} color={colors.gold} />
                <AppText variant="footnote" style={styles.flex}>
                  {`You're on ${TIER_NAME.pro} free for another ${trialHoursLeft} ${
                    trialHoursLeft === 1 ? "hour" : "hours"
                  }. Nothing will be charged and nothing renews — when it ends you go back to ${
                    TIER_NAME[currentTier]
                  } unless you pick a plan.`}
                </AppText>
              </View>
            ) : null}
            {personalLine ? (
              <View style={[styles.personal, { borderColor: alpha(colors.gold, 0.35) }]}>
                <Ionicons name="calendar-outline" size={14} color={colors.gold} />
                <AppText variant="footnote" style={styles.flex}>
                  {personalLine}
                </AppText>
              </View>
            ) : null}
          </View>
        )}
      </Reveal>

      {/* ── Period switch ─────────────────────────────────────────────────── */}
      <Reveal index={1}>
        <View style={styles.switchRow}>
          <SegmentedControl<BillingPeriod>
            label="Billing period"
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({
              value: p,
              label: p === "annual" ? "Annual" : "Monthly",
            }))}
            style={styles.flex}
          />
          {bestSaving ? (
            <Pill label={`SAVE ${bestSaving}%`} tone={colors.gold} icon="pricetag" size="sm" />
          ) : null}
        </View>
      </Reveal>

      {/* ── The store's own state, when it isn't ready to sell ─────────────── */}
      {!isAvailable ? (
        <Reveal index={2}>
          <Card padding="lg" style={styles.block}>
            <AppText variant="callout">
              {gatingActive
                ? "Subscriptions aren't available here"
                : "Everything is already unlocked in this build"}
            </AppText>
            <AppText variant="footnote" color="secondary" style={styles.gapSm}>
              {gatingActive
                ? `In-app purchases need the build from the app store. The prices below are ${LIST_CURRENCY} list prices; the store shows yours in your own currency.`
                : `This build has no store connection, so nothing can be bought and every paid feature is open to you. The prices below are ${LIST_CURRENCY} list prices — what a released build sells.`}
            </AppText>
          </Card>
        </Reveal>
      ) : isLoadingPlans && plans.length === 0 ? (
        <Reveal index={2}>
          <Card padding="lg" style={[styles.block, styles.loadingRow]}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="footnote" color="tertiary">
              Loading live prices…
            </AppText>
          </Card>
        </Reveal>
      ) : plans.length === 0 ? (
        <Reveal index={2}>
          <Card padding="lg" style={styles.block}>
            <AppText variant="callout">Prices couldn&apos;t be loaded</AppText>
            <AppText variant="footnote" color="secondary" style={styles.gapSm}>
              Check your connection and try again. Nothing has been charged.
            </AppText>
            <Button
              label="Retry"
              variant="tonal"
              size="sm"
              style={styles.gapLg}
              onPress={() => void loadPlans()}
            />
          </Card>
        </Reveal>
      ) : null}

      {/* ── The three plans ───────────────────────────────────────────────── */}
      {PLAN_CARD_ORDER.map((tier, i) => (
        <Reveal key={tier} index={3 + i}>
          <PlanCard
            tier={tier}
            period={period}
            price={tier === "free" ? FREE_PRICE : priceView(tier, period, plans)}
            plan={tier === "free" ? null : planFor(tier, period)}
            currentTier={currentTier}
            canBuy={canBuy}
            trialOffered={trialOffered}
            recommended={tier === RECOMMENDED}
            note={tier === RECOMMENDED ? upsell : null}
            busy={busy === tier}
            disabled={busy !== null}
            onBuy={() => void onPurchase(tier as PaidTier)}
            onManage={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
          />
        </Reveal>
      ))}

      {/* Outcomes live directly under the buttons that caused them. */}
      {notice ? (
        <AppText variant="footnote" color="success" align="center" style={styles.gapMd}>
          {notice}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="footnote" color="error" align="center" style={styles.gapMd}>
          {error}
        </AppText>
      ) : null}

      {/* ── The honest note. Keeps the free tier's word of mouth intact. ─── */}
      <View style={styles.freeNote}>
        <Ionicons name="lock-open-outline" size={14} color={colors.textTertiary} />
        <AppText variant="footnote" color="tertiary" style={styles.flex}>
          {ALWAYS_FREE_NOTE}
        </AppText>
      </View>

      {/* ── Store-required footer. Restore must work for someone who has never
             signed in, so it is never hidden behind the subscriber branch. ── */}
      <View style={styles.footer}>
        <Pressable
          onPress={onRestore}
          disabled={busy !== null}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          accessibilityHint="Checks the store account on this device for a subscription you've already paid for"
        >
          <AppText variant="footnote" color="brand" style={styles.link}>
            {busy === "restore" ? "Restoring…" : "Restore purchases"}
          </AppText>
        </Pressable>
        <AppText variant="footnote" color="tertiary">
          ·
        </AppText>
        <Pressable
          onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Manage subscription"
          accessibilityHint="Opens your store account, where you can change or cancel the plan"
        >
          <AppText variant="footnote" color="brand" style={styles.link}>
            Manage
          </AppText>
        </Pressable>
        <AppText variant="footnote" color="tertiary">
          ·
        </AppText>
        <Pressable
          onPress={() => router.push("/legal/terms" as never)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Terms of service"
        >
          <AppText variant="footnote" color="brand" style={styles.link}>
            Terms
          </AppText>
        </Pressable>
        <AppText variant="footnote" color="tertiary">
          ·
        </AppText>
        <Pressable
          onPress={() => router.push("/legal/privacy" as never)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Privacy policy"
        >
          <AppText variant="footnote" color="brand" style={styles.link}>
            Privacy
          </AppText>
        </Pressable>
      </View>

      <DevTierSwitch />
    </Screen>
  );
}

/* ─────────────────────────────── Sub-views ─────────────────────────────────*/

/**
 * The subscriber's own card: what they have, until when, and the way out.
 *
 * "Ends" vs "Renews" is not a detail — someone who has already cancelled and
 * still sees "Renews 12 March" will assume they've been charged again, and the
 * support ticket that follows is entirely our fault.
 */
function CurrentPlanCard({
  tier,
  expiresAt,
  willRenew,
  onManage,
}: {
  tier: Tier;
  expiresAt: string | null;
  willRenew: boolean;
  onManage: () => void;
}) {
  const { colors } = useColors();
  const date = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;

  return (
    <Card padding="xl" style={styles.block}>
      <View style={styles.currentHead}>
        <View style={[styles.heroIcon, { backgroundColor: alpha(colors.gold, 0.14) }]}>
          <Ionicons name="checkmark-circle" size={26} color={colors.gold} />
        </View>
        <View style={styles.flex}>
          <AppText variant="headline">You&apos;re on {TIER_NAME[tier]}</AppText>
          <AppText variant="footnote" color="secondary" style={styles.gapXs}>
            {date
              ? willRenew
                ? `Renews ${date}`
                : `Ends ${date} — won't renew`
              : "Active on this account"}
          </AppText>
        </View>
      </View>

      <AppText variant="footnote" color="tertiary" style={styles.gapMd}>
        {tier === "pro"
          ? "Thank you — it's what pays for the AI behind your coaching and plans."
          : "Pro adds plans generated for your body, insights across your logs and coaching with no daily cap."}
      </AppText>

      <Button
        label="Manage subscription"
        variant="tonal"
        icon="open-outline"
        style={styles.gapLg}
        onPress={onManage}
      />
    </Card>
  );
}

/**
 * One plan, as a card: name, price, its own button, then what it gets you.
 *
 * The button is the card's whole point, so it states the actual next action
 * rather than a generic "select" — buy it, keep it, or nothing at all when the
 * tier is already included in a higher one the user holds.
 */
function PlanCard({
  tier,
  period,
  price,
  plan,
  currentTier,
  canBuy,
  trialOffered,
  recommended,
  note,
  busy,
  disabled,
  onBuy,
  onManage,
}: {
  tier: Tier;
  period: BillingPeriod;
  price: PriceView;
  /** The live store package, when there is one. `null` on Free and offline. */
  plan: PlanOption | null;
  currentTier: Tier;
  canBuy: boolean;
  trialOffered: boolean;
  recommended: boolean;
  /** A line under the button — "only $0.51 a month more than Plus". */
  note: string | null;
  busy: boolean;
  disabled: boolean;
  onBuy: () => void;
  onManage: () => void;
}) {
  const { colors, isDark } = useColors();
  const identity = PLAN_IDENTITY[tier];

  const isCurrent = tier === currentTier;
  /** Already covered by a higher tier the user holds — nothing to sell. */
  const included = !isCurrent && tierAtLeast(currentTier, tier);
  const highlighted = recommended && !isCurrent && !included;

  return (
    <View
      style={[
        styles.planCard,
        {
          borderColor: isCurrent ? colors.gold : highlighted ? alpha(colors.gold, 0.55) : colors.border,
          borderWidth: isCurrent || highlighted ? 2 : 1,
          backgroundColor: highlighted
            ? alpha(colors.gold, isDark ? 0.08 : 0.06)
            : alpha(colors.surface, isDark ? 0.5 : 1),
        },
      ]}
    >
      {/* Name + status */}
      <View style={styles.planHead}>
        <Ionicons name={identity.icon} size={17} color={colors.gold} />
        <AppText variant="headline" style={styles.flex}>
          {identity.name}
        </AppText>
        {isCurrent ? (
          <Pill label="YOUR PLAN" tone={colors.gold} size="sm" />
        ) : highlighted ? (
          <Pill label="BEST VALUE" tone={colors.gold} size="sm" solid />
        ) : null}
      </View>

      <AppText variant="footnote" color="secondary" style={styles.planTagline}>
        {identity.tagline}
      </AppText>

      {/* Price. Annual is quoted per month, with the monthly price struck
          through and the real yearly charge stated underneath. */}
      <View style={styles.priceRow}>
        <AppText variant="display">{price.headline}</AppText>
        <View style={styles.priceSide}>
          {price.strikethrough ? (
            <AppText variant="footnote" color="tertiary" style={styles.struck}>
              {price.strikethrough}
            </AppText>
          ) : null}
          <AppText variant="footnote" color="secondary">
            {price.unit}
          </AppText>
        </View>
        {price.savePercent ? (
          <Pill label={`−${price.savePercent}%`} tone={colors.success} size="sm" />
        ) : null}
      </View>
      <AppText variant="footnote" color="tertiary">
        {price.detail}
      </AppText>

      {/* Action */}
      <View style={styles.planAction}>
        {tier === "free" ? (
          <Button
            label={isCurrent ? "Your plan" : "Included in your plan"}
            variant="tonal"
            disabled
            onPress={() => {}}
          />
        ) : isCurrent ? (
          <Button label="Manage plan" variant="tonal" icon="open-outline" onPress={onManage} />
        ) : included ? (
          <Button label={`Included in ${TIER_NAME[currentTier]}`} variant="tonal" disabled onPress={() => {}} />
        ) : (
          <Button
            label={
              trialOffered && plan?.trialDays
                ? `Start ${plan.trialDays}-day free trial`
                : currentTier === "plus"
                  ? "Upgrade to Pro"
                  : `Get ${identity.name}`
            }
            variant={highlighted ? "primary" : "tonal"}
            loading={busy}
            disabled={disabled || !canBuy || !plan}
            onPress={onBuy}
          />
        )}

        {note && !isCurrent && !included ? (
          <AppText variant="footnote" color="brand" align="center" style={styles.planNote}>
            {note}
          </AppText>
        ) : null}

        {/* Store-required, and it has to sit with the button that charges. */}
        {plan && !isCurrent && !included ? (
          <AppText variant="caption" color="tertiary" style={styles.terms}>
            {renewalDisclosure(plan, trialOffered)}
          </AppText>
        ) : price.estimated && tier !== "free" ? (
          <AppText variant="caption" color="tertiary" style={styles.terms}>
            {LIST_CURRENCY} list price. The store charges in your own currency, and every plan
            renews automatically until you cancel it there.
          </AppText>
        ) : null}
      </View>

      {/* WHAT THIS TIER ADDS TO THE ONE BELOW IT — the whole comparison, on
          the card whose button buys it. There is no table to cross-reference
          any more, so this list has to answer "why would I move up?" on its
          own: it is headed with the question, ruled off from the price and the
          terms above it, and closed by the "Everything in Free / Plus" line
          that carries everything this tier inherits rather than re-listing it. */}
      <View style={[styles.highlights, { borderTopColor: colors.border }]}>
        <AppText variant="caption" uppercase color="tertiary" style={styles.highlightsHead}>
          {tier === "free" ? "What you get" : `What ${identity.name} adds`}
        </AppText>
        {identity.highlights.map((h) => (
          <View key={h} style={styles.highlightRow}>
            <Ionicons
              name="checkmark-circle"
              size={15}
              color={tier === "free" ? colors.textTertiary : colors.gold}
              style={styles.highlightIcon}
            />
            <AppText variant="footnote" color="secondary" style={styles.flex}>
              {h}
            </AppText>
          </View>
        ))}
        {tier === "plus" || tier === "pro" ? (
          <View style={styles.highlightRow}>
            <Ionicons
              name="add-circle-outline"
              size={15}
              color={colors.textTertiary}
              style={styles.highlightIcon}
            />
            <AppText variant="footnote" color="tertiary" style={styles.flex}>
              {tier === "plus" ? "Everything in Free" : "Everything in Plus"}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* The period this card is quoting, said once more in plain words — the
          switch is above the fold and cards are scrolled past it. */}
      {tier !== "free" ? (
        <AppText variant="caption" color="tertiary" style={styles.planPeriodNote}>
          {period === "annual" ? "Yearly billing" : "Monthly billing"}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * DEV-ONLY tier switch: real → free → plus → pro → real.
 *
 * Every lock has to be walkable before the RevenueCat account exists, otherwise
 * the free and Plus experiences first get tested during store review. It lives
 * here rather than in Settings because this is the screen that shows what each
 * tier is — flipping and watching which card claims "YOUR PLAN" and which
 * buttons fall back to "Included in…" is the fastest way to check a gate.
 * Stripped from release builds entirely.
 */
function DevTierSwitch() {
  const { colors } = useColors();
  const { isHydrating } = useBilling();
  const [override, setOverride] = useState<Tier | null>(() => getDevTierOverride());

  // The override is restored from disk during billing hydration, which finishes
  // after this first renders — re-read once it lands.
  useEffect(() => {
    if (__DEV__ && !isHydrating) setOverride(getDevTierOverride());
  }, [isHydrating]);

  if (!__DEV__) return null;

  const cycle = async () => {
    const next: Tier | null =
      override === null ? "free" : override === "free" ? "plus" : override === "plus" ? "pro" : null;
    setOverride(next);
    await setDevTierOverride(next);
    // Clear the day's meters with the switch, so testing the free cap starts
    // from 3 messages rather than whatever you'd already spent as Pro.
    await Promise.all([resetUsage(), resetAllowances()]);
  };

  return (
    <Pressable
      onPress={cycle}
      accessibilityRole="button"
      accessibilityLabel="Force tier, developer only"
      style={[styles.devRow, { borderColor: colors.border }]}
    >
      <Ionicons name="construct-outline" size={16} color={colors.warning} />
      <View style={styles.flex}>
        <AppText variant="footnote">Force tier (dev only)</AppText>
        <AppText variant="caption" color="tertiary">
          {override === null
            ? "Using your real entitlement — tap to walk Free, Plus, then Pro"
            : `Pretending you're ${TIER_SHORT_NAME[override]} — tap for the next tier`}
        </AppText>
      </View>
      <Pill
        label={override === null ? "REAL" : TIER_SHORT_NAME[override].toUpperCase()}
        tone={override === null ? colors.textTertiary : colors.warning}
        size="sm"
      />
    </Pressable>
  );
}

/**
 * LEVEL 3 — route-level boundary. A throw inside this screen is contained here:
 * the menu stays live and every other destination stays usable.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:upgrade" />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { marginBottom: Spacing.lg },
  block: { marginBottom: Spacing.lg },
  gapXs: { marginTop: 2 },
  gapSm: { marginTop: Spacing.sm },
  gapMd: { marginTop: Spacing.md },
  gapLg: { marginTop: Spacing.lg },

  /* Hero — words only; see the note at the render site. */
  hero: { alignItems: "center", paddingHorizontal: Spacing.sm, marginBottom: Spacing.xl },
  heroTitle: { marginBottom: Spacing.sm },

  /** The subscriber card's mark. The only glyph this screen still leads with. */
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  /** The personal line. Bordered rather than filled: it is a fact about the
   *  user, not another promotional block. */
  personal: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
  },

  /* Current plan */
  currentHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  /* Period switch */
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  /* Plan cards */
  planCard: {
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  planHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  planTagline: { marginTop: 2, marginBottom: Spacing.md },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: Spacing.sm },
  priceSide: { flexShrink: 1 },
  struck: { textDecorationLine: "line-through" },
  planAction: { marginTop: Spacing.lg },
  planNote: { marginTop: Spacing.sm, fontWeight: "600" },
  terms: { marginTop: Spacing.sm },

  /** Ruled off: with the comparison table gone, this list is the card's case. */
  highlights: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  highlightsHead: { marginBottom: Spacing.xs },
  /** Optically centres a 15px glyph on a 17px footnote line. */
  highlightIcon: { marginTop: 1 },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  planPeriodNote: { marginTop: Spacing.md },

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
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  link: { fontWeight: "600" },

  devRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xxl,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
  },
});
