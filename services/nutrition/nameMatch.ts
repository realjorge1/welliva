/**
 * nameMatch — the one similarity score used everywhere a food name is matched.
 *
 * This lived inside NutrientResolver, which meant the resolver could forgive a
 * typo ("yoghurt" → yogurt) while the Foods catalog's own search — a plain
 * `.includes()` — could not. Two search qualities in one app is worse than
 * either one consistently, so the scorer moved here and both callers share it.
 *
 * It sits in its own module rather than in NutrientResolver or FoodDictionary
 * because both of those import each other's neighbourhood: FoodDictionary needs
 * the score for search, NutrientResolver needs it for matching, and
 * NutrientResolver already imports FoodDictionary. Anything holding the scorer
 * that also imports either one would close a cycle. This file imports nothing.
 */

/**
 * Token-set similarity. Chosen over edit distance because food names are
 * multi-word and word ORDER varies freely ("boiled egg" / "egg, boiled"), while
 * a single wrong word matters a lot ("egg white" ≠ "egg"). Overlap is weighted
 * toward covering the QUERY's tokens, then penalised for extra tokens in the
 * candidate, so "egg" prefers "egg" over "egg noodles".
 *
 * Both arguments must already be normalised (see `normalizeForMatch`).
 */
export function similarity(query: string, candidate: string): number {
  if (query === candidate) return 1;

  const qTokens = query.split(" ").filter(Boolean);
  const cTokens = candidate.split(" ").filter(Boolean);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  const cSet = new Set(cTokens);
  let hits = 0;
  for (const t of qTokens) {
    if (cSet.has(t)) hits += 1;
    // Partial credit for a prefix match ("choc" → "chocolate").
    else if (cTokens.some((c) => c.startsWith(t) || t.startsWith(c))) hits += 0.6;
  }

  const coverage = hits / qTokens.length;
  // Penalise candidates carrying words the query never mentioned.
  const extra = Math.max(0, cTokens.length - qTokens.length);
  const precision = cTokens.length / (cTokens.length + extra * 0.5);

  return coverage * 0.75 + coverage * precision * 0.25;
}

/**
 * Minimum similarity before a fuzzy hit is claimed as a MATCH — i.e. before the
 * app is willing to state nutrition facts about it. Deliberately strict.
 */
export const MATCH_THRESHOLD = 0.62;

/**
 * Minimum similarity for a fuzzy hit to be SHOWN in a search result list. Looser
 * than MATCH_THRESHOLD on purpose: offering a near-miss the user can look at and
 * reject costs nothing, whereas silently asserting its macros would not.
 */
export const SUGGEST_THRESHOLD = 0.34;
