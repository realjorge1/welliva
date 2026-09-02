/**
 * Welliva billing — subscriptions via RevenueCat.
 *
 *   import { allows, effectiveTier, coachDailyLimit } from "@/services/billing";
 *
 * Setup runbook: docs/monetization/setup.md
 * What Free and Pro each get: ./tiers.ts
 */
export {
  DEFAULT_OFFERING,
  isBillingConfigured,
  LEGACY_PLUS_ENTITLEMENT,
  MANAGE_SUBSCRIPTION_URL,
  PRO_ENTITLEMENT,
  TIER_OFFERINGS,
} from "./config";

export {
  canUseAI,
  clearEntitlement,
  currentTier,
  FREE,
  getDevTierOverride,
  getEntitlement,
  hydrateEntitlement,
  isPro,
  isSubscriber,
  setDevTierOverride,
  setEntitlement,
  subscribe,
  type Entitlement,
} from "./entitlement";

export {
  configureBilling,
  getPlanOptions,
  identifyUser,
  installEntitlementListener,
  isBillingAvailable,
  purchasePlan,
  refreshEntitlement,
  restorePurchases,
  signOutBilling,
  type BillingPeriod,
  type PlanOption,
  type PurchaseOutcome,
} from "./Billing";

export {
  canCreateHabit,
  clampHistoryDays,
  coachDailyLimit,
  deepDiveLifetimeLimit,
  FEATURE_MIN_TIER,
  featureMinTier,
  FREE_TIER,
  habitLimit,
  higherTier,
  historyCutoffDate,
  historyWindowDays,
  isHistoryRangeLocked,
  photoScanDailyLimit,
  PRO_TIER,
  TIER_LIMITS,
  TIER_NAME,
  TIER_ORDER,
  TIER_SHORT_NAME,
  tierAllowsFeature,
  tierAtLeast,
  toTier,
  type FeatureId,
  type Tier,
  type TierLimits,
} from "./tiers";

export {
  annualSaving,
  formatMoney,
  LIST_CURRENCY,
  LIST_PRICES,
  listPrice,
  perMonthOfAnnual,
  type AnnualSaving,
} from "./pricing";

export {
  checkQuota,
  getUsage,
  recordUsage,
  resetUsage,
  type MeterId,
  type QuotaState,
} from "./usage";

export {
  checkAllowance,
  getAllowanceUsed,
  resetAllowances,
  spendAllowance,
  type AllowanceId,
  type AllowanceState,
} from "./allowance";

export {
  allows,
  checkCoachQuota,
  checkDeepDive,
  checkPhotoScanQuota,
  effectiveTier,
  hasPaidAccess,
  isGatingActive,
  needsUpgrade,
  spendCoachTurn,
  spendDeepDive,
  spendPhotoScan,
  type MeteredState,
} from "./gating";

export {
  activeTrial,
  hasUsedTrial,
  hydrateTrial,
  maybeStartInsightTrial,
  setTrialClaimer,
  subscribeTrial,
  trialSource,
  TRIAL_HOURS,
  trialHoursLeft,
  trialTier,
  type InsightTrial,
  type RemoteTrialClaim,
  type TrialClaimer,
} from "./trial";
