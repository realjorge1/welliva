/**
 * WellivaApi — typed client for the Welliva backend (/backend-welliva).
 *
 * All AI work (diet, workout, coach) runs server-side on Claude Haiku. These
 * methods return shapes that drop straight into the app's existing models.
 *
 * Every /v1 endpoint requires the signed-in user's Supabase access token, so
 * these calls throw when nobody is signed in. That's intentional and safe:
 * callers (PlanSync, RemoteGozlinProvider) already catch and fall back to the
 * on-device deterministic engines.
 */
import { supabase } from "@/lib/supabase";
// Streaming-capable fetch. RN's global fetch polyfill exposes no `response.body`,
// so this is the only way to render the coach's reply as it arrives.
import { fetch as expoFetch } from "expo/fetch";
import type { DaySchedule } from "@/models/diet";
import type { NutritionTargets } from "@/models/nutrition";
import type { UserBio } from "@/models/user";
import type { GeneratedWorkoutPlan } from "@/models/workout";
import { API_BASE_URL, isApiConfigured } from "./config";
import {
  isApiErrorBody,
  isCoachChatResponse,
  isCoachTurnFrame,
  isDietGenerateResponse,
  isFoodLookupResponse,
  isInsightTrialClaim,
  isMealPhotoResponse,
  isParseFoodResponse,
  isWorkoutGenerateResponse,
  type InsightTrialClaim,
} from "./contracts";
import { warmBackend } from "./warmup";

export interface DietGenerateResponse {
  schedule: DaySchedule;
  dailyNutritionEstimate: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  dietName: string;
  rationale: string;
  coachNote: string;
  model: string;
  source: "ai";
}

export interface WorkoutGenerateResponse {
  plan: GeneratedWorkoutPlan;
  rationale: string;
  coachNote: string;
  model: string;
  source: "ai";
}

export interface CoachChatResponse {
  reply: string;
  model: string;
}

/**
 * Food-parse response. Note the shape: quantity, unit and food name — and
 * deliberately NO nutrition fields. The model is used as a parser only; the
 * numbers are resolved on-device from the cited reference table. See
 * services/gozlin/GozlinFoodAnalyst.ts for why this boundary matters.
 */
export interface ParseFoodResponse {
  items: { quantity: number; unit: string; food: string }[];
  model: string;
}

/**
 * Meal-photo response — what the vision model SAW, never what it thinks the
 * numbers are.
 *
 * The shape is deliberately `ParseFoodResponse` plus a slot: quantity, unit and
 * food name, and no nutrition fields at all. A photo is a harder parse than a
 * sentence, not a different KIND of parse, so it lands on the same rung of the
 * same ladder — the model identifies and portions, the device resolves the
 * numbers from the USDA / FAO reference tables, and anything unmatched is shown
 * as unidentified rather than estimated (see GozlinFoodAnalyst.ts).
 *
 * Letting a vision model return calories directly would be the easiest possible
 * way to put invented numbers into someone's daily total, and it would be
 * invisible: a plausible number looks exactly like a measured one once summed.
 * So the endpoint is contractually forbidden from sending them, and the client
 * has nowhere to put them if it did.
 */
export interface MealPhotoResponse {
  /** Foods the model identified, with its best portion estimate. */
  items: { quantity: number; unit: string; food: string }[];
  /** Which meal it looks like, when the model can tell. */
  slot?: "breakfast" | "lunch" | "dinner" | "snack";
  /** Optional one-line remark, shown above the parsed text. */
  note?: string;
  model: string;
}

/**
 * One candidate food from the lookup ladder.
 *
 * `origin` is the contract's most important field: it tells the app whether the
 * numbers were MEASURED by a food composition body or ESTIMATED by a model, and
 * the app labels them differently for the rest of their life. The server must
 * never report `usda` for a figure a model produced.
 */
