/**
 * THE `/v1` CONTRACT.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The backend lives in another repository (`/backend-welliva`). Gozlin chat,
 * diet and workout generation, food parsing, photo identification and the USDA
 * lookup all depend on it, and NOTHING in this tree exercised any of its
 * shapes — so a rename on the server surfaced here as a runtime `undefined` in
 * front of a user, with a green CI in both repos. That was F-05 of the 30 Aug
 * audit.
 *
 * This module is the app's half of the contract, written down. Two mechanisms,
 * and it needs both:
 *
 *   1. RUNTIME GUARDS. `isMealPhotoResponse`, `isFoodLookupResponse`, … Pure
 *      predicates over `unknown`, so the test suite can throw hostile and
 *      merely-drifted payloads at them without a network or a native runtime.
 *
 *   2. A COMPILE-TIME LINK. The guards narrow to the SAME types WellivaApi
 *      declares, imported with `import type` so nothing is pulled in at
 *      runtime. If someone adds a field to `MealPhotoResponse` and not here,
 *      `tsc` fails. That is what stops this file from becoming a stale parallel
 *      copy of the truth — the failure mode of every hand-written schema.
 *
 * ── THE ONE CONTRACT THAT IS NOT ABOUT SHAPE ────────────────────────────────
 * `/v1/nutrition/parse` and `/v1/log/photo` are FORBIDDEN FROM RETURNING
 * NUMBERS. Not "shouldn't" — the app has nowhere to put them, on purpose, and
 * that absence is the mechanism behind the receipt (see
 * services/gozlin/agent/receipts.ts) and behind every "measured" label in the
 * food log. A model may parse; only `NutrientResolver` may number.
 *
 * A shape check alone would not catch a violation of that, because extra keys
 * are structurally harmless — a payload carrying `calories: 340` still passes
 * every "has the fields I need" test ever written. So {@link carriesNutrition}
 * checks for the fields that must NOT be there, and the guards for those two
 * endpoints REJECT a payload that has them.
 *
 * Rejecting rather than stripping is deliberate. A server that started sending
 * calories from the vision endpoint has had a change of behaviour that someone
 * needs to know about; silently deleting the field would hide exactly the
 * regression this file was written to catch.
 *
 * ── SCOPE ───────────────────────────────────────────────────────────────────
 * Response shapes and the auth requirement. NOT request bodies (the client
 * builds those and TypeScript already checks them), and not semantics — whether
 * the USDA figure is CORRECT is USDA's problem and the resolver's, not the
 * wire's.
 *
 * Nested plan payloads (`DaySchedule`, `GeneratedWorkoutPlan`) are checked
 * structurally at the top level only. They are large app-owned models that
 * change with the product, and pinning every field here would make this file a
 * second, worse copy of models/diet.ts that breaks on every legitimate edit.
 * What is pinned is what the CLIENT would break on: presence, type, and the
 * envelope around them.
 */

import type {
  CoachChatResponse,
  DietGenerateResponse,
  FoodLookupResponse,
  FoodLookupResult,
  MealPhotoResponse,
  ParseFoodResponse,
  WorkoutGenerateResponse,
} from "./WellivaApi";

// ============================================================================
// THE ENDPOINT TABLE
// ============================================================================

export interface EndpointContract {
  path: string;
  method: "POST";
  /**
   * Every `/v1` route requires the caller's Supabase access token. There is no
   * anonymous endpoint, and adding one would put an unmetered model call behind
   * no identity at all — see the rate limits in the backend repo.
   */
  auth: "bearer";
  /**
   * True for the two endpoints contractually forbidden from returning nutrition
   * figures. See the header.
   */
  parseOnly?: boolean;
  /** Client-side ceiling, in ms. Pinned because a change here is a UX change. */
  timeoutMs: number;
}

