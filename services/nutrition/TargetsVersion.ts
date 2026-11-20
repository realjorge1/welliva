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
import { readJSON, todayDate, writeJSON } from "../OfflineStorage";
import type { NutritionTargets } from "../../models/nutrition";
import type { UserBio } from "../../models/user";
import { ACTIVITY_MULTIPLIERS } from "../../models/user";
import { AGE_CALORIE_ADJUSTMENTS, BASELINE_NUTRITION } from "../../models/nutrition";
import { applyConstraints, resolveConstraintsForBio } from "./ConditionConstraints";
import { proteinBasisKg } from "./bodyWeight";
import { noCutReason } from "./pace";
import { makeMove, recordMove } from "./weightRetarget";

/**
 * Bump on any change that moves an existing user's numbers.
 *
 *   2 — age counted once; protein on adjusted weight above BMI 30.
 *   3 — 2026-11-20: the 3,200/2,800 ceiling removed; no calorie cut under 18
 *       or at a BMI under 18.5; protein 1.6 g/kg while in a cut; fibre and
 *       sugar follow calories. (A chosen pace, a weight move and a learned
 *       correction are NOT versions: they are her own action or her own data,
 *       explained by their own notices — see weightRetarget.ts.)
 */
export const TARGETS_ALGO_VERSION = 3;

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
  /** Recorded from v3 on, so the next bump can quote the fibre it replaces. */
  fiberG?: number;
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

/**
 * v2's output (the algorithm from the age fix until 2026-11-20), reproduced so
 * the v3 notice can name what moved: the 3,200/2,800 ceiling, the fixed −500
 * for everyone (under-18s and underweight users included), 1.2 g/kg protein in
 * a deficit, and the flat fibre number. The clinical pass is today's — it did
 * not change at v3 — so the reproduction runs through it.
 *
 * Frozen history like legacyTargetsV1: never fix a bug in here.
 */
function legacyTargetsV2(bio: UserBio): {
  calories: number;
  proteinG: number;
  fiberG: number;
  uncappedKcal: number;
  capKcal: number;
} {
  const bmr =
    bio.sex === "male"
      ? 10 * bio.weightKg + 6.25 * bio.heightCm - 5 * bio.age + 5
      : 10 * bio.weightKg + 6.25 * bio.heightCm - 5 * bio.age - 161;
  const tdee = bmr * (ACTIVITY_MULTIPLIERS[bio.activityLevel] ?? 1.55);
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
  const capKcal = (bio.sex === "male" ? 3200 : 2800) + surplus;
  const uncappedKcal = tdee + effective + surplus;
  const calories = Math.round(Math.max(min, Math.min(capKcal, uncappedKcal)));
  const basis = proteinBasisKg(bio);
  const multiplier =
    bio.primaryGoal === "build_muscle" || bio.primaryGoal === "athletic_performance" ? 1.6 : 1.2;
  const proteinG = Math.round(basis * multiplier);
  const fatG = Math.round((calories * 0.275) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - calories * 0.275) / 4));
  const baseline = BASELINE_NUTRITION[bio.sex];
  const out = applyConstraints(
    {
      calories,
      proteinG,
      fatG,
      carbsG,
      sugarG: baseline.sugarG,
      fiberG: baseline.fiberG,
      sodiumMg: baseline.sodiumMg,
      waterMl: 0,
    },
    resolveConstraintsForBio(bio),
    basis,
  );
  return { calories: out.calories, proteinG: out.proteinG, fiberG: out.fiberG, uncappedKcal, capKcal };
}

/* ──────────────────────────── the notice itself ────────────────────────────*/

const fmt = (n: number) => Math.round(n).toLocaleString();

/** Fibre is advisory: a move under this many grams isn't worth a sentence. */
const FIBRE_NOTICE_G = 5;

/** WHY a number moved. Each cause is named in the notice; none is guessed. */
export type ChangeCause =
  | "age" // v2: age was counted twice
  | "protein_basis" // v2: protein on adjusted weight above BMI 30
  | "ceiling" // v3: the 3,200/2,800 cap removed
  | "no_cut_under_18" // v3: no calorie cut under 18
  | "no_cut_underweight" // v3: no calorie cut at a BMI under 18.5
  | "protein_deficit" // v3: 1.6 g/kg while in a cut
  | "fibre"; // v3: fibre per 1,000 kcal

