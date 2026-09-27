/**
 * DIET MATCH SERVICE
 * Calculate diet compatibility scores based on user bio
 *
 * Scoring algorithm (v2):
 * - Base score 75 (neutral)
 * - Points ADDED for positive matches (goal alignment, condition preference, restriction compat)
 * - Points DEDUCTED for incompatibilities
 * - Hard blocks for medical/allergy conflicts
 * - Recommended: score 87-96 (clamped)
 * - Safe Options: score 75-86 (clamped)
 * - Below 75: not shown
 */

import { DIET_DATABASE, DietData, DietMealOption } from "../constants/DietDatabase";
import { DietMatchScore } from "../models/diet";
import {
  DietaryRestriction,
  MedicalCondition,
  MedicationCategory,
  UserBio,
} from "../models/user";
import {
  breaksRestriction,
  cuisineWord,
  dietNameContradicts,
  restrictionWord,
  servesPreference,
  signatureDietFor,
} from "./nutrition/mealRules";

/**
 * Condition → diet intelligence.
 *
 * Each health condition maps to the therapeutic diet(s) that treat it (a strong
 * recommend boost, so the right clinical plan lands in the "Recommended" band),
 * the diets that are unsafe for it (hard block), and optional gentle cautions.
 * `label` is the human phrasing used in reasons/warnings.
 *
 * Partial<Record<…>> is deliberate: adding a MedicalCondition never forces an
 * entry here, and any condition with no mapping simply carries no diet bias.
 * Diet ids reference DIET_DATABASE (base + the generated clinical library).
 */
type ConditionInfo = {
  label: string;
  recommend: string[];
  block?: string[];
  caution?: { dietId: string; message: string }[];
};

const CONDITION_INFO: Partial<Record<MedicalCondition, ConditionInfo>> = {
  // ── Heart & metabolic ──────────────────────────────────────────────
  hypertension: {
    label: "high blood pressure",
    recommend: ["dash", "low-sodium", "mediterranean"],
    caution: [{ dietId: "keto", message: "Watch sodium carefully on keto" }],
  },
  high_cholesterol: {
    label: "high cholesterol",
    recommend: ["low-cholesterol", "tlc", "portfolio", "mediterranean"],
  },
  diabetes_type2: {
    label: "type 2 diabetes",
    recommend: ["diabetic-friendly", "low-gi", "low-carb", "mediterranean"],
    caution: [
      { dietId: "weight-gain", message: "High-carb — harder to keep glucose steady" },
    ],
  },
  diabetes_type1: {
    label: "type 1 diabetes",
    recommend: ["diabetes-type1", "low-gi", "diabetic-friendly"],
  },
  prediabetes: {
    label: "prediabetes",
    recommend: ["prediabetes", "low-gi", "mediterranean", "diabetic-friendly"],
  },
  metabolic_syndrome: {
    label: "metabolic syndrome",
    recommend: ["metabolic-syndrome", "mediterranean", "low-gi"],
  },
  // ── Digestive ──────────────────────────────────────────────────────
  gerd: {
    label: "acid reflux (GERD)",
    recommend: ["ulcer-gerd-friendly"],
    caution: [{ dietId: "keto", message: "High-fat meals can worsen reflux" }],
  },
  ibs: { label: "IBS", recommend: ["ibs-low-fodmap", "gut-health"] },
  ibd: { label: "IBD (Crohn's / colitis)", recommend: ["ibd-crohns-colitis"] },
  celiac: { label: "celiac disease", recommend: ["gluten-free"] },
  diverticulitis: {
    label: "diverticular disease",
    recommend: ["diverticulitis", "high-fiber"],
  },
  constipation: { label: "constipation", recommend: ["high-fiber", "gut-health"] },
  lactose_intolerance: {
    label: "lactose intolerance",
    recommend: ["lactose-free"],
  },
  // ── Liver, kidney & endocrine ──────────────────────────────────────
  renal_issues: {
    label: "kidney conditions",
    recommend: ["renal-friendly", "kidney-stone"],
    block: ["high-protein", "keto", "bodybuilding"],
    caution: [
      { dietId: "paleo", message: "High protein may stress the kidneys" },
      {
        dietId: "wellness-detox",
        message: "Very high in potassium and fluid — check with your clinician",
      },
    ],
  },
  fatty_liver: {
    label: "fatty liver",
    recommend: ["liver-friendly", "mediterranean", "metabolic-syndrome"],
  },
  gallbladder: {
    label: "gallbladder issues",
    recommend: ["gallbladder-low-fat"],
    caution: [{ dietId: "keto", message: "Very high fat can trigger attacks" }],
  },
  pancreatitis: {
    label: "pancreatitis",
    recommend: ["pancreatitis"],
    block: ["keto"],
    caution: [{ dietId: "high-protein", message: "Keep fat very low while healing" }],
  },
  hypothyroidism: { label: "hypothyroidism", recommend: ["thyroid-support"] },
  hyperthyroidism: { label: "hyperthyroidism", recommend: ["hyperthyroid"] },
  gout: {
    label: "gout",
    recommend: ["gout-low-purine"],
    block: ["high-protein", "bodybuilding"],
    caution: [{ dietId: "keto", message: "Keto can raise uric acid early on" }],
  },
  // ── Hormonal & life-stage ──────────────────────────────────────────
  pcos: {
    label: "PCOS",
    recommend: ["pcos-friendly", "low-gi", "mediterranean"],
  },
  endometriosis: {
    label: "endometriosis",
    recommend: ["endometriosis", "anti-inflammatory"],
  },
  pregnancy: {
    label: "pregnancy",
    recommend: ["pregnancy", "mediterranean"],
    block: ["keto"],
    caution: [
      {
        dietId: "intermittent-fasting",
        message: "Fasting isn't advised during pregnancy",
      },
      {
        dietId: "wellness-detox",
        message: "A restrictive reset isn't advised in pregnancy — eat normally",
      },
    ],
  },
  postpartum: {
    label: "postpartum recovery",
    recommend: ["postpartum-wellness", "mediterranean"],
    caution: [
      {
        dietId: "wellness-detox",
        message: "Not while recovering or breastfeeding — you need full intake",
      },
    ],
  },
  menopause: {
    label: "menopause",
    recommend: ["menopause", "mediterranean", "osteoporosis"],
  },
  // ── Immune, blood & musculoskeletal ────────────────────────────────
  anemia: {
    label: "iron-deficiency anemia",
    recommend: ["iron-deficiency-recovery"],
  },
  arthritis: {
    label: "arthritis",
    recommend: ["rheumatoid-arthritis", "anti-inflammatory", "mediterranean"],
  },
  osteoporosis: { label: "osteoporosis", recommend: ["osteoporosis"] },
  // ── Neurological ───────────────────────────────────────────────────
  migraine: { label: "migraine", recommend: ["migraine"] },
};