export interface FoodLookupResult {
  /** Display name, as the source calls it. */
  name: string;
  /** Household serving the numbers describe, e.g. "1 cup", "100 g". */
  serving: string;
  /** What that serving weighs. Null when genuinely unknown. */
  servingGrams: number | null;
  /** One of the app's display groups; the server maps onto our list. */
  group: string;
  /** Nutrition for ONE serving, in the app's NutrientPanel keys/units. */
  nutrients: Record<string, number>;
  /** Per 100 g, when the source has it — lets portions rescale exactly. */
  per100g?: Record<string, number>;
  origin: "usda" | "ai-estimate";
  /** Present iff origin === "usda". Verifiable at fdc.nal.usda.gov. */
  fdcId?: number;
  dataset?: "SR Legacy" | "Foundation" | "FNDDS" | "Branded";
  /** Free text: the brand, or what an estimate reasoned from. */
  description?: string;
  /** Set on estimates so a bad batch can be traced. */
  model?: string;
  /** True when the food is a regional/West-African dish. Drives the NG tag. */
  isRegional?: boolean;
}

export interface FoodLookupResponse {
  results: FoodLookupResult[];
  /** Which rung answered. "none" means neither had it — a legitimate outcome. */
  resolvedBy: "usda" | "ai-estimate" | "none";
}

/**
 * Current access token. `getSession()` refreshes it when it's near expiry, so
 * this is normally enough on its own. Throws when there is no session.
 */
async function accessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Auth session unavailable: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in — AI endpoints require an account");
  return token;
}

/**
 * The server answered, but not with the shape this client was written against.
 *
 * A distinct type on purpose. Every caller already degrades to an on-device
 * engine on failure, so without this a contract break would be indistinguishable
 * from "the user is on a train" — the app would quietly serve deterministic
 * plans forever and nobody would learn the backend had drifted. Callers that
 * want to tell the two apart can; callers that don't still get their fallback.
 */
export class ContractViolationError extends Error {
  readonly endpoint: string;
  /** Top-level keys that DID arrive. Never the values — those carry user data. */
  readonly receivedKeys: string[];

  constructor(endpoint: string, received: unknown) {
    const keys =
      received && typeof received === "object" && !Array.isArray(received)
        ? Object.keys(received as Record<string, unknown>)
        : [];
    super(
      `${endpoint} returned a payload this build does not recognise` +
        (keys.length ? ` (keys: ${keys.join(", ")})` : ""),
    );
    this.name = "ContractViolationError";
    this.endpoint = endpoint;
    this.receivedKeys = keys;
  }
}

async function send(
  path: string,
  body: unknown,
  token: string,
  signal: AbortSignal,
): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  return res;
}

/**
 * Default request timeout.
 *
 * This was 30s, which collided with the backend's 30-50s cold start: the first
 * call of a session timed out almost exactly when the instance finished waking.
 * The primary fix is warming on foreground (services/api/warmup.ts) plus an
 * always-on tier; this ceiling is the backstop for the case where a user beats
 * the warm-up into the coach.
 *
 * 60s is only defensible because every caller degrades to a deterministic
 * on-device engine and none of them blocks a screen on this promise. Do NOT
 * raise it for a path that leaves a user watching a silent spinner — a fast
 * failure with a fallback beats a long indeterminate wait.
 */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * POST, then CHECK.
 *
 * `validate` is the runtime half of services/api/contracts.ts, and it is not
 * optional in practice — every method below passes one. It runs on the parsed
 * body before the value is handed back, so a server that renamed a field fails
 * HERE, once, with the endpoint named, instead of surfacing as an `undefined`
 * three layers away in front of a user.
 *
 * Rejecting rather than repairing is the deliberate choice (see contracts.ts):
 * a payload we don't recognise is a change of behaviour somebody needs to know
 * about, and every caller of this function already falls back to an on-device
 * engine, so the cost of being strict is a degraded feature rather than a
 * broken screen.
 */
