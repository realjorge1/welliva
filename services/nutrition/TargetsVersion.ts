/**
 * TARGETS ALGORITHM VERSION — owning a correction out loud.
 *
 * Two bugs were fixed in how daily targets are computed, and both MOVE existing
 * users' numbers:
 *
 *   · Age was counted twice. Mifflin–St Jeor already contains a `− 5 × age`
 *     term, and the old code multiplied its output by a further 0.85–0.95. A
 *     65-year-old was under-fed by roughly 300 kcal/day. Removing it RAISES
 *     targets for everyone over 30 — by up to ~15% at 61+.
 *   · Protein scaled on total bodyweight. Above BMI 30 that over-prescribes,
 *     because adipose tissue isn't metabolically demanding. Fixing it LOWERS
 *     protein for high-BMI users.
 *
 * A silent recalculation is not acceptable: someone who has been eating to
 * 1,780 kcal opens the app to 2,010 with no explanation and concludes the app is
 * unreliable. So the version is persisted with the numbers it produced, and a
 * mismatch produces a one-time notice that states the old number, the new one,
 * and which was wrong. Users forgive a fixed bug; they don't forgive a number
 * that changed by itself.
 *
 * Bump TARGETS_ALGO_VERSION whenever a change moves existing users' targets, and
 * add a line to `describeChange` for it.
 */
import { readJSON, writeJSON } from "../OfflineStorage";
import type { NutritionTargets } from "../../models/nutrition";
import type { UserBio } from "../../models/user";
import { ACTIVITY_MULTIPLIERS } from "../../models/user";
import { AGE_CALORIE_ADJUSTMENTS } from "../../models/nutrition";

/** Bump on any change that moves an existing user's numbers. */
export const TARGETS_ALGO_VERSION = 2;

/** Syncs with the account, so the notice isn't shown once per device. */
export const TARGETS_ALGO_KEY = "@welliva_targets_algo";

export interface TargetsRecalcNotice {
  fromVersion: number;
  toVersion: number;
  previous: { calories: number; proteinG: number };
  current: { calories: number; proteinG: number };
  /** Ready-to-render copy, in the app's voice. */
  message: string;
}

interface StoredRecord {
  version: number;
  calories: number;
  proteinG: number;
  /** Set when the version moved; cleared once the user has seen the notice. */
  pending?: TargetsRecalcNotice | null;
}

/* ───────────────────── what the old algorithm produced ─────────────────────*/

/**
 * v1's calorie + protein output, reproduced exactly.
 *
 * This exists ONLY so the notice can say "from 1,780" truthfully for users who
 * pre-date the version record. It is frozen history — never fix a bug in here,
 * and never call it for anything but the message.
 */
function legacyTargetsV1(bio: UserBio): { calories: number; proteinG: number } {
  const bmr =
    bio.sex === "male"
      ? 10 * bio.weightKg + 6.25 * bio.heightCm - 5 * bio.age + 5
      : 10 * bio.weightKg + 6.25 * bio.heightCm - 5 * bio.age - 161;

  const ageRange =
    bio.age >= 18 && bio.age <= 30
      ? "18-30"
      : bio.age >= 31 && bio.age <= 50
        ? "31-50"
        : bio.age >= 51 && bio.age <= 60
          ? "51-60"
          : "61+";

  const multiplier = ACTIVITY_MULTIPLIERS[bio.activityLevel] ?? 1.55;
  // The double count: the age table applied on top of Mifflin's own age term.
  const tdee = bmr * multiplier * (AGE_CALORIE_ADJUSTMENTS[ageRange] ?? 1.0);

  const conditions = bio.medicalConditions ?? [];
  const isPregnant = conditions.includes("pregnancy");
  const isPostpartum = conditions.includes("postpartum");
  const goalModifier = GOAL_MODIFIERS_V1[bio.primaryGoal] ?? 0;
  let effective = goalModifier;
  let surplus = 0;
  if (isPregnant) {
    effective = Math.max(0, goalModifier);
    surplus = bio.pregnancyTrimester === 1 ? 70 : bio.pregnancyTrimester === 3 ? 450 : 340;
  } else if (isPostpartum) {
    effective = Math.max(0, goalModifier);
    surplus = 400;
  }

  const min = isPregnant || isPostpartum ? 1800 : bio.sex === "male" ? 1500 : 1200;
  const max = (bio.sex === "male" ? 3200 : 2800) + surplus;
  const calories = Math.round(
    Math.max(min, Math.min(max, tdee + effective + surplus)),
  );

  let proteinMultiplier =
    bio.primaryGoal === "build_muscle" || bio.primaryGoal === "athletic_performance"
      ? 1.6
      : 1.2;
  if (isPregnant || isPostpartum) proteinMultiplier = Math.max(proteinMultiplier, 1.4);
  if (conditions.includes("renal_issues")) {
    proteinMultiplier = Math.min(proteinMultiplier, 0.8);
  }

  return { calories, proteinG: Math.round(bio.weightKg * proteinMultiplier) };
}