/**
 * Medication-kind diet rules. Light touch — meds nudge the match score and
 * raise advisories rather than hard-blocking. Based on broadly-accepted food
 * interactions (not drug-specific advice).
 */
const MEDICATION_DIET_RULES: Partial<
  Record<
    MedicationCategory,
    { preferred: string[]; discouraged: { dietId: string; message: string }[] }
  >
> = {
  blood_pressure: {
    preferred: ["low-sodium", "mediterranean", "balanced", "flexitarian"],
    discouraged: [
      { dietId: "keto", message: "Sodium can run high on keto — watch your salt" },
    ],
  },
  corticosteroids: {
    preferred: ["low-sodium", "mediterranean", "balanced"],
    discouraged: [
      { dietId: "keto", message: "Aim for lower sodium while on steroids" },
    ],
  },
  diuretics: {
    preferred: ["mediterranean", "balanced", "low-sodium"],
    discouraged: [],
  },
  diabetes: {
    preferred: ["diabetic-friendly", "low-carb", "mediterranean"],
    discouraged: [
      {
        dietId: "weight-gain",
        message: "High-carb — harder to keep blood sugar steady",
      },
    ],
  },
};

/**
 * Human, non-drug-specific food advisories for a user's medication kinds.
 * Surfaced on the diet screen and in the post-edit change summary.
 */
const MEDICATION_ADVICE: Record<MedicationCategory, string> = {
  antibiotics:
    "Space dairy and calcium-rich foods a couple of hours from your doses.",
  antidepressants:
    "If you're on an MAOI, avoid aged cheeses, cured meats and fermented foods.",
  blood_thinners: "Keep leafy-green (vitamin K) intake steady day to day.",
  blood_pressure: "Go easy on salt and very high-potassium foods.",
  corticosteroids: "Favor lower-sodium, calcium- and potassium-rich meals.",
  diabetes: "Keep carbohydrate amounts consistent across your meals.",
  diuretics: "Mind sodium and stay topped up on potassium and fluids.",
  thyroid:
    "Take thyroid meds on an empty stomach, away from calcium, iron and soy.",
  nsaids: "Take anti-inflammatories with food to protect your stomach.",
  other: "",
};

