/**
 * TRAINING SAFETY — injuries and medical conditions, turned into the moves a
 * plan must leave out.
 *
 * Each rule excludes whole movement patterns and/or exercises that load named
 * muscles, and can cap intensity. The rules moved here from WorkoutGenerator
 * unchanged; what is new is `safetyLabel`, which says in plain words WHICH rule
 * keeps a given exercise out — the half of a substitution the user reads
 * ("Step-ups instead of Jump Squats — protects your knee").
 *
 * Unlike the generator this replaced, nothing here ever falls back to an unsafe
 * pool when the rules leave too little: the planner fills the gap with safe
 * moves (mobility is never excluded) rather than quietly re-admitting the ones
 * the user's body said no to.
 */

import type { ExerciseDBEntry } from "../../constants/ExerciseDatabase";
import type { Difficulty } from "../../models/exercise";
import type { MedicalCondition, UserBio } from "../../models/user";
import type { MovementPattern } from "../../models/workout";
import { LYING_DOWN } from "./vocabulary";

export const DIFFICULTY_ORDER: Difficulty[] = ["beginner", "intermediate", "advanced"];

export function difficultyIndex(d: Difficulty): number {
  return DIFFICULTY_ORDER.indexOf(d);
}

interface SafetyRule {
  patterns?: MovementPattern[];
  /** lowercase substrings matched against an exercise's targetMuscles */
  muscles?: string[];
  /** specific exercises kept out, by id */
  ids?: ReadonlySet<string>;
  /** hardest difficulty allowed while this applies */
  maxDifficulty?: Difficulty;
}

/**
 * Injury BODY-AREA keyword → movement patterns / muscles to avoid. Tokens come
 * from the profile's body-area picker (leg, chest, knee…) but free text works
 * too (substring match), e.g. "lower back", "rotator cuff", "right foot".
 */
const INJURY_RULES: { keywords: string[]; rule: SafetyRule }[] = [
  { keywords: ["neck"], rule: { muscles: ["trap", "neck"] } },
  {
    keywords: ["shoulder", "rotator", "delt"],
    rule: {
      patterns: ["push", "pull"],
      muscles: ["deltoid", "shoulder", "trap", "lat"],
    },
  },
  {
    keywords: ["arm", "elbow", "bicep", "tricep", "forearm"],
    rule: { patterns: ["push", "pull"], muscles: ["tricep", "bicep", "forearm"] },
  },
  {
    keywords: ["wrist", "hand"],
    rule: { patterns: ["push"], muscles: ["forearm", "wrist"] },
  },
  {
    keywords: ["chest", "pec"],
    rule: { patterns: ["push"], muscles: ["chest", "pec"] },
  },
  {
    keywords: ["back", "spine", "spinal", "lumbar", "disc", "sciatica"],
    rule: {
      patterns: ["hinge", "pull"],
      muscles: ["back", "spinal", "erector", "lat"],
    },
  },
  {
    keywords: ["core", "abs", "abdom", "oblique"],
    rule: { patterns: ["core"] },
  },
  {
    keywords: ["hip", "glute"],
    rule: { patterns: ["hinge", "squat"], muscles: ["glute", "hip", "hamstring"] },
  },
  {
    keywords: ["leg", "thigh", "quad", "hamstring"],
    rule: {
      patterns: ["squat", "hinge"],
      muscles: ["quad", "hamstring", "glute", "calf"],
    },
  },
  {
    keywords: ["knee"],
    rule: { patterns: ["squat"], muscles: ["quad", "calf"] },
  },
  {
    keywords: ["ankle", "foot", "feet", "calf"],
    rule: { patterns: ["cardio"], muscles: ["calf"] },
  },
];

/** Non-pregnancy medical condition → safety rule (pregnancy is trimester-aware). */
const CONDITION_RULES: Partial<Record<MedicalCondition, SafetyRule>> = {
  // Gentle return: skip hard core work (diastasis risk), keep intensity moderate.
  postpartum: { patterns: ["core"], maxDifficulty: "intermediate" },
  // Avoid maximal strain / breath-holding heavy work.
  hypertension: { maxDifficulty: "intermediate" },
};

