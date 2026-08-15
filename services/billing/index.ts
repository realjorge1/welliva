/**
 * Welliva billing — subscriptions via RevenueCat.
 *
 *   import { isPro, canUseAI, coachDailyLimit } from "@/services/billing";
 *
 * Setup runbook: docs/monetization/setup.md
 * What Free gets vs Pro: ./tiers.ts
 */
export {
  DEFAULT_OFFERING,
  isBillingConfigured,
  MANAGE_SUBSCRIPTION_URL,
  PRO_ENTITLEMENT,
} from "./config";

export {
  canUseAI,
  clearEntitlement,
  FREE,
  getDevProOverride,
  getEntitlement,
  hydrateEntitlement,
  isPro,
  setDevProOverride,
  setEntitlement,
  subscribe,
  type Entitlement,
} from "./entitlement";

export {
  configureBilling,
  getProPackages,
  identifyUser,
  installEntitlementListener,
  isBillingAvailable,
  purchasePro,
  refreshEntitlement,
  restorePurchases,
  signOutBilling,
  type ProPackage,
  type PurchaseOutcome,
} from "./Billing";

export {
  canCreateHabit,
  clampHistoryDays,
  coachDailyLimit,
  FREE_DIET_IDS,
  FREE_TIER,
  habitLimit,
  historyCutoffDate,
  historyWindowDays,
  isDietFree,
  isDietLocked,
  isHistoryRangeLocked,
  missingFreeDietIds,
  photoScanDailyLimit,
  PRO_TIER,
} from "./tiers";

export {
  checkQuota,
  getUsage,
  recordUsage,
  resetUsage,
  type MeterId,
  type QuotaState,
} from "./usage";

export {
  allowPro,
  checkCoachQuota,
  checkPhotoScanQuota,
  isGatingActive,
  needsUpgrade,
  spendCoachTurn,
  spendPhotoScan,
  type MeteredState,
} from "./gating";
