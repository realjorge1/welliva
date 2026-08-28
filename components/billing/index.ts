/**
 * Welliva billing UI — the storefront's copy, gates and lock markers.
 *
 *   import { PaywallGate, ProLockCard } from "@/components/billing";
 *
 * The tier list itself is data, in services/billing/tiers.ts.
 */
export { PaywallGate } from "./PaywallGate";
export { ProLockCard } from "./ProLockCard";
export { LOCK_COPY, toLockId, type LockCopy, type LockId } from "./lockCopy";
export {
  ALWAYS_FREE_NOTE,
  bestAnnualSaving,
  countLoggedDays,
  FREE_PRICE,
  historyReachLine,
  PLAN_CARD_ORDER,
  PLAN_IDENTITY,
  periodLabel,
  periodName,
  priceView,
  PRO_VALUE_NOTE,
  proUpsell,
  renewalDisclosure,
  type PaidTier,
  type PlanIdentity,
  type PriceView,
} from "./planCopy";
