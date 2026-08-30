/**
 * OPEN FOOD FACTS — the packaged-food rung of the lookup ladder.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The catalogs are 205 curated whole foods and the reference table is measured
 * entries. Between them they describe an ingredient extremely well and a
 * *product* not at all. Nobody eats "oats, rolled, dry" — they eat a specific
 * box with a specific panel printed on the side, and the number on that panel
 * is the number they want logged. USDA can't answer that; the barcode can.
 *
 * Open Food Facts is the right source for it: free, keyless, open-licensed
 * (ODbL), and organised around exactly the identifier a camera can read. There
 * is no API key to leak and no per-call cost, so unlike the USDA/AI rung this
 * one does not have to be rationed — it only has to be honest.
 *
 * ── WHAT KIND OF NUMBER THIS IS ─────────────────────────────────────────────
 * A declared label. Not a laboratory assay, and not a model's guess — the third
 * thing. A manufacturer is legally accountable for the panel it prints, which
 * makes these figures a MEASUREMENT and puts them above `ai-estimate` without
 * argument. But the transcription from package to database is done by
 * volunteers, which is a real failure mode USDA doesn't have, and it is the
 * exact failure mode that makes MyFitnessPal's crowd database untrustworthy.
 *
 * So this module does two things the rest of the ladder doesn't need to:
 *
 *   1. It carries `kind: "branded"` — "declared label", already in the source
 *      union — never `usda`. Nothing here can be promoted to a lab measurement.
 *   2. It runs a PLAUSIBILITY GATE before it will assert anything (see
 *      {@link isPlausiblePer100g}). A transcription slip that puts a decimal in
 *      the wrong place is the characteristic crowd-data error, and it is
 *      trivially detectable: 100 g of food cannot hold 400 g of fat or 5,000
 *      kcal. A value that fails physics is dropped rather than shown, because a
 *      wrong number the user believes is worse than a missing one they notice.
 *
 * ── UNITS ───────────────────────────────────────────────────────────────────
 * Open Food Facts normalises every `_100g` field to the nutrient's SI base
 * unit — grams — so a product with 32 mg of vitamin C stores `0.032`. The app's
 * `NutrientPanel` is in label units (mg for minerals, mcg for the vitamins the
 * FDA prints in mcg). {@link OFF_NUTRIENTS} is that conversion, per nutrient,
 * written out rather than inferred, because a silent factor-of-1000 error here
 * would produce numbers that look completely normal on a screen.
 *
 * Two fields are deliberately NOT mapped:
 *   • `alcohol_100g` is percent by volume, not grams. Converting needs a
 *     density assumption; the app's `alcohol` key is grams. Skipped rather than
 *     guessed.
 *   • `water_100g` is not a field Open Food Facts populates for packaged goods.
 *
 * ── OFFLINE, AND FAILING WELL ───────────────────────────────────────────────
 * Every failure returns a typed outcome instead of throwing, mirroring
 * MealPhotoCapture: the scanner has to be able to say WHICH thing went wrong,
 * because "not in the database" (add it yourself) and "you're offline" (try
 * again later) are completely different sentences to show someone standing in a
 * supermarket aisle.
 */

import {
  NUTRIENT_META,
  type NutrientConfidence,
  type NutrientKey,
  type NutrientPanel,
  type NutrientSource,
} from "../../models/nutrients";
import type { AddCustomFoodInput } from "./CustomFoodService";

// ============================================================================
// BARCODES
// ============================================================================

/**
 * Symbologies worth accepting, and why the list is closed.
 *
 * These are the GS1 numeric formats Open Food Facts is keyed on. A QR code or a
 * Code-128 shipping label scans perfectly well and means nothing here, so the
 * scanner asks the camera for only these and this function rejects the rest —
 * a lookup that was never going to match should fail instantly and locally
 * rather than after a network round trip.
 */
const BARCODE_LENGTHS = new Set([8, 12, 13, 14]);

/**
 * Strip anything that isn't a digit.
 *
 * Scanners and hand-typed entry both produce stray spaces and hyphens; a UPC-A
 * printed on a US package is routinely written `0 12345 67890 5`.
 */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D+/g, "");
}

