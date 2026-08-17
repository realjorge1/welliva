/**
 * FoodLookupService — finding a food our catalogs don't have.
 *
 * ── THE LOCAL-FIRST RULE ────────────────────────────────────────────────────
 * The remote ladder runs ONLY when the query missed everything on device. Not
 * "when the top result looks weak", not "when the user seems unsatisfied" —
 * only on a genuine, total miss. That rule is enforced here in
 * {@link shouldOfferLookup} rather than left to each caller, because a network
 * lookup is the one path in this feature that costs money, takes seconds, and
 * can return a figure no laboratory ever measured. It should be rare.
 *
 * Concretely: search hits the bundled catalog AND the user's own added foods
 * first. Either one matching means we already know this food, and the answer we
 * already have is better than the one we'd pay for — the catalog's numbers are
 * curated and its ids are stable, and a re-lookup would create a duplicate.
 *
 * ── THE LADDER ──────────────────────────────────────────────────────────────
 *   1. on-device catalog + the user's foods   ← handled by the caller
 *   2. USDA FoodData Central (server-proxied) → measured, real fdcId
 *   3. a model estimate (server-proxied)      → ai-estimated, labelled forever
 *   4. nothing                                → say so
 *
 * Rungs 2–3 live behind ONE server call (`/v1/nutrition/lookup`); the server
 * owns the ordering because it holds the USDA key. The app's job is to decide
 * whether to ask at all, and to make sure whatever comes back is labelled
 * honestly on the way in.
 *
 * ── WHY THE SANITIZER IS HERE ───────────────────────────────────────────────
 * The server is trusted, but this is the last gate before a number reaches a
 * user's daily total. GozlinFoodAnalyst makes the same argument for its own
 * re-check and it applies with more force here, because unlike the parser this
 * endpoint is ALLOWED to return numbers. So: unknown nutrient keys are dropped,
 * non-finite values are dropped, and an `origin` the app doesn't recognise is
 * treated as an estimate rather than trusted. Failing toward "less confident"
 * is always the safe direction.
 */

import type { FoodItem } from "../../constants/FoodDictionary";
import {
  NUTRIENT_META,
  type NutrientConfidence,
  type NutrientKey,
  type NutrientPanel,
  type NutrientSource,
} from "../../models/nutrients";
// `isApiConfigured` comes from ../api/config, which reads process.env and
// imports nothing. WellivaApi itself is NOT imported at module scope: it pulls
// in the Supabase client and expo/fetch, which drag React Native along with
// them. That would make this module unimportable outside a native runtime — no
// unit test could reach the local-first rule, which is the part most worth
// testing. The client is loaded lazily inside lookupFood instead, which also
// keeps it off the cold-start path.
import { isApiConfigured } from "../api/config";
import type { FoodLookupResult } from "../api/WellivaApi";
import type { AddCustomFoodInput } from "./CustomFoodService";

/** Shortest query worth spending a network call on. */
const MIN_QUERY_LENGTH = 2;

/** A resolved candidate, ready to preview and then save. */
export interface LookupCandidate extends AddCustomFoodInput {
  /** Stable within one result set, for list keys and selection. */
  key: string;
}

export interface LookupOutcome {
  candidates: LookupCandidate[];
  resolvedBy: "usda" | "ai-estimate" | "none";
}

/**
 * Whether to offer a remote lookup at all.
 *
 * `localHitCount` is the number of foods the on-device search returned across
 * BOTH the bundled catalog and the user's own added foods. Anything above zero
 * means we already know this food and must not go looking for it again.
 */
export function shouldOfferLookup(args: {
  query: string;
  localHitCount: number;
  /** False when no backend URL is configured — the feature simply isn't there. */
  apiConfigured?: boolean;
}): boolean {
  if (args.localHitCount > 0) return false;
  if ((args.apiConfigured ?? isApiConfigured) !== true) return false;
  return args.query.trim().length >= MIN_QUERY_LENGTH;
}

/**
 * Ask the server for a food we don't have.
 *
 * Callers must gate on {@link shouldOfferLookup} first. Throws on network or
 * auth failure so the UI can show a retry — unlike the food-log parser there is
 * no local fallback to degrade to, because the entire point is that we don't
 * have this food.
 */
