/**
 * ProactiveDeliveryRunner — the headless host for proactive notification delivery (P2).
 *
 * Renders nothing; mounting it (inside AppProvider) is what lays down each day's
 * notification plan from the live engines. Kept as a component so the scheduling effect
 * lives at a stable point in the tree and runs whenever the app opens. Entirely a no-op
 * until the user enables proactive notifications (consent + OS permission).
 */
import { useProactiveDelivery } from "./useNotifications";

export function ProactiveDeliveryRunner(): null {
  useProactiveDelivery();
  return null;
}
