/**
 * The plan follows the preferences the user gave in onboarding.
 *
 * Pins the reported bug — an African user finishing onboarding and being shown
 * "Mediterranean Diet" as their plan — and the three things underneath it: the
 * diet scorer ignored cuisine, it broke 96-point ties by catalog order
 * (Mediterranean is entry #0), and a dietary restriction was only ever a score
 * nudge, never a rule about what could be served.
 */
import { describe, expect, it } from "vitest";
import { DIET_DATABASE } from "../../constants/DietDatabase";
import type { UserBio } from "../../models/user";
import { calculateDietMatches, getRecommendedDiets } from "../DietMatchService";
import { generateDietPlan } from "../DietPlanGenerator";
import { recommendDiets } from "../intelligence";
import { breaksRestriction, mealCuisine } from "../nutrition/mealRules";
import { calculateNutritionTargets } from "../NutritionService";

function bio(over: Partial<UserBio> = {}): UserBio {
  return {
    age: 30,
    sex: "female",
    heightCm: 168,
    weightKg: 78,
    activityLevel: "sedentary",
    exerciseLevel: "beginner",
    primaryGoal: "lose_weight",
    goals: ["lose_weight"],
    trainingEnabled: false,
    dietaryRestriction: "none",
    cuisinePreference: "african",
    equipment: ["none"],
    workoutDaysPerWeek: 3,
    allergies: [],
    medicalConditions: [],
    mealsPerDay: 3,
    ...over,
  } as UserBio;
}

const top = (b: UserBio) => {
  const { recommended, safeOptions } = recommendDiets(b, calculateNutritionTargets(b));
  return (recommended[0] ?? safeOptions[0])?.dietId;
};

const dates = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];

describe("the diet a user is matched to", () => {
  it("is never the Mediterranean Diet for someone who chose African food", () => {
    for (const goal of ["lose_weight", "build_muscle", "improve_fitness", "better_health", "increase_energy", "athletic_performance"] as const) {
      for (const activityLevel of ["sedentary", "moderate", "very_active"] as const) {
        const b = bio({ primaryGoal: goal, goals: [goal], activityLevel });
        expect(top(b), `${goal}/${activityLevel}`).not.toBe("mediterranean");
      }
    }
  });

  it("is the West African tradition itself when nothing medical competes", () => {
    expect(top(bio())).toBe("traditional-african");
  });

  it("still lets a condition's therapeutic diet lead", () => {
    const b = bio({ medicalConditions: ["diabetes_type2"] });
    expect(top(b)).not.toBe("traditional-african");
    expect(top(b)).not.toBe("mediterranean");
  });

  it("does not push the African tradition on anyone who chose another cuisine", () => {
    for (const cuisinePreference of ["western", "mediterranean"] as const) {
      expect(top(bio({ cuisinePreference }))).not.toBe("traditional-african");
    }
  });

  it("sends a vegetarian to the plan written vegetarian", () => {
    expect(top(bio({ dietaryRestriction: "vegetarian" }))).toBe("vegetarian");
  });

  it("orders by the real fit, not by where a diet sits in the catalog", () => {
    // Mediterranean is entry #0. With every diet tied at the 96 ceiling it used
    // to win every tie; the unclamped rank must now decide.
    const b = bio({ cuisinePreference: "mixed", medicalConditions: ["hypertension", "high_cholesterol", "metabolic_syndrome"] });
    const ranked = getRecommendedDiets(b);
    for (let i = 1; i < ranked.length; i++) {
      expect((ranked[i - 1].rank ?? 0) >= (ranked[i].rank ?? 0)).toBe(true);
    }
  });

  it("tells the user the plan is built from their cuisine", () => {
    const b = bio();
    const { recommended } = recommendDiets(b, calculateNutritionTargets(b));
    expect(recommended[0].reasons[0]).toMatch(/African/);
    // …and never the old blanket line every user was shown regardless.
    const western = bio({ cuisinePreference: "western" });
    const w = recommendDiets(western, calculateNutritionTargets(western));
    for (const r of [...w.recommended, ...w.safeOptions]) {
      expect(r.reasons.join(" ")).not.toMatch(/Nigerian/);
    }
  });

  it("scores every diet without throwing for every cuisine and restriction", () => {
    for (const cuisinePreference of ["african", "western", "mediterranean", "mixed"] as const) {
      for (const dietaryRestriction of ["none", "vegetarian", "vegan", "pescatarian", "halal", "kosher", "gluten_free", "dairy_free"] as const) {
        const matches = calculateDietMatches(bio({ cuisinePreference, dietaryRestriction }));
        expect(matches).toHaveLength(DIET_DATABASE.length);
      }
    }
  });
});

