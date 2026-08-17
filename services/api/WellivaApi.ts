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

async function post<T>(
  path: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
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
        const j = (await res.json()) as { error?: { message?: string } };
        if (j?.error?.message) message = j.error.message;
      } catch {
        // non-JSON error body — keep the status message
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
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
    let frame: CoachTurnFrame;
    try {
      frame = JSON.parse(trimmed) as CoachTurnFrame;
    } catch {
      return; // a partial or malformed line is not worth failing the turn over
    }
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
    onDelta?: (text: string) => void;
    signal?: AbortSignal;
  }): Promise<CoachTurnResult> {
    const { messages, promptVersion, ...opts } = args;
    return postStream("/v1/coach/turn", { messages, promptVersion }, { ...opts, timeoutMs: 60000 });
  },

  /** Generate one day's AI meal plan tailored to the user. */
  generateDiet(args: {
    bio: UserBio;
    targets: NutritionTargets;
    date: string;
    dietId?: string;
  }): Promise<DietGenerateResponse> {
    return post<DietGenerateResponse>("/v1/diet/generate", args, 30000);
  },

  /** Generate a weekly AI workout plan tailored to the user. */
  generateWorkout(args: {
    bio: UserBio;
    weekStart: string;
  }): Promise<WorkoutGenerateResponse> {
    return post<WorkoutGenerateResponse>("/v1/workout/generate", args, 30000);
  },

  /** Open-ended Gozlin coach reply (grounded by the app's system prompt). */
  coachChat(args: { system?: string; user: string }): Promise<CoachChatResponse> {
    return post<CoachChatResponse>("/v1/coach/chat", args, 20000);
  },

  /**
   * Parse a free-text meal description into structured food items. Returns
   * names and amounts only — never nutrition figures. Short timeout: this sits
   * in front of a user typing, and the local parser is always available as a
   * fallback, so waiting is worse than degrading.
   */
  parseFood(args: { system: string; user: string }): Promise<ParseFoodResponse> {
    return post<ParseFoodResponse>("/v1/nutrition/parse", args, 12000);
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
    return post<FoodLookupResponse>("/v1/nutrition/lookup", args, 20000);
  },
};