/** Food advisories for the user's medication kinds (empty when none apply). */
export function getMedicationAdvisories(bio: UserBio): string[] {
  return (bio.medicationCategories ?? [])
    .map((c) => MEDICATION_ADVICE[c])
    .filter((s): s is string => Boolean(s));
}

/**
 * Dietary restriction compatibility
 * Maps restrictions to compatible diet IDs
 */
const RESTRICTION_COMPATIBLE_DIETS: Record<DietaryRestriction, string[]> = {
  none: ["*"], // All diets
  pescatarian: ["mediterranean", "pescatarian", "flexitarian", "balanced"],
  vegetarian: ["vegetarian", "mediterranean", "flexitarian", "plant-based"],
  vegan: ["vegan", "plant-based"],
  halal: ["halal", "mediterranean", "balanced"], // Most can be adapted
  kosher: ["kosher", "mediterranean", "balanced"], // Most can be adapted
  gluten_free: ["gluten-free", "paleo", "keto"], // Naturally gluten-free diets
  dairy_free: ["vegan", "plant-based", "paleo"], // Naturally dairy-free diets
};

/**
 * The diet each restriction was AUTHORED for. The compatibility table above
 * says which diets can be adapted; this says which one needs no adapting —
 * every meal in the vegetarian plan was written vegetarian, whereas the
 * Mediterranean plan is "compatible" only once its fish is filtered out.
 */
const RESTRICTION_HOME_DIETS: Partial<Record<DietaryRestriction, string[]>> = {
  vegetarian: ["vegetarian"],
  vegan: ["vegan", "plant-based"],
  pescatarian: ["pescatarian"],
  gluten_free: ["gluten-free", "gluten-free-lifestyle"],
  dairy_free: ["lactose-free"],
};

/**
 * Best first. Orders by the UNCLAMPED rank so a tie at the 96 display ceiling
 * is broken by the actual fit rather than by where a diet sits in the catalog.
 * Every ranked list in the app goes through this one comparator, so the diet a
 * screen recommends is always the diet the generator picks.
 */
export function byBestMatch(a: DietMatchScore, b: DietMatchScore): number {
  return (b.rank ?? b.score) - (a.rank ?? a.score);
}

/**
 * Calculate match scores for all diets
 */
export function calculateDietMatches(bio: UserBio): DietMatchScore[] {
  return DIET_DATABASE.map((diet) => calculateSingleDietMatch(diet, bio));
}

/**
 * Get recommended diets (score 87-96)
 */
export function getRecommendedDiets(bio: UserBio): DietMatchScore[] {
  const matches = calculateDietMatches(bio);
  return matches.filter((m) => m.isRecommended && !m.isBlocked).sort(byBestMatch);
}

/**
 * Get safe options (score 75-86)
 */
export function getSafeOptionDiets(bio: UserBio): DietMatchScore[] {
  const matches = calculateDietMatches(bio);
  return matches.filter((m) => m.isSafeOption && !m.isBlocked).sort(byBestMatch);
}

/**
 * Get all available diets (not blocked)
 */
export function getAllAvailableDiets(bio: UserBio): DietMatchScore[] {
  const matches = calculateDietMatches(bio);
  return matches.filter((m) => !m.isBlocked).sort(byBestMatch);
}

// ── Cuisine fit ──────────────────────────────────────────────────────────────

export interface CuisineFit {
  /** Points added to (or taken from) the match score. */
  delta: number;
  /** The fewest dishes in the user's cuisine across breakfast, lunch and dinner. */
  depth: number;
  /** A plain-language reason to show when the fit is good. */
  reason?: string;
  /** Said out loud when this diet cannot really serve the cuisine. */
  warning?: string;
}

/** Dishes in one slot that serve both the user's cuisine and their restriction. */
function servingCount(options: DietMealOption[], bio: UserBio): number {
  return options.filter(
    (o) =>
      servesPreference(o, bio.cuisinePreference) &&
      !breaksRestriction(o.name, bio.dietaryRestriction),
  ).length;
}