/**
 * GS1 check-digit validation.
 *
 * Worth doing on device: the last digit of every EAN/UPC is a checksum over the
 * others, so a misread is detectable without asking anyone. Roughly nine out of
 * ten single-digit transposition errors fail this, which turns "we couldn't
 * find that product" (wrong, and the user blames the database) into "that scan
 * didn't read cleanly, try again" (right, and actionable).
 *
 * The algorithm is the same for all four lengths: weight digits 3 and 1
 * alternately from the right, sum, and the check digit is what completes the
 * next multiple of ten.
 */
export function isValidBarcode(raw: string): boolean {
  const code = normalizeBarcode(raw);
  if (!BARCODE_LENGTHS.has(code.length)) return false;

  const digits = [...code].map((d) => Number(d));
  const check = digits.pop()!;
  let sum = 0;
  // Rightmost body digit carries weight 3, then alternating.
  for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10 === check;
}

// ============================================================================
// THE NUTRIENT MAP
// ============================================================================

interface OffNutrient {
  /** Open Food Facts base key, before the `_100g` suffix. */
  off: string;
  /** Multiply the OFF value (grams, or kcal for energy) by this. */
  factor: number;
}

/**
 * Open Food Facts key → app nutrient key, with the unit conversion.
 *
 * `factor: 1000` is grams → milligrams; `1e6` is grams → micrograms. Every one
 * of these was checked against `NUTRIENT_META`'s declared unit for the same key;
 * the test suite pins each factor so a future edit can't quietly change one.
 */
export const OFF_NUTRIENTS: Partial<Record<NutrientKey, OffNutrient>> = {
  fat: { off: "fat", factor: 1 },
  satFat: { off: "saturated-fat", factor: 1 },
  transFat: { off: "trans-fat", factor: 1 },
  monoFat: { off: "monounsaturated-fat", factor: 1 },
  polyFat: { off: "polyunsaturated-fat", factor: 1 },
  carbs: { off: "carbohydrates", factor: 1 },
  fiber: { off: "fiber", factor: 1 },
  sugar: { off: "sugars", factor: 1 },
  addedSugar: { off: "added-sugars", factor: 1 },
  protein: { off: "proteins", factor: 1 },

  // Grams → milligrams.
  cholesterol: { off: "cholesterol", factor: 1000 },
  sodium: { off: "sodium", factor: 1000 },
  calcium: { off: "calcium", factor: 1000 },
  iron: { off: "iron", factor: 1000 },
  potassium: { off: "potassium", factor: 1000 },
  magnesium: { off: "magnesium", factor: 1000 },
  zinc: { off: "zinc", factor: 1000 },
  vitaminC: { off: "vitamin-c", factor: 1000 },
  vitaminE: { off: "vitamin-e", factor: 1000 },
  vitaminB6: { off: "vitamin-b6", factor: 1000 },
  thiamin: { off: "vitamin-b1", factor: 1000 },
  riboflavin: { off: "vitamin-b2", factor: 1000 },
  niacin: { off: "vitamin-pp", factor: 1000 },
  caffeine: { off: "caffeine", factor: 1000 },

  // Grams → micrograms.
  vitaminD: { off: "vitamin-d", factor: 1e6 },
  vitaminA: { off: "vitamin-a", factor: 1e6 },
  vitaminK: { off: "vitamin-k", factor: 1e6 },
  vitaminB12: { off: "vitamin-b12", factor: 1e6 },
  folate: { off: "vitamin-b9", factor: 1e6 },
};

/**
 * Physical ceilings per 100 g, used to reject transcription slips.
 *
 * These are not "unlikely" values, they are impossible ones. 100 g of anything
 * contains at most 100 g of fat; the most energy-dense food possible is pure fat
 * at 884 kcal, so 1,000 is a ceiling with room to spare rather than a judgement
 * about what people eat. Sodium's is the one soft entry: pure table salt is
 * ~38,700 mg of sodium per 100 g, which no product is, but a seasoning packet
 * can legitimately be close.
 */
