/**
 * FITNESS PROFILE STORE — persistence for the module's own preference state.
 *
 * Owns exactly one AsyncStorage key. Body data (weight, injuries, equipment,
 * level) intentionally lives in UserBio via AppContext — the app's single
 * source of truth — so this store never duplicates it.
 *
 * All functions are storage-safe: failures degrade to defaults and never
 * throw into the UI.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  EffortMemory,
  FitnessProfile,
  RecommendationMemory,
  ReminderPrefs,
} from "../types";

/** A partial update; reminders may themselves be partial (deep-merged). */
export type FitnessProfilePatch = Partial<Omit<FitnessProfile, "reminders">> & {
  reminders?: Partial<ReminderPrefs>;
};

export const FITNESS_PROFILE_KEY = "@welliva_fitness_profile";

/** How many recommendation outcomes to remember for adaptation. */
const REC_MEMORY_LIMIT = 21;

/** How many "how did that feel" answers to keep. */
const EFFORT_MEMORY_LIMIT = 30;

/* ─────────────── in-process change feed (keeps screens in sync) ───────────────
 * The dashboard, library and settings each hold a copy of the profile; saving
 * from any of them notifies the others so favorites/toggles never go stale.
 */
type ProfileListener = (profile: FitnessProfile) => void;
const listeners = new Set<ProfileListener>();

export function subscribeFitnessProfile(listener: ProfileListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(profile: FitnessProfile): void {
  for (const l of listeners) {
    try {
      l(profile);
    } catch {
      // a broken listener must never block persistence
    }
  }
}

export function createDefaultProfile(now: Date = new Date()): FitnessProfile {
  const iso = now.toISOString();
  return {
    version: 1,
    createdAt: iso,
    updatedAt: iso,
    setupComplete: false,
    goals: [],
    location: "anywhere",
    typicalDurationMin: 20,
    preferredStyles: [],
    daysAvailable: [0, 2, 4], // Mon / Wed / Fri — a sane starting rhythm
    musicEnabled: true,
    musicVolume: 0.8,
    voiceGuidance: false,
    reminders: {
      workouts: false,
      hydration: false,
      stretch: false,
      weeklySummary: false,
      hour: 17,
    },
    favorites: [],
    recommendationHistory: [],
    effortHistory: [],
  };
}

/** Merge stored JSON over defaults so new fields are always present. */
function hydrate(raw: string | null): FitnessProfile {
  const base = createDefaultProfile();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<FitnessProfile>;
    return {
      ...base,
      ...parsed,
      reminders: { ...base.reminders, ...(parsed.reminders ?? {}) },
      version: 1,
    };
  } catch {
    return base;
  }
}

export async function loadFitnessProfile(): Promise<FitnessProfile> {
  try {
    return hydrate(await AsyncStorage.getItem(FITNESS_PROFILE_KEY));
  } catch {
    return createDefaultProfile();
  }
}

export async function saveFitnessProfile(profile: FitnessProfile): Promise<void> {
  try {
    const next = { ...profile, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(FITNESS_PROFILE_KEY, JSON.stringify(next));
    emit(next);
  } catch (e) {
    console.error("FitnessProfileStore.save:", e);
  }
}

export async function updateFitnessProfile(
  patch: FitnessProfilePatch,
): Promise<FitnessProfile> {
  const current = await loadFitnessProfile();
  const next: FitnessProfile = {
    ...current,
    ...patch,
    reminders: { ...current.reminders, ...(patch.reminders ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  await saveFitnessProfile(next);
  return next;
}

/* ───────────────────────── evolving signals ───────────────────────── */

export function toggleFavorite(profile: FitnessProfile, workoutId: string): FitnessProfile {
  const favorites = profile.favorites.includes(workoutId)
    ? profile.favorites.filter((id) => id !== workoutId)
    : [...profile.favorites, workoutId];
  return { ...profile, favorites };
}

/**
 * Record today's recommendation outcome (idempotent per date+workout).
 * Completion flips the existing entry rather than duplicating it.
 */
export function rememberRecommendation(
  profile: FitnessProfile,
  memory: RecommendationMemory,
): FitnessProfile {
  const rest = profile.recommendationHistory.filter(
    (m) => !(m.date === memory.date && m.workoutId === memory.workoutId),
  );
  const history = [...rest, memory]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-REC_MEMORY_LIMIT);
  return { ...profile, recommendationHistory: history };
}

/**
 * Bank how a finished session felt.
 *
 * Appended rather than deduped by date: two sessions in one day are two honest
 * data points, and the engine reads the RUN of recent answers, not one of them.
 */
export async function rememberSessionEffort(
  memory: EffortMemory,
): Promise<FitnessProfile> {
  const current = await loadFitnessProfile();
  const effortHistory = [...current.effortHistory, memory].slice(-EFFORT_MEMORY_LIMIT);
  return updateFitnessProfile({ effortHistory });
}

/* ─────────────────────────── data safety ─────────────────────────── */

/**
 * Reset only the adaptive signals (recommendation memory + favorites stay a
 * user choice, so they're separate flags). Powers "Reset recommendations".
 */
export async function resetRecommendationMemory(): Promise<FitnessProfile> {
  return updateFitnessProfile({ recommendationHistory: [] });
}

/** Wipe the whole fitness profile back to first-run defaults. */
export async function clearFitnessProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FITNESS_PROFILE_KEY);
  } catch (e) {
    console.error("FitnessProfileStore.clear:", e);
  }
}

/**
 * Assemble a portable JSON export of the user's fitness data. The workout
 * log + session history are passed in (they live in AppContext) so this
 * module stays read-only over app state.
 */
export function buildFitnessExport(input: {
  profile: FitnessProfile;
  workoutLog: unknown[];
  sessionHistory: unknown[];
}): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "Welliva",
      kind: "fitness-data-export",
      version: 1,
      profile: input.profile,
      workoutLog: input.workoutLog,
      sessionHistory: input.sessionHistory,
    },
    null,
    2,
  );
}