export async function lookupFood(args: {
  query: string;
  region?: string;
}): Promise<LookupOutcome> {
  const query = args.query.trim();
  const { WellivaApi } = await import("../api/WellivaApi");
  const res = await WellivaApi.lookupFood({
    query,
    ...(args.region ? { region: args.region } : {}),
  });

  const candidates = (Array.isArray(res.results) ? res.results : [])
    .map((r, i) => toCandidate(r, query, i))
    .filter((c): c is LookupCandidate => c !== null)
    // More than a handful of options turns a decision into a chore.
    .slice(0, 8);

  return {
    candidates,
    resolvedBy:
      candidates.length === 0
        ? "none"
        : res.resolvedBy === "usda" || res.resolvedBy === "ai-estimate"
          ? res.resolvedBy
          : "ai-estimate",
  };
}

/**
 * One server result → something safe to store, or null if it can't be trusted.
 *
 * A candidate with no name, or with no calories, is dropped: a food row that
 * can't say what it is or how much energy it holds is not worth adding to a
 * user's personal catalog.
 */
function toCandidate(
  raw: FoodLookupResult,
  query: string,
  index: number,
): LookupCandidate | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;

  const nutrients = sanitizePanel(raw.nutrients);
  if (nutrients.calories === undefined) return null;

  const per100g = raw.per100g ? sanitizePanel(raw.per100g) : undefined;

  // An origin we don't recognise is treated as an estimate. Never the reverse:
  // a bug or a malicious payload must not be able to promote a guess to
  // "measured" — that's the one direction with no recovery.
  const measured = raw.origin === "usda" && typeof raw.fdcId === "number";

  const source: NutrientSource = measured
    ? {
        kind: "usda",
        fdcId: raw.fdcId as number,
        dataset: raw.dataset ?? "Foundation",
        description: raw.description ?? name,
      }
    : {
        kind: "ai-estimate",
        model: typeof raw.model === "string" ? raw.model : "unknown",
        description: raw.description ?? `Estimate for “${query}”`,
      };

  /*
   * A measured entry is only "measured" when we also know the portion's weight.
   * With a real gram weight the panel is exactly what USDA published; without
   * one the food is right but the amount was assumed, which is precisely what
   * `portion-estimated` means elsewhere in the resolver.
   */
  const servingGrams =
    typeof raw.servingGrams === "number" && Number.isFinite(raw.servingGrams) && raw.servingGrams > 0
      ? raw.servingGrams
      : null;

  const confidence: NutrientConfidence = measured
    ? servingGrams !== null
      ? "measured"
      : "portion-estimated"
    : "ai-estimated";

  return {
    key: `${raw.origin}_${raw.fdcId ?? index}_${index}`,
    name,
    serving:
      typeof raw.serving === "string" && raw.serving.trim() ? raw.serving.trim() : "1 serving",
    servingGrams,
    group: normalizeGroup(raw.group),
    nutrients,
    ...(per100g && Object.keys(per100g).length > 0 ? { per100g } : {}),
    source,
    confidence,
    ...(raw.isRegional ? { isNigerian: true } : {}),
    query,
  };
}

/**
 * Keep only nutrients the app actually models, with finite non-negative values.
 *
 * An unknown key is silently dropped rather than stored: NutrientPanel is a
 * closed union, and a stray key would flow into totals, sums and the label
 * component as an untyped value nobody renders.
 */
function sanitizePanel(raw: unknown): NutrientPanel {
  if (!raw || typeof raw !== "object") return {};
  const out: NutrientPanel = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(k in NUTRIENT_META)) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) continue;
    out[k as NutrientKey] = v;
  }
  return out;
}

/**
 * The app's display groups. A looked-up food has to land in one of them or it
 * would be invisible: the Foods screen buckets strictly by group, and a food in
 * a group the list never renders is a food the user can't reach.
 */
const KNOWN_GROUPS = [
  "Fruits",
  "Vegetables",
  "Proteins",
  "Legumes & Plant Protein",
  "Grains & Starches",
  "Nuts, Seeds, Fats & Oils",
  "Dairy & Alternatives",
  "Herbs, Aromatics & Seasonings",
  "Beverages",
];

/** Where anything unrecognised goes. Always rendered, never a dead end. */
export const CUSTOM_FOOD_GROUP = "Your foods";

function normalizeGroup(group: unknown): string {
  if (typeof group !== "string") return CUSTOM_FOOD_GROUP;
  const match = KNOWN_GROUPS.find((g) => g.toLowerCase() === group.trim().toLowerCase());
  return match ?? CUSTOM_FOOD_GROUP;
}

/** Every group the Foods screen may need to render, catalog plus custom. */
export function allDisplayGroups(catalogGroups: string[]): string[] {
  return catalogGroups.includes(CUSTOM_FOOD_GROUP)
    ? catalogGroups
    : [...catalogGroups, CUSTOM_FOOD_GROUP];
}

/** A CustomFood is a FoodItem — this is just the narrowing for search code. */
export type SearchableFood = FoodItem;