const PER_100G_CEILING: Partial<Record<NutrientKey, number>> = {
  calories: 1000,
  fat: 100,
  satFat: 100,
  transFat: 100,
  carbs: 100,
  fiber: 100,
  sugar: 100,
  addedSugar: 100,
  protein: 100,
  sodium: 40000,
};

/** True when a per-100 g value is physically possible for that nutrient. */
export function isPlausiblePer100g(key: NutrientKey, value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  const ceiling = PER_100G_CEILING[key];
  return ceiling === undefined || value <= ceiling;
}

// ============================================================================
// THE PRODUCT SHAPE
// ============================================================================

/**
 * The subset of an Open Food Facts product this app reads.
 *
 * Everything is optional because everything genuinely is: OFF products are
 * community-contributed and a brand-new entry may be a barcode, a photo and
 * nothing else. `unknown` for `nutriments` on purpose — its keys are open-ended
 * and the reader below validates each one it wants rather than trusting a type
 * assertion over a payload from the internet.
 */
export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: unknown;
  categories_tags?: unknown;
  countries_tags?: unknown;
}

export interface OffResponse {
  status?: number;
  status_verbose?: string;
  code?: string;
  product?: OffProduct;
}

/** Read one numeric field out of the untyped `nutriments` bag. */
function readNumber(bag: Record<string, unknown>, key: string): number | null {
  const v = bag[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  // OFF occasionally stores numerics as strings on older entries.
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Energy per 100 g in kilocalories.
 *
 * `energy-kcal_100g` when the contributor entered kcal, otherwise the kJ field
 * converted at the thermochemical factor. The bare `energy_100g` field is
 * ambiguous — its unit lives in a sibling key and is frequently absent — so it
 * is only trusted when that sibling says kcal outright. Guessing here would put
 * a 4.184× error into someone's daily total.
 */
function readCalories(bag: Record<string, unknown>): number | null {
  const kcal = readNumber(bag, "energy-kcal_100g");
  if (kcal !== null) return kcal;

  const kj = readNumber(bag, "energy-kj_100g");
  if (kj !== null) return kj / 4.184;

  const unit = bag["energy_unit"];
  const energy = readNumber(bag, "energy_100g");
  if (energy !== null && typeof unit === "string") {
    if (unit.toLowerCase() === "kcal") return energy;
    if (unit.toLowerCase() === "kj") return energy / 4.184;
  }
  return null;
}

/**
 * Build the per-100 g panel from an OFF `nutriments` bag.
 *
 * Anything that fails {@link isPlausiblePer100g} is dropped rather than clamped.
 * Clamping would invent a number; dropping leaves the nutrient genuinely
 * unknown, which the panel already models as "absent" and the UI already renders
 * as a blank rather than a zero.
 */
export function panelFromNutriments(nutriments: unknown): NutrientPanel {
  if (!nutriments || typeof nutriments !== "object") return {};
  const bag = nutriments as Record<string, unknown>;
  const panel: NutrientPanel = {};

  const calories = readCalories(bag);
  if (calories !== null && isPlausiblePer100g("calories", calories)) {
    panel.calories = calories;
  }

  for (const [appKey, spec] of Object.entries(OFF_NUTRIENTS) as [
    NutrientKey,
    OffNutrient,
  ][]) {
    const raw = readNumber(bag, `${spec.off}_100g`);
    if (raw === null) continue;
    const value = raw * spec.factor;
    if (!isPlausiblePer100g(appKey, value)) continue;
    panel[appKey] = value;
  }

  /*
   * Salt → sodium, only when sodium itself is missing.
   *
   * European labels print salt; US labels print sodium. OFF usually derives one
   * from the other, but not always, and a European product with no sodium key
   * would otherwise lose the single most clinically important number in this
   * app — the renal and hypertension diets are built on it. The ratio is the
   * standard 2.5 (sodium chloride is 39.3% sodium by mass).
   */
  if (panel.sodium === undefined) {
    const salt = readNumber(bag, "salt_100g");
    if (salt !== null) {
      const sodiumMg = (salt / 2.5) * 1000;
      if (isPlausiblePer100g("sodium", sodiumMg)) panel.sodium = sodiumMg;
    }
  }

  return panel;
}

/** Scale a per-100 g panel to a serving weight. */
function scalePanel(per100g: NutrientPanel, grams: number): NutrientPanel {
  const factor = grams / 100;
  const out: NutrientPanel = {};
  for (const [k, v] of Object.entries(per100g) as [NutrientKey, number][]) {
    if (!(k in NUTRIENT_META)) continue;
    out[k] = v * factor;
  }
  return out;
}

/** Round a panel to the precision the app displays, so stored ≈ shown. */
function roundPanel(panel: NutrientPanel): NutrientPanel {
  const out: NutrientPanel = {};
  for (const [k, v] of Object.entries(panel) as [NutrientKey, number][]) {
    out[k] = k === "calories" ? Math.round(v) : Math.round(v * 100) / 100;
  }
  return out;
}

/**
 * What one serving weighs, in grams.
 *
 * `serving_quantity` is OFF's parsed gram weight of `serving_size`; it is the
 * only field here that can be trusted numerically, and it is absent on a large
 * minority of products. When it is missing the food is still perfectly usable —
 * the panel is per 100 g and 100 g is a real, honest serving to log — but the
 * portion was chosen by us, not read off the package, and that is exactly what
 * the `portion-estimated` rung means.
 */
function readServingGrams(product: OffProduct): number | null {
  const raw = product.serving_quantity;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  // A "serving" over a kilo is a pack size mis-parsed as a portion.
  if (n > 2000) return null;
  return n;
}

/** Display name: the product, qualified by its brand when there is one. */
function readName(product: OffProduct): string {
  const name = (product.product_name_en || product.product_name || product.generic_name || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name) return "";
  const brand = (product.brands ?? "").split(",")[0]?.trim();
  if (!brand) return name;
  // Don't repeat a brand the product name already carries ("Nutella" by Ferrero).
  if (name.toLowerCase().includes(brand.toLowerCase())) return name;
  return `${name} (${brand})`;
}

/**
 * How complete the declared panel looks.
 *
 * A lawful nutrition label always declares energy, fat, carbohydrate and
 * protein. An OFF entry missing two or more of those was transcribed partially —
 * someone scanned the barcode and typed in the calories. The numbers present are
 * probably right, but asserting `measured` over a visibly half-entered label
 * overstates what we know, so it drops to `macros-only`, which is what it is.
 */
function macroCompleteness(per100g: NutrientPanel): number {
  return (["calories", "fat", "carbs", "protein"] as const).filter(
    (k) => per100g[k] !== undefined,
  ).length;
}

/**
 * A scanned product, ready to preview and save — or null if it can't be trusted.
 *
 * Pure: no network, no storage, no clock. Everything that decides whether a
 * number reaches a user's daily total is decided here, which is why this is the
 * function the tests hammer.
 */
export function candidateFromProduct(
  product: OffProduct,
  barcode: string,
): (AddCustomFoodInput & { key: string; barcode: string }) | null {
  const name = readName(product);
  if (!name) return null;

  const per100g = roundPanel(panelFromNutriments(product.nutriments));
  // No energy figure means no loggable food. Everything downstream — targets,
  // rings, the day's total — is denominated in calories.
  if (per100g.calories === undefined) return null;

  const servingGrams = readServingGrams(product);
  const grams = servingGrams ?? 100;
  const nutrients = roundPanel(scalePanel(per100g, grams));

  const completeness = macroCompleteness(per100g);
  const confidence: NutrientConfidence =
    completeness < 3
      ? "macros-only"
      : servingGrams !== null
        ? "measured"
        : "portion-estimated";

  const brand = (product.brands ?? "").split(",")[0]?.trim();
  const source: NutrientSource = {
    kind: "branded",
    brand: brand || "Open Food Facts",
    description: `Declared label · Open Food Facts ${barcode}`,
  };

  const servingLabel =
    product.serving_size?.trim() ||
    (servingGrams !== null ? `${servingGrams} g` : "100 g");

  return {
    key: `off_${barcode}`,
    barcode,
    name,
    serving: servingLabel,
    servingGrams,
    group: OFF_GROUP,
    nutrients,
    ...(Object.keys(per100g).length > 0 ? { per100g } : {}),
    source,
    confidence,
    query: barcode,
  };
}

/**
 * Packaged products land in the user's own list, not a whole-food group.
 *
 * The catalog's groups are ingredient categories ("Vegetables", "Grains &
 * Starches"); a protein bar belongs to none of them and filing it under one
 * would make the whole-food browse view wrong. `CUSTOM_FOOD_GROUP` always
 * renders, so nothing becomes unreachable.
 */
const OFF_GROUP = "Your foods";

// ============================================================================
// THE NETWORK CALL
// ============================================================================

/** Open Food Facts asks every client to identify itself. This is that. */
const USER_AGENT = "Welliva/1.0 (https://welliva.app)";

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";

/**
 * Fields requested explicitly.
 *
 * A full OFF product document is hundreds of kilobytes of ingredient text,
 * images and per-language names. Asking for the dozen fields actually read cuts
 * a supermarket-aisle lookup from seconds to a fraction of one on a slow
 * connection, which is the entire user experience of this feature.
 */
const FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "generic_name",
  "brands",
  "quantity",
  "serving_size",
  "serving_quantity",
  "nutriments",
  "categories_tags",
  "countries_tags",
].join(",");

/** How long to wait before deciding the aisle has no signal. */
const TIMEOUT_MS = 10_000;

export type BarcodeOutcome =
  /** Found, mapped, and safe to show. */
  | { status: "ok"; candidate: AddCustomFoodInput & { key: string; barcode: string } }
  /** The code isn't a valid EAN/UPC — a misread, or a non-food symbology. */
  | { status: "invalid" }
  /** Open Food Facts has no entry for this barcode. A legitimate answer. */
  | { status: "not-found" }
  /**
   * The product exists but has no usable nutrition — no name, or no energy
   * figure. Distinct from `not-found` because the user's next move differs:
   * there is nothing to wait for, they should enter it by hand.
   */
  | { status: "no-nutrition"; name?: string }
  /** Offline, timed out, or the service is down. Worth retrying. */
  | { status: "failed"; message: string };

/** Injectable for tests; defaults to the platform fetch. */
export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Look a barcode up on Open Food Facts.
 *
 * Never throws. A scanner that crashes on a bad network is worse than one that
 * says "couldn't reach the database" — see the header.
 */
export async function fetchBarcode(
  rawCode: string,
  opts: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<BarcodeOutcome> {
  const code = normalizeBarcode(rawCode);
  if (!isValidBarcode(code)) return { status: "invalid" };

  const doFetch = (opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)) ?? null;
  if (!doFetch) return { status: "failed", message: "No network client available" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);

  try {
    const res = await doFetch(
      `${OFF_BASE}/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: controller.signal,
      },
    );

    // OFF answers a missing product with 404 and a status:0 body. Both mean the
    // same thing and both are ordinary, not errors.
    if (res.status === 404) return { status: "not-found" };
    if (!res.ok) {
      return { status: "failed", message: `Open Food Facts returned ${res.status}` };
    }

    const body = (await res.json()) as OffResponse;
    if (!body || body.status === 0 || !body.product) return { status: "not-found" };

    const candidate = candidateFromProduct(body.product, code);
    if (!candidate) {
      const name = readName(body.product);
      return name ? { status: "no-nutrition", name } : { status: "no-nutrition" };
    }
    return { status: "ok", candidate };
  } catch (e) {
    const message =
      e instanceof Error && e.name === "AbortError"
        ? "The lookup timed out. Check your connection and try again."
        : e instanceof Error
          ? e.message
          : "Lookup failed";
    return { status: "failed", message };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

/** Public product page, so a user can check or correct the entry themselves. */
export function openFoodFactsUrl(barcode: string): string {
  return `https://world.openfoodfacts.org/product/${encodeURIComponent(normalizeBarcode(barcode))}`;
}