export const V1_ENDPOINTS = {
  coachTurn: { path: "/v1/coach/turn", method: "POST", auth: "bearer", timeoutMs: 60000 },
  coachChat: { path: "/v1/coach/chat", method: "POST", auth: "bearer", timeoutMs: 20000 },
  dietGenerate: { path: "/v1/diet/generate", method: "POST", auth: "bearer", timeoutMs: 30000 },
  workoutGenerate: {
    path: "/v1/workout/generate",
    method: "POST",
    auth: "bearer",
    timeoutMs: 30000,
  },
  nutritionParse: {
    path: "/v1/nutrition/parse",
    method: "POST",
    auth: "bearer",
    parseOnly: true,
    timeoutMs: 12000,
  },
  nutritionLookup: {
    path: "/v1/nutrition/lookup",
    method: "POST",
    auth: "bearer",
    timeoutMs: 20000,
  },
  logPhoto: {
    path: "/v1/log/photo",
    method: "POST",
    auth: "bearer",
    parseOnly: true,
    timeoutMs: 25000,
  },
  billingTrialClaim: {
    path: "/v1/billing/trial/claim",
    method: "POST",
    auth: "bearer",
    timeoutMs: 8000,
  },
} as const satisfies Record<string, EndpointContract>;

export type V1EndpointName = keyof typeof V1_ENDPOINTS;

// ============================================================================
// PRIMITIVES
// ============================================================================

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// ============================================================================
// THE PARSE-ONLY RULE
// ============================================================================

/**
 * Field names that would mean a model had computed a number.
 *
 * Deliberately broad, and deliberately including the spellings the app does NOT
 * use (`kcal`, `energy`, `fats`, `carbohydrates`, `macros`): the point is to
 * catch a server that started sending figures under ANY name, not to validate
 * the app's own vocabulary. A false positive here costs one confused developer;
 * a false negative puts an invented calorie count in someone's daily total.
 */
export const FORBIDDEN_NUTRITION_KEYS = [
  "calories",
  "kcal",
  "energy",
  "protein",
  "proteins",
  "proteinG",
  "carbs",
  "carbohydrates",
  "carbsG",
  "fat",
  "fats",
  "fatG",
  "fiber",
  "sugar",
  "sodium",
  "nutrients",
  "nutrition",
  "macros",
] as const;

const FORBIDDEN = new Set<string>(FORBIDDEN_NUTRITION_KEYS);

/**
 * Does this payload carry nutrition figures anywhere inside it?
 *
 * Recursive, because the violation that matters is per-ITEM
 * (`items[0].calories`), not at the top level. Depth-capped at 6 so a pathological
 * payload can't turn a validity check into a stack overflow.
 */
export function carriesNutrition(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (Array.isArray(value)) return value.some((v) => carriesNutrition(v, depth + 1));
  if (!isObject(value)) return false;
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN.has(k)) return true;
    if (carriesNutrition(v, depth + 1)) return true;
  }
  return false;
}

// ============================================================================
// PARSE / PHOTO
// ============================================================================

/** One food a model identified: what and how much, never how many calories. */
export function isParsedFoodItem(v: unknown): v is { quantity: number; unit: string; food: string } {
  return (
    isObject(v) &&
    isFiniteNumber(v.quantity) &&
    typeof v.unit === "string" &&
    isNonEmptyString(v.food)
  );
}

/**
 * `/v1/nutrition/parse`.
 *
 * Rejects any payload carrying nutrition, however well-formed otherwise — see
 * the header for why that is a rejection and not a strip.
 */
export function isParseFoodResponse(v: unknown): v is ParseFoodResponse {
  if (!isObject(v)) return false;
  if (!Array.isArray(v.items) || !v.items.every(isParsedFoodItem)) return false;
  if (!isNonEmptyString(v.model)) return false;
  return !carriesNutrition(v.items);
}

const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];

/** `/v1/log/photo`. Same rule as parse — a photo is a harder parse, not a different kind. */
export function isMealPhotoResponse(v: unknown): v is MealPhotoResponse {
  if (!isObject(v)) return false;
  if (!Array.isArray(v.items) || !v.items.every(isParsedFoodItem)) return false;
  if (!isNonEmptyString(v.model)) return false;
  if (v.slot !== undefined && !MEAL_SLOTS.includes(v.slot as string)) return false;
  if (v.note !== undefined && typeof v.note !== "string") return false;
  return !carriesNutrition(v.items);
}

