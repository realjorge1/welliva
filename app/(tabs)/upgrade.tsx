/**
 * UPGRADE — the one place welliva asks for money, and the one place a
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
 * THE PICKER: TWO CARDS, PRO FIRST, ONE PRICE TAG
 *
 * Free and Pro are two cards of the same shape, each carrying its own price and
 * its own button — the shape Google's own plan pickers settled on, and for good
 * reasons worth stating:
 *
 *  · ONE CARD, ONE DECISION. A radio list with a shared button at the bottom
 *    makes you hold "which did I pick?" in your head while you scroll the
 *    benefits. A button inside each card means the thing you just read about is
 *    the thing the button buys.
 *  · FREE IS A CARD. Staying is a real choice, and hiding the tier someone is
 *    on reads as a trap. It used to earn its place by arithmetic too — "3
 *    messages a day" sitting directly above "100 a day". Free's AI allowance is
 *    0 now, so the contrast is categorical rather than numeric: one card is the
 *    tracking app, the other is Gozlin.
 *
 * There were three cards until Plus was merged into Pro. Two changes that came
 * with that and are worth not undoing by accident: the "BEST VALUE" badge is
 * gone, because a badge that marks the only purchasable option is decoration
 * pretending to be guidance; and the line under the Pro button is now a fixed
 * value note rather than a computed price gap, since there is no cheaper paid
 * tier left to measure against.
 *  · ANNUAL IS ALWAYS QUOTED PER MONTH, on a tile beside the Monthly one, with
 *    the real yearly charge spelled out in the receipt underneath. Per-month is
 *    the only unit in which two plans can be compared at a glance — but quoting
 *    a year's price as though it were monthly, without saying what actually
 *    leaves the account, is the dishonest version of this same layout and is
 *    what teaches people to distrust an annual toggle.
 *  · THE PRICE LIVES ON THE PRO CARD, ONCE. Monthly and Annual are two tiles
 *    inside it, above the receipt for whichever is chosen and the button that
 *    buys it (components/billing/PriceTag). A period picker at the top of the
 *    screen plus a price block on the card was the same price twice, a phone
 *    height apart. Pro comes first so the tag sits right under the hero.
 *
 * EXACTLY ONE CARD IS EVER HIGHLIGHTED
 *
 * The cards are a real single-selection control now, not two static panels with
 * the paid one permanently lit. `selected` holds the tier the reader is looking
 * at, tapping a card moves it, and the gold emphasis — border, tinted ground,
 * primary button — follows `selected` and nothing else.
 *
 * It used to follow `recommended && !isCurrent`, which meant Pro was lit from
 * the moment the screen opened and stayed lit no matter what the reader did.
 * Two things were wrong with that. Emphasis that never moves is not emphasis,
 * it is decoration — it tells you nothing, because it would look the same if
 * you had chosen the other one. And a subscriber saw their own plan and the
 * pitch for it lit simultaneously, which reads as being sold something they
 * already own.
 *
 * WHERE THE SELECTION STARTS is the one judgement here: Pro for a free user,
 * because that is the question they opened this screen to answer, and the
 * CURRENT plan for a subscriber, because for them the screen is a receipt
 * before it is a shop. Either way it is one card, and either way tapping the
 * other one moves it.
 *
 * The active plan is marked independently, by the "YOUR PLAN" pill and by the
 * tier chip beside the screen title — status is not emphasis, and conflating
 * the two is what produced the double-highlight in the first place.
 *
 * THE SAVING IS STATED TWICE, IN MONEY, AND THAT IS DELIBERATE
 *
 * Annual saves exactly $10.00 a year at list price — services/billing/pricing.ts
 * sets it backwards from that claim so the round number is literally true rather
 * than a rounded $9.89. (In other stores it is whatever Play's local prices
 * make it — ₦5,100 in Nigeria — and every figure is written the way the store
 * writes its own; see `formatLike`.) It appears in two places, and they are
 * not redundant because they answer different questions:
 *
 *  1. ON THE ANNUAL TILE — "SAVE $10" across its top edge, beside the Monthly
 *     tile it beats. An offer while monthly is chosen, a receipt once annual is.
 *  2. IN THE RECEIPT under the tiles — $35.88 struck beside $25.88, the saving
 *     shown as the two numbers it is the difference of, with "28% off" inked in
 *     the line beneath. The tag makes the claim; the receipt lets it be checked.
 *
 * Both lead with the AMOUNT; the percentage only ever trails it. "28%" is a
 * ratio waiting for a number the reader hasn't reached yet; "$10.00" is the
 * number. Neither is ever the fourth clause of a grey footnote, which is where
 * this used to live ("$25.99 billed yearly · save $9.89") — that is where you
 * put something you are obliged to disclose, not something you want read.
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
 * and no offerings. The cards still render in full, feature lists and all: they
 * are the honest description of the product even when nothing can be bought.
 *
 * ONE OF THOSE STATES NO LONGER ANNOUNCES ITSELF. There used to be a card at
 * the top reading "Everything is already unlocked in this build", shown when
 * gating was off. It has been removed. It was a developer's console note
 * wearing the same card as the product, it was the first thing anyone saw on
 * the screen whose entire job is to sell, and its sentence is the single worst
 * thing a storefront can say — that the paid tier is already free. The
 * condition it described is still real and still handled; it simply renders
 * nothing now, and the disabled buy buttons plus the "USD list price" note
 * under them are what say so, quietly and only where it matters.
 *
 * The other degraded state DOES still speak, and must: in a store build where
 * offerings genuinely failed to load, saying nothing would leave a real
 * customer looking at prices they cannot buy with no explanation.
 *
 * THERE IS NO COMPARISON TABLE
 *
 * There was one, under the cards, and it is gone. A multi-column grid made the
 * reader carry a row label on the left and a cell on the right at the same
 * time, scan sideways, and work out for themselves which column had changed —
 * and it printed every shared feature in every column to say nothing. Each card
 * now carries its own difference instead: `PLAN_IDENTITY[tier].highlights` is
 * strictly WHAT THAT TIER ADDS TO THE ONE BELOW, headed with that question and
 * closed by an "Everything in Free" line that inherits the rest in one row
 * rather than a column of identical ticks. The argument for a plan now sits on
 * the card whose own button buys it, which is the point of card-shaped pickers
 * in the first place.
 */
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import {
  ALWAYS_FREE_NOTE,
  bestAnnualSaving,
  FreePriceTag,
  freePriceView,
  LOCK_COPY,
  PLAN_CARD_ORDER,
  PLAN_IDENTITY,
  PriceTag,
  priceView,
  PRO_VALUE_NOTE,
  renewalDisclosure,
  toLockId,
  type BestSaving,
  type PaidTier,
  type PriceView,
} from "@/components/billing";
import { ScreenTopBar } from "@/components/navigation";
import {
  AppText,
  Button,
  Card,
  ConfirmSheet,
  Pill,
  Reveal,
  Screen,
  useColors,
} from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useBilling } from "@/contexts/BillingContext";
import {
  LIST_CURRENCY,
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
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

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
    isReady,
    plans,
    plansProblem,
    isLoadingPlans,
    loadPlans,
    purchase,
    restore,
    cancelSubscription,
    manageSubscription,
  } = useBilling();

  const currentTier = entitlement.tier;

  // Annual leads: it is the plan with the margin, and at these prices it is also
  // genuinely the better deal — the switch opens on the answer we'd defend.
  const [period, setPeriod] = useState<BillingPeriod>("annual");

  /**
   * The one highlighted card. See "EXACTLY ONE CARD IS EVER HIGHLIGHTED".
   *
   * Seeded from the tier the reader is here about — Pro if they're free, their
   * own plan if they're paying — and moved by tapping a card. It is deliberately
   * NOT re-synced to `currentTier` afterwards: a purchase that completes on this
   * screen leaves the highlight where the user put it, which is on the card that
   * just turned into their plan anyway.
   */
  const [selected, setSelected] = useState<Tier>(() =>
    currentTier === "free" ? "pro" : currentTier,
  );

  const [busy, setBusy] = useState<"restore" | Tier | null>(null);
  /** Restore's outcome, under the footer link that ran it. */
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * A purchase's outcome, printed on the paid card directly under its button.
   * It used to share the restore line below both cards — which put "This plan
   * isn't available to buy on this device right now" a phone-height under the
   * button that caused it, behind the Deck. From the button, the tap looked
   * like it did nothing at all.
   */
  const [buyMessage, setBuyMessage] = useState<LineMessage | null>(null);

  /** The "Cancel subscription?" sheet. */
  const [cancelAsk, setCancelAsk] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setLineMessage] = useState<LineMessage | null>(null);

  const onCancelConfirmed = useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    setLineMessage(null);
    try {
      const outcome = await cancelSubscription();
      switch (outcome.status) {
        case "cancelled": {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          const until = shortDate(outcome.expiresAt);
          setLineMessage({
            tone: "success",
            text: outcome.already
              ? `This was already cancelled${until ? ` — you keep Pro until ${until}` : ""}.`
              : `Cancelled. Nothing more will be charged${until ? ` — you keep Pro until ${until}` : ""}.`,
          });
          return;
        }
        case "no_subscription":
          setLineMessage({
            tone: "secondary",
            text: "There's no active subscription on this account to cancel.",
          });
          return;
        case "handed_off":
          setLineMessage({
            tone: "secondary",
            text: "Finish cancelling on the store page that just opened. This screen updates when you come back.",
          });
          return;
        case "error":
          setLineMessage({ tone: "error", text: outcome.message });
          return;
      }
    } finally {
      setCancelling(false);
    }
  }, [cancelling, cancelSubscription]);

  /*
   * Offerings are fetched on mount rather than at startup: it's a network call
   * that only this screen needs, and prices must be fresh at the moment of sale.
   *
   * Gated on `isReady`, NOT on `isAvailable` alone. Availability only means a key
   * and a native module exist; `getPlanOptions()` returns [] until the SDK has
   * been configured, and configure waits on auth. Fetching on availability alone
   * loses that race on a cold start — and because nothing about `isAvailable`
   * changes afterwards, the effect never re-ran and the storefront stayed empty
   * for the rest of the session. `isReady` flips exactly when configure lands,
   * which is what makes this retry itself.
   */
  useEffect(() => {
    if (isAvailable && isReady) void loadPlans();
  }, [isAvailable, isReady, loadPlans]);

  const planFor = useCallback(
    (tier: PaidTier, p: BillingPeriod): PlanOption | null =>
      plans.find((x) => x.tier === tier && x.period === p) ?? null,
    [plans],
  );

  /**
   * Nothing can be bought until RevenueCat has answered with live packages.
   * Prices can be on screen before that — straight from Google Play, or
   * remembered from last time — but those are `purchasable: false`.
   */
  const canBuy = isAvailable && plans.some((p) => p.purchasable);

  const bestSaving = useMemo(() => bestAnnualSaving(["pro"], plans), [plans]);
  const proMonthly = useMemo(() => priceView("pro", "monthly", plans), [plans]);
  const proAnnual = useMemo(() => priceView("pro", "annual", plans), [plans]);

  const freePrice = useMemo(() => freePriceView(plans), [plans]);

  /**
   * The FIRST load is still in flight and there is no quote at all — not live,
   * not from Google Play, not remembered. Only then do the figures show as bars,
   * and only until that load settles: once it has, a tag always carries prices,
   * falling back to the labelled USD list prices when nothing better exists.
   * (Bars that never resolved were how "the price tags are gone" happened on a
   * network that couldn't reach RevenueCat.)
   */
  const pricesPending = isAvailable && plans.length === 0 && plansProblem === null;

  /**
   * A free trial is a NEW-customer offer, but the store reports it on the
   * product regardless of who's asking. Someone already subscribed (a legacy
   * Plus member the store still bills) will be charged today, so the trial must
   * not be shown to them — on the card, on the button, or in the disclosure.
   */
  const trialOffered = !isSubscriber;

  /**
   * Move the highlight. A selection tap is a light haptic, never a heavy one —
   * this is reading, not buying, and the buy button has its own confirmation.
   */
  const onSelect = useCallback((tier: Tier) => {
    setSelected((prev) => {
      if (prev !== tier) Haptics.selectionAsync().catch(() => {});
      return tier;
    });
  }, []);

  const onPurchase = useCallback(
    async (tier: PaidTier) => {
      const plan = planFor(tier, period);
      if (!plan || !plan.purchasable || busy) return;
      setBusy(tier);
      setError(null);
      setNotice(null);
      setBuyMessage(null);
      try {
        const outcome = await purchase(plan);
        if (outcome.status === "purchased") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          // Deliberately stays on this screen: the cards re-render from the new
          // entitlement, so the receipt IS the screen.
          setBuyMessage({
            tone: "success",
            text: `You're on ${TIER_NAME[tier]}. Everything is unlocked.`,
          });
          return;
        }
        // Pending is a notice, not an error: the money is on its way and the
        // entitlement listener unlocks Pro by itself when Play confirms it.
        if (outcome.status === "pending") {
          setBuyMessage({ tone: "secondary", text: outcome.message });
          return;
        }
        // A cancellation is a normal outcome, not an error — say nothing at all.
        if (outcome.status === "error") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setBuyMessage({ tone: "error", text: outcome.message });
        }
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
    setBuyMessage(null);
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

  // No `bottomInset`: the Deck floats over this destination like every other,
  // so `Screen`'s NAV_CLEARANCE default is what keeps the last plan card off
  // the rail.
  return (
    <Screen header={header}>
      {/* ── Where you are now ─────────────────────────────────────────────── */}
      <Reveal index={0}>
        {isSubscriber ? (
          <CurrentPlanCard
            tier={currentTier}
            expiresAt={entitlement.expiresAt}
            willRenew={entitlement.willRenew}
            cancelling={cancelling}
            message={cancelMessage}
            onManage={() => void manageSubscription()}
            onCancel={() => {
              Haptics.selectionAsync().catch(() => {});
              setCancelAsk(true);
            }}
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
            {/* The open window is stated plainly, with the clock and what
                happens when it stops. Someone using Gozlin for free must never
                be left to discover the ending on their own — and "nothing will
                be charged" is the sentence that makes the offer trustworthy
                rather than suspicious, since no card was ever taken.

                It names GOZLIN, not the tier. The window opens the AI and
                nothing else (services/billing/trial.ts), so "you're on Pro"
                would promise history, backup and the Foods catalog that are
                still locked one screen away — the kind of small lie a user
                discovers by tapping. */}
            {isTrialing ? (
              <View style={[styles.personal, { borderColor: alpha(colors.gold, 0.55) }]}>
                <Ionicons name="hourglass-outline" size={14} color={colors.gold} />
                <AppText variant="footnote" style={styles.flex}>
                  {`Gozlin is open for another ${trialHoursLeft} ${
                    trialHoursLeft === 1 ? "hour" : "hours"
                  }, free. Nothing will be charged and nothing renews — when the window closes, chat, insights, deep dives and AI plans lock until you upgrade your plan.`}
                </AppText>
              </View>
            ) : null}
          </View>
        )}
      </Reveal>

      {/* ── The store's own state, when it isn't ready to sell ───────────────
             `!isAvailable && !gatingActive` renders NOTHING. That is the
             developer build, and the card that used to sit here announced "every
             paid feature is open to you" at the top of the storefront. See the
             note in the header. The `gatingActive` branch stays: a real customer
             in a store build that can't reach the store needs the sentence. */}
      {!isAvailable ? (
        gatingActive ? (
          <Reveal index={1}>
            <Card padding="lg" style={styles.block}>
              <AppText variant="callout">Subscriptions aren&apos;t available here</AppText>
              <AppText variant="footnote" color="secondary" style={styles.gapSm}>
                {`In-app purchases need the build from the app store. The prices below are ${LIST_CURRENCY} list prices; the store shows yours in your own currency.`}
              </AppText>
            </Card>
          </Reveal>
        ) : null
      ) : !isReady || (isLoadingPlans && plans.length === 0) ? (
        /* `!isReady` is the cold start: the SDK is still waiting on auth before
           it can configure. That is "connecting", not "failed" — the fetch
           effect above re-runs the moment it lands. */
        <Reveal index={1}>
          <Card padding="lg" style={[styles.block, styles.loadingRow]}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="footnote" color="tertiary">
              {isReady ? "Loading live prices…" : "Connecting to Google Play…"}
            </AppText>
          </Card>
        </Reveal>
      ) : plans.length === 0 ? (
        <Reveal index={1}>
          <Card padding="lg" style={styles.block}>
            <AppText variant="callout">Prices couldn&apos;t be loaded</AppText>
            {/* The store's own reason, classified — a console problem must not
                be dressed up as bad WiFi (services/billing/storeErrors.ts). */}
            <AppText variant="footnote" color="secondary" style={styles.gapSm}>
              {plansProblem?.message ??
                "Check your connection and try again. Nothing has been charged."}
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

      {/* ── The two plans. Exactly one is highlighted: `selected`. ────────── */}
      {PLAN_CARD_ORDER.map((tier, i) => (
        <Reveal key={tier} index={2 + i}>
          <PlanCard
            tier={tier}
            period={period}
            price={tier === "free" ? freePrice : period === "annual" ? proAnnual : proMonthly}
            plan={tier === "free" ? null : planFor(tier, period)}
            currentTier={currentTier}
            canBuy={canBuy}
            trialOffered={trialOffered}
            selected={tier === selected}
            onSelect={() => onSelect(tier)}
            onChangePeriod={setPeriod}
            monthly={proMonthly}
            annual={proAnnual}
            saving={bestSaving}
            pricesPending={pricesPending}
            retrying={isLoadingPlans}
            onRetry={() => void loadPlans()}
            message={tier === "free" ? null : buyMessage}
            note={tier === RECOMMENDED ? PRO_VALUE_NOTE : null}
            busy={busy === tier}
            disabled={busy !== null}
            onBuy={() => void onPurchase(tier as PaidTier)}
            onManage={() => void manageSubscription()}
          />
        </Reveal>
      ))}

      {/* Restore's outcome. A purchase's prints on its own card, under its
          button; this line belongs to the footer link below. */}
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
          onPress={() => void manageSubscription()}
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
          accessibilityLabel="Terms of use"
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

      {/* Names what stops (the renewal), when access ends, and what survives
          (everything logged). "Keep Pro" is the reachable, reversible answer. */}
      <ConfirmSheet
        visible={cancelAsk}
        icon="close-circle-outline"
        title={`Cancel ${TIER_NAME[currentTier]}?`}
        body={`Your subscription stops renewing now and nothing more is charged. You keep ${
          TIER_SHORT_NAME[currentTier]
        } ${
          shortDate(entitlement.expiresAt)
            ? `until ${shortDate(entitlement.expiresAt)}`
            : "to the end of the period you've paid for"
        }, then you're on Free.`}
        reassurance="Everything you've logged stays — Free is the whole tracking app."
        confirmLabel="Cancel subscription"
        cancelLabel={`Keep ${TIER_SHORT_NAME[currentTier]}`}
        onConfirm={() => void onCancelConfirmed()}
        onClose={() => setCancelAsk(false)}
      />
    </Screen>
  );
}

/* ─────────────────────────────── Sub-views ─────────────────────────────────*/

/** A date the way the rest of the screen prints one, or null when unknown. */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString();
}

/** A one-line outcome shown under the control that caused it. */
interface LineMessage {
  tone: "success" | "secondary" | "error";
  text: string;
}

/**
 * The subscriber's own card: what they have, until when, and the way out.
 *
 * "Ends" vs "Renews" is not a detail — someone who has already cancelled and
 * still sees "Renews 12 March" will assume they've been charged again, and the
 * support ticket that follows is entirely our fault.
 *
 * CANCELLING IS ONE TAP AND A CONFIRMATION, RIGHT HERE. Buying took one tap on
 * this screen; leaving must not take a trip through the Play Store's menus to
 * find. The button is quiet (a ghost, not red) because it is a normal choice,
 * not an alarm — the confirmation sheet is where the consequences are spelled
 * out. Once cancelled, the same slot offers the way back.
 */
function CurrentPlanCard({
  tier,
  expiresAt,
  willRenew,
  cancelling,
  message,
  onManage,
  onCancel,
}: {
  tier: Tier;
  expiresAt: string | null;
  willRenew: boolean;
  cancelling: boolean;
  message: LineMessage | null;
  onManage: () => void;
  onCancel: () => void;
}) {
  const { colors } = useColors();
  const date = shortDate(expiresAt);

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
              : willRenew
                ? "Active on this account"
                : "Cancelled — won't renew"}
          </AppText>
        </View>
      </View>

      <AppText variant="footnote" color="tertiary" style={styles.gapMd}>
        {willRenew
          ? "Thank you — it's what pays for the AI behind your coaching and plans."
          : `Your subscription is cancelled and nothing more will be charged. You keep ${TIER_SHORT_NAME[tier]} ${
              date ? `until ${date}` : "to the end of the period you've paid for"
            }, then you're on Free.`}
      </AppText>

      <Button
        label={willRenew ? "Manage subscription" : "Resubscribe"}
        variant="tonal"
        icon="open-outline"
        style={styles.gapLg}
        onPress={onManage}
      />
      {willRenew ? (
        <Button
          label="Cancel subscription"
          variant="ghost"
          loading={cancelling}
          disabled={cancelling}
          style={styles.gapSm}
          onPress={onCancel}
        />
      ) : null}

      {message ? (
        <AppText
          variant="footnote"
          color={message.tone}
          align="center"
          style={styles.gapMd}
          accessibilityLiveRegion="polite"
        >
          {message.text}
        </AppText>
      ) : null}
    </Card>
  );
}