/**
 * How well a diet can feed the user from the cuisine they chose.
 *
 * DEPTH is the measurement: the thinnest of the three main slots, counted
 * after the restriction filter, because that is the slot where the plan will
 * run out of the user's food first and start repeating — or fall back to
 * another kitchen entirely. A diet with one African breakfast is not an African
 * plan, however well it scores on goals.
 *
 * Two NAMING rules sit on top, because the diet's name is the first thing the
 * user reads: a diet named after a different cuisine is marked down (an African
 * user is never headlined "Mediterranean Diet" unless their health calls for
 * it), and the diet that IS their cuisine's tradition is marked up — strongly
 * when nothing medical competes for the top spot, gently when something does,
 * so a condition's therapeutic diet still leads.
 */
export function cuisineFit(diet: DietData, bio: UserBio): CuisineFit {
  const pref = bio.cuisinePreference;
  if (!pref || pref === "mixed") return { delta: 0, depth: Infinity };

  const depth = Math.min(
    servingCount(diet.breakfastOptions, bio),
    servingCount(diet.lunchOptions, bio),
    servingCount(diet.dinnerOptions, bio),
  );
  const word = cuisineWord(pref);

  let delta = 0;
  let reason: string | undefined;
  let warning: string | undefined;

  if (depth === 0) {
    delta -= 12;
    warning = `Few ${word} dishes in this plan`;
  } else if (depth === 1) {
    delta -= 6;
    warning = `Only a handful of ${word} dishes here`;
  } else if (depth >= 6) {
    delta += 6;
    reason = `Full of the ${word} dishes you chose`;
  } else if (depth >= 4) {
    delta += 3;
    reason = `Plenty of ${word} dishes`;
  } else {
    reason = `Made with ${word} dishes`;
  }

  if (dietNameContradicts(diet.id, pref)) delta -= 8;

  if (signatureDietFor(pref) === diet.id) {
    const hasTherapeuticNeed = bio.medicalConditions.some(
      (c) => c !== "none" && (CONDITION_INFO[c]?.recommend.length ?? 0) > 0,
    );
    delta += hasTherapeuticNeed ? 4 : 10;
    reason = `Built on the ${word} kitchen you chose`;
  }

  return { delta, depth, reason, warning };
}

/** Would changing to this cuisine make the active diet's NAME contradict it? */
export function dietConflictsWithCuisine(
  dietId: string | null | undefined,
  pref: UserBio["cuisinePreference"],
): boolean {
  return !!dietId && dietNameContradicts(dietId, pref);
}

/**
 * Calculate score for a single diet
 *
 * Scoring v2: Start at 75 (neutral), add/subtract based on fit.
 * - Goal alignment: +8 to +12
 * - Medical preference: +5 to +8
 * - Restriction: +13 (authored for it), +5 (compatible) or -5 to -12 (not)
 * - Allergy safety: -8 (soft) or block (hard)
 * - Activity/difficulty fit: +3 to -5
 * - Age appropriateness: +2 to -3
 * - Cuisine fit: -20 to +16 (see {@link cuisineFit})
 *
 * Result clamped: Recommended [87,96], Safe [75,86]. Ordering uses the
 * unclamped `rank` (see {@link byBestMatch}).
 */