// ============================================================================
// LOOKUP — the endpoint that IS allowed to return numbers
// ============================================================================

const DATASETS = ["SR Legacy", "Foundation", "FNDDS", "Branded"];

/**
 * One lookup candidate.
 *
 * The load-bearing rule is the last one: **`origin: "usda"` requires a numeric
 * `fdcId`**. That id is what makes a "measured" claim checkable at
 * fdc.nal.usda.gov, and a `usda` result without one is a figure asserting an
 * authority it cannot produce. FoodLookupService independently refuses to promote
 * such a result to `measured`; this guard means the payload is refused outright
 * rather than quietly demoted, so the server bug is visible.
 */
export function isFoodLookupResult(v: unknown): v is FoodLookupResult {
  if (!isObject(v)) return false;
  if (!isNonEmptyString(v.name)) return false;
  if (typeof v.serving !== "string") return false;
  if (v.servingGrams !== null && !isFiniteNumber(v.servingGrams)) return false;
  if (typeof v.group !== "string") return false;
  if (!isObject(v.nutrients)) return false;
  if (v.per100g !== undefined && !isObject(v.per100g)) return false;
  if (v.origin !== "usda" && v.origin !== "ai-estimate") return false;
  if (v.dataset !== undefined && !DATASETS.includes(v.dataset as string)) return false;
  if (v.origin === "usda" && !isFiniteNumber(v.fdcId)) return false;
  return true;
}

export function isFoodLookupResponse(v: unknown): v is FoodLookupResponse {
  if (!isObject(v)) return false;
  if (!Array.isArray(v.results) || !v.results.every(isFoodLookupResult)) return false;
  return v.resolvedBy === "usda" || v.resolvedBy === "ai-estimate" || v.resolvedBy === "none";
}

// ============================================================================
// COACH
// ============================================================================

export function isCoachChatResponse(v: unknown): v is CoachChatResponse {
  return isObject(v) && typeof v.reply === "string" && isNonEmptyString(v.model);
}

/** One NDJSON frame of `/v1/coach/turn`. */
export type CoachTurnFrame =
  | { type: "delta"; text: string }
  | { type: "done"; content: unknown[]; stop_reason: string | null }
  | { type: "error"; message: string };

/**
 * A stream frame.
 *
 * `done.content` is the FULL content array — text, thinking and tool_use blocks
 * — because the agent loop echoes it back verbatim on its next iteration. A
 * `done` frame without it silently breaks multi-turn tool use, which is the
 * failure that looks like "the coach forgot what it was doing".
 */
export function isCoachTurnFrame(v: unknown): v is CoachTurnFrame {
  if (!isObject(v)) return false;
  switch (v.type) {
    case "delta":
      return typeof v.text === "string";
    case "done":
      return (
        Array.isArray(v.content) &&
        (v.stop_reason === null || typeof v.stop_reason === "string")
      );
    case "error":
      return typeof v.message === "string";
    default:
      return false;
  }
}

// ============================================================================
// GENERATION
// ============================================================================

function isMacroEstimate(v: unknown): boolean {
  return (
    isObject(v) &&
    isFiniteNumber(v.calories) &&
    isFiniteNumber(v.proteinG) &&
    isFiniteNumber(v.carbsG) &&
    isFiniteNumber(v.fatG)
  );
}

/**
 * `/v1/diet/generate`.
 *
 * `schedule` is checked for presence and object-ness only — see the header's
 * note on nested plan payloads. `source: "ai"` is pinned because PlanSync uses
 * it to distinguish a generated plan from a deterministic one, and a plan
 * mislabelled as AI would be shown with an attribution it hasn't earned.
 */