/**
 * One plan, as a card: name, price, its own button, then what it gets you.
 *
 * The button is the card's whole point, so it states the actual next action
 * rather than a generic "select" — buy it, keep it, or nothing at all when the
 * tier is already included in a higher one the user holds.
 *
 * THE WHOLE CARD IS A SELECTION TARGET, and the button inside it is not. Both
 * are pressable and they do different things: the card moves the highlight, the
 * button spends money. Nesting them is safe here because the button is a real
 * `Pressable` that stops the event, and it is worth the care — a card you can
 * only select by hitting its 40px header is a card nobody selects.
 *
 * `accessibilityState.selected` carries the highlight to screen readers, which
 * a border colour cannot.
 */
function PlanCard({
  tier,
  period,
  price,
  plan,
  currentTier,
  canBuy,
  trialOffered,
  selected,
  onSelect,
  onChangePeriod,
  monthly,
  annual,
  saving,
  pricesPending,
  retrying,
  onRetry,
  message,
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
  /** The one highlighted card. Exactly one is true at a time. */
  selected: boolean;
  onSelect: () => void;
  onChangePeriod: (period: BillingPeriod) => void;
  /** The paid tier at each period, for its price tag. Ignored on Free. */
  monthly: PriceView;
  annual: PriceView;
  /** The annual saving, tagged on the Annual tile. Null when none is worth claiming. */
  saving: BestSaving | null;
  /** The first price load is in flight with no quote at all: bars, briefly. */
  pricesPending: boolean;
  /** A price load is running (the "Try again" below says so). */
  retrying: boolean;
  onRetry: () => void;
  /** This card's purchase outcome, printed under its button. */
  message: LineMessage | null;
  /** A line under the button — what the money actually buys. */
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
  /** This card can still be bought here, rather than managed in the store. */
  const forSale = tier !== "free" && !isCurrent && !included;

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${identity.name} plan, ${price.headline} ${price.unit}${
        isCurrent ? ", your current plan" : ""
      }`}
      style={[
        styles.planCard,
        {
          // Emphasis follows selection and ONLY selection. The current plan is
          // marked by its pill, not by being lit — see the header note.
          borderColor: selected ? colors.gold : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          backgroundColor: selected
            ? alpha(colors.gold, isDark ? 0.08 : 0.05)
            : alpha(colors.surface, isDark ? 0.4 : 1),
        },
      ]}
    >
      {/* Name + status */}
      <View style={styles.planHead}>
        <View
          style={[
            styles.planIcon,
            {
              backgroundColor: alpha(
                selected ? colors.gold : colors.textTertiary,
                selected ? 0.16 : 0.1,
              ),
            },
          ]}
        >
          <Ionicons
            name={identity.icon}
            size={16}
            color={selected ? colors.gold : colors.textSecondary}
          />
        </View>
        <AppText variant="headline" style={styles.flex}>
          {identity.name}
        </AppText>
        {/* No "BEST VALUE" badge: with one paid card it would mark the only
            thing that can be bought, which is decoration pretending to be
            guidance. The card's own emphasis already carries it. */}
        {isCurrent ? <Pill label="YOUR PLAN" tone={colors.gold} size="sm" /> : null}
      </View>

      <AppText variant="footnote" color="secondary" style={styles.planTagline}>
        {identity.tagline}
      </AppText>

      {/* The price, as ONE tag: Monthly and Annual side by side, then the
          receipt for the one chosen. Free gets a single tile of the same make.
          See components/billing/PriceTag. */}
      {tier === "free" ? (
        <FreePriceTag price={price} />
      ) : (
        <PriceTag
          period={period}
          onChangePeriod={onChangePeriod}
          monthly={monthly}
          annual={annual}
          saving={saving}
          trialDays={forSale && trialOffered ? (plan?.trialDays ?? null) : null}
          pending={pricesPending}
        />
      )}

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
                : `Get ${identity.name}`
            }
            variant={selected ? "primary" : "tonal"}
            loading={busy}
            disabled={disabled || !canBuy || !plan || !plan.purchasable}
            onPress={onBuy}
          />
        )}

        {/* Prices are showing but can't be sold yet — Google Play's own, or the
            last ones seen — because RevenueCat isn't answering. A disabled
            button with no reason beside it reads as a broken one. */}
        {forSale && plan && !plan.purchasable ? (
          <View style={styles.unsellable}>
            <AppText variant="footnote" color="secondary" align="center">
              These are your Google Play prices. Buying opens as soon as welliva&apos;s
              subscription service answers — it isn&apos;t reachable on this network right now.
            </AppText>
            <Pressable
              onPress={onRetry}
              disabled={retrying}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <AppText variant="footnote" color="brand" style={styles.link}>
                {retrying ? "Checking…" : "Try again"}
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {/* The outcome of pressing it, right here — see `buyMessage`. */}
        {message ? (
          <AppText
            variant="footnote"
            color={message.tone}
            align="center"
            style={styles.gapMd}
            accessibilityLiveRegion="polite"
          >
            {message.text}
          </AppText>
        ) : null}

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
        ) : price.estimated && tier !== "free" && !pricesPending ? (
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
          <View key={h.text} style={styles.highlightRow}>
            {/* Each line carries its own glyph rather than a column of identical
                ticks. Nine identical check marks is a texture, not a list — you
                stop reading it at the third. A distinct icon per line lets
                someone scanning for the ONE thing they came here about (the
                camera, the search, the chat bubble) find it without reading. */}
            <Ionicons
              name={h.icon}
              size={15}
              color={tier === "free" ? colors.textSecondary : colors.gold}
              style={styles.highlightIcon}
            />
            <AppText variant="footnote" color="secondary" style={styles.flex}>
              {h.text}
            </AppText>
          </View>
        ))}
        {tier !== "free" ? (
          <View style={styles.highlightRow}>
            <Ionicons
              name="add-circle-outline"
              size={15}
              color={colors.textTertiary}
              style={styles.highlightIcon}
            />
            <AppText variant="footnote" color="tertiary" style={styles.flex}>
              Everything in Free
            </AppText>
          </View>
        ) : null}
      </View>

      {/* The period this card is quoting, said once more in plain words — the
          picker is above the fold and cards are scrolled past it. It says "a
          year", not "today": with a free trial, today's charge is nothing. */}
      {tier !== "free" && !pricesPending ? (
        <AppText variant="caption" color="tertiary" style={styles.planPeriodNote}>
          {period === "annual"
            ? `Yearly billing${price.billedTotal ? ` · ${price.billedTotal} a year` : ""}`
            : `Monthly billing · ${price.headline} a month`}
        </AppText>
      ) : null}
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

  /** The open-window notice. Bordered rather than filled: it is a fact about
   *  the user's account, not another promotional block. */
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

  loadingRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  /* Plan cards */
  planCard: {
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  planHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  /** A plated glyph rather than a bare one: it gives the card head a fixed
   *  left edge that the tagline and price line up against. */
  planIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  planTagline: { marginTop: Spacing.xs, marginBottom: Spacing.md },
  planAction: { marginTop: Spacing.lg },
  planNote: { marginTop: Spacing.sm, fontWeight: "600" },
  unsellable: { alignItems: "center", gap: Spacing.xs, marginTop: Spacing.md },
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
});