function calculateSingleDietMatch(
  diet: DietData,
  bio: UserBio,
): DietMatchScore {
  let score = 75; // Neutral baseline
  const warnings: string[] = [];
  const blockReasons: string[] = [];
  const reasons: string[] = [];
  let isBlocked = false;

  // ── Medical condition checks ─────────────────────────────────
  // A condition's target diet(s) get a strong boost so the right clinical plan
  // surfaces in the "Recommended" band; unsafe diets are hard-blocked. Multiple
  // conditions stack — a diet good for several of the user's conditions ranks
  // highest, which is exactly what a multi-condition user needs.
  for (const condition of bio.medicalConditions) {
    if (condition === "none") continue;
    const info = CONDITION_INFO[condition];
    if (!info) continue;

    if (info.block?.includes(diet.id)) {
      isBlocked = true;
      blockReasons.push(`Not recommended for ${info.label}`);
    }
    if (info.recommend.includes(diet.id)) {
      score += 15;
      reasons.push(`Targeted for ${info.label}`);
    }
    const caution = info.caution?.find((c) => c.dietId === diet.id);
    if (caution) {
      warnings.push(caution.message);
      score -= 6;
    }
  }

  // ── Dietary restriction compatibility ──────────────────────
  const compatibleDiets = RESTRICTION_COMPATIBLE_DIETS[bio.dietaryRestriction];
  if (RESTRICTION_HOME_DIETS[bio.dietaryRestriction]?.includes(diet.id)) {
    // Authored for this restriction — nothing has to be filtered out of it.
    score += 13;
    reasons.push(`Written for ${restrictionWord(bio.dietaryRestriction)} eating`);
  } else if (compatibleDiets.includes("*") || compatibleDiets.includes(diet.id)) {
    // Fully compatible - bonus
    if (bio.dietaryRestriction !== "none") {
      score += 5;
      reasons.push(`Supports ${restrictionWord(bio.dietaryRestriction)} eating`);
    }
  } else if (canAdaptDiet(diet.id, bio.dietaryRestriction)) {
    score -= 5;
    warnings.push(
      `May need adaptation for ${bio.dietaryRestriction} restriction`,
    );
  } else {
    score -= 12;
    warnings.push(
      `Limited compatibility with ${bio.dietaryRestriction} restriction`,
    );
  }

  // ── Medication-kind nudges ─────────────────────────────────
  for (const med of bio.medicationCategories ?? []) {
    const rules = MEDICATION_DIET_RULES[med];
    if (!rules) continue;
    if (rules.preferred.includes(diet.id)) {
      score += 4;
      reasons.push("Friendly to your medication");
    }
    const disc = rules.discouraged.find((d) => d.dietId === diet.id);
    if (disc) {
      score -= 5;
      warnings.push(disc.message);
    }
  }

  // ── Allergy checks ──────────────────────────────────────────
  const allergyConflicts = checkAllergyConflicts(diet, bio.allergies);
  for (const conflict of allergyConflicts) {
    if (conflict.severity === "hard") {
      isBlocked = true;
      blockReasons.push(`Contains ${conflict.allergen}`);
    } else {
      score -= 8;
      warnings.push(`May contain ${conflict.allergen} - check meal options`);
    }
  }

  // ── Goal alignment (FIXED key mapping) ─────────────────────
  const goalBonus = getGoalAlignmentBonus(diet.id, bio.primaryGoal);
  score += goalBonus;
  if (goalBonus > 0) {
    reasons.push(`Aligns with your ${formatGoal(bio.primaryGoal)} goal`);
  }

  // ── Activity level fit ─────────────────────────────────────
  score += getActivityFit(diet, bio.activityLevel);

  // ── Difficulty appropriateness ─────────────────────────────
  if (bio.age > 65) {
    if (diet.difficulty === "Easy") {
      score += 3;
    } else if (diet.difficulty === "Advanced") {
      score -= 5;
      warnings.push("This diet may be challenging to maintain");
    }
  }

  // ── Cuisine fit ────────────────────────────────────────────
  // Replaces a flat "+2 if any meal is Nigerian" that every diet in the catalog
  // earned, whatever the user had asked for — so it ranked nothing and the
  // cuisine the user chose played no part in which diet they were matched to.
  const fit = cuisineFit(diet, bio);
  score += fit.delta;
  if (fit.warning) warnings.push(fit.warning);

  // ── Clamp score to valid range ────────────────────────────
  const rank = score;
  score = Math.min(Math.max(score, 0), 96);

  return {
    dietId: diet.id,
    score,
    rank,
    isRecommended: score >= 87 && !isBlocked,
    isSafeOption: score >= 75 && score < 87 && !isBlocked,
    isBlocked,
    blockReasons: isBlocked ? blockReasons : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    reasons: reasons.length > 0 ? reasons : undefined,
  };
}

/**
 * Check if diet can be adapted for a restriction
 */
function canAdaptDiet(
  dietId: string,
  restriction: DietaryRestriction,
): boolean {
  // Most diets can be adapted for halal or kosher (substitute ingredients)
  if (restriction === "halal" || restriction === "kosher") return true;

  // Mediterranean can be adapted for most restrictions
  if (dietId === "mediterranean") return true;

  // Many diets can be made gluten-free or dairy-free with substitutions
  if (restriction === "gluten_free" || restriction === "dairy_free")
    return true;

  return false;
}

/**
 * Check for allergy conflicts
 */