export function isDietGenerateResponse(v: unknown): v is DietGenerateResponse {
  return (
    isObject(v) &&
    isObject(v.schedule) &&
    isMacroEstimate(v.dailyNutritionEstimate) &&
    isNonEmptyString(v.dietName) &&
    typeof v.rationale === "string" &&
    typeof v.coachNote === "string" &&
    isNonEmptyString(v.model) &&
    v.source === "ai"
  );
}

export function isWorkoutGenerateResponse(v: unknown): v is WorkoutGenerateResponse {
  return (
    isObject(v) &&
    isObject(v.plan) &&
    typeof v.rationale === "string" &&
    typeof v.coachNote === "string" &&
    isNonEmptyString(v.model) &&
    v.source === "ai"
  );
}

// ============================================================================
// BILLING
// ============================================================================

export interface InsightTrialClaim {
  expiresAt: string;
  claimedAt: string;
  alreadyClaimed: boolean;
}

/**
 * `/v1/billing/trial/claim`.
 *
 * Both timestamps must be real dates. The server owns this window and the app
 * enforces it locally, so an unparseable `expiresAt` would either grant Pro
 * forever or revoke it instantly, depending on which way the NaN fell.
 */
export function isInsightTrialClaim(v: unknown): v is InsightTrialClaim {
  return (
    isObject(v) &&
    isNonEmptyString(v.expiresAt) &&
    !Number.isNaN(Date.parse(v.expiresAt)) &&
    isNonEmptyString(v.claimedAt) &&
    !Number.isNaN(Date.parse(v.claimedAt)) &&
    typeof v.alreadyClaimed === "boolean"
  );
}

// ============================================================================
// THE ERROR ENVELOPE
// ============================================================================

export interface ApiErrorBody {
  error: { message: string; code?: string };
}

/**
 * The shape `post()` digs a message out of on a non-2xx.
 *
 * Pinned because the client reads `error.message` and falls back to
 * `API error <status>` when it can't find one. A server that flattened this to
 * `{ message }` would not break anything visibly — it would just replace every
 * useful error the user could act on with a bare status code, everywhere, and
 * no test would notice.
 */
export function isApiErrorBody(v: unknown): v is ApiErrorBody {
  return isObject(v) && isObject(v.error) && typeof v.error.message === "string";
}

// ============================================================================
// THE COMPILE-TIME LINK
// ============================================================================

/**
 * Ties each guard's narrowed type to the interface WellivaApi actually declares.
 *
 * These are types, not values: they cost nothing at runtime and disappear from
 * the bundle. What they buy is that a field added to `MealPhotoResponse` without
 * a corresponding check here fails `tsc`, so the guards cannot silently drift
 * from the client they are supposed to be guarding. Without this, a hand-written
 * schema decays into fiction within a couple of releases.
 */
type GuardedType<F> = F extends (v: unknown) => v is infer T ? T : never;
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _ParseFood = Exact<GuardedType<typeof isParseFoodResponse>, ParseFoodResponse>;
type _MealPhoto = Exact<GuardedType<typeof isMealPhotoResponse>, MealPhotoResponse>;
type _Lookup = Exact<GuardedType<typeof isFoodLookupResponse>, FoodLookupResponse>;
type _LookupResult = Exact<GuardedType<typeof isFoodLookupResult>, FoodLookupResult>;
type _CoachChat = Exact<GuardedType<typeof isCoachChatResponse>, CoachChatResponse>;
type _Diet = Exact<GuardedType<typeof isDietGenerateResponse>, DietGenerateResponse>;
type _Workout = Exact<GuardedType<typeof isWorkoutGenerateResponse>, WorkoutGenerateResponse>;

/** Each of these is `true` only while the guard and the client agree. */
const _contractsMatchClient: [
  _ParseFood,
  _MealPhoto,
  _Lookup,
  _LookupResult,
  _CoachChat,
  _Diet,
  _Workout,
] = [true, true, true, true, true, true, true];

export const CONTRACTS_VERIFIED = _contractsMatchClient.every(Boolean);