/** What each condition's rule is called when it is the reason a move is out. */
const CONDITION_LABEL: Partial<Record<MedicalCondition, string>> = {
  pregnancy: "pregnancy-safe",
  postpartum: "a gentle postpartum return",
  hypertension: "easier on your blood pressure",
};

/**
 * Pregnancy restrictions tighten by trimester:
 *  • T1 — keep moving; just cap intensity.
 *  • T2 — add: no core work, and nothing done lying flat on the back or face
 *         down (ACOG: avoid the supine position after the first trimester).
 *  • T3 — add: no high-impact jumping (cardio); beginner intensity only.
 * Unknown trimester ⇒ conservative (treat like T2/T3 blend).
 */
function pregnancyRule(trimester?: 1 | 2 | 3): SafetyRule {
  switch (trimester) {
    case 1:
      return { maxDifficulty: "intermediate" };
    case 2:
      return { patterns: ["core"], ids: LYING_DOWN, maxDifficulty: "intermediate" };
    case 3:
      return { patterns: ["core", "cardio"], ids: LYING_DOWN, maxDifficulty: "beginner" };
    default:
      return { patterns: ["core", "cardio"], ids: LYING_DOWN, maxDifficulty: "intermediate" };
  }
}

function conditionRule(bio: UserBio, condition: MedicalCondition): SafetyRule | undefined {
  return condition === "pregnancy"
    ? pregnancyRule(bio.pregnancyTrimester)
    : CONDITION_RULES[condition];
}

export interface Contraindications {
  patterns: Set<MovementPattern>;
  muscles: string[];
  /** Specific exercises kept out (e.g. lying down, mid-pregnancy). */
  ids: Set<string>;
  maxDifficulty: Difficulty | null;
}

/** Keep the more restrictive (lower) of two difficulty caps. */
export function stricterDifficulty(a: Difficulty | null, b: Difficulty): Difficulty {
  if (!a) return b;
  return difficultyIndex(a) <= difficultyIndex(b) ? a : b;
}

function injuryTexts(bio: UserBio): string[] {
  return (bio.injuries ?? []).map((s) => s.trim()).filter(Boolean);
}

function injuryRulesFor(text: string): SafetyRule[] {
  const lower = text.toLowerCase();
  return INJURY_RULES.filter(({ keywords }) => keywords.some((k) => lower.includes(k))).map(
    ({ rule }) => rule,
  );
}

/** Collapse a user's injuries + conditions into one set of restrictions. */
export function buildContraindications(bio: UserBio): Contraindications {
  const patterns = new Set<MovementPattern>();
  const muscles: string[] = [];
  const ids = new Set<string>();
  let maxDifficulty: Difficulty | null = null;

  const apply = (rule: SafetyRule) => {
    rule.patterns?.forEach((p) => patterns.add(p));
    if (rule.muscles) muscles.push(...rule.muscles);
    rule.ids?.forEach((id) => ids.add(id));
    if (rule.maxDifficulty) maxDifficulty = stricterDifficulty(maxDifficulty, rule.maxDifficulty);
  };

  for (const injury of injuryTexts(bio)) injuryRulesFor(injury).forEach(apply);
  for (const condition of bio.medicalConditions ?? []) {
    const rule = conditionRule(bio, condition);
    if (rule) apply(rule);
  }
  return { patterns, muscles, ids, maxDifficulty };
}

function ruleExcludes(rule: SafetyRule, ex: ExerciseDBEntry): boolean {
  if (rule.ids?.has(ex.id)) return true;
  if (rule.patterns?.includes(ex.movementPattern)) return true;
  if (rule.muscles && rule.muscles.length > 0) {
    const target = ex.targetMuscles.map((m) => m.toLowerCase());
    if (rule.muscles.some((k) => target.some((m) => m.includes(k)))) return true;
  }
  return false;
}