describe("the meals a user is served", () => {
  it("are African every main meal, every day, for an African user", () => {
    const b = bio();
    const targets = calculateNutritionTargets(b);
    for (const date of dates) {
      const day = generateDietPlan(b, targets, date)!.schedule;
      for (const meal of [day.breakfast, day.lunch, day.dinner]) {
        expect(mealCuisine(meal!), `${date} ${meal!.name}`).toBe("Nigerian");
      }
    }
  });

  it("never break the dietary restriction, whichever diet serves them", () => {
    for (const dietaryRestriction of ["vegetarian", "vegan", "pescatarian", "halal", "gluten_free", "dairy_free"] as const) {
      const b = bio({ dietaryRestriction, cuisinePreference: "mixed" });
      const targets = calculateNutritionTargets(b);
      for (const diet of DIET_DATABASE) {
        const day = generateDietPlan(b, targets, dates[0], diet.id)!.schedule;
        for (const meal of [day.breakfast, day.lunch, day.dinner, ...day.snacks]) {
          expect(
            breaksRestriction(meal!.name, dietaryRestriction),
            `${dietaryRestriction} served "${meal!.name}" from ${diet.id}`,
          ).toBe(false);
        }
      }
    }
  });

  it("never contain a declared allergen, including by its other names", () => {
    const b = bio({ allergies: ["peanuts"] });
    const targets = calculateNutritionTargets(b);
    for (const date of dates) {
      const day = generateDietPlan(b, targets, date)!.schedule;
      for (const meal of [day.breakfast, day.lunch, day.dinner, ...day.snacks]) {
        expect(meal!.name.toLowerCase()).not.toMatch(/groundnut|peanut/);
      }
    }
  });

  it("give a 4-meal user the two snacks their plan promises", () => {
    const b = bio({ mealsPerDay: 4 });
    const targets = calculateNutritionTargets(b);
    for (const date of dates) {
      expect(generateDietPlan(b, targets, date)!.schedule.snacks).toHaveLength(2);
    }
  });
});

describe("an Asian user (the kitchen added 2026-10)", () => {
  const asian = (over: Partial<UserBio> = {}) => bio({ cuisinePreference: "asian", ...over });

  it("is matched to the Asian tradition itself when nothing medical competes", () => {
    expect(top(asian())).toBe("traditional-asian");
  });

  it("is never headlined by another kitchen's diet, whatever the goal", () => {
    for (const goal of ["lose_weight", "build_muscle", "improve_fitness", "better_health", "increase_energy", "athletic_performance"] as const) {
      const pick = top(asian({ primaryGoal: goal, goals: [goal] }));
      expect(pick, goal).not.toBe("mediterranean");
      expect(pick, goal).not.toBe("traditional-african");
    }
  });

  it("is served an Asian dish at every main meal, every day", () => {
    const b = asian();
    const targets = calculateNutritionTargets(b);
    for (const date of dates) {
      const day = generateDietPlan(b, targets, date)!.schedule;
      for (const meal of [day.breakfast, day.lunch, day.dinner]) {
        expect(mealCuisine(meal!), `${date} ${meal!.name}`).toBe("Asian");
      }
    }
  });

  it("sends an Asian vegetarian to the vegetarian plan, and serves it Asian", () => {
    const b = asian({ dietaryRestriction: "vegetarian" });
    expect(top(b)).toBe("vegetarian");
    const targets = calculateNutritionTargets(b);
    for (const date of dates) {
      const day = generateDietPlan(b, targets, date, "vegetarian")!.schedule;
      for (const meal of [day.breakfast, day.lunch, day.dinner]) {
        expect(mealCuisine(meal!), meal!.name).toBe("Asian");
        expect(breaksRestriction(meal!.name, "vegetarian"), meal!.name).toBe(false);
      }
    }
  });

  it("does not pull the Asian plan onto anyone who chose another kitchen", () => {
    for (const cuisinePreference of ["african", "western", "mediterranean"] as const) {
      expect(top(bio({ cuisinePreference }))).not.toBe("traditional-asian");
    }
  });
});
