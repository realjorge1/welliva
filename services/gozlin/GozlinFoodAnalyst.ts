/**
 * GozlinFoodAnalyst — "tell me what you ate" → a real nutrition panel.
 *
 * THE ARCHITECTURAL RULE THIS FILE EXISTS TO ENFORCE:
 *
 *     The language model may decide WHAT you ate.
 *     It may never decide what that CONTAINS.
 *
 * Asking a model for nutrition facts produces fluent, specific, confidently
 * wrong numbers — 340 kcal and 12 g of protein, sourced from nowhere, different
 * if you ask twice. That is disqualifying for a health app, where the whole
 * point is that the numbers add up to something true.
 *
 * So Gozlin is used strictly as a PARSER. It converts messy prose into
 * {quantity, unit, food} triples and nothing else — the server's schema
 * physically rejects any nutrition field it tries to return. Those triples then
 * go through the same NutrientResolver that the local parser feeds, hitting the
 * same cited reference table. The AI improves our understanding of the SENTENCE;
 * it has no influence whatsoever on the numbers.
 *
 * Consequences worth knowing:
 *  - Offline, the local parser handles it and the feature still works.
 *  - A food outside the reference table returns "unmatched" instead of a guess,
 *    even when the model recognised it perfectly well.
 *  - Two users typing the same meal always get identical numbers.
 */

import type { MealType } from "../../models/diet";
import type { FoodAnalysis } from "../../models/nutrients";
import { WellivaApi } from "../api/WellivaApi";
import { parseFoodText, type ParsedFoodItem } from "../nutrition/FoodTextParser";
import { resolveItems } from "../nutrition/NutrientResolver";

export interface AnalyzeOptions {
  /** Slot the user is logging against, passed to the parser as a hint only. */
  slot?: MealType | null;
  /** Skip the network entirely (offline, or the user opted out). */
  localOnly?: boolean;
}

export interface AnalysisOutcome {
  analysis: FoodAnalysis;
  /** True when the AI parse was used in place of the local one. */
  usedAI: boolean;
  /** Set when the AI path was attempted and failed; the local result stands. */
  aiError?: string;
}

/**
 * How poorly the local parse must do before it's worth a network round-trip.
 * Escalating on *any* unmatched item would call the API for every typo; the
 * threshold keeps the fast, free, offline path handling the common case.
 */
function needsEscalation(analysis: FoodAnalysis): boolean {
  if (analysis.items.length === 0) return true;
  const unmatched = analysis.items.filter((i) => i.confidence === "unmatched").length;
  return unmatched > 0 && unmatched / analysis.items.length >= 0.5;
}

/**
 * Analyse a free-text meal description.
 *
 * Always returns an analysis — the local parse is the floor, and the AI can
 * only ever replace it with a *better-resolved* one. A network failure is
 * invisible to the user beyond `aiError`.
 */
export async function analyzeFoodText(
  text: string,
  options: AnalyzeOptions = {},
): Promise<AnalysisOutcome> {
  const input = text.trim();
  if (!input) {
    return {
      analysis: resolveItems([], input, "local"),
      usedAI: false,
    };
  }

  // --- Rung 1: local, deterministic, offline, free. ------------------------
  const localItems = parseFoodText(input);
  const local = resolveItems(localItems, input, "local");

  if (options.localOnly || !WellivaApi.isConfigured || !needsEscalation(local)) {
    return { analysis: local, usedAI: false };
  }

  // --- Rung 2: ask Gozlin to re-read the sentence. -------------------------
  try {
    const parsed = await parseWithAI(input, options.slot ?? null);
    if (parsed.length === 0) return { analysis: local, usedAI: false };

    const ai = resolveItems(parsed, input, "ai");

    // Only accept the AI parse if it actually resolved MORE of the meal. A
    // model that confidently re-reads "rice" as something exotic must not make
    // the result worse than the parse we already had.
    const localResolved = local.items.filter((i) => i.confidence !== "unmatched").length;
    const aiResolved = ai.items.filter((i) => i.confidence !== "unmatched").length;
    return aiResolved > localResolved
      ? { analysis: ai, usedAI: true }
      : { analysis: local, usedAI: false };
  } catch (e) {
    return {
      analysis: local,
      usedAI: false,
      aiError: e instanceof Error ? e.message : "Analysis unavailable",
    };
  }
}

/**
 * The parse-only prompt. Note what it does NOT ask for: no calories, no macros,
 * no "estimate the nutrition". The server enforces the same restriction in its
 * response schema, so even a model that ignores these instructions can't get a
 * number past the boundary.
 */
const PARSE_SYSTEM = `You convert food descriptions into structured items.

Return ONLY a JSON array. Each element:
  { "quantity": number, "unit": string, "food": string }

Rules:
- "quantity" is how many; use 1 when unstated.
- "unit" is the household measure exactly as said ("cup", "slice", "medium",
  "g", "tbsp"), or "" if none was given. Never invent a unit.
- "food" is the plain food name, singular, with no amount and no adjectives
  that aren't part of the food's identity. Keep the cooking method when it
  changes the food ("fried egg", "boiled yam").
- Split distinct foods into separate elements. Keep dish names that merely
  contain a conjunction intact ("macaroni and cheese" is ONE item).
- If the text mentions no food at all, return [].

Do NOT return calories, macros, nutrients, or any other field. You are a parser,
not a nutrition database. Return the JSON array and nothing else.`;

async function parseWithAI(
  input: string,
  slot: MealType | null,
): Promise<ParsedFoodItem[]> {
  const hint = slot ? `\n(This was the user's ${slot}.)` : "";
  const res = await WellivaApi.parseFood({
    system: PARSE_SYSTEM,
    user: `${input}${hint}`,
  });
  return sanitize(res.items, input);
}

/**
 * Final client-side gate. Even though the server validates, we re-check here:
 * this is the last point before numbers enter the resolver, and the cost of a
 * second check is nothing against the cost of a fabricated nutrient reaching a
 * user's daily total.
 */
function sanitize(
  items: { quantity?: unknown; unit?: unknown; food?: unknown }[],
  input: string,
): ParsedFoodItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw) => {
      const food = typeof raw.food === "string" ? raw.food.trim() : "";
      if (!food) return null;
      const quantity =
        typeof raw.quantity === "number" && Number.isFinite(raw.quantity) && raw.quantity > 0
          ? raw.quantity
          : 1;
      const unit = typeof raw.unit === "string" ? raw.unit.trim().toLowerCase() : "";
      return {
        raw: input,
        quantity,
        unit,
        food,
        quantityAssumed: typeof raw.quantity !== "number",
      } satisfies ParsedFoodItem;
    })
    .filter((i): i is ParsedFoodItem => i !== null)
    // A runaway model listing fifty ingredients isn't a meal log.
    .slice(0, 25);
}