async function post<T>(
  path: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  validate?: (v: unknown) => v is T,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Cheap when already warm (memoized + TTL'd); on a cold instance this is
    // what turns a guaranteed timeout into a slow success.
    void warmBackend();
    let res = await send(path, body, await accessToken(), controller.signal);

    // A 401 after a long backgrounding usually means the cached token aged out
    // between getSession() and arrival. Force one refresh and retry once.
    if (res.status === 401) {
      const { data, error } = await supabase.auth.refreshSession();
      const refreshed = data.session?.access_token;
      if (!error && refreshed) {
        res = await send(path, body, refreshed, controller.signal);
      }
    }

    if (!res.ok) {
      let message = `API error ${res.status}`;
      try {
        // The envelope is pinned too: a server that flattened `{error:{message}}`
        // to `{message}` would silently replace every actionable error with a
        // bare status code, and nothing would notice. isApiErrorBody notices.
        const j: unknown = await res.json();
        if (isApiErrorBody(j)) message = j.error.message;
      } catch {
        // non-JSON error body — keep the status message
      }
      throw new Error(message);
    }

    const parsed: unknown = await res.json();
    if (validate && !validate(parsed)) throw new ContractViolationError(path, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Streaming: the Gozlin agent turn ───────────────────────────────

/**
 * One frame of the NDJSON coach-turn stream. `done` carries the FULL content
 * array (text + thinking + tool_use blocks), because the agent loop has to echo
 * those back verbatim on its next iteration.
 */
type CoachTurnFrame =
  | { type: "delta"; text: string }
  | {
      type: "done";
      content: unknown[];
      stop_reason: string | null;
      model?: string;
      usage?: Record<string, number>;
    }
  | { type: "error"; message: string };

export interface CoachTurnResult {
  content: unknown[];
  stop_reason: string | null;
  model?: string;
  usage?: Record<string, number>;
}

/**
 * POST + consume an NDJSON stream.
 *
 * `expo/fetch` is used rather than the global fetch because React Native's
 * whatwg-fetch polyfill has no `response.body` — without it there is no way to
 * read bytes as they arrive, and the whole turn would land in one lump after
 * several seconds of dead air. If a runtime still hands back a body-less
 * response we degrade to buffering the whole payload rather than failing.
 */
async function postStream(
  path: string,
  body: unknown,
  opts: { onDelta?: (text: string) => void; signal?: AbortSignal; timeoutMs?: number },
): Promise<CoachTurnResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);

  let done: CoachTurnResult | null = null;
  let failure: string | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return; // a partial or malformed line is not worth failing the turn over
    }
    /*
     * A frame that fails the contract is DROPPED, not thrown on — the opposite
     * of post()'s rule, and deliberately so. This is a stream: a single bad line
     * mid-turn is the same class of event as the truncated JSON above, and
     * killing a reply the user is already reading would be worse than ignoring
     * one frame. The failure still surfaces, because a dropped `done` leaves
     * `done` null and the turn ends with "stream ended without a result".
     */
    if (!isCoachTurnFrame(parsed)) return;
    // Widened back to the local type: contracts' frame omits the optional
    // `model`/`usage` the agent loop reads off `done`.
    const frame = parsed as CoachTurnFrame;
    if (frame.type === "delta") opts.onDelta?.(frame.text);
    else if (frame.type === "done") done = frame;
    else if (frame.type === "error") failure = frame.message;
  };

  try {
    const token = await accessToken();
    const res = await expoFetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          handleLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      handleLine(buffer);
    } else {
      // No streaming support in this runtime — still correct, just not live.
      for (const line of (await res.text()).split("\n")) handleLine(line);
    }

    if (failure) throw new Error(failure);
    if (!done) throw new Error("Coach stream ended without a result");
    return done;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