/** What each algorithm step changed for THIS bio, oldest first. */
export function diagnoseCauses(bio: UserBio, fromVersion: number, current: NutritionTargets): ChangeCause[] {
  const causes: ChangeCause[] = [];
  const v2 = legacyTargetsV2(bio);
  if (fromVersion < 2) {
    const v1 = legacyTargetsV1(bio);
    if (v1.calories !== v2.calories) causes.push("age");
    if (v2.proteinG < v1.proteinG) causes.push("protein_basis");
  }
  if (fromVersion < 3) {
    if (current.calories !== v2.calories) {
      if (v2.uncappedKcal > v2.capKcal && current.calories > v2.calories) causes.push("ceiling");
      const noCut = noCutReason(bio);
      if (bio.primaryGoal === "lose_weight" && noCut === "under_18") causes.push("no_cut_under_18");
      if (bio.primaryGoal === "lose_weight" && noCut === "underweight") causes.push("no_cut_underweight");
    }
    if (bio.primaryGoal === "lose_weight" && current.proteinG > v2.proteinG) causes.push("protein_deficit");
    if (Math.abs(current.fiberG - v2.fiberG) >= FIBRE_NOTICE_G) causes.push("fibre");
  }
  return causes;
}

interface Numbers {
  calories: number;
  proteinG: number;
  fiberG?: number;
}

/**
 * The notice, by cause. Each sentence names the real reason and the real
 * numbers — the old version blamed age for every calorie move, which became
 * untrue the moment anything else could move one.
 */
export function describeChange(previous: Numbers, current: Numbers, causes: readonly ChangeCause[]): string {
  const parts: string[] = [];
  const has = (c: ChangeCause) => causes.includes(c);

  if (current.calories !== previous.calories) {
    // Name the bug, not just the movement. "We improved our algorithm" is what
    // an app says when it doesn't want to admit the old number was wrong.
    const reasons: string[] = [];
    if (has("age")) reasons.push("I corrected how I account for your age");
    if (has("ceiling")) {
      reasons.push(
        "your target was capped for large, active frames, which left you short of what your goal needs, so I removed the cap",
      );
    }
    if (has("no_cut_under_18")) {
      reasons.push("while you're under 18 I don't set a calorie cut, so your target is now what your body uses");
    }
    if (has("no_cut_underweight")) {
      reasons.push(
        "I no longer set a calorie cut at your current weight for your height, so your target is now what your body uses",
      );
    }
    const moved = `${fmt(previous.calories)} to ${fmt(current.calories)} kcal`;
    if (reasons.length > 0) {
      const lead = reasons.join(", and ");
      parts.push(`${lead.charAt(0).toUpperCase()}${lead.slice(1)}. Your daily target moved from ${moved}.`);
    } else {
      parts.push(`Your daily target moved from ${moved}.`);
    }
  }

  if (current.proteinG !== previous.proteinG) {
    const moved = `${fmt(previous.proteinG)} g to ${fmt(current.proteinG)} g`;
    if (has("protein_basis") && current.proteinG < previous.proteinG) {
      parts.push(
        `I also now scale protein on adjusted body weight rather than total ` +
          `weight, which is the clinical standard above BMI 30. Your protein ` +
          `target moved from ${moved}: the old figure asked more of you than the evidence supports.`,
      );
    } else if (has("protein_deficit") && current.proteinG > previous.proteinG) {
      parts.push(
        `I now set protein higher while you're losing weight, which protects muscle. ` +
          `Your protein target moved from ${moved}.`,
      );
    } else {
      parts.push(`Your protein target moved from ${moved}.`);
    }
  }

  if (has("fibre") && previous.fiberG != null && current.fiberG != null) {
    parts.push(
      `Your fibre goal now follows how much you eat (about 14 g for every 1,000 kcal), ` +
        `so it moved from ${fmt(previous.fiberG)} g to ${fmt(current.fiberG)} g.`,
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
      fiberG: current.fiberG,
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
    // Fibre was never recorded before v3; the algorithm that produced the
    // stored numbers is reproduced for it (v1 and v2 shared one flat fibre).
    const previousFiberG = stored?.fiberG ?? legacyTargetsV2(bio).fiberG;

    const causes = diagnoseCauses(bio, fromVersion, current);
    const moved =
      previous.calories !== current.calories ||
      previous.proteinG !== current.proteinG ||
      causes.includes("fibre");

    next.pending = moved
      ? {
          fromVersion,
          toVersion: TARGETS_ALGO_VERSION,
          previous,
          current: { calories: current.calories, proteinG: current.proteinG },
          message: describeChange(
            { ...previous, fiberG: previousFiberG },
            { calories: current.calories, proteinG: current.proteinG, fiberG: current.fiberG },
            causes,
          ),
        }
      : null;

    await writeJSON(TARGETS_ALGO_KEY, next);

    // The notice above is shown once and then erased. "Why did my number
    // change?" must still have an answer months later — in Settings, and in the
    // exported document under "Why your numbers changed" — so the same sentence
    // is kept as a durable move. Stored `seen`, because the correction card has
    // just said it and the move card must not repeat it. Recorded AFTER the
    // record itself, so a storage failure here can never cost the notice.
    if (next.pending) {
      await recordMove({
        ...makeMove(
          "correction",
          todayDate(),
          previous,
          { calories: current.calories, proteinG: current.proteinG },
          next.pending.message,
          new Date(),
        ),
        seen: true,
      });
    }
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