/** Whether injuries/conditions keep this movement out (patterns, muscles, named moves). */
export function isContraindicated(ex: ExerciseDBEntry, contra: Contraindications): boolean {
  if (contra.ids.has(ex.id)) return true;
  if (contra.patterns.has(ex.movementPattern)) return true;
  if (contra.muscles.length > 0) {
    const target = ex.targetMuscles.map((m) => m.toLowerCase());
    if (contra.muscles.some((k) => target.some((m) => m.includes(k)))) return true;
  }
  return false;
}

/**
 * Stable signature of a user's injuries + conditions, folded into the plan's
 * input hash so a new injury/condition rebuilds the plan (and the weekly
 * rebuild stays stable while nothing changes).
 */
export function contraindicationKey(bio: UserBio): string {
  const injuries = injuryTexts(bio)
    .map((s) => s.toLowerCase())
    .sort()
    .join("|");
  const conditions = (bio.medicalConditions ?? [])
    .filter((c) => c !== "none")
    .slice()
    .sort()
    .join("|");
  // Trimester changes which pregnancy restrictions apply ⇒ part of the key.
  const trimester = (bio.medicalConditions ?? []).includes("pregnancy")
    ? `t${bio.pregnancyTrimester ?? 0}`
    : "";
  return `${injuries}#${conditions}#${trimester}`;
}

/**
 * The plain-language reason THIS exercise is kept out, naming the rule that
 * does it: "protects your knee", "pregnancy-safe". Null when nothing excludes
 * it. Difficulty caps count: a move above a condition's cap is out for that
 * condition, and says so.
 */
export function safetyLabel(ex: ExerciseDBEntry, bio: UserBio): string | null {
  for (const injury of injuryTexts(bio)) {
    if (injuryRulesFor(injury).some((rule) => ruleExcludes(rule, ex))) {
      return `protects your ${injury.toLowerCase()}`;
    }
  }
  for (const condition of bio.medicalConditions ?? []) {
    const rule = conditionRule(bio, condition);
    if (!rule) continue;
    if (rule.ids?.has(ex.id) && condition === "pregnancy") {
      return "pregnancy-safe, nothing lying flat";
    }
    const overCap =
      rule.maxDifficulty !== undefined &&
      difficultyIndex(ex.difficulty) > difficultyIndex(rule.maxDifficulty);
    if (ruleExcludes(rule, ex) || overCap) {
      return CONDITION_LABEL[condition] ?? "kept safe for your health";
    }
  }
  return null;
}

/** One plain line per injury/condition the plan is shaped around. */
export function safetyNotes(bio: UserBio): string[] {
  const notes: string[] = [];
  const injuries = injuryTexts(bio).map((s) => s.toLowerCase());
  if (injuries.length > 0) {
    const list =
      injuries.length === 1
        ? injuries[0]
        : `${injuries.slice(0, -1).join(", ")} and ${injuries[injuries.length - 1]}`;
    notes.push(
      `Protects your ${list} — moves that load ${injuries.length === 1 ? "it" : "them"} are left out`,
    );
  }
  const conditions = bio.medicalConditions ?? [];
  if (conditions.includes("pregnancy")) {
    const t = bio.pregnancyTrimester;
    notes.push(t ? `Pregnancy-safe moves for trimester ${t}` : "Pregnancy-safe moves only");
    if (t !== 1) notes.push("Nothing done lying flat on your back or front — advised from the second trimester");
  }
  if (conditions.includes("postpartum")) notes.push("A gentle postpartum return — no hard core work");
  if (conditions.includes("hypertension")) notes.push("Kept moderate for your blood pressure");
  return notes;
}

/**
 * Why the plan's hardest moves sit below the user's own level, when a
 * condition caps them. Null when nothing caps below `level`.
 */
export function ceilingLabel(bio: UserBio, level: Difficulty): string | null {
  for (const condition of bio.medicalConditions ?? []) {
    const rule = conditionRule(bio, condition);
    if (rule?.maxDifficulty && difficultyIndex(rule.maxDifficulty) < difficultyIndex(level)) {
      if (condition === "pregnancy" && bio.pregnancyTrimester) {
        return `pregnancy, trimester ${bio.pregnancyTrimester}`;
      }
      return condition === "hypertension" ? "your blood pressure" : condition.replace(/_/g, " ");
    }
  }
  return null;
}
