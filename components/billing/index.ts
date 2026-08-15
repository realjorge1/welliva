/**
 * Welliva billing UI — paywalls, gates and lock markers.
 *
 *   import { PaywallGate, ProBadge, ProLockCard } from "@/components/billing";
 *
 * The tier list itself is data, in services/billing/tiers.ts.
 */
export { PaywallGate } from "./PaywallGate";
export { ProBadge } from "./ProBadge";
export { ProLockCard } from "./ProLockCard";
export {
  ALWAYS_FREE_NOTE,
  LOCK_COPY,
  PRO_BENEFITS,
  toLockId,
  type LockCopy,
  type LockId,
  type ProBenefit,
} from "./lockCopy";