function checkAllergyConflicts(
  diet: DietData,
  allergies: string[],
): { allergen: string; severity: "hard" | "soft" }[] {
  const conflicts: { allergen: string; severity: "hard" | "soft" }[] = [];

  // Check diet principles for common allergens
  const dietIngredients = [
    ...(diet.principles.emphasis || []),
    ...(diet.principles.moderate || []),
  ].map((i) => i.toLowerCase());

  for (const allergy of allergies) {
    const allergyLower = allergy.toLowerCase();

    // Hard conflicts - allergen is emphasized in diet
    if (dietIngredients.some((i) => i.includes(allergyLower))) {
      conflicts.push({ allergen: allergy, severity: "hard" });
    }

    // Soft conflicts - allergen might be present in some meals
    else if (mightContainAllergen(diet, allergyLower)) {
      conflicts.push({ allergen: allergy, severity: "soft" });
    }
  }

  return conflicts;
}

/**
 * Check if diet might contain an allergen in some meals
 */
function mightContainAllergen(diet: DietData, allergen: string): boolean {
  // Check meal names for common allergens
  const allMeals = [
    ...diet.breakfastOptions,
    ...diet.lunchOptions,
    ...diet.dinnerOptions,
  ];

  return allMeals.some((meal) => meal.name.toLowerCase().includes(allergen));
}

/**
 * Get bonus score for goal alignment
 * FIXED: Uses correct PrimaryGoal keys from models/user.ts
 */
function getGoalAlignmentBonus(dietId: string, goal: string): number {
  const goalDietMap: Record<string, { diets: string[]; bonus: number }> = {
    lose_weight: {
      diets: [
        "low-carb",
        "mediterranean",
        "low-fat",
        "balanced",
        "keto",
        "intermittent-fasting",
      ],
      bonus: 10,
    },
    build_muscle: {
      diets: ["high-protein", "bodybuilding", "balanced", "weight-gain"],
      bonus: 12,
    },
    improve_fitness: {
      diets: [
        "mediterranean",
        "balanced",
        "high-protein",
        "flexitarian",
        "whole-food",
      ],
      bonus: 8,
    },
    increase_energy: {
      diets: [
        "mediterranean",
        "balanced",
        "whole-food",
        "plant-based",
        "flexitarian",
      ],
      bonus: 8,
    },
    better_health: {
      diets: [
        "mediterranean",
        "balanced",
        "whole-food",
        "plant-based",
        "flexitarian",
      ],
      bonus: 9,
    },
    athletic_performance: {
      diets: [
        "high-protein",
        "bodybuilding",
        "balanced",
        "mediterranean",
        "weight-gain",
      ],
      bonus: 11,
    },
  };

  const entry = goalDietMap[goal];
  if (!entry) return 0;
  return entry.diets.includes(dietId) ? entry.bonus : 0;
}

/**
 * Get activity level fit bonus/penalty
 */
function getActivityFit(diet: DietData, activityLevel: string): number {
  // Very active users benefit from higher-calorie / performance diets. Both top
  // tiers qualify: the scale gained a fifth tier, so what used to be the single
  // `very_active` bucket is now `active` (1.725) + `very_active` (1.9).
  if (activityLevel === "very_active" || activityLevel === "active") {
    if (["high-protein", "bodybuilding", "weight-gain"].includes(diet.id))
      return 4;
    if (["very-low-calorie", "low-fat"].includes(diet.id)) return -3;
  }
  // Sedentary users benefit from balanced / moderate diets
  if (activityLevel === "sedentary") {
    if (["balanced", "mediterranean", "low-carb"].includes(diet.id)) return 3;
    if (["bodybuilding", "weight-gain"].includes(diet.id)) return -4;
  }
  return 0;
}

/**
 * Format goal for display
 */
function formatGoal(goal: string): string {
  const names: Record<string, string> = {
    lose_weight: "weight loss",
    build_muscle: "muscle building",
    improve_fitness: "fitness improvement",
    increase_energy: "energy boost",
    better_health: "better health",
    athletic_performance: "athletic performance",
  };
  return names[goal] || goal;
}

/**
 * Get diet by ID
 */
export function getDietById(dietId: string): DietData | undefined {
  return DIET_DATABASE.find((d) => d.id === dietId);
}

/**
 * Get all diets
 */
export function getAllDiets(): DietData[] {
  return DIET_DATABASE;
}
