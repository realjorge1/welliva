/**
 * PaywallGate — render children for a tier that includes the feature, an upgrade
 * prompt for everyone else.
 *
 *   <PaywallGate lock="insights">
 *     <CorrelationPanel />
 *   </PaywallGate>
 *
 * WHAT THIS IS AND IS NOT FOR
 *
 * It is for feature SURFACES — a panel, a chart, a section of a screen. It is
 * not the right tool for a per-item lock inside a list — that pattern is gone
 * with the diet catalog lock it existed for — and it is not a security
 * boundary: anything that costs money to serve must also be gated where the
 * money is spent, which for the AI paths means server-side
 * (docs/monetization/setup.md Part 6).
 *
 * `fallback` lets a caller substitute something better than the default card —
 * a blurred preview of the real thing converts better than a description of it,
 * because the user can see their own data behind the lock.
 */
import React from "react";

import { useBilling } from "@/contexts/BillingContext";
import { ProLockCard } from "./ProLockCard";
import type { LockId } from "./lockCopy";

export function PaywallGate({
  lock,
  children,
  fallback,
  /**
   * Render children while the cached entitlement is still loading. Prevents a
   * paying user seeing a one-frame flash of the paywall on cold start — the
   * cache resolves in milliseconds, and briefly showing a paid feature to a free
   * user costs nothing.
   */
  optimistic = true,
  compact = false,
}: {
  lock: LockId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  optimistic?: boolean;
  compact?: boolean;
}) {
  // `allows` asks the tier this specific feature needs — a Plus subscriber sees
  // a Plus surface and still gets the ask on a Pro one.
  const { allows, isHydrating } = useBilling();

  if (allows(lock)) return <>{children}</>;
  if (optimistic && isHydrating) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  return <ProLockCard lock={lock} compact={compact} />;
}
