/**
 * welliva billing — subscriptions via RevenueCat.
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
  getEntitlement,
  hydrateEntitlement,
  isPro,
  isSubscriber,
  markNotRenewing,
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
  isBillingReady,
  openSubscriptionManagement,
  purchasePlan,
  refreshEntitlement,
  restorePurchases,
  signOutBilling,
  type BillingPeriod,
  type PlanOption,
  type PurchaseOutcome,
  type Storefront,
} from "./Billing";

export {
  describeStoreError,
  type StoreProblem,
  type StoreProblemKind,
} from "./storeErrors";

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
  featureTier,
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
  maybeStartTrial,
  reconcileTrialWithServer,
  setTrialClaimer,
  subscribeTrial,
  trialGrants,
  trialSource,
  TRIAL_FEATURES,
  TRIAL_HOURS,
  trialHoursLeft,
  type RemoteTrialClaim,
  type TrialClaimer,
  type TrialWindow,
} from "./trial";
