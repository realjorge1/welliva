/**
 * HYDRATION — Home's hydration card.
 *
 * One card: the day's water as a dot-matrix figure beside a measuring cylinder,
 * one-tap keys, and a log of today's drinks you can correct (./HydrationCard).
 *
 * The classic ring-and-wave card (`components/WaterTracker`) and the switch
 * that chose between the two were deleted on 2026-10-31 at the owner's word
 * ("delete the previous (old) hydration log"). Nothing logged is lost with it:
 * both cards always read and wrote the same counter, and the drinks list is
 * written by the water store itself, not by any card.
 */
import { HydrationCard } from "./HydrationCard";

export function Hydration() {
  return <HydrationCard />;
}