export const WellivaApi = {
  /** Whether a backend URL is configured (EXPO_PUBLIC_API_URL). */
  isConfigured: isApiConfigured,

  /**
   * One turn of the Gozlin agent loop. The loop lives on the device
   * (services/gozlin/agent) — this only carries messages up and streams the
   * model's reply back down.
   *
   * Timeout is generous because a turn legitimately includes thinking plus
   * possibly several tool rounds; the caller aborts via `signal` when the user
   * leaves the screen.
   */
  coachTurn(args: {
    messages: unknown[];
    promptVersion?: string;
    /**
     * Turn kind, for a server that wants to vary `max_tokens` by surface —
     * "deep-dive" asks for a long-form research answer rather than a coach
     * reply. Forward-compatible: a backend that does not know the field
     * ignores it and answers normally.
     */
    mode?: string;
    onDelta?: (text: string) => void;
    signal?: AbortSignal;
  }): Promise<CoachTurnResult> {
    const { messages, promptVersion, mode, ...opts } = args;
    return postStream(
      "/v1/coach/turn",
      { messages, promptVersion, mode },
      { ...opts, timeoutMs: 60000 },
    );
  },

  /** Generate one day's AI meal plan tailored to the user. */
  generateDiet(args: {
    bio: UserBio;
    targets: NutritionTargets;
    date: string;
    dietId?: string;
  }): Promise<DietGenerateResponse> {
    return post("/v1/diet/generate", args, 30000, isDietGenerateResponse);
  },

  /** Generate a weekly AI workout plan tailored to the user. */
  generateWorkout(args: {
    bio: UserBio;
    weekStart: string;
  }): Promise<WorkoutGenerateResponse> {
    return post("/v1/workout/generate", args, 30000, isWorkoutGenerateResponse);
  },

  /** Open-ended Gozlin coach reply (grounded by the app's system prompt). */
  coachChat(args: { system?: string; user: string }): Promise<CoachChatResponse> {
    return post("/v1/coach/chat", args, 20000, isCoachChatResponse);
  },

  /**
   * Parse a free-text meal description into structured food items. Returns
   * names and amounts only — never nutrition figures. Short timeout: this sits
   * in front of a user typing, and the local parser is always available as a
   * fallback, so waiting is worse than degrading.
   */
  parseFood(args: { system: string; user: string }): Promise<ParseFoodResponse> {
    // isParseFoodResponse enforces the parse-only rule: a payload carrying
    // calories is REJECTED, not stripped. See contracts.ts.
    return post("/v1/nutrition/parse", args, 12000, isParseFoodResponse);
  },

  /**
   * Claim this account's one insight trial.
   *
   * The server owns the decision: it records the claim against the Supabase user
   * id, returns the window it will itself enforce, and returns that same window
   * (with `alreadyClaimed: true`) on every later call — including after it has
   * expired. That makes the trial once per account rather than once per install,
   * and makes it impossible for the app to believe someone is on Pro while the
   * backend meters them as free.
   *
   * Short timeout and no retry: this sits behind a card the user is already
   * reading, and services/billing/trial.ts degrades to a local grant on any
   * failure — including the 404 it will get until the endpoint is deployed.
   */
  claimInsightTrial(): Promise<InsightTrialClaim> {
    return post("/v1/billing/trial/claim", {}, 8000, isInsightTrialClaim);
  },

  /**
   * Identify the foods in a meal photo.
   *
   * Sends base64 image bytes and gets back names + portions — see
   * {@link MealPhotoResponse} for why it must never return nutrition figures.
   * The caller turns those into the same free-text line a user would have typed
   * and runs it through the existing analyzer, so a photo log and a typed log
   * are the same entry, with the same confidence rungs and the same per-item
   * corrections.
   *
   * 25s: a vision call is legitimately slower than a text parse, and the user is
   * watching a progress state they asked for. Past that the honest move is to
   * fail and let them type it — which is one tap away on the same screen.
   */
  describeMealPhoto(args: {
    /** Raw base64 (no `data:` prefix), as the image picker returns it. */
    imageBase64: string;
    /** e.g. "image/jpeg" — lets the server build the right media block. */
    mimeType: string;
    /** The user's region, so a local dish resolves the way they mean it. */
    region?: string;
  }): Promise<MealPhotoResponse> {
    // Same parse-only rule as /v1/nutrition/parse — a vision model returning
    // calories is the exact regression this guard exists to make loud.
    return post("/v1/log/photo", args, 25000, isMealPhotoResponse);
  },

  /**
   * Look up a food our catalogs don't have.
   *
   * Note how this DIFFERS from `parseFood`, which is forbidden from returning
   * numbers. This endpoint is allowed to, because its first rung is USDA
   * FoodData Central — a measured source with a verifiable id — and anything it
   * returns from the model instead is tagged `ai-estimate` and carried on the
   * app's weakest confidence rung all the way through to the daily total.
   *
   * The caller must have already missed locally: this is the expensive rung and
   * it never runs for a food we already have (see FoodLookupService).
   *
   * 20s: a USDA round-trip plus a possible model fallback is legitimately
   * slower than a parse, and the user is looking at a progress state they asked
   * for rather than waiting mid-typing.
   */
  lookupFood(args: {
    query: string;
    /** The user's region, so "swallow" or "pap" resolves the way they mean. */
    region?: string;
  }): Promise<FoodLookupResponse> {
    return post("/v1/nutrition/lookup", args, 20000, isFoodLookupResponse);
  },
};
