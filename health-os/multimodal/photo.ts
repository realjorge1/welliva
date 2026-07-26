/**
 * health-os/multimodal/photo.ts — PURE photo-analysis → LogDraft translation (P5).
 *
 * Turns a `MealPhotoAnalysis` (from the server's vision endpoint, or a manual fallback)
 * into normalized, validated meal `LogDraft`s with DETERMINISTIC ids — so confirming the
 * same capture twice never double-logs. No native imports, no I/O: fully unit-testable.
 *
 * The analysis itself (the vision model) is a server concern behind the M3 consent
 * boundary; this file owns the safe, on-device normalization of whatever it returns.
 */
import type { MealSlot } from "../timeline/catalog";
import type { LogDraft, MealPhotoAnalysis } from "./types";

function clampNonNeg(n: number | undefined): number | undefined {
  if (typeof n !== "number" || Number.isNaN(n)) return undefined;
  return Math.max(0, Math.round(n));
}

function clamp01(n: number | undefined, fallback = 0.6): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/**
 * Build meal drafts from an analysis. `captureId` seeds the deterministic draft ids
 * (e.g. a content hash or timestamp the caller holds stable across re-renders), so the
 * SAME photo yields the SAME ids and an idempotent commit.
 */
export function draftsFromAnalysis(
  analysis: MealPhotoAnalysis,
  captureId: string,
): LogDraft[] {
  const slot: MealSlot | undefined = analysis.slot;
  const out: LogDraft[] = [];
  let i = 0;
  for (const food of analysis.foods ?? []) {
    const name = (food.name ?? "").trim();
    if (!name) continue;
    out.push({
      id: `photo:${captureId}:${i}`,
      kind: "meal",
      source: "photo",
      confidence: clamp01(food.confidence),
      name,
      ...(slot ? { slot } : {}),
      ...(clampNonNeg(food.calories) !== undefined ? { calories: clampNonNeg(food.calories) } : {}),
      ...(clampNonNeg(food.proteinG) !== undefined ? { proteinG: clampNonNeg(food.proteinG) } : {}),
      ...(clampNonNeg(food.carbsG) !== undefined ? { carbsG: clampNonNeg(food.carbsG) } : {}),
      ...(clampNonNeg(food.fatG) !== undefined ? { fatG: clampNonNeg(food.fatG) } : {}),
    });
    i++;
  }
  return out;
}

/** Sum a set of meal drafts into a single nutrition total (for the confirm-card header). */
export function mealDraftTotals(drafts: LogDraft[]): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  return drafts.reduce(
    (acc, d) => ({
      calories: acc.calories + (d.calories ?? 0),
      proteinG: acc.proteinG + (d.proteinG ?? 0),
      carbsG: acc.carbsG + (d.carbsG ?? 0),
      fatG: acc.fatG + (d.fatG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Edit one draft (the confirm card lets the user fix a name/macro before committing). */
export function applyDraftEdit(
  draft: LogDraft,
  patch: Partial<Pick<LogDraft, "name" | "slot" | "calories" | "proteinG" | "carbsG" | "fatG">>,
): LogDraft {
  return {
    ...draft,
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
  };
}

/** A draft is auto-checked on the confirm card only when we're reasonably sure. */
export const CONFIRM_AUTO_CHECK_THRESHOLD = 0.5;

export function isAutoChecked(draft: LogDraft): boolean {
  return draft.confidence >= CONFIRM_AUTO_CHECK_THRESHOLD;
}
