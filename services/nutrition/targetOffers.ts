/**
 * TARGET OFFERS — the one-tap questions that may change her numbers.
 *
 * Three things can propose a new target without her editing anything:
 *   pace_guard — she's been losing faster than ~1% a week for three weeks
 *   learned    — the learning model has watched enough to know her burn
 *   activity   — her logged training disagrees with her stated activity level
 *
 * None of them changes a number by itself (the owner's 2026-11-20 decision for
 * the learned target, applied to all three): each becomes a card with the old
 * and new numbers and the reason, [Use new numbers] [Keep mine]. Her answer is
 * remembered, so a declined offer doesn't come back the next morning.
 *
 * One record per kind, synced: an offer answered on the phone is answered on
 * the tablet (mergeById on `id`, the later `updatedAt` wins).
 */
import type { NutritionTargets } from "../../models/nutrition";
import type { ActivityLevel, TargetPace } from "../../models/user";
import { readJSON, writeJSON } from "../OfflineStorage";

export const TARGET_OFFERS_KEY = "@welliva_target_offers";

export type OfferKind = "pace_guard" | "learned" | "activity";

export interface TargetOffer {
  /** One live record per kind. */
  id: OfferKind;
  status: "pending" | "accepted" | "declined";
  /** Local date it was offered. */
  date: string;
  /** ISO times: when made, and the last change (the merge's tie-breaker). */
  createdAt: string;
  updatedAt: string;
  from: { calories: number; proteinG: number };
  to: { calories: number; proteinG: number };
  /** The card's sentence, in the app's voice. */
  message: string;
  /** What accepting writes to her bio. Exactly one field is set. */
  change: { pace?: TargetPace; maintenanceAdjustKcal?: number; activityLevel?: ActivityLevel };
}

export async function loadOffers(): Promise<TargetOffer[]> {
  try {
    const offers = await readJSON<TargetOffer[]>(TARGET_OFFERS_KEY, []);
    return Array.isArray(offers) ? offers : [];
  } catch {
    return [];
  }
}

export async function saveOffer(offer: TargetOffer): Promise<void> {
  const offers = await loadOffers();
  await writeJSON(TARGET_OFFERS_KEY, [offer, ...offers.filter((o) => o.id !== offer.id)]);
}

/** The pending offer to show, if any. Learned first: it is the most informed. */
export async function pendingOffer(): Promise<TargetOffer | null> {
  const offers = await loadOffers();
  const order: OfferKind[] = ["learned", "pace_guard", "activity"];
  for (const kind of order) {
    const o = offers.find((x) => x.id === kind && x.status === "pending");
    if (o) return o;
  }
  return null;
}

/** Days from one local date to another (positive when `b` is later). */
export function daysBetween(a: string, b: string): number {
  const n = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Math.floor(Date.UTC(y!, m! - 1, day!) / 86_400_000);
  };
  return n(b) - n(a);
}

/** Has an offer of this kind been made (in any state) within `days` of today? */
export function offeredWithin(offers: readonly TargetOffer[], kind: OfferKind, today: string, days: number): boolean {
  const o = offers.find((x) => x.id === kind);
  return !!o && daysBetween(o.date, today) < days;
}

export function makeOffer(
  kind: OfferKind,
  today: string,
  before: Pick<NutritionTargets, "calories" | "proteinG">,
  after: Pick<NutritionTargets, "calories" | "proteinG">,
  message: string,
  change: TargetOffer["change"],
  now: Date = new Date(),
): TargetOffer {
  const at = now.toISOString();
  return {
    id: kind,
    status: "pending",
    date: today,
    createdAt: at,
    updatedAt: at,
    from: { calories: before.calories, proteinG: before.proteinG },
    to: { calories: after.calories, proteinG: after.proteinG },
    message,
    change,
  };
}

/** Record her answer. Kept, so the same question isn't asked again tomorrow. */
export async function answerOffer(kind: OfferKind, status: "accepted" | "declined", now: Date = new Date()): Promise<void> {
  const offers = await loadOffers();
  const o = offers.find((x) => x.id === kind);
  if (!o) return;
  await saveOffer({ ...o, status, updatedAt: now.toISOString() });
}