/** Frozen copy — the live table may gain goals that v1 never had. */
const GOAL_MODIFIERS_V1: Record<string, number> = {
  lose_weight: -500,
  build_muscle: 300,
  improve_fitness: 0,
  increase_energy: 100,
  better_health: 0,
  athletic_performance: 200,
};

/* ──────────────────────────── the notice itself ────────────────────────────*/

const fmt = (n: number) => Math.round(n).toLocaleString();

function describeChange(
  previous: { calories: number; proteinG: number },
  current: { calories: number; proteinG: number },
): string {
  const parts: string[] = [];

  if (current.calories !== previous.calories) {
    // Name the bug, not just the movement. "We improved our algorithm" is what
    // an app says when it doesn't want to admit the old number was wrong.
    const direction = current.calories > previous.calories ? "was low" : "was high";
    parts.push(
      `I corrected how I account for your age — your daily target moved from ` +
        `${fmt(previous.calories)} to ${fmt(current.calories)} kcal. The old number ${direction}.`,
    );
  }

  if (current.proteinG !== previous.proteinG) {
    parts.push(
      current.proteinG < previous.proteinG
        ? `I also now scale protein on adjusted body weight rather than total ` +
          `weight, which is the clinical standard above BMI 30. Your protein ` +
          `target moved from ${fmt(previous.proteinG)} g to ${fmt(current.proteinG)} g — ` +
          `the old figure asked more of you than the evidence supports.`
        : `Your protein target moved from ${fmt(previous.proteinG)} g to ` +
          `${fmt(current.proteinG)} g alongside the calorie correction.`,
    );
  }

  return parts.join("\n\n");
}

/* ─────────────────────────────── public API ────────────────────────────────*/

/**
 * Compare the algorithm that produced the stored numbers against the current
 * one, and stage a notice when it moved. Call once per launch, after targets
 * are computed. Fail-soft: a storage problem must never block the app.
 *
 * `hasHistory` — false for a user onboarding right now. They have no old number
 * to be surprised by, so the version is recorded silently.
 */
export async function reconcileTargetsVersion(
  bio: UserBio,
  current: NutritionTargets,
  hasHistory: boolean,
): Promise<void> {
  try {
    const stored = await readJSON<StoredRecord | null>(TARGETS_ALGO_KEY, null);
    const next: StoredRecord = {
      version: TARGETS_ALGO_VERSION,
      calories: current.calories,
      proteinG: current.proteinG,
      pending: stored?.pending ?? null,
    };

    if (stored?.version === TARGETS_ALGO_VERSION) {
      // Same algorithm — just keep the last numbers fresh for the next bump.
      await writeJSON(TARGETS_ALGO_KEY, next);
      return;
    }

    if (!hasHistory) {
      await writeJSON(TARGETS_ALGO_KEY, { ...next, pending: null });
      return;
    }

    // Pre-record users have no stored "before", so reproduce what v1 gave them.
    const fromVersion = stored?.version ?? 1;
    const previous =
      stored != null
        ? { calories: stored.calories, proteinG: stored.proteinG }
        : legacyTargetsV1(bio);

    const moved =
      previous.calories !== current.calories || previous.proteinG !== current.proteinG;

    next.pending = moved
      ? {
          fromVersion,
          toVersion: TARGETS_ALGO_VERSION,
          previous,
          current: { calories: current.calories, proteinG: current.proteinG },
          message: describeChange(previous, current),
        }
      : null;

    await writeJSON(TARGETS_ALGO_KEY, next);
  } catch {
    // Fail-soft: an unexplained number is bad, a crashed launch is worse.
  }
}

/** The staged notice, if the user hasn't seen it yet. */
export async function getPendingTargetsNotice(): Promise<TargetsRecalcNotice | null> {
  try {
    const stored = await readJSON<StoredRecord | null>(TARGETS_ALGO_KEY, null);
    return stored?.pending ?? null;
  } catch {
    return null;
  }
}

/** Mark it read. Once only — this is an explanation, not a nag. */
export async function dismissTargetsNotice(): Promise<void> {
  try {
    const stored = await readJSON<StoredRecord | null>(TARGETS_ALGO_KEY, null);
    if (!stored) return;
    await writeJSON(TARGETS_ALGO_KEY, { ...stored, pending: null });
  } catch {
    /* fail-soft */
  }
}
