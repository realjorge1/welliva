/**
 * DietLibraryGenerated.ts — AUTO-GENERATED. DO NOT EDIT BY HAND.
 *
 * Source of truth: /diet_dictionary (repo root).
 * Regenerate:      node scripts/build-diet-dictionary.mjs
 *
 * 122 diets + 205 whole foods parsed from the clinical
 * diet dictionary. Diets whose id already exists in the hand-authored
 * DIET_DATABASE are merged/skipped there (base wins), so GENERATED_DIETS is
 * additive only. FOOD_DICTIONARY is the ingredient-level whole-foods catalog
 * (fruits, vegetables, proteins, grains, legumes, dairy, Nigerian staples …).
 */

import type { DietData } from "./DietDatabase";
import type { FoodItem } from "./FoodDictionary";

export const GENERATED_DIETS: DietData[] = [
  {
    "id": "mediterranean",
    "name": "Mediterranean Diet",
    "fullName": "Mediterranean Diet",
    "description": "Vegetables, fruit, whole grains, legumes, olive oil & fish; little red meat.",
    "icon": "heart-outline",
    "difficulty": "Easy",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Vegetables",
        "fruit",
        "whole grains",
        "legumes",
        "olive oil",
        "fish",
        "little red meat."
      ],
      "avoids": [
        "Mind oil/nut portions if in a calorie deficit."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Heart health",
        "longevity",
        "cholesterol",
        "insulin sensitivity",
        "general prevention."
      ],
      "cautionFor": [
        "Mind oil/nut portions if in a calorie deficit."
      ],
      "guidelines": [
        "WHO",
        "AHA",
        "EAT-Lancet",
        "Harvard Healthy Eating"
      ],
      "clinicalNotes": [
        "~2000 kcal · Fat 35–40% (mostly MUFA) · Fiber 30g+ · Fish 2×/week",
        "Heart health, longevity, cholesterol, insulin sensitivity, general prevention."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Greek yogurt + honey + walnuts + figs",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + smashed avocado + tomato + olive oil",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Shakshuka (eggs poached in tomato–pepper sauce) + bread",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Oats + berries + almonds + drizzle of olive oil",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled sardines + wholegrain couscous + garden salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Chickpea & vegetable stew + brown rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Jollof brown rice + grilled fish + steamed greens",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil soup + wholegrain bread + olive-oil salad",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked salmon + roasted vegetables + quinoa",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled chicken + ratatouille + bulgur",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "White-bean & tomato stew + sautéed spinach",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 55,
          "max": 55
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Efo riro (spinach stew, olive oil) + small swallow + fish",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Handful of almonds + olives",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh orange + a few walnuts",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + carrot & cucumber sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Greek yogurt + honey",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "dash",
    "name": "DASH Diet (Hypertension)",
    "fullName": "DASH Diet (Hypertension)",
    "description": "Low sodium, high potassium, calcium, magnesium & fiber to lower blood pressure.",
    "icon": "heart-outline",
    "difficulty": "Easy",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Low sodium",
        "high potassium",
        "calcium",
        "magnesium",
        "fiber to lower blood pressure."
      ],
      "avoids": [
        "Advanced CKD (potassium limits)",
        "some diuretics — check with clinician."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Hypertension",
        "prehypertension",
        "heart-failure prevention."
      ],
      "cautionFor": [
        "Advanced CKD (potassium limits)",
        "some diuretics — check with clinician."
      ],
      "guidelines": [
        "AHA",
        "NHLBI",
        "WHO",
        "NICE"
      ],
      "clinicalNotes": [
        "~2000 kcal · Sodium <1500mg · Potassium ~4700mg · Fiber 30g+",
        "Hypertension, prehypertension, heart-failure prevention."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oatmeal + banana + walnuts (no salt)",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 55,
          "max": 55
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Veg egg-white omelet + wholegrain toast",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Akamu (pap) + unsweetened soy milk + groundnuts",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Low-fat yogurt + berries + chia + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + brown rice + steamed vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 55,
          "max": 55
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans porridge (unsalted) + plantain + greens",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Skinless chicken + sweet potato + spinach salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 45,
          "max": 45
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked chicken breast + roasted vegetables",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled tilapia + boiled yam + garden salad",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "White-bean stew + steamed broccoli",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & tofu stir-fry (low-salt) + brown rice",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Unsalted almonds",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple slices + peanut butter (unsalted)",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Low-fat yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot & celery sticks + hummus",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "low-cholesterol",
    "name": "Low-Cholesterol / Heart-Healthy Diet",
    "fullName": "Low-Cholesterol / Heart-Healthy Diet",
    "description": "Low saturated & trans fat, high soluble fiber, plant sterols, omega-3.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Low saturated",
        "trans fat",
        "high soluble fiber",
        "plant sterols",
        "omega-3."
      ],
      "avoids": [
        "Avoid very-low-fat extremes",
        "keep healthy unsaturated fats."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "High LDL cholesterol",
        "atherosclerosis",
        "cardiovascular risk reduction."
      ],
      "cautionFor": [
        "Avoid very-low-fat extremes",
        "keep healthy unsaturated fats."
      ],
      "guidelines": [
        "AHA",
        "NHS",
        "NCEP ATP III"
      ],
      "clinicalNotes": [
        "~1900 kcal · Sat fat <7% kcal · Soluble fiber 10–25g · No trans fat",
        "High LDL cholesterol, atherosclerosis, cardiovascular risk reduction."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Steel-cut oats + blueberries + walnuts",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + avocado + boiled egg white",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Barley porridge + apple + cinnamon",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soy-milk smoothie + banana + flaxseed",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled mackerel + brown rice + okra",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + wholegrain rice + vegetable sauce",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken (skinless) & vegetable stir-fry + quinoa",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil dhal + wholegrain flatbread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked salmon + steamed vegetables + sweet potato",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean chili + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled fish + boiled plantain + greens",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & broccoli stir-fry + wholegrain noodles",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Handful of walnuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange + oat crackers",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted chickpeas",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple + almond butter",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "low-sodium",
    "name": "Low-Sodium Diet",
    "fullName": "Low-Sodium Diet",
    "description": "Minimize added salt & sodium-rich processed foods; season with herbs/spices.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Minimize added salt",
        "sodium-rich processed foods",
        "season with herbs/spices."
      ],
      "avoids": [
        "Read labels — bread",
        "stock cubes",
        "cured meat",
        "snacks hide sodium."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Hypertension",
        "heart failure",
        "fluid retention/edema",
        "some kidney/liver disease."
      ],
      "cautionFor": [
        "Read labels — bread",
        "stock cubes",
        "cured meat",
        "snacks hide sodium."
      ],
      "guidelines": [
        "AHA",
        "WHO",
        "NHS"
      ],
      "clinicalNotes": [
        "~2000 kcal · Sodium 1500–2000mg/day · No stock cubes/MSG in excess",
        "Hypertension, heart failure, fluid retention/edema, some kidney/liver disease."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Unsalted oats + banana + cinnamon",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh tomato & pepper egg scramble (no salt)",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + fresh milk + groundnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fruit + plain yogurt + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Fresh fish pepper soup (herbs, no cube) + yam",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 45,
          "max": 45
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + plantain (unsalted)",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Grilled chicken + rice + fresh vegetable salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & lentil pot (herb-seasoned)",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Herb-baked chicken + roasted vegetables",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Steamed fish + boiled potatoes + greens",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 45,
          "max": 45
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Unsalted vegetable soup + small swallow",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry (no soy sauce) + rice",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Unsalted nuts",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh fruit (any)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain popcorn (air-popped, no salt)",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cucumber & tomato slices",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "tlc",
    "name": "TLC Diet (Therapeutic Lifestyle Changes)",
    "fullName": "TLC Diet (Therapeutic Lifestyle Changes)",
    "description": "NHLBI plan to cut LDL via low saturated fat, added soluble fiber & plant sterols.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "NHLBI plan to cut LDL via low saturated fat",
        "added soluble fiber",
        "plant sterols."
      ],
      "avoids": [
        "Combine with activity",
        "weight management for full effect."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Elevated LDL",
        "metabolic syndrome",
        "primary prevention of heart disease."
      ],
      "cautionFor": [
        "Combine with activity",
        "weight management for full effect."
      ],
      "guidelines": [
        "NHLBI",
        "NCEP",
        "AHA"
      ],
      "clinicalNotes": [
        "~2000 kcal · Sat fat <7% · Dietary cholesterol <200mg · Fiber 20–30g",
        "Elevated LDL, metabolic syndrome, primary prevention of heart disease."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oat bran cereal + skim milk + berries",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + apple sauce + walnuts",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white & vegetable omelet + rye toast",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soy yogurt + oats + flaxseed + banana",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + barley + steamed vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean & vegetable stew + brown rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Skinless turkey + quinoa salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea curry (light) + wholegrain rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked cod + sweet potato + broccoli",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil loaf + roasted vegetables",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled fish + boiled yam + spinach",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Vegetable & tofu stir-fry + brown rice",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Almonds (23 count)",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pear + oat crackers",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fat-free yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted soy nuts",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "portfolio",
    "name": "Portfolio Diet (Cholesterol-Lowering)",
    "fullName": "Portfolio Diet (Cholesterol-Lowering)",
    "description": "Combine 4 LDL-lowering foods daily — nuts, soy protein, viscous fiber, plant sterols.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Combine 4 LDL-lowering foods daily — nuts",
        "soy protein",
        "viscous fiber",
        "plant sterols."
      ],
      "avoids": [
        "Plant-sterol dose matters",
        "pair with variety to keep it balanced."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "High cholesterol",
        "those preferring food-first LDL reduction."
      ],
      "cautionFor": [
        "Plant-sterol dose matters",
        "pair with variety to keep it balanced."
      ],
      "guidelines": [
        "Jenkins/Portfolio trials",
        "Heart",
        "Stroke",
        "AHA"
      ],
      "clinicalNotes": [
        "~2000 kcal · Soy protein ~45g · Viscous fiber 20g · Nuts ~45g · Sterols 2g",
        "High cholesterol, those preferring food-first LDL reduction."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Soy-milk oat porridge + almonds + berries",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu scramble + wholegrain toast + tomato",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Barley porridge + soy yogurt + flaxseed",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sterol-spread wholegrain toast + soy latte",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Tofu & vegetable stir-fry + eggplant + brown rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean & okra soup (viscous fiber) + wholegrain rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & barley salad + almonds",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil dhal + oat flatbread",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Soy mince chili + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Baked tofu + okra & vegetable stew + yam",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Edamame & barley bowl + peanuts",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & white-bean stew + wholegrain bread",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Roasted almonds + soy nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple + oat bran biscuit",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soy yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Okra crisps / edamame",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "diabetic-friendly",
    "name": "Type 2 Diabetes Diet",
    "fullName": "Type 2 Diabetes Diet",
    "description": "Steady blood glucose via low-GI carbs, high fiber, lean protein, portion control.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Steady blood glucose via low-GI carbs",
        "high fiber",
        "lean protein",
        "portion control."
      ],
      "avoids": [
        "Coordinate carb amount with medication/insulin",
        "watch hypos."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Type 2 diabetes",
        "insulin resistance",
        "weight-related glucose issues."
      ],
      "cautionFor": [
        "Coordinate carb amount with medication/insulin",
        "watch hypos."
      ],
      "guidelines": [
        "ADA",
        "Diabetes UK",
        "WHO"
      ],
      "clinicalNotes": [
        "~1800 kcal · Carbs 45–50% low-GI · Fiber 30g+ · Added sugar minimal",
        "Type 2 diabetes, insulin resistance, weight-related glucose issues."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Vegetable egg omelet + wholegrain toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Unsweetened oats + chia + berries + nuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap (thin) + boiled egg + groundnuts",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Greek yogurt + flaxseed + apple slices",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + brown rice (½ cup) + salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + unripe-plantain porridge + greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + wheat swallow (small) + efo",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + steamed vegetables + ½ sweet potato",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken & vegetable stir-fry + cauliflower rice",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & greens + small wholegrain swallow",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable pepper soup + grilled fish",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Handful of peanuts",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple + cheese cube",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cucumber + boiled egg",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain Greek yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "diabetes-type1",
    "name": "Type 1 Diabetes / Carb-Counting Diet",
    "fullName": "Type 1 Diabetes / Carb-Counting Diet",
    "description": "Consistent, countable carbohydrate at each meal to match insulin dosing.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Consistent",
        "countable carbohydrate at each meal to match insulin dosing."
      ],
      "avoids": [
        "Carb totals shown per meal for bolus calc",
        "always confirm ratios with clinician."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Type 1 diabetes",
        "insulin-dependent Type 2",
        "pump/MDI users."
      ],
      "cautionFor": [
        "Carb totals shown per meal for bolus calc",
        "always confirm ratios with clinician."
      ],
      "guidelines": [
        "ADA",
        "ISPAD",
        "Diabetes UK"
      ],
      "clinicalNotes": [
        "~2000 kcal · Carbs counted per meal (≈45–60g) · Consistent timing",
        "Type 1 diabetes, insulin-dependent Type 2, pump/MDI users."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Wholegrain toast (2) + egg + avocado",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + milk + berries (measured)",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + boiled egg + orange",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + granola (weighed) + banana",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + rice (1 cup) + salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 55,
          "max": 55
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + one plantain + vegetables",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + wheat swallow (weighed) + efo",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Pasta (measured) + tomato & chicken sauce",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + boiled yam (weighed) + greens",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Chicken stir-fry + rice (¾ cup)",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil stew + wholegrain rice (measured)",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Jollof rice (1 cup) + grilled protein + salad",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Apple",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "3 crackers + cheese",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Small banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Glucose tabs / juice (hypo rescue)",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "prediabetes",
    "name": "Prediabetes / Insulin-Resistance Diet",
    "fullName": "Prediabetes / Insulin-Resistance Diet",
    "description": "Reverse rising glucose with low-GI carbs, fiber, protein, weight loss & activity.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Reverse rising glucose with low-GI carbs",
        "fiber",
        "protein",
        "weight loss",
        "activity."
      ],
      "avoids": [
        "Reduce refined carbs",
        "sugary drinks",
        "pair carbs with protein/fat."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Prediabetes",
        "PCOS-linked insulin resistance",
        "metabolic-syndrome risk."
      ],
      "cautionFor": [
        "Reduce refined carbs",
        "sugary drinks",
        "pair carbs with protein/fat."
      ],
      "guidelines": [
        "ADA (prevention)",
        "CDC National DPP",
        "WHO"
      ],
      "clinicalNotes": [
        "~1700 kcal · Low-GI · Fiber 30g+ · 5–7% weight loss goal",
        "Prediabetes, PCOS-linked insulin resistance, metabolic-syndrome risk."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Veggie omelet + avocado + tomato",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chia-oat pudding + berries + nuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Unsweetened pap + boiled egg + groundnuts",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Greek yogurt + flax + apple",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken salad + olive oil + beans",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + unripe plantain + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable bowl + ½ cup brown rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu stir-fry + cauliflower rice",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + greens + small sweet potato",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable pepper soup + grilled protein",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans porridge (small) + steamed greens",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Almonds",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + cucumber",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Berries + plain yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Celery + peanut butter",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "low-gi",
    "name": "Low-Glycemic-Index (Low-GI) Diet",
    "fullName": "Low-Glycemic-Index (Low-GI) Diet",
    "description": "Choose slow-digesting carbs (GI <55) for stable energy and glucose.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Choose slow-digesting carbs (GI <55) for stable energy and glucose."
      ],
      "avoids": [
        "GI isn't everything — portion (glycemic load) still counts."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Diabetes",
        "PCOS",
        "weight management",
        "sustained-energy needs."
      ],
      "cautionFor": [
        "GI isn't everything — portion (glycemic load) still counts."
      ],
      "guidelines": [
        "University of Sydney GI",
        "ADA",
        "Diabetes UK"
      ],
      "clinicalNotes": [
        "~1900 kcal · Prefer GI <55 staples · Fiber 30g+",
        "Diabetes, PCOS, weight management, sustained-energy needs."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Steel-cut oats + apple + cinnamon + nuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain rye toast + egg + avocado",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans (moi-moi) + orange",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Plain yogurt + berries + barley flakes",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chickpea & vegetable stew + parboiled/ofada rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Grilled fish + wholewheat pasta (al dente) + salad",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + unripe plantain + greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil soup + pumpernickel bread",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled chicken + barley + steamed vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sweet potato (small) + greens",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + basmati (small)",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean chili + wholegrain rice",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Apple + peanuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + carrot sticks",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Plain yogurt + berries",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Handful of cashews",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 9,
          "max": 9
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "metabolic-syndrome",
    "name": "Metabolic Syndrome Diet",
    "fullName": "Metabolic Syndrome Diet",
    "description": "Tackle the cluster — belly fat, high BP, high glucose, high triglycerides, low HDL.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Tackle the cluster — belly fat",
        "high BP",
        "high glucose",
        "high triglycerides",
        "low HDL."
      ],
      "avoids": [
        "Cut refined carbs",
        "sugary drinks",
        "alcohol",
        "prioritize fiber",
        "activity."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Metabolic syndrome",
        "high triglycerides",
        "central obesity."
      ],
      "cautionFor": [
        "Cut refined carbs",
        "sugary drinks",
        "alcohol",
        "prioritize fiber",
        "activity."
      ],
      "guidelines": [
        "AHA/NHLBI",
        "IDF",
        "ADA"
      ],
      "clinicalNotes": [
        "~1700 kcal · Low added sugar · Fiber 30g+ · Healthy fats · Modest deficit",
        "Metabolic syndrome, high triglycerides, central obesity."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Veggie omelet + avocado + wholegrain toast",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + berries + walnuts + chia",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi (bean pudding) + pepper sauce + orange",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Greek yogurt + flaxseed + apple",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + vegetable salad + beans",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + brown rice (½ cup) + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + quinoa",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked salmon + roasted vegetables",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + greens + ½ sweet potato",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable pepper soup + grilled fish",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Bean chili + cauliflower rice",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Mixed nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 7,
          "max": 7
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + cucumber",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Berries + plain yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted chickpeas",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "calorie-counting",
    "name": "Weight-Loss / Calorie-Deficit Diet",
    "fullName": "Weight-Loss / Calorie-Deficit Diet",
    "description": "Moderate calorie deficit with high protein & fiber to preserve muscle and stay full.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Moderate calorie deficit with high protein",
        "fiber to preserve muscle and stay full."
      ],
      "avoids": [
        "Avoid crash dieting",
        "aim ~0.5–1kg/week",
        "keep protein high."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Overweight/obesity",
        "general fat loss",
        "obesity-linked conditions."
      ],
      "cautionFor": [
        "Avoid crash dieting",
        "aim ~0.5–1kg/week",
        "keep protein high."
      ],
      "guidelines": [
        "WHO",
        "NICE",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~1500 kcal · Protein 1.6g/kg · Fiber 30g+ · 500 kcal/day deficit",
        "Overweight/obesity, general fat loss, obesity-linked conditions."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Egg-white & vegetable scramble + 1 toast",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Overnight oats + berries + Greek yogurt",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi (small) + orange",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Protein smoothie (banana, milk, whey)",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken salad + light dressing",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + ½ cup rice + big vegetable side",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + steamed vegetables (small plantain)",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil soup + side salad",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + cauliflower rice + greens",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & tofu soup + small swallow",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pepper soup (fish) + steamed greens",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Apple",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain Greek yogurt",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot & cucumber sticks",
        "calories": {
          "min": 50,
          "max": 50
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "keto",
    "name": "Ketogenic Diet",
    "fullName": "Ketogenic Diet",
    "description": "Very low carb, high fat, moderate protein to shift metabolism to ketones.",
    "icon": "heart-outline",
    "difficulty": "Advanced",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Very low carb",
        "high fat",
        "moderate protein to shift metabolism to ketones."
      ],
      "avoids": [
        "NOT for Type 1 (DKA risk)",
        "pregnancy",
        "pancreatitis",
        "gallbladder issues",
        "needs monitoring."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Some weight loss",
        "epilepsy (medical keto)",
        "select metabolic goals."
      ],
      "cautionFor": [
        "NOT for Type 1 (DKA risk)",
        "pregnancy",
        "pancreatitis",
        "gallbladder issues",
        "needs monitoring."
      ],
      "guidelines": [
        "Epilepsy medical keto protocols",
        "clinician-supervised"
      ],
      "clinicalNotes": [
        "~1800 kcal · Carbs <30g · Fat ~70% · Protein moderate · Electrolytes",
        "Some weight loss, epilepsy (medical keto), select metabolic goals."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs fried in butter + avocado + spinach",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 36,
          "max": 36
        },
        "cuisine": "Universal"
      },
      {
        "name": "Full-fat yogurt + walnuts + chia",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 32,
          "max": 32
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese & vegetable omelet",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 32,
          "max": 32
        },
        "cuisine": "Universal"
      },
      {
        "name": "Keto smoothie (coconut milk, avocado, cocoa)",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 36,
          "max": 36
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken thigh + cauliflower rice + olive oil",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 36,
          "max": 36
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + buttered greens + avocado",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 36,
          "max": 36
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & vegetable stir-fry (no sugar)",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 9,
          "max": 9
        },
        "fat": {
          "min": 34,
          "max": 34
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable salad + olive-oil dressing",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 7,
          "max": 7
        },
        "fat": {
          "min": 38,
          "max": 38
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + asparagus + hollandaise",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 38,
          "max": 38
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + zucchini noodles + pesto",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 34,
          "max": 34
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pepper soup (goat/fish) + leafy greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 30,
          "max": 30
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable coconut curry (low-carb)",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 38,
          "max": 38
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Cheese cubes",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 2,
          "max": 2
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Macadamia nuts",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 21,
          "max": 21
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs (2)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Olives + avocado",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "low-carb",
    "name": "Low-Carbohydrate Diet",
    "fullName": "Low-Carbohydrate Diet",
    "description": "Reduce (not eliminate) carbs; emphasize protein, vegetables & healthy fats.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Reduce (not eliminate) carbs",
        "emphasize protein",
        "vegetables",
        "healthy fats."
      ],
      "avoids": [
        "Less extreme than keto",
        "keep fiber up",
        "not for endurance athletes mid-season."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Weight loss",
        "Type 2 diabetes glucose control",
        "triglyceride reduction."
      ],
      "cautionFor": [
        "Less extreme than keto",
        "keep fiber up",
        "not for endurance athletes mid-season."
      ],
      "guidelines": [
        "ADA (low-carb option)",
        "Diabetes UK"
      ],
      "clinicalNotes": [
        "~1800 kcal · Carbs 50–100g/day · High protein · High non-starchy veg",
        "Weight loss, Type 2 diabetes glucose control, triglyceride reduction."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Veggie omelet + avocado",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries + almonds",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + tomato & cucumber",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chia pudding (unsweetened) + walnuts",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + big salad + olive oil",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sautéed greens + ¼ cup rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & vegetable stir-fry",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & bean salad (small beans) + avocado",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + cauliflower mash + greens",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pepper soup + grilled protein",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable curry (light)",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Cheese + olives",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 3,
          "max": 3
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Mixed nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 7,
          "max": 7
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cucumber + guacamole",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "intermittent-fasting",
    "name": "Intermittent Fasting Plan (16:8)",
    "fullName": "Intermittent Fasting Plan (16:8)",
    "description": "Time-restricted eating (8-hour window) with balanced, protein-forward meals.",
    "icon": "heart-outline",
    "difficulty": "Moderate",
    "category": "Cardiovascular & Metabolic",
    "principles": {
      "emphasis": [
        "Time-restricted eating (8-hour window) with balanced",
        "protein-forward meals."
      ],
      "avoids": [
        "NOT for pregnancy",
        "T1 diabetes",
        "eating-disorder history",
        "some meds",
        "hydrate well."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Weight management",
        "insulin sensitivity",
        "simplified meal structure."
      ],
      "cautionFor": [
        "NOT for pregnancy",
        "T1 diabetes",
        "eating-disorder history",
        "some meds",
        "hydrate well."
      ],
      "guidelines": [
        "Emerging TRE research",
        "clinician guidance"
      ],
      "clinicalNotes": [
        "~1800 kcal in 8-hr window · Break fast with protein+fiber · Water/black coffee/tea while fasting",
        "Weight management, insulin sensitivity, simplified meal structure."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Veggie omelet + avocado + wholegrain toast",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt bowl + oats + berries + nuts",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + boiled egg + orange",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Protein smoothie + banana + peanut butter",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + brown rice + vegetables",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable bowl + quinoa",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables + sweet potato",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken stir-fry + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable pepper soup + protein + small swallow",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable curry + brown rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Handful of nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 7,
          "max": 7
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple + peanut butter",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + fruit",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "ulcer-gerd-friendly",
    "name": "GERD / Acid-Reflux Diet",
    "fullName": "GERD / Acid-Reflux Diet",
    "description": "Non-acidic, low-fat, non-spicy foods; smaller meals; nothing right before bed.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Non-acidic",
        "low-fat",
        "non-spicy foods",
        "smaller meals",
        "nothing right before bed."
      ],
      "avoids": [
        "Avoid citrus",
        "tomato",
        "chocolate",
        "mint",
        "coffee",
        "alcohol"
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Acid reflux",
        "heartburn",
        "hiatal hernia",
        "LPR/silent reflux."
      ],
      "cautionFor": [
        "Avoid citrus",
        "tomato",
        "chocolate",
        "mint",
        "coffee",
        "alcohol"
      ],
      "guidelines": [
        "ACG",
        "NHS",
        "Mayo Clinic"
      ],
      "clinicalNotes": [
        "~2000 kcal · Low fat · Small frequent meals · Upright 2–3h after eating",
        "Acid reflux, heartburn, hiatal hernia, LPR/silent reflux."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oatmeal + banana + almond milk",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + low-fat milk + pear",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg-white omelet + wholegrain toast",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice porridge + melon",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Baked skinless chicken + white rice + green beans",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled fish + yam + steamed carrots",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Couscous + steamed vegetables (no tomato)",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Soft beans porridge (no pepper, little oil)",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + mashed potatoes + zucchini",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + rice + steamed vegetables",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & potato soup (mild)",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Baked chicken + boiled plantain + spinach",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes / plain crackers",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Low-fat yogurt (non-citrus)",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Melon slices",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "gastritis",
    "name": "Gastritis Diet",
    "fullName": "Gastritis Diet",
    "description": "Anti-inflammatory, low-acid, low-fat foods that calm the stomach lining.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Anti-inflammatory",
        "low-acid",
        "low-fat foods that calm the stomach lining."
      ],
      "avoids": [
        "Avoid alcohol",
        "caffeine",
        "spicy",
        "fried",
        "acidic",
        "carbonated items."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Acute/chronic gastritis",
        "stomach inflammation",
        "H. pylori (with therapy)."
      ],
      "cautionFor": [
        "Avoid alcohol",
        "caffeine",
        "spicy",
        "fried",
        "acidic",
        "carbonated items."
      ],
      "guidelines": [
        "ACG",
        "NHS",
        "Mayo Clinic"
      ],
      "clinicalNotes": [
        "~2000 kcal · Low fat · Probiotics · Small frequent meals",
        "Acute/chronic gastritis, stomach inflammation, H. pylori (with therapy)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oatmeal + banana + honey",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + low-fat milk",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Soft scrambled egg + white toast",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice porridge + pear",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Steamed fish + white rice + carrots",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled chicken + mashed potato + green beans",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft vegetable & rice pot (mild)",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans porridge (no pepper)",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + boiled yam + spinach",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + rice + steamed zucchini",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup (mild) + soft swallow",
        "calories": {
          "min": 370,
          "max": 370
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + mashed potato + carrots",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Probiotic yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain crackers",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cooked apple + cinnamon",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "ibs-low-fodmap",
    "name": "IBS Diet (Low-FODMAP)",
    "fullName": "IBS Diet (Low-FODMAP)",
    "description": "Limit fermentable carbs (FODMAPs) that trigger bloating, gas, pain & irregular bowel.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Limit fermentable carbs (FODMAPs) that trigger bloating",
        "gas",
        "pain",
        "irregular bowel."
      ],
      "avoids": [
        "3-phase plan — eliminate",
        "reintroduce",
        "personalize. Not a forever diet."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Irritable bowel syndrome",
        "functional bloating",
        "SIBO-related symptoms."
      ],
      "cautionFor": [
        "3-phase plan — eliminate",
        "reintroduce",
        "personalize. Not a forever diet."
      ],
      "guidelines": [
        "Monash University FODMAP",
        "NICE",
        "BDA"
      ],
      "clinicalNotes": [
        "~2000 kcal · Low-FODMAP · Avoid onion/garlic/wheat/lactose/some fruits · Fiber to tolerance",
        "Irritable bowel syndrome, functional bloating, SIBO-related symptoms."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats (GF) + strawberries + lactose-free milk",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Scrambled eggs + gluten-free toast + spinach",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice porridge + firm banana + walnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lactose-free yogurt + blueberries + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + white rice + carrots & zucchini",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + potato + green beans",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Quinoa bowl + tofu (firm) + spinach + olive oil",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice noodles + shrimp + bok choy (garlic-infused oil only)",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked salmon + rice + carrots",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + polenta + zucchini",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & potato stew (no onion/garlic)",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & rice stir-fry (chive tops, ginger)",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Firm banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes + peanut butter",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lactose-free yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Handful of walnuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "ibd-crohns-colitis",
    "name": "IBD Diet (Crohn's & Ulcerative Colitis)",
    "fullName": "IBD Diet (Crohn's & Ulcerative Colitis)",
    "description": "Gentle, nutrient-dense foods; low residue in flares, liberalized in remission.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Gentle",
        "nutrient-dense foods",
        "low residue in flares",
        "liberalized in remission."
      ],
      "avoids": [
        "Individualized — flare vs remission differ",
        "watch for anemia/B12/iron deficits."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Crohn's disease",
        "ulcerative colitis",
        "inflammatory bowel disease."
      ],
      "cautionFor": [
        "Individualized — flare vs remission differ",
        "watch for anemia/B12/iron deficits."
      ],
      "guidelines": [
        "Crohn's",
        "Colitis Foundation",
        "ESPEN",
        "BDA"
      ],
      "clinicalNotes": [
        "~2200 kcal · Adequate protein & calories · Low insoluble fiber in flare · Hydration",
        "Crohn's disease, ulcerative colitis, inflammatory bowel disease."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Cream of rice + banana + smooth peanut butter",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Scrambled eggs + white toast",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oatmeal (well-cooked) + lactose-free milk",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smoothie (banana, protein, lactose-free milk)",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Baked skinless chicken + white rice + peeled zucchini",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Steamed fish + mashed potato + carrots",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + soft pasta + peeled squash",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smooth lentil soup (strained) + white bread",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + white rice + peeled cooked carrots",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + mashed sweet potato + spinach (well-cooked)",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Minced beef + soft polenta",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Poached fish + rice porridge",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Ripe banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lactose-free yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smooth nut butter on white toast",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oral nutrition shake (if advised)",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "diverticulitis",
    "name": "Diverticulitis / Diverticular Diet",
    "fullName": "Diverticulitis / Diverticular Diet",
    "description": "Clear→low-fiber during acute flare; gradually build to high-fiber for prevention.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Clear→low-fiber during acute flare",
        "gradually build to high-fiber for prevention."
      ],
      "avoids": [
        "Low residue during a flare only",
        "long-term goal is HIGH fiber + hydration."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Diverticulitis (acute) and diverticulosis (long-term prevention)."
      ],
      "cautionFor": [
        "Low residue during a flare only",
        "long-term goal is HIGH fiber + hydration."
      ],
      "guidelines": [
        "ASCRS",
        "NHS",
        "Mayo Clinic"
      ],
      "clinicalNotes": [
        "Flare: low fiber · Recovery/prevention: fiber 25–35g · Water 2L+",
        "Diverticulitis (acute) and diverticulosis (long-term prevention)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Wholegrain oats + berries + chia",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholewheat toast + egg + avocado",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bran cereal + milk + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + groundnuts + orange",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + brown rice + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled fish + wholegrain rice + salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & chickpea stew + wholegrain couscous",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Mediterranean"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked chicken + sweet potato + broccoli",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + boiled yam + efo",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Bean chili + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup + wholegrain swallow",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Apple with skin",
        "calories": {
          "min": 95,
          "max": 95
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 25,
          "max": 25
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain crackers + hummus",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Bran muffin (small)",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Prunes / dried figs",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 31,
          "max": 31
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "gluten-free",
    "name": "Celiac / Gluten-Free Diet",
    "fullName": "Celiac / Gluten-Free Diet",
    "description": "Strictly remove wheat, barley, rye & cross-contamination; naturally GF whole foods.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Strictly remove wheat",
        "barley",
        "rye",
        "cross-contamination",
        "naturally GF whole foods."
      ],
      "avoids": [
        "Watch hidden gluten (soy sauce",
        "stock",
        "oats unless certified GF)",
        "ensure iron/B-vits/fiber."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Celiac disease",
        "dermatitis herpetiformis",
        "non-celiac gluten sensitivity."
      ],
      "cautionFor": [
        "Watch hidden gluten (soy sauce",
        "stock",
        "oats unless certified GF)",
        "ensure iron/B-vits/fiber."
      ],
      "guidelines": [
        "Celiac Disease Foundation",
        "NICE",
        "BDA"
      ],
      "clinicalNotes": [
        "~2100 kcal · 100% gluten-free · Fiber from rice, corn, beans, GF oats",
        "Celiac disease, dermatitis herpetiformis, non-celiac gluten sensitivity."
      ]
    },
    "breakfastOptions": [
      {
        "name": "GF oats + banana + almond milk",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + plantain + avocado",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Pap (maize/millet) + milk + groundnuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "GF toast + peanut butter + banana",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Jollof rice + grilled chicken + salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + plantain + vegetables",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Grilled fish + yam + efo riro",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Quinoa bowl + chickpeas + roasted vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + rice + steamed vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + sweet potato + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & vegetable stir-fry (GF sauce) + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + GF flatbread",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fruit + nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes + peanut butter",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain yogurt + berries",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted plantain chips (baked)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ]
  },
  {
    "id": "high-fiber",
    "name": "Constipation / High-Fiber Diet",
    "fullName": "Constipation / High-Fiber Diet",
    "description": "Boost soluble + insoluble fiber and fluids to restore regular, comfortable bowel movements.",
    "icon": "nutrition-outline",
    "difficulty": "Easy",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Boost soluble + insoluble fiber and fluids to restore regular",
        "comfortable bowel movements."
      ],
      "avoids": [
        "Increase fiber gradually + drink water",
        "or bloating worsens."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Chronic constipation",
        "low-fiber intake",
        "IBS-C",
        "hemorrhoid prevention."
      ],
      "cautionFor": [
        "Increase fiber gradually + drink water",
        "or bloating worsens."
      ],
      "guidelines": [
        "NHS",
        "Academy of Nutrition",
        "Dietetics",
        "WGO"
      ],
      "clinicalNotes": [
        "~2000 kcal · Fiber 30–40g · Water 2–2.5L · Probiotics",
        "Chronic constipation, low-fiber intake, IBS-C, hemorrhoid prevention."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Bran flakes + milk + berries + flaxseed",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 13,
          "max": 13
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain oats + prunes + walnuts",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholewheat toast + avocado + egg",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + wheat bran + groundnuts + pear",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + brown rice + vegetable sauce",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean soup + wholegrain bread",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled fish + wholegrain rice + okra + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil dhal + wholegrain flatbread + salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Chicken + sweet potato (skin on) + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean chili + wholegrain rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup (okra/ewedu) + wholegrain swallow",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + boiled beans + steamed greens",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Prunes / dried figs",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 31,
          "max": 31
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple + pear (with skin)",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 31,
          "max": 31
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Popcorn (air-popped)",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chia pudding",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "low-residue-diarrhea",
    "name": "Chronic Diarrhea / BRAT-Plus Diet",
    "fullName": "Chronic Diarrhea / BRAT-Plus Diet",
    "description": "Binding, low-residue, easily absorbed foods + fluid & electrolyte replacement.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Binding",
        "low-residue",
        "easily absorbed foods + fluid",
        "electrolyte replacement."
      ],
      "avoids": [
        "Short-term",
        "avoid dairy (temporarily)",
        "caffeine",
        "fried",
        "high-fiber",
        "sugar alcohols. Rehydrate."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Acute/chronic diarrhea",
        "gastroenteritis recovery",
        "post-antibiotic gut upset."
      ],
      "cautionFor": [
        "Short-term",
        "avoid dairy (temporarily)",
        "caffeine",
        "fried",
        "high-fiber",
        "sugar alcohols. Rehydrate."
      ],
      "guidelines": [
        "WHO ORS",
        "NHS",
        "WGO"
      ],
      "clinicalNotes": [
        "~1900 kcal · Low residue · ORS/electrolytes · Probiotics as gut settles",
        "Acute/chronic diarrhea, gastroenteritis recovery, post-antibiotic gut upset."
      ]
    },
    "breakfastOptions": [
      {
        "name": "White rice porridge + banana",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain toast + smooth peanut butter",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cream of rice + applesauce",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled potato + poached egg",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "White rice + boiled skinless chicken + carrots",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled fish + white rice + peeled squash",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain pasta + a little olive oil + boiled chicken",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Mashed potato + poached fish",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Rice + boiled turkey + cooked carrots",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken broth + rice + soft white bread",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Poached fish + boiled potato",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft-cooked eggs + white toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain white crackers",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Applesauce",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oral rehydration solution",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "bariatric-post-surgery",
    "name": "Bariatric Post-Surgery Diet",
    "fullName": "Bariatric Post-Surgery Diet",
    "description": "Staged texture progression (liquid→puree→soft→solid); protein-first, tiny portions.",
    "icon": "nutrition-outline",
    "difficulty": "Advanced",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Staged texture progression (liquid→puree→soft→solid)",
        "protein-first",
        "tiny portions."
      ],
      "avoids": [
        "Protein target essential",
        "sip fluids between (not with) meals",
        "lifelong vitamins."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Gastric bypass/sleeve recovery",
        "post-bariatric long-term eating."
      ],
      "cautionFor": [
        "Protein target essential",
        "sip fluids between (not with) meals",
        "lifelong vitamins."
      ],
      "guidelines": [
        "ASMBS",
        "BOMSS",
        "clinical bariatric teams"
      ],
      "clinicalNotes": [
        "600–1000 kcal early · Protein 60–80g · Small volume · B12/iron/calcium/D supplements",
        "Gastric bypass/sleeve recovery, post-bariatric long-term eating."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Scrambled egg + soft avocado",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein yogurt (Greek, blended)",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cottage cheese + soft berries",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein shake + oats (thin)",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Flaked fish + mashed pumpkin",
        "calories": {
          "min": 240,
          "max": 240
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Minced chicken + mashed potato (small)",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft beans (blended) + a little oil",
        "calories": {
          "min": 240,
          "max": 240
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg salad (light mayo)",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Poached fish + soft-cooked vegetables",
        "calories": {
          "min": 240,
          "max": 240
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Minced turkey + mashed sweet potato (small)",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Silken tofu + soft greens",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Blended lentil soup",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "String cheese",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt (small)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein water / shake",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "lactose-free",
    "name": "Lactose-Intolerance / Dairy-Light Diet",
    "fullName": "Lactose-Intolerance / Dairy-Light Diet",
    "description": "Remove/limit lactose; use plant or lactose-free alternatives; protect calcium & vitamin D.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Remove/limit lactose",
        "use plant or lactose-free alternatives",
        "protect calcium",
        "vitamin D."
      ],
      "avoids": [
        "Hard cheeses",
        "yogurt often tolerated",
        "ensure calcium from other sources."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Lactose intolerance",
        "dairy-sensitive digestion."
      ],
      "cautionFor": [
        "Hard cheeses",
        "yogurt often tolerated",
        "ensure calcium from other sources."
      ],
      "guidelines": [
        "NHS",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~2000 kcal · Lactose-free · Calcium 1000mg from fortified/plant sources · Vitamin D",
        "Lactose intolerance, dairy-sensitive digestion."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + almond/soy milk + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + soy milk + groundnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lactose-free yogurt + berries + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable stir-fry + brown rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + rice + steamed vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil stew + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean soup + swallow",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fortified soy yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Almonds (calcium-rich)",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange + tahini crackers",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Fortified plant-milk smoothie",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "sibo",
    "name": "SIBO / Gut-Rebalance Diet",
    "fullName": "SIBO / Gut-Rebalance Diet",
    "description": "Reduce fermentable carbs feeding bacterial overgrowth; support motility; targeted reintroduction.",
    "icon": "nutrition-outline",
    "difficulty": "Moderate",
    "category": "Digestive & Gastrointestinal",
    "principles": {
      "emphasis": [
        "Reduce fermentable carbs feeding bacterial overgrowth",
        "support motility",
        "targeted reintroduction."
      ],
      "avoids": [
        "Usually alongside medical treatment",
        "overly long restriction harms the microbiome."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Small intestinal bacterial overgrowth",
        "chronic bloating with distension."
      ],
      "cautionFor": [
        "Usually alongside medical treatment",
        "overly long restriction harms the microbiome."
      ],
      "guidelines": [
        "Low-FODMAP + SCD frameworks",
        "gastroenterology guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Low-fermentation (low-FODMAP/SCD blend) · Spaced meals · Adequate protein",
        "Small intestinal bacterial overgrowth, chronic bloating with distension."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + spinach + firm banana",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lactose-free yogurt + blueberries + walnuts",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "GF oats (small) + almond milk + strawberries",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Omelet + zucchini + tomato",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + white rice + carrots",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + potato + green beans",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Firm tofu + rice + bok choy (garlic-oil)",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + zucchini noodles + olive oil",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + rice + spinach",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + polenta + peeled squash",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef + potato (no onion/garlic)",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Poached fish + carrots + rice",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Firm banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Walnuts / macadamia",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lactose-free yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes + peanut butter",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "renal-friendly",
    "name": "Renal / CKD Diet (Pre-Dialysis)",
    "fullName": "Renal / CKD Diet (Pre-Dialysis)",
    "description": "Controlled protein, low sodium, potassium & phosphorus to protect failing kidneys.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Controlled protein",
        "low sodium",
        "potassium",
        "phosphorus to protect failing kidneys."
      ],
      "avoids": [
        "Avoid bananas",
        "oranges",
        "tomatoes",
        "potatoes (unless leached)",
        "nuts",
        "whole grains"
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Chronic kidney disease stages 3–5 (not yet on dialysis)."
      ],
      "cautionFor": [
        "Avoid bananas",
        "oranges",
        "tomatoes",
        "potatoes (unless leached)",
        "nuts",
        "whole grains"
      ],
      "guidelines": [
        "KDOQI",
        "KDIGO",
        "NKF"
      ],
      "clinicalNotes": [
        "~1900 kcal · Protein 0.6–0.8g/kg · Sodium <2000mg · K+ <2000mg · Phosphorus <1000mg",
        "Chronic kidney disease stages 3–5 (not yet on dialysis)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Cream of rice + egg-white omelet + apple",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "White bread toast + egg white + pear",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cereal + unsweetened rice milk",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap (ogi) + soy-free rice milk",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "White rice + small grilled fish + double-boiled cabbage",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Couscous + steamed leached vegetables",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Yam porridge (no palm oil, low salt)",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Pasta + olive-oil peppers (low-K)",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Small chicken portion + white rice + boiled green beans",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sole fillet + pasta + leached cauliflower",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white scramble + white bread + zucchini",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tilapia + white rice + lettuce salad",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Unsalted crackers",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple slices",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cake + jelly",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Blueberries (small)",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "dialysis",
    "name": "Dialysis Diet",
    "fullName": "Dialysis Diet",
    "description": "HIGHER protein (protein lost in dialysate), tight potassium/phosphorus/sodium & fluid limits.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "HIGHER protein (protein lost in dialysate)",
        "tight potassium/phosphorus/sodium",
        "fluid limits."
      ],
      "avoids": [
        "Fluid restriction critical",
        "phosphate binders with meals",
        "avoid high-K fruits",
        "dairy."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Hemodialysis / peritoneal dialysis patients."
      ],
      "cautionFor": [
        "Fluid restriction critical",
        "phosphate binders with meals",
        "avoid high-K fruits",
        "dairy."
      ],
      "guidelines": [
        "KDOQI",
        "KDIGO",
        "renal dietitian"
      ],
      "clinicalNotes": [
        "~2000 kcal · Protein 1.0–1.2g/kg · Sodium <2000mg · K+ <2000mg · Phosphorus <1000mg · Fluid limit",
        "Hemodialysis / peritoneal dialysis patients."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Egg-white omelet + white toast + apple",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cream of wheat + egg whites",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "White bread + tuna (low-sodium)",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice porridge + boiled egg whites",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken breast + white rice + boiled cabbage",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + pasta + leached carrots",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + white rice + green beans",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white fried rice + peppers",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked cod + white rice + leached cauliflower",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + couscous + zucchini",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Shrimp + pasta + peppers",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sole + white bread + lettuce",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Unsalted rice crackers + tuna",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white bites",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 2,
          "max": 2
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Blueberries",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "kidney-stone",
    "name": "Kidney-Stone Prevention Diet",
    "fullName": "Kidney-Stone Prevention Diet",
    "description": "High fluids, normal calcium (with meals), low sodium, low oxalate & moderate animal protein.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "High fluids",
        "normal calcium (with meals)",
        "low sodium",
        "low oxalate",
        "moderate animal protein."
      ],
      "avoids": [
        "Don't cut dietary calcium (raises stone risk)",
        "limit spinach",
        "nuts",
        "tea",
        "chocolate",
        "add citrate."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Calcium-oxalate stone prevention",
        "recurrent kidney stones."
      ],
      "cautionFor": [
        "Don't cut dietary calcium (raises stone risk)",
        "limit spinach",
        "nuts",
        "tea",
        "chocolate",
        "add citrate."
      ],
      "guidelines": [
        "AUA",
        "NKF",
        "Mayo Clinic"
      ],
      "clinicalNotes": [
        "Fluid 2.5–3L · Sodium <2300mg · Calcium 1000–1200mg with meals · Low oxalate",
        "Calcium-oxalate stone prevention, recurrent kidney stones."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oatmeal + milk + blueberries",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + melon + wholegrain toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + white toast + orange",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + pawpaw (papaya)",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + rice + cucumber salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + couscous + mixed low-oxalate vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Bean & vegetable stew + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread + lemon water",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + potato + green beans",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + rice + cauliflower",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup + swallow (moderate)",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + couscous + carrots",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Mediterranean"
      }
    ],
    "snackOptions": [
      {
        "name": "Lemon/lime water",
        "calories": {
          "min": 15,
          "max": 15
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Melon / pawpaw",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Low-fat yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "liver-friendly",
    "name": "Fatty-Liver (NAFLD) Diet",
    "fullName": "Fatty-Liver (NAFLD) Diet",
    "description": "Weight loss, low sugar/refined carbs, high fiber, anti-inflammatory fats to de-fat the liver.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Weight loss",
        "low sugar/refined carbs",
        "high fiber",
        "anti-inflammatory fats to de-fat the liver."
      ],
      "avoids": [
        "No alcohol",
        "cut fructose/sugary drinks",
        "7–10% weight loss reverses steatosis."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Non-alcoholic fatty liver disease",
        "NASH",
        "metabolic-associated liver disease."
      ],
      "cautionFor": [
        "No alcohol",
        "cut fructose/sugary drinks",
        "7–10% weight loss reverses steatosis."
      ],
      "guidelines": [
        "AASLD",
        "EASL",
        "Mediterranean-diet evidence"
      ],
      "clinicalNotes": [
        "~1700 kcal · Low added sugar · Fiber 30g+ · MUFA/omega-3 · No alcohol",
        "Non-alcoholic fatty liver disease, NASH, metabolic-associated liver disease."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + flaxseed",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + avocado + tomato",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green smoothie (spinach, banana, flax)",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholewheat toast + peanut butter + apple",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + brown rice + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled fish + quinoa + salad",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken stir-fry (olive oil) + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + vegetable salad",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Turkey + steamed vegetables + sweet potato",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup + small swallow + fish",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled tofu + sautéed greens",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Baked fish + spinach + wholegrain rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Greek yogurt (unsweetened)",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Almonds (small handful)",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot sticks + hummus",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "cirrhosis",
    "name": "Cirrhosis / Advanced-Liver Diet",
    "fullName": "Cirrhosis / Advanced-Liver Diet",
    "description": "Adequate calories & protein to prevent muscle wasting; low sodium for ascites; late-evening snack.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Adequate calories",
        "protein to prevent muscle wasting",
        "low sodium for ascites",
        "late-evening snack."
      ],
      "avoids": [
        "Do NOT over-restrict protein",
        "limit sodium <2000mg",
        "small frequent meals + bedtime snack prevent catabolism."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Liver cirrhosis",
        "chronic liver failure",
        "hepatic ascites."
      ],
      "cautionFor": [
        "Do NOT over-restrict protein",
        "limit sodium <2000mg",
        "small frequent meals + bedtime snack prevent catabolism."
      ],
      "guidelines": [
        "EASL",
        "AASLD",
        "ESPEN"
      ],
      "clinicalNotes": [
        "~2200 kcal · Protein 1.2–1.5g/kg · Sodium <2000mg · Bedtime carb+protein snack",
        "Liver cirrhosis, chronic liver failure, hepatic ascites."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + milk + banana + peanut butter",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + moi-moi",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + granola + berries",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + rice + vegetables (low salt)",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Chicken + sweet potato + spinach",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil stew + wholegrain rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked chicken + yam + steamed vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish pepper soup (low salt) + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable stir-fry + rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable fried rice (little oil)",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Milk + wholegrain toast + peanut butter",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + oats + banana",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soy milk + biscuit",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "gallbladder-low-fat",
    "name": "Gallbladder / Low-Fat Diet",
    "fullName": "Gallbladder / Low-Fat Diet",
    "description": "Low total fat to reduce gallbladder contractions; lean protein; soluble fiber.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Low total fat to reduce gallbladder contractions",
        "lean protein",
        "soluble fiber."
      ],
      "avoids": [
        "Avoid fried/greasy foods",
        "full-fat dairy",
        "fatty meats",
        "add fat back gradually after surgery."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Gallstones",
        "cholecystitis",
        "post-cholecystectomy adjustment."
      ],
      "cautionFor": [
        "Avoid fried/greasy foods",
        "full-fat dairy",
        "fatty meats",
        "add fat back gradually after surgery."
      ],
      "guidelines": [
        "NHS",
        "Mayo Clinic",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~1900 kcal · Fat <30% (spread small amounts) · High fiber · Lean protein",
        "Gallstones, cholecystitis, post-cholecystectomy adjustment."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oatmeal + banana + skim milk",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white omelet + wholegrain toast",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + skim milk + pawpaw",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fruit + fat-free yogurt + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled skinless chicken + rice + vegetables",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Steamed fish + yam + greens",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans (little oil) + plantain",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked white fish + potato + green beans",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey breast + rice + steamed carrots",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean stew (low fat)",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + couscous + vegetables",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      }
    ],
    "snackOptions": [
      {
        "name": "Apple / pear",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fat-free yogurt",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes + jam",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh fruit salad",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "pancreatitis",
    "name": "Pancreatitis Diet",
    "fullName": "Pancreatitis Diet",
    "description": "Very low fat, easily digested; small frequent meals; strict no alcohol; enzyme support if prescribed.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Very low fat",
        "easily digested",
        "small frequent meals",
        "strict no alcohol",
        "enzyme support if prescribed."
      ],
      "avoids": [
        "Absolutely no alcohol",
        "very low fat",
        "may need pancreatic enzymes",
        "fat-soluble vitamins."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Acute recovery",
        "chronic pancreatitis."
      ],
      "cautionFor": [
        "Absolutely no alcohol",
        "very low fat",
        "may need pancreatic enzymes",
        "fat-soluble vitamins."
      ],
      "guidelines": [
        "ACG",
        "UEG",
        "clinical pancreatology"
      ],
      "clinicalNotes": [
        "~1800 kcal · Fat <20–30g/day · High carb/lean protein · Small frequent meals",
        "Acute recovery & chronic pancreatitis."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oatmeal + banana (water/skim milk)",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white scramble + white toast",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice porridge + applesauce",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + skim milk",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Boiled skinless chicken + white rice + carrots",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Steamed fish + potato + green beans",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup (fat-free) + white bread",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain pasta + tomato-free vegetable broth + turkey",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked white fish + mashed potato + peas",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Skinless turkey + rice + steamed vegetables",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white & vegetable rice",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken broth + rice + soft vegetables",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Applesauce",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fat-free yogurt",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "thyroid-support",
    "name": "Hypothyroid / Thyroid-Support Diet",
    "fullName": "Hypothyroid / Thyroid-Support Diet",
    "description": "Adequate iodine, selenium, zinc & protein; steady energy; support metabolism & weight.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Adequate iodine",
        "selenium",
        "zinc",
        "protein",
        "steady energy",
        "support metabolism",
        "weight."
      ],
      "avoids": [
        "Take levothyroxine on empty stomach",
        "space soy",
        "coffee",
        "calcium",
        "iron away from meds",
        "don't over-eat raw goitrogens."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Hypothyroidism",
        "Hashimoto's",
        "low thyroid metabolism."
      ],
      "cautionFor": [
        "Take levothyroxine on empty stomach",
        "space soy",
        "coffee",
        "calcium",
        "iron away from meds",
        "don't over-eat raw goitrogens."
      ],
      "guidelines": [
        "ATA",
        "BTA",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~1800 kcal · Iodine ~150µg · Selenium ~55µg · Adequate protein · Fiber for constipation",
        "Hypothyroidism, Hashimoto's, low thyroid metabolism."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + sweet potato + spinach",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + Brazil nuts + berries",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + pumpkin seeds + banana",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + boiled egg + orange",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Fish (iodine-rich) stew + rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + vegetables + quinoa",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans porridge + plantain",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Seafood + brown rice + greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + rice + mixed vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Shrimp stir-fry + brown rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Brazil nuts (2–3, selenium)",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 3,
          "max": 3
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pumpkin seeds (zinc)",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "hyperthyroid",
    "name": "Hyperthyroid Diet",
    "fullName": "Hyperthyroid Diet",
    "description": "Higher calories & protein for a fast metabolism; calcium & vitamin D for bones; limit excess iodine.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Higher calories",
        "protein for a fast metabolism",
        "calcium",
        "vitamin D for bones",
        "limit excess iodine."
      ],
      "avoids": [
        "Avoid iodine excess (kelp",
        "iodized-salt overuse)",
        "limit caffeine",
        "protect bone density."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Hyperthyroidism",
        "Graves' disease",
        "thyrotoxicosis (alongside treatment)."
      ],
      "cautionFor": [
        "Avoid iodine excess (kelp",
        "iodized-salt overuse)",
        "limit caffeine",
        "protect bone density."
      ],
      "guidelines": [
        "ATA",
        "BTA",
        "Endocrine Society"
      ],
      "clinicalNotes": [
        "~2400 kcal · High protein · Calcium 1200mg + vitamin D · Moderate iodine · Antioxidants",
        "Hyperthyroidism, Graves' disease, thyrotoxicosis (alongside treatment)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + milk + berries + almonds",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + granola + banana",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + moi-moi + groundnuts",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + vegetables + cheese",
        "calories": {
          "min": 550,
          "max": 550
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + egg",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef & vegetable stew + rice",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentils + wholegrain rice + yogurt side",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + broccoli",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + rice + mixed vegetables + cheese",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable curry + rice",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg fried rice + vegetables",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + honey + nuts",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Milk smoothie + banana",
        "calories": {
          "min": 240,
          "max": 240
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Trail mix",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "adrenal-support",
    "name": "Adrenal / Cortisol-Support Diet",
    "fullName": "Adrenal / Cortisol-Support Diet",
    "description": "Balanced blood sugar, steady protein, magnesium & B-vitamins; limit caffeine, sugar & alcohol.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Balanced blood sugar",
        "steady protein",
        "magnesium",
        "B-vitamins",
        "limit caffeine",
        "sugar",
        "alcohol."
      ],
      "avoids": [
        "Not a diagnosis-specific medical diet (\"adrenal fatigue\" is unproven) — a stress-supportive balanced pattern."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Chronic stress",
        "cortisol dysregulation",
        "fatigue-with-stress patterns."
      ],
      "cautionFor": [
        "Not a diagnosis-specific medical diet (\"adrenal fatigue\" is unproven) — a stress-supportive balanced pattern."
      ],
      "guidelines": [
        "General balanced-nutrition",
        "stress-physiology evidence"
      ],
      "clinicalNotes": [
        "~2000 kcal · Regular balanced meals · Magnesium-rich foods · Limit caffeine after noon",
        "Chronic stress, cortisol dysregulation, fatigue-with-stress patterns."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + banana + almond butter + seeds",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries + walnuts + oats",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + boiled egg + groundnuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + brown rice + leafy greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + quinoa + roasted vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + spinach",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable bowl + avocado",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + rice + mixed vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + couscous + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Mediterranean"
      }
    ],
    "snackOptions": [
      {
        "name": "Dark chocolate (small) + almonds",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana + peanut butter",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pumpkin seeds",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "gout-low-purine",
    "name": "Gout / Low-Purine Diet",
    "fullName": "Gout / Low-Purine Diet",
    "description": "Low purine to reduce uric acid; more water, low-fat dairy, cherries; avoid alcohol & fructose.",
    "icon": "pulse-outline",
    "difficulty": "Advanced",
    "category": "Renal, Hepatic & Endocrine",
    "principles": {
      "emphasis": [
        "Low purine to reduce uric acid",
        "more water",
        "low-fat dairy",
        "cherries",
        "avoid alcohol",
        "fructose."
      ],
      "avoids": [
        "Avoid organ meats",
        "red meat",
        "shellfish",
        "beer",
        "sugary drinks",
        "stay well hydrated."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Gout",
        "hyperuricemia",
        "recurrent uric-acid stones."
      ],
      "cautionFor": [
        "Avoid organ meats",
        "red meat",
        "shellfish",
        "beer",
        "sugary drinks",
        "stay well hydrated."
      ],
      "guidelines": [
        "ACR",
        "EULAR",
        "Arthritis Foundation"
      ],
      "clinicalNotes": [
        "~1900 kcal · Low purine · Fluid 2.5L+ · Low-fat dairy · Limit fructose & alcohol",
        "Gout, hyperuricemia, recurrent uric-acid stones."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oatmeal + low-fat milk + cherries",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + egg + tomato",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Low-fat yogurt + berries + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + skim milk + banana",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Vegetable & bean stew + brown rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled chicken (moderate) + rice + salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Egg & vegetable rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled chicken breast + potato + greens",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable pasta + olive oil + peppers",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean chili + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Cherries (uric-acid lowering)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Low-fat yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple / orange",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Water with lemon (frequent)",
        "calories": {
          "min": 15,
          "max": 15
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "pcos-friendly",
    "name": "PCOS Diet",
    "fullName": "PCOS Diet",
    "description": "Low-GI carbs, high fiber & protein, anti-inflammatory fats to improve insulin & hormones.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Low-GI carbs",
        "high fiber",
        "protein",
        "anti-inflammatory fats to improve insulin",
        "hormones."
      ],
      "avoids": [
        "Cut refined sugar",
        "sugary drinks",
        "modest weight loss restores ovulation",
        "overlaps with insulin-resistance diet."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Polycystic ovary syndrome",
        "insulin-resistant PCOS",
        "related weight/fertility goals."
      ],
      "cautionFor": [
        "Cut refined sugar",
        "sugary drinks",
        "modest weight loss restores ovulation",
        "overlaps with insulin-resistance diet."
      ],
      "guidelines": [
        "ESHRE PCOS guideline",
        "ADA",
        "Monash"
      ],
      "clinicalNotes": [
        "~1700 kcal · Low-GI · Fiber 30g+ · Protein 1.2g/kg · Omega-3",
        "Polycystic ovary syndrome, insulin-resistant PCOS, related weight/fertility goals."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + avocado + spinach",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries + chia + almonds",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + cinnamon + walnuts + flax",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + pepper sauce + orange",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + mixed vegetables + beans",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + brown rice (½) + big salad",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable bowl + avocado",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey stir-fry + cauliflower rice",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + broccoli + quinoa (small)",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu + vegetables + brown rice (½)",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + roasted vegetables + olive oil",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable stir-fry + beans",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Almonds + apple",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain Greek yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + cucumber",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pumpkin seeds",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "endometriosis",
    "name": "Endometriosis Diet",
    "fullName": "Endometriosis Diet",
    "description": "Anti-inflammatory, high-fiber, omega-3-rich; limit red meat, trans fat & excess alcohol.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Anti-inflammatory",
        "high-fiber",
        "omega-3-rich",
        "limit red meat",
        "trans fat",
        "excess alcohol."
      ],
      "avoids": [
        "Evidence is emerging",
        "an anti-inflammatory pattern may ease symptoms",
        "not cure."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Endometriosis",
        "painful/heavy periods",
        "inflammation-linked pelvic pain."
      ],
      "cautionFor": [
        "Evidence is emerging",
        "an anti-inflammatory pattern may ease symptoms",
        "not cure."
      ],
      "guidelines": [
        "Emerging endometriosis-nutrition research",
        "anti-inflammatory evidence"
      ],
      "clinicalNotes": [
        "~1900 kcal · Omega-3 · Fiber 30g+ · Antioxidants · Limit red/processed meat",
        "Endometriosis, painful/heavy periods, inflammation-linked pelvic pain."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + flax + walnuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green smoothie (spinach, banana, chia)",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + avocado + wholegrain toast",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + pumpkin seeds",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + quinoa + leafy greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea salad + olive oil + spinach",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled fish + sweet potato + broccoli",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked mackerel + vegetables + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable curry (turmeric) + rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean chili + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup (leafy) + fish + swallow",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Walnuts + berries",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange + pumpkin seeds",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Dark chocolate (small) + almonds",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Ginger/turmeric tea + fruit",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "fertility-preconception",
    "name": "Fertility / Preconception Diet",
    "fullName": "Fertility / Preconception Diet",
    "description": "Nutrient-dense whole foods, folate, iron, omega-3, plant protein; healthy weight for conception.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Nutrient-dense whole foods",
        "folate",
        "iron",
        "omega-3",
        "plant protein",
        "healthy weight for conception."
      ],
      "avoids": [
        "Start folic acid supplement",
        "limit alcohol",
        "high-mercury fish",
        "excess caffeine."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Couples trying to conceive",
        "pre-pregnancy preparation (both partners)."
      ],
      "cautionFor": [
        "Start folic acid supplement",
        "limit alcohol",
        "high-mercury fish",
        "excess caffeine."
      ],
      "guidelines": [
        "ACOG",
        "NICE preconception",
        "\"Fertility Diet\" (Harvard)"
      ],
      "clinicalNotes": [
        "~2100 kcal · Folate 400µg+ · Iron · Omega-3 · Antioxidants · Whole-food fats",
        "Couples trying to conceive, pre-pregnancy preparation (both partners)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Fortified oats + berries + walnuts",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + spinach + wholegrain toast + avocado",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + granola + orange",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + pawpaw",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + quinoa + leafy greens",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + brown rice + vegetables",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & spinach stew + wholegrain rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + sweet potato + broccoli",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + vegetables + yam",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable stir-fry + brown rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable fried rice + beans",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + couscous + greens",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Mediterranean"
      }
    ],
    "snackOptions": [
      {
        "name": "Oranges + almonds",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + wholegrain crackers",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Dates + walnuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "pregnancy",
    "name": "Pregnancy (Prenatal) Diet",
    "fullName": "Pregnancy (Prenatal) Diet",
    "description": "Extra energy & protein, folate, iron, calcium, iodine, choline & DHA for mother and baby.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Extra energy",
        "protein",
        "folate",
        "iron",
        "calcium",
        "iodine",
        "choline",
        "DHA for mother and baby."
      ],
      "avoids": [
        "Avoid alcohol",
        "raw/undercooked foods",
        "high-mercury fish",
        "unpasteurized dairy",
        "liver excess (vit A)."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Pregnancy (2nd/3rd trimester +~340–450 kcal)",
        "healthy fetal development."
      ],
      "cautionFor": [
        "Avoid alcohol",
        "raw/undercooked foods",
        "high-mercury fish",
        "unpasteurized dairy",
        "liver excess (vit A)."
      ],
      "guidelines": [
        "ACOG",
        "WHO",
        "NHS Start4Life"
      ],
      "clinicalNotes": [
        "~2200–2500 kcal · Protein +25g · Folate 600µg · Iron 27mg · Calcium 1000mg · DHA",
        "Pregnancy (2nd/3rd trimester +~340–450 kcal), healthy fetal development."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Fortified cereal + milk + banana + eggs",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + eggs + avocado + orange",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + granola + berries + nuts",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Well-cooked fish + rice + leafy greens",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + vegetables",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Chicken + sweet potato + spinach + beans",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil stew + wholegrain rice + salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon (low-mercury) + quinoa + broccoli",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg & vegetable rice + beans",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable curry + brown rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Yogurt + fruit",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + orange",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Milk + wholegrain biscuits",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Dates + nuts",
        "calories": {
          "min": 190,
          "max": 190
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "gestational-diabetes",
    "name": "Gestational Diabetes Diet",
    "fullName": "Gestational Diabetes Diet",
    "description": "Control blood glucose in pregnancy with low-GI carbs, spread across meals, plus protein & fiber.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Control blood glucose in pregnancy with low-GI carbs",
        "spread across meals",
        "plus protein",
        "fiber."
      ],
      "avoids": [
        "Distribute carbs (3 meals + 2–3 snacks)",
        "limit juice/sweets",
        "monitor glucose",
        "keep prenatal nutrients up."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Gestational diabetes mellitus (GDM)."
      ],
      "cautionFor": [
        "Distribute carbs (3 meals + 2–3 snacks)",
        "limit juice/sweets",
        "monitor glucose",
        "keep prenatal nutrients up."
      ],
      "guidelines": [
        "ADA",
        "ACOG",
        "Diabetes UK"
      ],
      "clinicalNotes": [
        "~2000–2200 kcal · Carbs ~175g+ spread & low-GI · Protein high · Fiber 28g+",
        "Gestational diabetes mellitus (GDM)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Veggie egg omelet + 1 wholegrain toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries + nuts",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + boiled egg",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Oat pancakes (small) + eggs",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + ½ cup brown rice + salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + unripe plantain + greens",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + vegetables + small yam",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil bowl + wholegrain rice (small) + salad",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables + ½ sweet potato",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + cauliflower rice + greens",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + small rice",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable pepper stew + small swallow",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Apple + peanut butter",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + cucumber",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "postpartum-wellness",
    "name": "Postpartum / Lactation Diet",
    "fullName": "Postpartum / Lactation Diet",
    "description": "Extra calories & fluids for milk supply; iron & protein for recovery; DHA, calcium & B12.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Extra calories",
        "fluids for milk supply",
        "iron",
        "protein for recovery",
        "DHA",
        "calcium",
        "B12."
      ],
      "avoids": [
        "+330–400 kcal while nursing",
        "stay hydrated",
        "limit high-mercury fish",
        "alcohol",
        "excess caffeine."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Breastfeeding mothers",
        "postpartum recovery."
      ],
      "cautionFor": [
        "+330–400 kcal while nursing",
        "stay hydrated",
        "limit high-mercury fish",
        "alcohol",
        "excess caffeine."
      ],
      "guidelines": [
        "WHO",
        "ACOG",
        "La Leche / IBCLC guidance"
      ],
      "clinicalNotes": [
        "~2300–2500 kcal · Protein +25g · Fluids 3L+ · Calcium 1000mg · Iron · DHA",
        "Breastfeeding mothers, postpartum recovery."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + milk + banana + peanut butter",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk + groundnuts",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + granola + berries + seeds",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Fish + rice + vegetables + beans",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 76,
          "max": 76
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Chicken + sweet potato + spinach",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil stew + wholegrain rice + salad",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + quinoa + broccoli",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg & vegetable fried rice + beans",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish pepper soup + rice + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Oat & flax lactation cookie",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + dates + nuts",
        "calories": {
          "min": 210,
          "max": 210
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Milk smoothie + banana",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + fruit",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "menopause",
    "name": "Menopause Diet",
    "fullName": "Menopause Diet",
    "description": "Bone-protective calcium & vitamin D, phytoestrogens, protein for muscle, fiber & heart health.",
    "icon": "people-outline",
    "difficulty": "Easy",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Bone-protective calcium",
        "vitamin D",
        "phytoestrogens",
        "protein for muscle",
        "fiber",
        "heart health."
      ],
      "avoids": [
        "Limit alcohol",
        "caffeine",
        "spicy triggers if hot flushes",
        "calorie needs dip — mind portions."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Perimenopause",
        "menopause",
        "hot flushes",
        "bone-loss prevention",
        "midlife weight shift."
      ],
      "cautionFor": [
        "Limit alcohol",
        "caffeine",
        "spicy triggers if hot flushes",
        "calorie needs dip — mind portions."
      ],
      "guidelines": [
        "NAMS",
        "British Menopause Society",
        "Osteoporosis guidelines"
      ],
      "clinicalNotes": [
        "~1800 kcal · Calcium 1200mg + vitamin D · Protein 1.2g/kg · Phytoestrogens (soy/flax) · Fiber 30g",
        "Perimenopause & menopause, hot flushes, bone-loss prevention, midlife weight shift."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Soy-milk oats + flaxseed + berries",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + chia + almonds + fruit",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu scramble + vegetables + toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + quinoa + leafy greens",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Edamame & vegetable rice bowl",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean & vegetable stew + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + roasted vegetables + quinoa",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + couscous + greens",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Lentil & vegetable curry + rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fortified soy yogurt + berries",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Almonds + dried figs",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Edamame",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + apple",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "pediatric",
    "name": "Pediatric / Children (4–12) Diet",
    "fullName": "Pediatric / Children (4–12) Diet",
    "description": "Balanced growth nutrition — protein, calcium, iron, whole grains, fruit & veg; limit sugar & ultra-processed.",
    "icon": "people-outline",
    "difficulty": "Easy",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Balanced growth nutrition — protein",
        "calcium",
        "iron",
        "whole grains",
        "fruit",
        "veg",
        "limit sugar",
        "ultra-processed."
      ],
      "avoids": [
        "Right-size portions for age",
        "limit sugary drinks",
        "salty snacks",
        "make foods fun",
        "varied."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "School-age children's healthy growth",
        "development."
      ],
      "cautionFor": [
        "Right-size portions for age",
        "limit sugary drinks",
        "salty snacks",
        "make foods fun",
        "varied."
      ],
      "guidelines": [
        "WHO",
        "AAP",
        "NHS Change4Life"
      ],
      "clinicalNotes": [
        "~1400–1800 kcal (age-dependent) · Calcium · Iron · Balanced macros · 5-a-day fruit & veg",
        "School-age children's healthy growth & development."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Wholegrain cereal + milk + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + toast soldiers + orange",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + moi-moi",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + oats + berries",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + vegetables",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + egg",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + jollof rice + salad",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Pasta + tomato & vegetable sauce + cheese",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Fish fingers (baked) + potato + peas",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + vegetables",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg fried rice + vegetables",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Mild vegetable soup + swallow (small)",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fruit + cheese",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt tube",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain crackers + peanut butter",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot & cucumber sticks + hummus",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "toddler",
    "name": "Toddler Nutrition (1–3) Diet",
    "fullName": "Toddler Nutrition (1–3) Diet",
    "description": "Small, frequent, energy- & nutrient-dense meals; full-fat dairy; iron & healthy fats for brain growth.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Small",
        "frequent",
        "energy-",
        "nutrient-dense meals",
        "full-fat dairy",
        "iron",
        "healthy fats for brain growth."
      ],
      "avoids": [
        "No added salt/sugar",
        "whole-fat milk 1–2yr",
        "avoid choking hazards (whole nuts",
        "grapes uncut",
        "popcorn)."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Toddlers 1–3 years",
        "fussy eaters",
        "healthy early growth."
      ],
      "cautionFor": [
        "No added salt/sugar",
        "whole-fat milk 1–2yr",
        "avoid choking hazards (whole nuts",
        "grapes uncut",
        "popcorn)."
      ],
      "guidelines": [
        "WHO",
        "AAP",
        "NHS Start4Life"
      ],
      "clinicalNotes": [
        "~1000–1300 kcal · Iron · Healthy fats (brain) · Calcium · 3 meals + 2 snacks",
        "Toddlers 1–3 years, fussy eaters, healthy early growth."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oat porridge + full-fat milk + mashed banana",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Scrambled egg + soft toast fingers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + full-fat milk",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt (full-fat) + soft fruit",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Mashed beans + soft plantain",
        "calories": {
          "min": 240,
          "max": 240
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Flaked fish + mashed potato + peas",
        "calories": {
          "min": 240,
          "max": 240
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + soft rice + carrots",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg + soft vegetable rice",
        "calories": {
          "min": 230,
          "max": 230
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Soft vegetable & lentil mash",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Minced chicken + mashed yam + spinach",
        "calories": {
          "min": 240,
          "max": 240
        },
        "protein": {
          "min": 13,
          "max": 13
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + soft couscous + squash",
        "calories": {
          "min": 230,
          "max": 230
        },
        "protein": {
          "min": 13,
          "max": 13
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Moi-moi (soft) + mashed pawpaw",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Soft fruit pieces (banana, pawpaw)",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 17,
          "max": 17
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Full-fat yogurt",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese cubes (soft)",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft cooked vegetable sticks",
        "calories": {
          "min": 40,
          "max": 40
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "adolescent",
    "name": "Adolescent / Teen Diet",
    "fullName": "Adolescent / Teen Diet",
    "description": "High energy & protein for growth spurts; iron (esp. menstruating teens), calcium for peak bone mass.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "High energy",
        "protein for growth spurts",
        "iron (esp. menstruating teens)",
        "calcium for peak bone mass."
      ],
      "avoids": [
        "Counter junk-food/sugary-drink habits",
        "support body image with balance",
        "not restriction."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Teenagers 13–18",
        "active adolescents",
        "growth",
        "puberty."
      ],
      "cautionFor": [
        "Counter junk-food/sugary-drink habits",
        "support body image with balance",
        "not restriction."
      ],
      "guidelines": [
        "WHO",
        "AAP",
        "NHS"
      ],
      "clinicalNotes": [
        "~2200–2800 kcal (activity-dependent) · Calcium 1300mg · Iron · Protein · Whole grains",
        "Teenagers 13–18, active adolescents, growth & puberty."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + wholegrain toast + milk + fruit",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + milk + banana + peanut butter",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + granola + berries + nuts",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + jollof rice + salad",
        "calories": {
          "min": 550,
          "max": 550
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + plantain + egg",
        "calories": {
          "min": 550,
          "max": 550
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 78,
          "max": 78
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + rice + vegetables",
        "calories": {
          "min": 530,
          "max": 530
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pasta + meat & tomato sauce + cheese",
        "calories": {
          "min": 550,
          "max": 550
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled chicken + yam + vegetables",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + rice + efo riro",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef stir-fry + rice",
        "calories": {
          "min": 530,
          "max": 530
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable fried rice + beans",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Milk smoothie + banana",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Peanut butter sandwich",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + granola",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + fruit",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "elderly-geriatric",
    "name": "Elderly / Geriatric Diet",
    "fullName": "Elderly / Geriatric Diet",
    "description": "Nutrient-dense, easy-to-chew meals; higher protein & calcium; vitamin D & B12; hydration & fiber.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "Nutrient-dense",
        "easy-to-chew meals",
        "higher protein",
        "calcium",
        "vitamin D",
        "B12",
        "hydration",
        "fiber."
      ],
      "avoids": [
        "Guard against undernutrition",
        "dehydration",
        "soften textures",
        "watch drug–nutrient interactions."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Older adults",
        "reduced appetite",
        "chewing difficulty",
        "bone",
        "muscle preservation."
      ],
      "cautionFor": [
        "Guard against undernutrition",
        "dehydration",
        "soften textures",
        "watch drug–nutrient interactions."
      ],
      "guidelines": [
        "ESPEN geriatrics",
        "WHO",
        "BDA"
      ],
      "clinicalNotes": [
        "~1800 kcal · Protein 1.0–1.2g/kg · Calcium 1200mg · Vitamin D · B12 · Fiber · Fluids",
        "Older adults, reduced appetite, chewing difficulty, bone & muscle preservation."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Soft oatmeal + milk + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Scrambled eggs + soft toast",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + moi-moi",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + soft fruit + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Soft beans + flaked fish",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Minced chicken + mashed yam + stew",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + soft rice + steamed vegetables",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + soft bread",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Mashed yam + vegetable stew + fish",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Chicken + soft rice + carrots",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft vegetable soup + swallow (small)",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg + soft potato + spinach",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Yogurt + honey",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Milk + biscuits",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft fruit + cheese",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oral nutrition drink (if needed)",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "sarcopenia",
    "name": "Sarcopenia / Muscle-Preservation Diet",
    "fullName": "Sarcopenia / Muscle-Preservation Diet",
    "description": "High, evenly-spread protein + leucine, vitamin D & resistance-exercise support to fight muscle loss.",
    "icon": "people-outline",
    "difficulty": "Moderate",
    "category": "Hormonal, Reproductive & Life-Stage",
    "principles": {
      "emphasis": [
        "High",
        "evenly-spread protein + leucine",
        "vitamin D",
        "resistance-exercise support to fight muscle loss."
      ],
      "avoids": [
        "Aim 25–30g protein per meal",
        "pair with strength training",
        "adequate total calories."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Age-related muscle loss",
        "frailty prevention",
        "recovery from immobility."
      ],
      "cautionFor": [
        "Aim 25–30g protein per meal",
        "pair with strength training",
        "adequate total calories."
      ],
      "guidelines": [
        "ESPEN",
        "PROT-AGE",
        "sarcopenia consensus"
      ],
      "clinicalNotes": [
        "~2100 kcal · Protein 1.2–1.5g/kg (25–30g/meal) · Leucine-rich · Vitamin D · Omega-3",
        "Age-related muscle loss, frailty prevention, recovery from immobility."
      ]
    },
    "breakfastOptions": [
      {
        "name": "3-egg omelet + cheese + wholegrain toast",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + whey + oats + berries",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi (large) + boiled eggs",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Cottage cheese + oats + nuts + banana",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken breast + rice + vegetables",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + beans + plantain",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef + quinoa + greens",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentils + egg + wholegrain rice",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + broccoli",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + rice + mixed vegetables",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu + tempeh stir-fry + rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Greek yogurt + nuts",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Milk/whey shake",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs (2) + fruit",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "mind-brain",
    "name": "MIND Diet (Brain / Dementia Prevention)",
    "fullName": "MIND Diet (Brain / Dementia Prevention)",
    "description": "Mediterranean-DASH hybrid built for the brain — leafy greens, berries, nuts, fish, olive oil, whole grains.",
    "icon": "bulb-outline",
    "difficulty": "Moderate",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Mediterranean-DASH hybrid built for the brain — leafy greens",
        "berries",
        "nuts",
        "fish",
        "olive oil",
        "whole grains."
      ],
      "avoids": [
        "Limit red meat",
        "butter",
        "cheese",
        "pastries",
        "fried/fast food."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Cognitive-decline prevention",
        "Alzheimer's risk reduction",
        "healthy aging."
      ],
      "cautionFor": [
        "Limit red meat",
        "butter",
        "cheese",
        "pastries",
        "fried/fast food."
      ],
      "guidelines": [
        "Rush University MIND-diet trials",
        "AHA"
      ],
      "clinicalNotes": [
        "~2000 kcal · Leafy greens 6+/wk · Berries 2+/wk · Nuts daily · Fish 1+/wk · Olive oil primary",
        "Cognitive-decline prevention, Alzheimer's risk reduction, healthy aging."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + blueberries + walnuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + avocado + egg + spinach",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries + flaxseed",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Millet pap + groundnuts + pawpaw",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + leafy-green salad + olive oil + quinoa",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + brown rice + sautéed greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + vegetable stir-fry + wholegrain rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & spinach stew + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked salmon + roasted vegetables + sweet potato",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Efo riro (leafy greens) + fish + small swallow",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & broccoli stir-fry + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean chili + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Walnuts + blueberries",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Handful of mixed nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 7,
          "max": 7
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple + almond butter",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Dark leafy-green smoothie",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "dementia-support",
    "name": "Alzheimer's / Dementia Support Diet",
    "fullName": "Alzheimer's / Dementia Support Diet",
    "description": "Easy-to-eat, nutrient-dense, brain-supportive meals; prevent weight loss & dehydration.",
    "icon": "bulb-outline",
    "difficulty": "Moderate",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Easy-to-eat",
        "nutrient-dense",
        "brain-supportive meals",
        "prevent weight loss",
        "dehydration."
      ],
      "avoids": [
        "Finger foods",
        "simple presentation help",
        "watch swallowing",
        "appetite",
        "hydration",
        "consistent routine."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "People living with dementia",
        "caregiver meal planning."
      ],
      "cautionFor": [
        "Finger foods",
        "simple presentation help",
        "watch swallowing",
        "appetite",
        "hydration",
        "consistent routine."
      ],
      "guidelines": [
        "Alzheimer's Association",
        "MIND-diet base",
        "ESPEN dementia"
      ],
      "clinicalNotes": [
        "~2000 kcal · Omega-3 · Antioxidants · Adequate protein/calories · Easy textures · Regular fluids",
        "People living with dementia, caregiver meal planning."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Soft oatmeal + berries + nut butter",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Scrambled eggs + soft toast fingers",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smoothie (banana, spinach, yogurt, flax)",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + mashed moi-moi",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Fish fingers (baked) + soft potato wedges + peas",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken strips + rice balls + soft carrots",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean cakes (akara, soft) + plantain",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Cheese & vegetable omelet + soft bread",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + mashed sweet potato + spinach",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Minced chicken + soft rice + vegetables",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Mild vegetable soup + soft swallow",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg + soft yam + greens",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Cheese cubes",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana / soft fruit pieces",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + honey",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Nut-butter oat balls",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "parkinsons",
    "name": "Parkinson's Diet",
    "fullName": "Parkinson's Diet",
    "description": "High fiber & fluids for constipation; protein-timing around levodopa; antioxidants; easy textures.",
    "icon": "bulb-outline",
    "difficulty": "Moderate",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "High fiber",
        "fluids for constipation",
        "protein-timing around levodopa",
        "antioxidants",
        "easy textures."
      ],
      "avoids": [
        "Space high-protein meals from levodopa doses (protein competes with absorption)",
        "manage swallowing",
        "constipation."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Parkinson's disease",
        "related motor",
        "digestive symptoms."
      ],
      "cautionFor": [
        "Space high-protein meals from levodopa doses (protein competes with absorption)",
        "manage swallowing",
        "constipation."
      ],
      "guidelines": [
        "Parkinson's Foundation",
        "MDS",
        "dietitian guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Fiber 30g+ · Fluids 2L+ · Protein redistributed (more later in day) · Antioxidants",
        "Parkinson's disease, related motor & digestive symptoms."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + flaxseed",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + avocado + tomato",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fruit smoothie + oats + chia",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + pawpaw + prunes",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + brown rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean & vegetable stew + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + sweet potato + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + quinoa + broccoli",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef & vegetable stew + rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & bean rice bowl",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Prunes + walnuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Berries + yogurt",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple with skin",
        "calories": {
          "min": 95,
          "max": 95
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 25,
          "max": 25
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green tea + oat biscuit",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "multiple-sclerosis",
    "name": "Multiple Sclerosis (MS) Diet",
    "fullName": "Multiple Sclerosis (MS) Diet",
    "description": "Anti-inflammatory, omega-3-rich, high vitamin D; abundant vegetables; limit saturated fat & processed food.",
    "icon": "bulb-outline",
    "difficulty": "Moderate",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Anti-inflammatory",
        "omega-3-rich",
        "high vitamin D",
        "abundant vegetables",
        "limit saturated fat",
        "processed food."
      ],
      "avoids": [
        "Evidence still developing (Wahls/Swank/Mediterranean patterns)",
        "prioritize vitamin D",
        "fiber for gut health."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Multiple sclerosis symptom",
        "energy management."
      ],
      "cautionFor": [
        "Evidence still developing (Wahls/Swank/Mediterranean patterns)",
        "prioritize vitamin D",
        "fiber for gut health."
      ],
      "guidelines": [
        "National MS Society",
        "Mediterranean/anti-inflammatory evidence"
      ],
      "clinicalNotes": [
        "~2000 kcal · Omega-3 · Vitamin D · High vegetables/antioxidants · Low saturated fat · Fiber",
        "Multiple sclerosis symptom & energy management."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + flax + walnuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + spinach + avocado + toast",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green smoothie + chia + almond milk",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + pumpkin seeds",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + leafy salad + quinoa",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + roasted vegetables + sweet potato",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach bowl + olive oil",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Mackerel + broccoli + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable curry (turmeric) + rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean chili + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled fish + efo riro + small swallow",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Walnuts + berries",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange + almonds",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + flaxseed",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable sticks + hummus",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "epilepsy-keto",
    "name": "Epilepsy (Modified Ketogenic) Diet",
    "fullName": "Epilepsy (Modified Ketogenic) Diet",
    "description": "Very high fat, very low carb (classic or modified Atkins) to raise ketones and reduce seizures.",
    "icon": "bulb-outline",
    "difficulty": "Advanced",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Very high fat",
        "very low carb (classic or modified Atkins) to raise ketones and reduce seizures."
      ],
      "avoids": [
        "MEDICALLY SUPERVISED ONLY — strict ratios",
        "supplements",
        "monitoring",
        "not a lifestyle keto."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Drug-resistant epilepsy (children",
        "adults) under neurology/dietitian supervision."
      ],
      "cautionFor": [
        "MEDICALLY SUPERVISED ONLY — strict ratios",
        "supplements",
        "monitoring",
        "not a lifestyle keto."
      ],
      "guidelines": [
        "ILAE",
        "Charlie Foundation",
        "Matthew's Friends"
      ],
      "clinicalNotes": [
        "Ketogenic ratio 3:1–4:1 fat:(carb+protein) · Carbs 10–20g · Supplement vitamins/minerals",
        "Drug-resistant epilepsy (children & adults) under neurology/dietitian supervision."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs cooked in butter + avocado",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 40,
          "max": 40
        },
        "cuisine": "Universal"
      },
      {
        "name": "Full-fat yogurt + macadamia + chia",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 38,
          "max": 38
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese omelet + cream + spinach",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 40,
          "max": 40
        },
        "cuisine": "Universal"
      },
      {
        "name": "Keto \"porridge\" (coconut, flax, cream)",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 40,
          "max": 40
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken thigh + avocado + buttered greens",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 42,
          "max": 42
        },
        "cuisine": "Universal"
      },
      {
        "name": "Salmon + olive-oil vegetables",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 40,
          "max": 40
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & cheese salad + heavy cream dressing",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 42,
          "max": 42
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef patties + cauliflower + butter",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 40,
          "max": 40
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Fatty fish + creamed spinach",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 40,
          "max": 40
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + zucchini + olive oil + cheese",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 38,
          "max": 38
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pork/goat + leafy greens + butter",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 42,
          "max": 42
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu + coconut cream + low-carb vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 40,
          "max": 40
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Macadamia nuts",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 21,
          "max": 21
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese cubes",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 2,
          "max": 2
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Avocado with olive oil",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 17,
          "max": 17
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fat bombs (coconut/cocoa/butter)",
        "calories": {
          "min": 190,
          "max": 190
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 3,
          "max": 3
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "migraine",
    "name": "Migraine-Trigger-Free Diet",
    "fullName": "Migraine-Trigger-Free Diet",
    "description": "Regular meals + steady blood sugar + hydration; avoid common dietary migraine triggers.",
    "icon": "bulb-outline",
    "difficulty": "Moderate",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Regular meals + steady blood sugar + hydration",
        "avoid common dietary migraine triggers."
      ],
      "avoids": [
        "Common triggers: aged cheese",
        "cured meats (nitrates)",
        "MSG",
        "chocolate",
        "red wine",
        "artificial sweeteners"
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Chronic/episodic migraine",
        "tension-headache sufferers."
      ],
      "cautionFor": [
        "Common triggers: aged cheese",
        "cured meats (nitrates)",
        "MSG",
        "chocolate",
        "red wine",
        "artificial sweeteners"
      ],
      "guidelines": [
        "American Migraine Foundation",
        "trigger-diary approach"
      ],
      "clinicalNotes": [
        "~2000 kcal · No skipped meals · Magnesium & riboflavin-rich foods · Hydration · Limit triggers",
        "Chronic/episodic migraine, tension-headache sufferers."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + banana + almonds",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + spinach",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh yogurt + berries + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + pawpaw",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Fresh grilled chicken + rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fresh fish + sweet potato + salad",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable bowl + quinoa",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + rice + steamed vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken (fresh, not cured) + yam + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable stir-fry (no MSG) + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean stew + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Pumpkin seeds + banana",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Almonds",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh apple",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain yogurt + honey",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "depression-mood",
    "name": "Depression / Mood-Support Diet",
    "fullName": "Depression / Mood-Support Diet",
    "description": "Omega-3, whole grains, folate, B12, vitamin D & gut-supportive foods; steady blood sugar for mood.",
    "icon": "bulb-outline",
    "difficulty": "Moderate",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Omega-3",
        "whole grains",
        "folate",
        "B12",
        "vitamin D",
        "gut-supportive foods",
        "steady blood sugar for mood."
      ],
      "avoids": [
        "Complements — not replaces — treatment",
        "limit alcohol",
        "ultra-processed",
        "high-sugar foods."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Low mood",
        "depression (as adjunct to care)",
        "mental-wellbeing support."
      ],
      "cautionFor": [
        "Complements — not replaces — treatment",
        "limit alcohol",
        "ultra-processed",
        "high-sugar foods."
      ],
      "guidelines": [
        "\"SMILES\" trial",
        "Mediterranean-diet mental-health evidence"
      ],
      "clinicalNotes": [
        "~2000 kcal · Omega-3 · Folate & B12 · Probiotics/fiber (gut-brain) · Steady low-GI carbs",
        "Low mood, depression (as adjunct to care), mental-wellbeing support."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + walnuts + flax",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + spinach + wholegrain toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt (probiotic) + banana + seeds",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + orange",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + leafy greens + quinoa",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + brown rice + vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + sweet potato + broccoli",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & spinach stew + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Mackerel + vegetables + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + efo riro + small swallow",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable stir-fry + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable fried rice + beans",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Dark chocolate (small) + walnuts",
        "calories": {
          "min": 190,
          "max": 190
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana + peanut butter",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pumpkin seeds",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "anxiety-calming",
    "name": "Anxiety-Calming Diet",
    "fullName": "Anxiety-Calming Diet",
    "description": "Magnesium, zinc, omega-3 & complex carbs for serotonin; limit caffeine, alcohol & sugar spikes.",
    "icon": "bulb-outline",
    "difficulty": "Moderate",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Magnesium",
        "zinc",
        "omega-3",
        "complex carbs for serotonin",
        "limit caffeine",
        "alcohol",
        "sugar spikes."
      ],
      "avoids": [
        "Reduce caffeine (a common anxiety amplifier)",
        "avoid long gaps between meals (blood-sugar dips mimic anxiety)."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Anxiety",
        "stress-related tension",
        "nervous-system support."
      ],
      "cautionFor": [
        "Reduce caffeine (a common anxiety amplifier)",
        "avoid long gaps between meals (blood-sugar dips mimic anxiety)."
      ],
      "guidelines": [
        "Nutritional-psychiatry evidence",
        "general balanced guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Magnesium & zinc-rich · Omega-3 · Low-GI carbs · Limit caffeine/alcohol",
        "Anxiety, stress-related tension, nervous-system support."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + banana + pumpkin seeds",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + avocado + wholegrain toast",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + almonds",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + groundnuts + pawpaw",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + spinach + brown rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + vegetables + wholegrain rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + quinoa + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + brown rice + vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach curry + rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Pumpkin seeds + dark chocolate",
        "calories": {
          "min": 190,
          "max": 190
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chamomile tea + oat biscuit",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana + almond butter",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "adhd",
    "name": "ADHD-Support Diet",
    "fullName": "ADHD-Support Diet",
    "description": "Steady protein & complex carbs for focus; omega-3, iron & zinc; limit sugar spikes & artificial additives.",
    "icon": "bulb-outline",
    "difficulty": "Moderate",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Steady protein",
        "complex carbs for focus",
        "omega-3",
        "iron",
        "zinc",
        "limit sugar spikes",
        "artificial additives."
      ],
      "avoids": [
        "Protein-rich breakfast supports attention",
        "minimize sugary drinks",
        "some artificial colors/additives."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "ADHD focus",
        "energy stability (children",
        "adults)",
        "as an adjunct."
      ],
      "cautionFor": [
        "Protein-rich breakfast supports attention",
        "minimize sugary drinks",
        "some artificial colors/additives."
      ],
      "guidelines": [
        "AAP",
        "emerging ADHD-nutrition research"
      ],
      "clinicalNotes": [
        "~2000 kcal · Protein at breakfast · Omega-3 · Iron & zinc · Low added sugar · Whole foods",
        "ADHD focus & energy stability (children & adults), as an adjunct."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + wholegrain toast + fruit",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + oats + berries + nuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + boiled egg + orange",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Peanut-butter oats + banana + milk",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + brown rice + vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sweet potato + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + egg",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable bowl + quinoa",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + rice + broccoli",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef stir-fry + brown rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable fried rice + beans",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Cheese + apple",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + wholegrain crackers",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Nuts + berries",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + pumpkin seeds",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "sleep-support",
    "name": "Sleep-Support Diet",
    "fullName": "Sleep-Support Diet",
    "description": "Tryptophan + complex carbs, magnesium & melatonin-supportive foods; light evening meals; caffeine curfew.",
    "icon": "bulb-outline",
    "difficulty": "Easy",
    "category": "Neurological, Cognitive & Mental Health",
    "principles": {
      "emphasis": [
        "Tryptophan + complex carbs",
        "magnesium",
        "melatonin-supportive foods",
        "light evening meals",
        "caffeine curfew."
      ],
      "avoids": [
        "Avoid caffeine after midday",
        "heavy/spicy late meals",
        "alcohol",
        "a small carb+protein snack can aid sleep onset."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Insomnia",
        "poor sleep quality",
        "shift-work sleep support."
      ],
      "cautionFor": [
        "Avoid caffeine after midday",
        "heavy/spicy late meals",
        "alcohol",
        "a small carb+protein snack can aid sleep onset."
      ],
      "guidelines": [
        "Sleep Foundation",
        "nutritional-sleep research"
      ],
      "clinicalNotes": [
        "~2000 kcal · Tryptophan-rich · Magnesium · Light dinner · No caffeine after 2pm",
        "Insomnia, poor sleep quality, shift-work sleep support."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + banana + walnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + fruit",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + seeds",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + groundnuts",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + brown rice + vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sweet potato + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + quinoa + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + rice + steamed vegetables",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + sweet potato + spinach",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu + vegetable soup + small rice",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable rice (light)",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Warm milk + honey",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana + few almonds",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + peanut butter",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tart cherry (melatonin) + yogurt",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "anti-inflammatory",
    "name": "Anti-Inflammatory Diet",
    "fullName": "Anti-Inflammatory Diet",
    "description": "Omega-3, colorful antioxidants, whole grains, olive oil & spices; limit sugar, refined carbs & processed meat.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Moderate",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Omega-3",
        "colorful antioxidants",
        "whole grains",
        "olive oil",
        "spices",
        "limit sugar",
        "refined carbs",
        "processed meat."
      ],
      "avoids": [
        "Cut ultra-processed foods",
        "trans fats",
        "excess red meat",
        "sugary drinks."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Chronic inflammation",
        "arthritis",
        "metabolic",
        "cardiovascular risk",
        "general wellness."
      ],
      "cautionFor": [
        "Cut ultra-processed foods",
        "trans fats",
        "excess red meat",
        "sugary drinks."
      ],
      "guidelines": [
        "Harvard T.H. Chan",
        "Arthritis Foundation",
        "Mediterranean evidence"
      ],
      "clinicalNotes": [
        "~2000 kcal · Omega-3 · 7–9 servings fruit/veg · Whole grains · Turmeric/ginger · Low added sugar",
        "Chronic inflammation, arthritis, metabolic & cardiovascular risk, general wellness."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + walnuts + flax",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turmeric scramble + spinach + wholegrain toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green smoothie + chia + ginger",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + pumpkin seeds",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + spinach salad + olive oil + quinoa",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sardines + wholegrain bread + tomato salad",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & turmeric curry + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Turmeric-rice + grilled chicken + broccoli",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Mackerel + roasted vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & olive-oil soup + wholegrain bread",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & ginger stir-fry + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Berries + green tea",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Walnuts + dark chocolate (small)",
        "calories": {
          "min": 190,
          "max": 190
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange + almonds",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot & pepper sticks + hummus",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "autoimmune-protocol",
    "name": "Autoimmune Protocol (AIP) Diet",
    "fullName": "Autoimmune Protocol (AIP) Diet",
    "description": "Elimination phase removes grains, legumes, dairy, eggs, nightshades, nuts/seeds; nutrient-dense whole foods; then reintroduce.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Advanced",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Elimination phase removes grains",
        "legumes",
        "dairy",
        "eggs",
        "nightshades",
        "nuts/seeds",
        "nutrient-dense whole foods",
        "then reintroduce."
      ],
      "avoids": [
        "Restrictive — short elimination then systematic reintroduction",
        "work with a dietitian to avoid deficiencies."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Autoimmune-flare management (Hashimoto's",
        "RA",
        "lupus",
        "IBD) as a structured trial."
      ],
      "cautionFor": [
        "Restrictive — short elimination then systematic reintroduction",
        "work with a dietitian to avoid deficiencies."
      ],
      "guidelines": [
        "AIP framework (Ballantyne)",
        "emerging IBD/autoimmune data"
      ],
      "clinicalNotes": [
        "~2000 kcal · Whole foods · Bone broth · Organ meats/fish · Abundant vegetables (no nightshades) · Reintroduce stepwise",
        "Autoimmune-flare management (Hashimoto's, RA, lupus, IBD) as a structured trial."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Sweet potato hash + salmon + avocado",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Butternut & spinach breakfast bowl",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Coconut yogurt + berries + plantain",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Bone broth + shredded chicken + greens",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + roasted vegetables + olive oil",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + cauliflower rice + greens",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & vegetable stew (no nightshades)",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      },
      {
        "name": "Salmon salad + avocado + olive oil",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 30,
          "max": 30
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked chicken + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + plantain + sautéed greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + squash + zucchini",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Slow-cooked beef + root vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Plantain chips (coconut-oil baked)",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Avocado + sea salt",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Coconut yogurt + berries",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bone broth (cup)",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 2,
          "max": 2
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "rheumatoid-arthritis",
    "name": "Rheumatoid Arthritis Diet",
    "fullName": "Rheumatoid Arthritis Diet",
    "description": "Mediterranean anti-inflammatory base — oily fish, olive oil, vegetables, whole grains; limit red/processed meat & sugar.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Moderate",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Mediterranean anti-inflammatory base — oily fish",
        "olive oil",
        "vegetables",
        "whole grains",
        "limit red/processed meat",
        "sugar."
      ],
      "avoids": [
        "Watch for individual triggers",
        "support bone health (steroid users need calcium/vitamin D)."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Rheumatoid arthritis",
        "inflammatory joint pain",
        "autoimmune joint disease."
      ],
      "cautionFor": [
        "Watch for individual triggers",
        "support bone health (steroid users need calcium/vitamin D)."
      ],
      "guidelines": [
        "Arthritis Foundation",
        "EULAR",
        "Mediterranean-diet trials"
      ],
      "clinicalNotes": [
        "~2000 kcal · Omega-3 (fish 2–3×/wk) · Antioxidants · Fiber · Calcium/vitamin D · Low processed food",
        "Rheumatoid arthritis, inflammatory joint pain, autoimmune joint disease."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + walnuts + flax",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smoked-mackerel + wholegrain toast + tomato",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + chia",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turmeric-ginger scramble + spinach + toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + quinoa + leafy greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sardine & tomato pasta (wholegrain)",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach curry + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Mackerel + roasted vegetables + sweet potato",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + turmeric rice + broccoli",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & ginger stir-fry + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean chili + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Walnuts + berries",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange + almonds",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + flaxseed",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green tea + oat biscuit",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "osteoarthritis",
    "name": "Osteoarthritis / Joint & Weight Diet",
    "fullName": "Osteoarthritis / Joint & Weight Diet",
    "description": "Weight management to offload joints + anti-inflammatory foods; vitamin C, D & omega-3 for cartilage/bone.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Moderate",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Weight management to offload joints + anti-inflammatory foods",
        "vitamin C",
        "D",
        "omega-3 for cartilage/bone."
      ],
      "avoids": [
        "Even modest weight loss dramatically reduces joint load",
        "keep protein for muscle support around joints."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Osteoarthritis",
        "joint wear",
        "obesity-linked knee/hip pain."
      ],
      "cautionFor": [
        "Even modest weight loss dramatically reduces joint load",
        "keep protein for muscle support around joints."
      ],
      "guidelines": [
        "OARSI",
        "Arthritis Foundation",
        "weight-management evidence"
      ],
      "clinicalNotes": [
        "~1700 kcal · Modest deficit · Omega-3 · Vitamin C & D · Protein 1.2g/kg · High vegetables",
        "Osteoarthritis, joint wear, obesity-linked knee/hip pain."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + walnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white & vegetable omelet + toast",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + orange + chia",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + groundnuts + pawpaw",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + big salad + quinoa (small)",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + steamed vegetables + small plantain",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Chicken + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + roasted vegetables",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + cauliflower rice + greens",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable pepper soup + fish",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable stir-fry + small rice",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Orange + almonds (vitamin C + E)",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain Greek yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot & cucumber sticks",
        "calories": {
          "min": 50,
          "max": 50
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Berries",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "osteoporosis",
    "name": "Osteoporosis / Bone-Health Diet",
    "fullName": "Osteoporosis / Bone-Health Diet",
    "description": "Calcium, vitamin D, vitamin K, magnesium & protein to build/preserve bone; limit excess salt & fizzy cola.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Moderate",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Calcium",
        "vitamin D",
        "vitamin K",
        "magnesium",
        "protein to build/preserve bone",
        "limit excess salt",
        "fizzy cola."
      ],
      "avoids": [
        "Pair calcium with vitamin D",
        "excess sodium",
        "cola (phosphoric acid) leach calcium",
        "adequate protein helps."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Osteoporosis",
        "osteopenia",
        "fracture prevention",
        "post-menopausal bone loss."
      ],
      "cautionFor": [
        "Pair calcium with vitamin D",
        "excess sodium",
        "cola (phosphoric acid) leach calcium",
        "adequate protein helps."
      ],
      "guidelines": [
        "IOF",
        "NOF",
        "NHS"
      ],
      "clinicalNotes": [
        "~1900 kcal · Calcium 1200mg · Vitamin D 800–1000IU · Vitamin K (greens) · Protein · Weight-bearing exercise",
        "Osteoporosis, osteopenia, fracture prevention, post-menopausal bone loss."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Fortified oats + milk + almonds + figs",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + fortified OJ",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + chia + berries",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + moi-moi (calcium set)",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Sardines (with bones) + wholegrain rice + kale",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & bok-choy stir-fry (calcium-set tofu) + rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + broccoli + sweet potato",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean & leafy-green stew + wholegrain rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + kale + quinoa",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Efo riro (calcium greens) + fish + swallow",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Cheese & vegetable frittata + salad",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu + vegetable curry + brown rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + almonds",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fortified soy milk + figs",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sesame/tahini on toast",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "lupus",
    "name": "Lupus-Support Diet",
    "fullName": "Lupus-Support Diet",
    "description": "Anti-inflammatory, heart- & kidney-protective; omega-3, antioxidants, vitamin D; moderate protein if kidney-involved.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Moderate",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Anti-inflammatory",
        "heart-",
        "kidney-protective",
        "omega-3",
        "antioxidants",
        "vitamin D",
        "moderate protein if kidney-involved."
      ],
      "avoids": [
        "Avoid alfalfa sprouts",
        "excess garlic (may stimulate immunity)",
        "manage steroid effects (bone",
        "BP",
        "glucose)",
        "adjust protein/sodium if lupus nephritis."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Systemic lupus erythematosus (SLE) symptom",
        "comorbidity support."
      ],
      "cautionFor": [
        "Avoid alfalfa sprouts",
        "excess garlic (may stimulate immunity)",
        "manage steroid effects (bone",
        "BP",
        "glucose)",
        "adjust protein/sodium if lupus nephritis."
      ],
      "guidelines": [
        "Lupus Foundation",
        "anti-inflammatory",
        "renal-diet principles"
      ],
      "clinicalNotes": [
        "~1900 kcal · Omega-3 · Antioxidants · Vitamin D & calcium · Low sodium · Kidney-aware protein",
        "Systemic lupus erythematosus (SLE) symptom & comorbidity support."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + flax + walnuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + spinach + wholegrain toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + chia",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + pawpaw",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + quinoa + leafy greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach curry + rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Mackerel + roasted vegetables + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup (low salt) + fish + swallow",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + couscous + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Mediterranean"
      }
    ],
    "snackOptions": [
      {
        "name": "Walnuts + berries",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + flaxseed",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange + almonds",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable sticks + hummus",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "psoriasis",
    "name": "Psoriasis Diet",
    "fullName": "Psoriasis Diet",
    "description": "Anti-inflammatory, weight-managed, omega-3-rich; limit alcohol, red meat, sugar & refined carbs.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Moderate",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Anti-inflammatory",
        "weight-managed",
        "omega-3-rich",
        "limit alcohol",
        "red meat",
        "sugar",
        "refined carbs."
      ],
      "avoids": [
        "Weight loss improves severity",
        "treatment response",
        "some benefit from reducing gluten if sensitive."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Psoriasis",
        "psoriatic arthritis",
        "inflammatory skin conditions."
      ],
      "cautionFor": [
        "Weight loss improves severity",
        "treatment response",
        "some benefit from reducing gluten if sensitive."
      ],
      "guidelines": [
        "National Psoriasis Foundation",
        "Mediterranean-diet evidence"
      ],
      "clinicalNotes": [
        "~1800 kcal · Omega-3 · Antioxidants · Vitamin D · Modest deficit if overweight · Limit alcohol",
        "Psoriasis, psoriatic arthritis, inflammatory skin conditions."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + walnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + avocado + spinach",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green smoothie + chia + flax",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + pumpkin seeds",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + leafy salad + quinoa",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + brown rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sardines + wholegrain bread + tomato",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach bowl + olive oil",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Mackerel + roasted vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + turmeric rice + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + brown rice",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean chili + rice",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Walnuts + berries",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot & pepper sticks + hummus",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Orange + almonds",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green tea + fruit",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "immunity-boosting",
    "name": "Immunity-Boosting Diet",
    "fullName": "Immunity-Boosting Diet",
    "description": "Vitamin C, D, zinc, selenium, protein & probiotics; colorful produce; hydration to support immune defense.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Easy",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Vitamin C",
        "D",
        "zinc",
        "selenium",
        "protein",
        "probiotics",
        "colorful produce",
        "hydration to support immune defense."
      ],
      "avoids": [
        "No single food \"boosts\" immunity — variety",
        "adequate protein",
        "sleep",
        "activity matter most."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Frequent infections",
        "recovery",
        "seasonal immune support",
        "general resilience."
      ],
      "cautionFor": [
        "No single food \"boosts\" immunity — variety",
        "adequate protein",
        "sleep",
        "activity matter most."
      ],
      "guidelines": [
        "WHO",
        "Harvard T.H. Chan",
        "immunonutrition evidence"
      ],
      "clinicalNotes": [
        "~2000 kcal · Vitamin C & D · Zinc & selenium · Protein · Probiotics · 5+ colors of produce",
        "Frequent infections, recovery, seasonal immune support, general resilience."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Citrus + yogurt + oats + seeds",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + peppers + spinach + toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green smoothie + ginger + orange + chia",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + groundnuts + pawpaw + orange",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken & vegetable soup + wholegrain bread",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + rice + colorful vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + vegetables + citrus salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & pepper stew + brown rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + broccoli + sweet potato",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken broth + vegetables + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry (ginger/garlic) + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish pepper soup + yam",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Oranges / guava",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt (probiotic) + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pumpkin seeds (zinc)",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 5,
          "max": 5
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Kefir / fermented drink",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "iron-deficiency-recovery",
    "name": "Anemia / Iron-Deficiency Recovery Diet",
    "fullName": "Anemia / Iron-Deficiency Recovery Diet",
    "description": "Iron-rich foods (heme + non-heme) paired with vitamin C; add B12 & folate; time tea/coffee & calcium away from iron.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Moderate",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Iron-rich foods (heme + non-heme) paired with vitamin C",
        "add B12",
        "folate",
        "time tea/coffee",
        "calcium away from iron."
      ],
      "avoids": [
        "Pair plant iron with vitamin C",
        "avoid tea/coffee/dairy with iron meals (they block absorption)",
        "B12/folate for related anemias."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Iron-deficiency anemia",
        "heavy menstruation",
        "post-blood-loss recovery."
      ],
      "cautionFor": [
        "Pair plant iron with vitamin C",
        "avoid tea/coffee/dairy with iron meals (they block absorption)",
        "B12/folate for related anemias."
      ],
      "guidelines": [
        "WHO",
        "CDC",
        "BSH anemia guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Iron 18–27mg · Vitamin C pairing · B12 & folate · Separate tea/coffee from meals",
        "Iron-deficiency anemia, heavy menstruation, post-blood-loss recovery."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Spinach & egg omelet + orange",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Iron-fortified oats + dates + strawberries",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Millet pap + groundnuts + orange",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Wholegrain toast + sardines + tomato",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Efo riro (iron greens) + fish + swallow",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + plantain + pepper (vitamin C)",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Liver stew (moderate) + rice + greens",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & spinach stew + wholegrain rice + citrus",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled beef + vegetables + sweet potato",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish pepper soup + yam + greens",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg & bean rice + pepper salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + lentils + broccoli",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Dates + pumpkin seeds",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange / guava",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted chickpeas",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Dried apricots + cashews",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "gut-health",
    "name": "Gut-Health / Microbiome Diet",
    "fullName": "Gut-Health / Microbiome Diet",
    "description": "Diverse fiber (prebiotics) + fermented foods (probiotics) to nourish a healthy, varied microbiome.",
    "icon": "shield-checkmark-outline",
    "difficulty": "Easy",
    "category": "Immune, Inflammatory & Musculoskeletal",
    "principles": {
      "emphasis": [
        "Diverse fiber (prebiotics) + fermented foods (probiotics) to nourish a healthy",
        "varied microbiome."
      ],
      "avoids": [
        "Increase fiber gradually with fluids",
        "include a wide variety (\"30 plants/week\") rather than one superfood."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Digestive health",
        "post-antibiotic recovery",
        "immune",
        "metabolic support."
      ],
      "cautionFor": [
        "Increase fiber gradually with fluids",
        "include a wide variety (\"30 plants/week\") rather than one superfood."
      ],
      "guidelines": [
        "ISAPP",
        "American Gut / microbiome research",
        "Mediterranean evidence"
      ],
      "clinicalNotes": [
        "~2000 kcal · Fiber 30g+ · Fermented foods daily · 30+ plant varieties/week · Polyphenols",
        "Digestive health, post-antibiotic recovery, immune & metabolic support."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Yogurt (live) + oats + berries + seeds",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Kefir smoothie + banana + flax",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + avocado + fermented pickle",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + pawpaw",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + brown rice + mixed vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Buddha bowl (chickpeas, quinoa, greens, kimchi)",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled fish + barley + roasted vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Vegetable & bean chili + wholegrain rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Miso/tempeh & vegetable stir-fry + brown rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Efo/ewedu (mucilaginous fiber) + fish + swallow",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu + mixed-vegetable curry + rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Kefir / yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana + oats (resistant starch)",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sauerkraut / kimchi side",
        "calories": {
          "min": 30,
          "max": 30
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Mixed nuts + dried fruit",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "cancer-support",
    "name": "Cancer-Support (Oncology) Diet",
    "fullName": "Cancer-Support (Oncology) Diet",
    "description": "Maintain weight & muscle with adequate energy + protein; plant-rich, food-safe, symptom-adaptable.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Maintain weight",
        "muscle with adequate energy + protein",
        "plant-rich",
        "food-safe",
        "symptom-adaptable."
      ],
      "avoids": [
        "Needs individualizing — appetite",
        "taste changes",
        "nausea",
        "neutropenia shift needs",
        "food safety important."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "People during/after cancer treatment",
        "prevention of treatment-related malnutrition."
      ],
      "cautionFor": [
        "Needs individualizing — appetite",
        "taste changes",
        "nausea",
        "neutropenia shift needs",
        "food safety important."
      ],
      "guidelines": [
        "ESPEN oncology",
        "WCRF/AICR",
        "ASCO"
      ],
      "clinicalNotes": [
        "~2200 kcal · Protein 1.2–1.5g/kg · Energy-dense options · Colorful plants · Hydration",
        "People during/after cancer treatment, prevention of treatment-related malnutrition."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + milk + nut butter + banana",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smoothie (yogurt, berries, protein, oats)",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + colorful vegetables",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sweet potato + greens + beans",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable bowl + quinoa + olive oil",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + mashed sweet potato + broccoli",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg & vegetable fried rice + beans",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish pepper soup + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Nut-butter oat balls",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + honey + nuts",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oral nutrition shake (if advised)",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "neutropenic",
    "name": "Neutropenic (Low-Microbial / Food-Safe) Diet",
    "fullName": "Neutropenic (Low-Microbial / Food-Safe) Diet",
    "description": "Minimize foodborne-infection risk when immunity is very low — thoroughly cooked, pasteurized, freshly prepared foods.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Minimize foodborne-infection risk when immunity is very low — thoroughly cooked",
        "pasteurized",
        "freshly prepared foods."
      ],
      "avoids": [
        "Avoid raw/undercooked meat",
        "eggs",
        "unpasteurized dairy/juice",
        "raw sprouts",
        "unwashed produce",
        "buffet/leftover risks."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Neutropenia",
        "chemo/transplant patients",
        "severely immunocompromised."
      ],
      "cautionFor": [
        "Avoid raw/undercooked meat",
        "eggs",
        "unpasteurized dairy/juice",
        "raw sprouts",
        "unwashed produce",
        "buffet/leftover risks."
      ],
      "guidelines": [
        "Oncology dietetics",
        "infection-control nutrition guidance"
      ],
      "clinicalNotes": [
        "~2200 kcal · Fully cooked · Pasteurized only · High protein/energy · Strict food hygiene",
        "Neutropenia, chemo/transplant patients, severely immunocompromised."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Well-cooked scrambled eggs + toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hot oatmeal + pasteurized milk + banana",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pasteurized yogurt + cooked-fruit compote",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cooked pap + pasteurized milk",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Fully-cooked chicken + rice + cooked vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Well-done fish + potato + cooked carrots",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Thoroughly cooked beans + plantain",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Canned/cooked lentil soup + toasted bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked chicken + mashed potato + cooked broccoli",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Well-cooked fish + rice + cooked spinach",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable rice (well cooked)",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + couscous + cooked vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Mediterranean"
      }
    ],
    "snackOptions": [
      {
        "name": "Individually-wrapped crackers + cheese (pasteurized)",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Canned fruit (single-serve)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pasteurized yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Commercial nutrition shake (sealed)",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "chemo-nausea",
    "name": "Chemotherapy Nausea-Friendly Diet",
    "fullName": "Chemotherapy Nausea-Friendly Diet",
    "description": "Bland, cool, low-odor, easy foods; small frequent meals; ginger; separate fluids from solids.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Bland",
        "cool",
        "low-odor",
        "easy foods",
        "small frequent meals",
        "ginger",
        "separate fluids from solids."
      ],
      "avoids": [
        "Eat when able (calories first)",
        "cold foods have less smell",
        "sip fluids between meals",
        "try ginger",
        "lemon."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Chemo/radiation nausea",
        "taste changes",
        "poor appetite."
      ],
      "cautionFor": [
        "Eat when able (calories first)",
        "cold foods have less smell",
        "sip fluids between meals",
        "try ginger",
        "lemon."
      ],
      "guidelines": [
        "ONS",
        "ESPEN",
        "Macmillan cancer-nutrition"
      ],
      "clinicalNotes": [
        "Calories-first · Small frequent bland meals · Ginger · Hydration between meals · Adapt to taste changes",
        "Chemo/radiation nausea, taste changes, poor appetite."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Plain toast + banana",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cold cereal + pasteurized milk",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oatmeal (plain) + honey",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smoothie (banana, yogurt, ginger)",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken & rice (plain) + carrots",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Crackers + mild cheese + cool fruit",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain pasta + a little olive oil",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Mashed potato + poached egg",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Poached fish + rice + soft vegetables",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken broth + noodles",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Scrambled egg + toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice porridge + shredded chicken",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Ginger tea + plain crackers",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cold melon / grapes",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Ice pops / sorbet",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pretzels / dry cereal",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "post-surgery-recovery",
    "name": "Post-Surgery Recovery Diet",
    "fullName": "Post-Surgery Recovery Diet",
    "description": "Extra protein, vitamin C & zinc for tissue repair; fiber & fluids to counter post-op constipation.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Extra protein",
        "vitamin C",
        "zinc for tissue repair",
        "fiber",
        "fluids to counter post-op constipation."
      ],
      "avoids": [
        "Progress texture as tolerated",
        "prioritize protein",
        "fluids + fiber prevent opioid-related constipation."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Recovery after surgery",
        "wound",
        "incision healing."
      ],
      "cautionFor": [
        "Progress texture as tolerated",
        "prioritize protein",
        "fluids + fiber prevent opioid-related constipation."
      ],
      "guidelines": [
        "ESPEN surgery",
        "ERAS protocols",
        "wound-healing nutrition"
      ],
      "clinicalNotes": [
        "~2200 kcal · Protein 1.2–1.5g/kg · Vitamin C & zinc · Fiber · Hydration",
        "Recovery after surgery, wound & incision healing."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + wholegrain toast + orange",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + oats + berries + nuts",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein smoothie + banana + peanut butter",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + orange",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + vegetables + citrus salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sweet potato + broccoli",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + quinoa + peppers (vitamin C)",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg & bean rice + vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef + vegetable stew + rice",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Yogurt + nuts + berries",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + orange",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein shake",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "wound-healing",
    "name": "Wound-Healing / High-Protein Diet",
    "fullName": "Wound-Healing / High-Protein Diet",
    "description": "Maximize protein, vitamin C, zinc, vitamin A & calories to rebuild tissue; for wounds & pressure injuries.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Maximize protein",
        "vitamin C",
        "zinc",
        "vitamin A",
        "calories to rebuild tissue",
        "for wounds",
        "pressure injuries."
      ],
      "avoids": [
        "Protein",
        "energy demands rise sharply",
        "consider arginine/zinc-fortified supplements if advised",
        "control glucose if diabetic."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Pressure ulcers",
        "chronic/slow-healing wounds",
        "diabetic foot wounds."
      ],
      "cautionFor": [
        "Protein",
        "energy demands rise sharply",
        "consider arginine/zinc-fortified supplements if advised",
        "control glucose if diabetic."
      ],
      "guidelines": [
        "EPUAP/NPIAP",
        "ESPEN",
        "wound-care nutrition"
      ],
      "clinicalNotes": [
        "~2400 kcal · Protein 1.5–2.0g/kg · Vitamin C 500mg · Zinc · Vitamin A · Adequate fluids",
        "Pressure ulcers, chronic/slow-healing wounds, diabetic foot wounds."
      ]
    },
    "breakfastOptions": [
      {
        "name": "3-egg omelet + cheese + toast",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + whey + oats + berries",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi (large) + boiled eggs + orange",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Protein smoothie + peanut butter + banana",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken breast (large) + rice + peppers",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + beans + plantain",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef + quinoa + broccoli",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentils + egg + wholegrain rice + citrus",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + spinach",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro + beans",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + rice + mixed vegetables + cheese",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & bean fried rice + fish",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Greek yogurt + pumpkin seeds",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + orange",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Arginine/zinc-fortified shake (if advised)",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "burns-recovery",
    "name": "Burns-Recovery Diet",
    "fullName": "Burns-Recovery Diet",
    "description": "Very high energy & protein for hypermetabolism; micronutrients (vitamin C, zinc, copper, selenium) for skin repair.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Very high energy",
        "protein for hypermetabolism",
        "micronutrients (vitamin C",
        "zinc",
        "copper",
        "selenium) for skin repair."
      ],
      "avoids": [
        "Energy needs can double",
        "often needs oral supplements/tube feeding under clinical care",
        "strict hydration."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Moderate–severe burn recovery",
        "extensive tissue repair."
      ],
      "cautionFor": [
        "Energy needs can double",
        "often needs oral supplements/tube feeding under clinical care",
        "strict hydration."
      ],
      "guidelines": [
        "ISBI",
        "ESPEN burns",
        "ASPEN"
      ],
      "clinicalNotes": [
        "2500–3500 kcal · Protein 1.5–2.0g/kg+ · Vitamin C · Zinc/copper/selenium · Frequent meals",
        "Moderate–severe burn recovery, extensive tissue repair."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + cheese + toast + full-fat milk",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + whey + peanut butter + banana",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + eggs + milk + orange",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "High-protein smoothie + oats + nut butter",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + beans + vegetables",
        "calories": {
          "min": 600,
          "max": 600
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + plantain + eggs + greens",
        "calories": {
          "min": 600,
          "max": 600
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef stew + rice + vegetables",
        "calories": {
          "min": 600,
          "max": 600
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentils + chicken + wholegrain rice + citrus",
        "calories": {
          "min": 580,
          "max": 580
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + spinach + cheese",
        "calories": {
          "min": 580,
          "max": 580
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo + beans",
        "calories": {
          "min": 580,
          "max": 580
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + rice + mixed vegetables + avocado",
        "calories": {
          "min": 580,
          "max": 580
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & bean fried rice + fish",
        "calories": {
          "min": 570,
          "max": 570
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fortified milkshake",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Nut butter + banana on toast",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + granola + honey",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oral nutrition supplement",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "hiv-nutrition",
    "name": "HIV / Immune-Nutrition Diet",
    "fullName": "HIV / Immune-Nutrition Diet",
    "description": "Adequate energy & protein to maintain weight/muscle; micronutrients for immunity; food & water safety.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Adequate energy",
        "protein to maintain weight/muscle",
        "micronutrients for immunity",
        "food",
        "water safety."
      ],
      "avoids": [
        "Manage medication side-effects (nausea",
        "lipids",
        "glucose)",
        "strict food hygiene",
        "treat weight loss early."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "People living with HIV/AIDS",
        "maintaining strength on antiretroviral therapy."
      ],
      "cautionFor": [
        "Manage medication side-effects (nausea",
        "lipids",
        "glucose)",
        "strict food hygiene",
        "treat weight loss early."
      ],
      "guidelines": [
        "WHO HIV nutrition",
        "FANTA",
        "ESPEN"
      ],
      "clinicalNotes": [
        "~2400 kcal (more if wasting/infection) · Protein 1.2–1.5g/kg · Micronutrient-rich · Safe food/water",
        "People living with HIV/AIDS, maintaining strength on antiretroviral therapy."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + milk + peanut butter + banana",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk + orange",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + granola + fruit + nuts",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + beans + vegetables",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + plantain + greens",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef & vegetable stew + rice",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentils + egg + wholegrain rice + citrus",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + broccoli",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg & bean fried rice + fish",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + rice + mixed vegetables",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Groundnuts / peanuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + fruit + honey",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + orange",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fortified porridge / shake",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "tuberculosis-recovery",
    "name": "Tuberculosis-Recovery Diet",
    "fullName": "Tuberculosis-Recovery Diet",
    "description": "High energy & protein to reverse wasting; vitamin A, C, D, zinc & iron; frequent nutrient-dense meals.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "High energy",
        "protein to reverse wasting",
        "vitamin A",
        "C",
        "D",
        "zinc",
        "iron",
        "frequent nutrient-dense meals."
      ],
      "avoids": [
        "Appetite is often poor — small frequent energy-dense meals",
        "ensure vitamin D",
        "B6 (with isoniazid)",
        "food safety."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Active TB treatment",
        "recovery",
        "TB-related malnutrition."
      ],
      "cautionFor": [
        "Appetite is often poor — small frequent energy-dense meals",
        "ensure vitamin D",
        "B6 (with isoniazid)",
        "food safety."
      ],
      "guidelines": [
        "WHO TB nutrition",
        "national TB programs"
      ],
      "clinicalNotes": [
        "~2600 kcal · Protein 1.2–1.5g/kg · Vitamin A/C/D · Zinc & iron · Frequent meals",
        "Active TB treatment & recovery, TB-related malnutrition."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + toast + milk + banana",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + peanut butter + milk + dates",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk + groundnuts",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + granola + fruit + nuts",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + beans + vegetables",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + plantain + greens + egg",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef stew + rice + vegetables",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Liver stew (iron/vitamin A) + rice + greens",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + spinach",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo + beans",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg & bean fried rice + fish",
        "calories": {
          "min": 510,
          "max": 510
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + rice + mixed vegetables + avocado",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Groundnuts + dates",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Milk + banana smoothie",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs + fruit",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fortified porridge",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "dysphagia-pureed",
    "name": "Dysphagia / Texture-Modified (Pureed) Diet",
    "fullName": "Dysphagia / Texture-Modified (Pureed) Diet",
    "description": "Smooth, lump-free purees & thickened fluids that are safe to swallow; keep them nutrient- & energy-dense.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Smooth",
        "lump-free purees",
        "thickened fluids that are safe to swallow",
        "keep them nutrient-",
        "energy-dense."
      ],
      "avoids": [
        "Follow prescribed IDDSI texture level",
        "fluid thickness",
        "avoid mixed textures",
        "thin liquids if aspiration risk. Fortify to prevent weight loss."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Swallowing difficulty (stroke",
        "dementia",
        "head/neck cancer",
        "neuromuscular disease)."
      ],
      "cautionFor": [
        "Follow prescribed IDDSI texture level",
        "fluid thickness",
        "avoid mixed textures",
        "thin liquids if aspiration risk. Fortify to prevent weight loss."
      ],
      "guidelines": [
        "IDDSI framework",
        "SLT/dietitian guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · IDDSI-appropriate texture · Fortified purees · Thickened fluids · Protein-enriched",
        "Swallowing difficulty (stroke, dementia, head/neck cancer, neuromuscular disease)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Smooth porridge + pureed banana + milk powder",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Blended eggs + smooth potato + cheese",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fortified pap (extra milk)",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Smooth yogurt + pureed fruit + protein powder",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Pureed chicken + smooth mashed potato + gravy",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Blended fish + pureed vegetables + cream",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smooth lentil puree + fortified mash",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pureed beans + soft plantain mash",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Pureed beef stew + smooth mash",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Blended fish + pureed yam + spinach",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Smooth chicken & vegetable puree",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fortified vegetable & egg puree",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Thick fortified milkshake",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Smooth yogurt + honey",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Custard / smooth pudding",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pureed fruit + cream",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "convalescence-soft",
    "name": "Convalescence / Soft Diet",
    "fullName": "Convalescence / Soft Diet",
    "description": "Soft, easy-to-chew, gentle-on-the-gut meals during recovery from illness, dental work or GI upset.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Soft",
        "easy-to-chew",
        "gentle-on-the-gut meals during recovery from illness",
        "dental work or GI upset."
      ],
      "avoids": [
        "Softer than normal but not pureed",
        "avoid tough",
        "crunchy",
        "very spicy or high-fiber-raw foods",
        "keep nutrition up."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Recovery from illness/infection",
        "dental surgery",
        "mild GI recovery",
        "frailty."
      ],
      "cautionFor": [
        "Softer than normal but not pureed",
        "avoid tough",
        "crunchy",
        "very spicy or high-fiber-raw foods",
        "keep nutrition up."
      ],
      "guidelines": [
        "Clinical soft-diet standards",
        "dietitian guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Soft textures · Adequate protein & energy · Gentle fiber · Hydration",
        "Recovery from illness/infection, dental surgery, mild GI recovery, frailty."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Soft scrambled eggs + soft bread",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oatmeal + mashed banana + milk",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + soft moi-moi",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + soft stewed fruit + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Minced chicken + mashed potato + soft carrots",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Flaked fish + soft rice + peas",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft beans + ripe plantain",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Soft pasta + mild vegetable & meat sauce",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Soft chicken & vegetable stew + mash",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Poached fish + mashed yam + spinach",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg + soft rice + soft vegetables",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + soft bread",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Yogurt + honey",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft ripe banana / pawpaw",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Custard / milk pudding",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soft cheese + soft bread",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "copd-respiratory",
    "name": "COPD / Respiratory-Support Diet",
    "fullName": "COPD / Respiratory-Support Diet",
    "description": "Energy-dense, higher-fat/lower-excess-carb meals to reduce CO₂ load; small frequent meals to ease breathing.",
    "icon": "medkit-outline",
    "difficulty": "Advanced",
    "category": "Cancer, Recovery & Clinical Nutrition",
    "principles": {
      "emphasis": [
        "Energy-dense",
        "higher-fat/lower-excess-carb meals to reduce CO₂ load",
        "small frequent meals to ease breathing."
      ],
      "avoids": [
        "Large meals",
        "excess simple carbs raise CO₂ and worsen breathlessness",
        "prevent weight loss",
        "muscle wasting",
        "limit gas-forming foods."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "COPD",
        "emphysema",
        "chronic respiratory disease",
        "breathlessness with eating."
      ],
      "cautionFor": [
        "Large meals",
        "excess simple carbs raise CO₂ and worsen breathlessness",
        "prevent weight loss",
        "muscle wasting",
        "limit gas-forming foods."
      ],
      "guidelines": [
        "ATS/ERS",
        "pulmonary-rehab nutrition",
        "ESPEN"
      ],
      "clinicalNotes": [
        "~2200 kcal · Higher healthy fat · Adequate protein · Small frequent meals · Limit bloating foods",
        "COPD, emphysema, chronic respiratory disease, breathlessness with eating."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + avocado + wholegrain toast",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + full-fat milk + nut butter",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt (full-fat) + granola + nuts",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + groundnuts + egg",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Salmon + sweet potato + olive-oil greens",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + rice + avocado salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + egg (moderate portion)",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable stew + olive oil + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + mashed potato + cheese + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg & vegetable fried rice + avocado",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable curry (coconut) + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Nut butter on toast",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Full-fat yogurt + honey + nuts",
        "calories": {
          "min": 240,
          "max": 240
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Avocado on crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "dairy-free",
    "name": "Dairy-Free (Milk-Allergy) Diet",
    "fullName": "Dairy-Free (Milk-Allergy) Diet",
    "description": "Remove all milk protein (casein/whey); replace calcium, vitamin D, protein & B12 from fortified/plant sources.",
    "icon": "alert-circle-outline",
    "difficulty": "Moderate",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Remove all milk protein (casein/whey)",
        "replace calcium",
        "vitamin D",
        "protein",
        "B12 from fortified/plant sources."
      ],
      "avoids": [
        "Read labels for hidden milk (butter",
        "whey",
        "casein",
        "ghee)",
        "ensure fortified alternatives for calcium",
        "vitamin D."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Cow's-milk protein allergy",
        "dairy-free by need",
        "severe lactose issues."
      ],
      "cautionFor": [
        "Read labels for hidden milk (butter",
        "whey",
        "casein",
        "ghee)",
        "ensure fortified alternatives for calcium",
        "vitamin D."
      ],
      "guidelines": [
        "Allergy UK",
        "FARE",
        "NHS"
      ],
      "clinicalNotes": [
        "~2000 kcal · 100% dairy-free · Calcium 1000mg (fortified/plant) · Vitamin D · B12",
        "Cow's-milk protein allergy, dairy-free by need, severe lactose issues."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + fortified soy/almond milk + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + fortified soy milk + groundnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Coconut yogurt + berries + oats + seeds",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + rice + mixed vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry (dairy-free) + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean chili + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fortified soy yogurt + berries",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Almonds (calcium)",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fruit + tahini crackers",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Fortified plant-milk smoothie",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "nut-free",
    "name": "Nut-Allergy (Peanut & Tree-Nut-Free) Diet",
    "fullName": "Nut-Allergy (Peanut & Tree-Nut-Free) Diet",
    "description": "Strictly exclude peanuts & tree nuts and their oils/traces; replace healthy fats & protein from seeds, fish, legumes.",
    "icon": "alert-circle-outline",
    "difficulty": "Moderate",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Strictly exclude peanuts",
        "tree nuts and their oils/traces",
        "replace healthy fats",
        "protein from seeds",
        "fish",
        "legumes."
      ],
      "avoids": [
        "Check labels for \"may contain traces\"",
        "watch sauces (satay",
        "pesto)",
        "baked goods",
        "cross-contact",
        "carry epinephrine if prescribed."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Peanut/tree-nut allergy (often life-threatening — anaphylaxis risk)."
      ],
      "cautionFor": [
        "Check labels for \"may contain traces\"",
        "watch sauces (satay",
        "pesto)",
        "baked goods",
        "cross-contact",
        "carry epinephrine if prescribed."
      ],
      "guidelines": [
        "FARE",
        "Allergy UK",
        "Anaphylaxis Campaign"
      ],
      "clinicalNotes": [
        "~2000 kcal · 100% nut-free · Seeds/fish for healthy fats · Legumes for protein",
        "Peanut/tree-nut allergy (often life-threatening — anaphylaxis risk)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + seeds (sunflower/pumpkin) + banana",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + moi-moi",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + sweet potato + salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + rice + broccoli",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable stir-fry (no nut oil) + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & bean fried rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Sunflower-seed butter on toast",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted chickpeas",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fruit + seed mix",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "egg-free",
    "name": "Egg-Free Diet",
    "fullName": "Egg-Free Diet",
    "description": "Exclude eggs & egg derivatives; use alternative proteins & baking binders (flax/chia \"egg\", banana, aquafaba).",
    "icon": "alert-circle-outline",
    "difficulty": "Moderate",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Exclude eggs",
        "egg derivatives",
        "use alternative proteins",
        "baking binders (flax/chia \"egg\"",
        "banana",
        "aquafaba)."
      ],
      "avoids": [
        "Hidden egg in baked goods",
        "mayo",
        "pasta",
        "glazes",
        "some vaccines — read labels",
        "ensure enough protein/choline elsewhere."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Egg allergy (common in children",
        "often outgrown)."
      ],
      "cautionFor": [
        "Hidden egg in baked goods",
        "mayo",
        "pasta",
        "glazes",
        "some vaccines — read labels",
        "ensure enough protein/choline elsewhere."
      ],
      "guidelines": [
        "FARE",
        "Allergy UK",
        "NHS"
      ],
      "clinicalNotes": [
        "~2000 kcal · 100% egg-free · Protein from meat/fish/legumes/dairy · Choline from other foods",
        "Egg allergy (common in children, often outgrown)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + milk + banana + seeds",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + avocado + tomato",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + granola + berries",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + moi-moi (bean, no egg)",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + broccoli",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + rice + mixed vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & vegetable stew + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Fruit + nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana + seed butter",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "soy-free",
    "name": "Soy-Free Diet",
    "fullName": "Soy-Free Diet",
    "description": "Exclude soybeans & soy derivatives (tofu, tempeh, soy sauce, soy lecithin, edamame); replace plant protein.",
    "icon": "alert-circle-outline",
    "difficulty": "Moderate",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Exclude soybeans",
        "soy derivatives (tofu",
        "tempeh",
        "soy sauce",
        "soy lecithin",
        "edamame)",
        "replace plant protein."
      ],
      "avoids": [
        "Hidden soy in sauces",
        "processed",
        "baked foods",
        "margarine (lecithin)",
        "many vegan products — read labels carefully."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Soy allergy or sensitivity."
      ],
      "cautionFor": [
        "Hidden soy in sauces",
        "processed",
        "baked foods",
        "margarine (lecithin)",
        "many vegan products — read labels carefully."
      ],
      "guidelines": [
        "FARE",
        "Allergy UK",
        "NHS"
      ],
      "clinicalNotes": [
        "~2000 kcal · 100% soy-free · Protein from meat/fish/eggs/legumes (non-soy) · Coconut aminos for soy sauce",
        "Soy allergy or sensitivity."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + milk + banana + seeds",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries + oats",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + groundnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + sweet potato + salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil soup + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + rice + broccoli",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef stir-fry (coconut aminos) + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & bean fried rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fruit + almonds",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted chickpeas",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "shellfish-free",
    "name": "Shellfish / Seafood-Allergy Diet",
    "fullName": "Shellfish / Seafood-Allergy Diet",
    "description": "Exclude crustaceans/mollusks (and/or fish); get omega-3 & iodine from safe alternative sources.",
    "icon": "alert-circle-outline",
    "difficulty": "Moderate",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Exclude crustaceans/mollusks (and/or fish)",
        "get omega-3",
        "iodine from safe alternative sources."
      ],
      "avoids": [
        "Avoid cross-contact (fried foods",
        "Asian sauces",
        "fish stock",
        "surimi)",
        "source omega-3 from flax/chia/walnut/algae oil."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Shellfish and/or fish allergy (often lifelong",
        "anaphylaxis risk)."
      ],
      "cautionFor": [
        "Avoid cross-contact (fried foods",
        "Asian sauces",
        "fish stock",
        "surimi)",
        "source omega-3 from flax/chia/walnut/algae oil."
      ],
      "guidelines": [
        "FARE",
        "Allergy UK",
        "Anaphylaxis Campaign"
      ],
      "clinicalNotes": [
        "~2000 kcal · No shellfish/seafood · Omega-3 (flax/chia/algae) · Iodine (dairy/eggs/iodized salt)",
        "Shellfish and/or fish allergy (often lifelong; anaphylaxis risk)."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + flaxseed + berries + walnuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + chia + banana",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk + groundnuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef + sweet potato + salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Chicken + quinoa + broccoli",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + yam + efo riro",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable stir-fry (no fish sauce) + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & bean fried rice + vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Walnuts + berries",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chia pudding",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + flaxseed",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fruit + seed mix",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "wheat-allergy",
    "name": "Wheat-Allergy Diet",
    "fullName": "Wheat-Allergy Diet",
    "description": "Exclude wheat proteins (distinct from celiac — may still tolerate barley/rye unless advised otherwise); use alternative grains.",
    "icon": "alert-circle-outline",
    "difficulty": "Moderate",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Exclude wheat proteins (distinct from celiac — may still tolerate barley/rye unless advised otherwise)",
        "use alternative grains."
      ],
      "avoids": [
        "Avoid wheat in bread",
        "pasta",
        "couscous",
        "sauces",
        "batter",
        "watch cross-contact"
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "IgE wheat allergy",
        "wheat-dependent exercise-induced anaphylaxis."
      ],
      "cautionFor": [
        "Avoid wheat in bread",
        "pasta",
        "couscous",
        "sauces",
        "batter",
        "watch cross-contact"
      ],
      "guidelines": [
        "FARE",
        "Allergy UK",
        "NHS"
      ],
      "clinicalNotes": [
        "~2000 kcal · Wheat-free · Alternative grains (rice, maize, millet, sorghum) · Fiber & B-vits",
        "IgE wheat allergy, wheat-dependent exercise-induced anaphylaxis."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Maize/millet pap + milk + groundnuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Eggs + plantain + avocado",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Rice porridge + banana + seeds",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wheat-free oats + milk + berries",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Jollof rice + grilled chicken + salad",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + plantain + vegetables",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Quinoa bowl + chickpeas + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + rice + steamed vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + sweet potato + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & vegetable stir-fry (wheat-free sauce) + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Rice cakes + seed butter",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plantain chips (baked)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fruit + nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "low-histamine",
    "name": "Histamine-Intolerance (Low-Histamine) Diet",
    "fullName": "Histamine-Intolerance (Low-Histamine) Diet",
    "description": "Fresh, freshly-cooked foods low in histamine; avoid aged, fermented, leftover & histamine-releasing foods.",
    "icon": "alert-circle-outline",
    "difficulty": "Moderate",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Fresh",
        "freshly-cooked foods low in histamine",
        "avoid aged",
        "fermented",
        "leftover",
        "histamine-releasing foods."
      ],
      "avoids": [
        "Avoid aged cheese",
        "cured/smoked meat",
        "fermented foods",
        "leftovers",
        "tomatoes",
        "spinach"
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Histamine intolerance",
        "unexplained flushing/hives/headaches after certain foods."
      ],
      "cautionFor": [
        "Avoid aged cheese",
        "cured/smoked meat",
        "fermented foods",
        "leftovers",
        "tomatoes",
        "spinach"
      ],
      "guidelines": [
        "Emerging histamine-intolerance research",
        "dietitian guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Freshly prepared · Freeze leftovers immediately · Low-histamine produce",
        "Histamine intolerance, unexplained flushing/hives/headaches after certain foods."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Fresh-cooked oats + apple + honey",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Freshly scrambled eggs + fresh toast",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice porridge + fresh pear",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh pap + rice milk",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Fresh-cooked chicken + rice + zucchini & carrots",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Freshly grilled fresh fish + potato + green beans",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh vegetable & rice bowl (no tomato/spinach)",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Freshly cooked lentils + rice + carrots",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Fresh chicken + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Freshly cooked fish + rice + squash",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh turkey + couscous + carrots",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Fresh vegetable stir-fry (fresh oil) + rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fresh apple / pear",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh melon",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh-made oat biscuit",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "low-salicylate",
    "name": "Salicylate-Sensitivity (Low-Salicylate) Diet",
    "fullName": "Salicylate-Sensitivity (Low-Salicylate) Diet",
    "description": "Limit naturally salicylate-rich foods; choose low-salicylate grains, proteins & mild vegetables; short-term investigation.",
    "icon": "alert-circle-outline",
    "difficulty": "Moderate",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Limit naturally salicylate-rich foods",
        "choose low-salicylate grains",
        "proteins",
        "mild vegetables",
        "short-term investigation."
      ],
      "avoids": [
        "Avoid berries",
        "citrus",
        "tomato",
        "many spices",
        "mint",
        "honey"
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Salicylate sensitivity",
        "aspirin-exacerbated respiratory disease",
        "some chronic urticaria."
      ],
      "cautionFor": [
        "Avoid berries",
        "citrus",
        "tomato",
        "many spices",
        "mint",
        "honey"
      ],
      "guidelines": [
        "RPAH elimination-diet framework",
        "allergy dietitian guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Low-salicylate choices · Adequate variety within limits · Reintroduce systematically",
        "Salicylate sensitivity, aspirin-exacerbated respiratory disease, some chronic urticaria."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + pear + milk",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Scrambled eggs + plain toast",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice porridge + banana",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + milk",
        "calories": {
          "min": 290,
          "max": 290
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + cabbage & peeled potato",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + potato + peeled zucchini",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentils + rice + leek & celery",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain pasta + a little sunflower oil + chicken",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked chicken + mashed potato + green beans",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + rice + peeled squash",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + potato + cabbage",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & rice with mild peeled vegetables",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Peeled pear",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain rice crackers",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "elimination",
    "name": "Elimination Diet (Allergy / Intolerance Investigation)",
    "fullName": "Elimination Diet (Allergy / Intolerance Investigation)",
    "description": "Temporarily remove the common trigger foods, then reintroduce one at a time to identify culprits.",
    "icon": "alert-circle-outline",
    "difficulty": "Advanced",
    "category": "Allergy, Intolerance & Elimination",
    "principles": {
      "emphasis": [
        "Temporarily remove the common trigger foods",
        "then reintroduce one at a time to identify culprits."
      ],
      "avoids": [
        "Short-term",
        "structured (usually 2–6 weeks elimination + planned reintroduction)",
        "ideally dietitian-guided to stay nutritionally complete."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Identifying unknown food intolerances",
        "chronic hives",
        "unexplained GI/skin symptoms."
      ],
      "cautionFor": [
        "Short-term",
        "structured (usually 2–6 weeks elimination + planned reintroduction)",
        "ideally dietitian-guided to stay nutritionally complete."
      ],
      "guidelines": [
        "RPAH/allergy elimination frameworks",
        "dietitian guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Remove top allergens (milk, egg, wheat, soy, nuts, fish, shellfish) · Reintroduce singly & log",
        "Identifying unknown food intolerances, chronic hives, unexplained GI/skin symptoms."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Rice porridge + pear + seeds",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats (GF) + banana + coconut yogurt",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plantain + avocado + turkey slice",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Millet pap + fortified rice milk",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + rice + peeled vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lamb/turkey + sweet potato + carrots",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentils + rice + mild vegetables",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Quinoa + chicken + zucchini",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked chicken + potato + green beans",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + rice + peeled squash",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lamb & vegetable stew + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice + mild vegetables + olive oil + chicken",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Pear / peeled apple",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sunflower/pumpkin seeds",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plantain chips (baked)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ]
  },
  {
    "id": "bodybuilding",
    "name": "Muscle-Gain / Bulking Diet",
    "fullName": "Muscle-Gain / Bulking Diet",
    "description": "Calorie surplus with high protein & carbs to build muscle alongside resistance training.",
    "icon": "barbell-outline",
    "difficulty": "Moderate",
    "category": "Fitness, Performance & Body Composition",
    "principles": {
      "emphasis": [
        "Calorie surplus with high protein",
        "carbs to build muscle alongside resistance training."
      ],
      "avoids": [
        "Aim a lean surplus (~+300–500 kcal) to limit fat gain",
        "spread protein across the day",
        "train progressively."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Muscle building",
        "\"hard-gainers\"",
        "strength progression."
      ],
      "cautionFor": [
        "Aim a lean surplus (~+300–500 kcal) to limit fat gain",
        "spread protein across the day",
        "train progressively."
      ],
      "guidelines": [
        "ISSN position stands",
        "ACSM"
      ],
      "clinicalNotes": [
        "~2800–3200 kcal · Protein 1.6–2.2g/kg · Carbs 4–6g/kg · Surplus +300–500 kcal",
        "Muscle building, \"hard-gainers\", strength progression."
      ]
    },
    "breakfastOptions": [
      {
        "name": "4-egg omelet + cheese + toast + avocado",
        "calories": {
          "min": 550,
          "max": 550
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 30,
          "max": 30
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + whey + peanut butter + banana + milk",
        "calories": {
          "min": 560,
          "max": 560
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi (large) + eggs + pap + milk",
        "calories": {
          "min": 550,
          "max": 550
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Protein pancakes + Greek yogurt + berries",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken breast (large) + rice + beans + vegetables",
        "calories": {
          "min": 700,
          "max": 700
        },
        "protein": {
          "min": 48,
          "max": 48
        },
        "carbs": {
          "min": 78,
          "max": 78
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef + jollof rice + plantain",
        "calories": {
          "min": 720,
          "max": 720
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 82,
          "max": 82
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + sweet potato + eggs + greens",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 44,
          "max": 44
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentils + chicken + wholegrain rice + avocado",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + rice + broccoli + olive oil",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 44,
          "max": 44
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo + beans",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 46,
          "max": 46
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef stir-fry + rice + vegetables",
        "calories": {
          "min": 700,
          "max": 700
        },
        "protein": {
          "min": 46,
          "max": 46
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + pasta + cheese + vegetables",
        "calories": {
          "min": 690,
          "max": 690
        },
        "protein": {
          "min": 44,
          "max": 44
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Mass-gainer/whey shake + oats + banana",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Peanut butter sandwich + milk",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + granola + honey + nuts",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Trail mix (nuts + dried fruit)",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "cutting-fat-loss",
    "name": "Cutting / Fat-Loss (Athlete) Diet",
    "fullName": "Cutting / Fat-Loss (Athlete) Diet",
    "description": "Moderate deficit with very high protein to shed fat while preserving hard-earned muscle.",
    "icon": "barbell-outline",
    "difficulty": "Moderate",
    "category": "Fitness, Performance & Body Composition",
    "principles": {
      "emphasis": [
        "Moderate deficit with very high protein to shed fat while preserving hard-earned muscle."
      ],
      "avoids": [
        "Keep deficit modest (~15–20%)",
        "protein high",
        "time carbs around training",
        "don't crash-cut."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Athletes/lifters leaning out",
        "physique prep",
        "fat loss without strength loss."
      ],
      "cautionFor": [
        "Keep deficit modest (~15–20%)",
        "protein high",
        "time carbs around training",
        "don't crash-cut."
      ],
      "guidelines": [
        "ISSN",
        "ACSM",
        "physique-nutrition research"
      ],
      "clinicalNotes": [
        "~1900 kcal · Protein 2.0–2.4g/kg · Moderate carbs (around training) · ~15–20% deficit",
        "Athletes/lifters leaning out, physique prep, fat loss without strength loss."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Egg-white & whole-egg scramble + spinach + 1 toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + whey + berries + oats",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein smoothie + oats + peanut butter (small)",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + boiled eggs",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken breast + salad + ½ cup rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 44,
          "max": 44
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sweet potato (small) + greens",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lean beef + vegetables + small rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tuna + beans + salad",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + broccoli + cauliflower rice",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + greens + small sweet potato",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 44,
          "max": 44
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + vegetable stir-fry (small rice)",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg-white & vegetable fried rice + shrimp",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Whey shake",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 25,
          "max": 25
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain Greek yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 17,
          "max": 17
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs (2) + cucumber",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Biltong / lean jerky",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 2,
          "max": 2
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "athlete-endurance",
    "name": "Endurance-Athlete Diet",
    "fullName": "Endurance-Athlete Diet",
    "description": "High carbohydrate to fuel long training/racing; adequate protein for repair; strategic hydration & electrolytes.",
    "icon": "barbell-outline",
    "difficulty": "Moderate",
    "category": "Fitness, Performance & Body Composition",
    "principles": {
      "emphasis": [
        "High carbohydrate to fuel long training/racing",
        "adequate protein for repair",
        "strategic hydration",
        "electrolytes."
      ],
      "avoids": [
        "Carb-load before long events",
        "fuel during (30–60g carb/hr)",
        "replace fluid",
        "sodium",
        "recover with carb+protein."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Runners",
        "cyclists",
        "triathletes",
        "footballers",
        "long-distance",
        "repeated-effort sports."
      ],
      "cautionFor": [
        "Carb-load before long events",
        "fuel during (30–60g carb/hr)",
        "replace fluid",
        "sodium",
        "recover with carb+protein."
      ],
      "guidelines": [
        "ISSN",
        "ACSM/IOC endurance-nutrition consensus"
      ],
      "clinicalNotes": [
        "~3000 kcal · Carbs 6–10g/kg · Protein 1.4–1.6g/kg · In-session carbs & electrolytes",
        "Runners, cyclists, triathletes, footballers, long-distance & repeated-effort sports."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + banana + honey + milk + whey",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 82,
          "max": 82
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pancakes + eggs + fruit + syrup",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 84,
          "max": 84
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + bread + milk",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 82,
          "max": 82
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Rice + eggs + plantain",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 84,
          "max": 84
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + large rice + vegetables + beans",
        "calories": {
          "min": 650,
          "max": 650
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 88,
          "max": 88
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pasta + tomato & chicken sauce + bread",
        "calories": {
          "min": 660,
          "max": 660
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 96,
          "max": 96
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Jollof rice + fish + plantain",
        "calories": {
          "min": 660,
          "max": 660
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 92,
          "max": 92
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + yam + eggs + greens",
        "calories": {
          "min": 640,
          "max": 640
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 92,
          "max": 92
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + large sweet potato + rice + greens",
        "calories": {
          "min": 640,
          "max": 640
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 84,
          "max": 84
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + pasta + vegetables",
        "calories": {
          "min": 640,
          "max": 640
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 82,
          "max": 82
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice + beef + plantain + salad",
        "calories": {
          "min": 660,
          "max": 660
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 84,
          "max": 84
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 620,
          "max": 620
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 78,
          "max": 78
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Banana + dates (pre/mid-run)",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Recovery shake (carb+whey)",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 25,
          "max": 25
        },
        "carbs": {
          "min": 45,
          "max": 45
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice cakes + honey + jam",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sports drink + electrolytes",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "strength-athlete",
    "name": "Strength / Power-Athlete Diet",
    "fullName": "Strength / Power-Athlete Diet",
    "description": "High protein for force production & repair; sufficient carbs to fuel heavy sessions; creatine-supportive.",
    "icon": "barbell-outline",
    "difficulty": "Moderate",
    "category": "Fitness, Performance & Body Composition",
    "principles": {
      "emphasis": [
        "High protein for force production",
        "repair",
        "sufficient carbs to fuel heavy sessions",
        "creatine-supportive."
      ],
      "avoids": [
        "Match energy to training volume",
        "protein 1.6–2.2g/kg spread across meals",
        "carbs periodized to sessions."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Powerlifters",
        "sprinters",
        "rugby/football linemen",
        "throwers",
        "combat athletes."
      ],
      "cautionFor": [
        "Match energy to training volume",
        "protein 1.6–2.2g/kg spread across meals",
        "carbs periodized to sessions."
      ],
      "guidelines": [
        "ISSN",
        "ACSM",
        "strength-nutrition research"
      ],
      "clinicalNotes": [
        "~3000 kcal · Protein 1.8–2.2g/kg · Carbs 4–6g/kg · Creatine (if used) · Post-lift protein+carb",
        "Powerlifters, sprinters, rugby/football linemen, throwers, combat athletes."
      ]
    },
    "breakfastOptions": [
      {
        "name": "4 eggs + oats + banana + milk",
        "calories": {
          "min": 560,
          "max": 560
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Steak & eggs + wholegrain toast",
        "calories": {
          "min": 560,
          "max": 560
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 28,
          "max": 28
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + eggs + pap + milk",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Protein oats + whey + peanut butter",
        "calories": {
          "min": 550,
          "max": 550
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken breast (large) + rice + beans",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 50,
          "max": 50
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef + jollof rice + vegetables",
        "calories": {
          "min": 700,
          "max": 700
        },
        "protein": {
          "min": 46,
          "max": 46
        },
        "carbs": {
          "min": 76,
          "max": 76
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + sweet potato + eggs + greens",
        "calories": {
          "min": 660,
          "max": 660
        },
        "protein": {
          "min": 46,
          "max": 46
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Turkey + pasta + cheese + vegetables",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 46,
          "max": 46
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + rice + broccoli",
        "calories": {
          "min": 640,
          "max": 640
        },
        "protein": {
          "min": 44,
          "max": 44
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef stir-fry + rice + vegetables",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 46,
          "max": 46
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo + beans",
        "calories": {
          "min": 660,
          "max": 660
        },
        "protein": {
          "min": 46,
          "max": 46
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lamb + couscous + vegetables",
        "calories": {
          "min": 670,
          "max": 670
        },
        "protein": {
          "min": 44,
          "max": 44
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Mediterranean"
      }
    ],
    "snackOptions": [
      {
        "name": "Whey + oats + banana shake",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cottage cheese + pineapple",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs (3) + fruit",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + granola + nuts",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "high-protein",
    "name": "High-Protein Diet",
    "fullName": "High-Protein Diet",
    "description": "Elevated protein at every meal for satiety, muscle maintenance & body-composition goals.",
    "icon": "barbell-outline",
    "difficulty": "Moderate",
    "category": "Fitness, Performance & Body Composition",
    "principles": {
      "emphasis": [
        "Elevated protein at every meal for satiety",
        "muscle maintenance",
        "body-composition goals."
      ],
      "avoids": [
        "Keep hydration up",
        "include fiber/vegetables",
        "adequate (not excessive) for healthy kidneys",
        "balance the other macros."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Fat loss with muscle retention",
        "active adults",
        "appetite control",
        "general recomposition."
      ],
      "cautionFor": [
        "Keep hydration up",
        "include fiber/vegetables",
        "adequate (not excessive) for healthy kidneys",
        "balance the other macros."
      ],
      "guidelines": [
        "ISSN",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~2000 kcal · Protein 1.6–2.0g/kg (25–40g/meal) · Fiber 30g · Balanced carbs/fats",
        "Fat loss with muscle retention, active adults, appetite control, general recomposition."
      ]
    },
    "breakfastOptions": [
      {
        "name": "3-egg veggie omelet + cheese + toast",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + whey + oats + berries",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi (large) + boiled eggs",
        "calories": {
          "min": 390,
          "max": 390
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Cottage cheese + oats + banana + nuts",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + quinoa + vegetables",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + beans + salad",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef + rice + broccoli",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 42,
          "max": 42
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tuna + wholegrain pasta + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo riro",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + rice + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu + tempeh stir-fry + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Whey shake",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 25,
          "max": 25
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs (2)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "post-workout-recovery",
    "name": "Post-Workout Recovery Diet",
    "fullName": "Post-Workout Recovery Diet",
    "description": "Replenish glycogen (carbs) + repair muscle (protein) + rehydrate soon after training.",
    "icon": "barbell-outline",
    "difficulty": "Moderate",
    "category": "Fitness, Performance & Body Composition",
    "principles": {
      "emphasis": [
        "Replenish glycogen (carbs) + repair muscle (protein) + rehydrate soon after training."
      ],
      "avoids": [
        "Aim ~20–40g protein + carbs within a couple of hours post-exercise",
        "rehydrate with fluids",
        "electrolytes."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Anyone training hard",
        "back-to-back sessions",
        "faster recovery."
      ],
      "cautionFor": [
        "Aim ~20–40g protein + carbs within a couple of hours post-exercise",
        "rehydrate with fluids",
        "electrolytes."
      ],
      "guidelines": [
        "ISSN nutrient-timing",
        "ACSM"
      ],
      "clinicalNotes": [
        "Post-session: carbs ~1g/kg + protein 20–40g · Rehydrate · Anti-inflammatory whole foods",
        "Anyone training hard, back-to-back sessions, faster recovery."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Greek yogurt + granola + banana + honey",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + fruit + milk",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein oats + whey + berries",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken + rice + vegetables + beans",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sweet potato + greens",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef + jollof rice + salad",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tuna pasta + vegetables",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + rice + broccoli",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + yam + efo + beans",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + pasta + vegetables",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & bean fried rice + fish",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Whey + banana + milk shake",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chocolate milk (classic recovery)",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + honey + berries",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + rice cakes + fruit",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "vegan",
    "name": "Vegan Diet",
    "fullName": "Vegan Diet",
    "description": "100% plant foods; combine protein sources; supplement B12; plan iron, calcium, omega-3, zinc & vitamin D.",
    "icon": "leaf-outline",
    "difficulty": "Moderate",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "100% plant foods",
        "combine protein sources",
        "supplement B12",
        "plan iron",
        "calcium",
        "omega-3",
        "zinc",
        "vitamin D."
      ],
      "avoids": [
        "B12 supplement is essential",
        "pair iron with vitamin C",
        "ensure calcium",
        "iodine",
        "omega-3 (algae)",
        "enough protein."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Ethical/environmental eating",
        "heart health",
        "cholesterol",
        "some weight goals."
      ],
      "cautionFor": [
        "B12 supplement is essential",
        "pair iron with vitamin C",
        "ensure calcium",
        "iodine",
        "omega-3 (algae)",
        "enough protein."
      ],
      "guidelines": [
        "Academy of Nutrition",
        "Dietetics",
        "BDA",
        "Vegan Society"
      ],
      "clinicalNotes": [
        "~2000 kcal · Varied plant protein · B12 (supplement) · Iron+C · Calcium · Omega-3 (flax/chia/algae)",
        "Ethical/environmental eating, heart health, cholesterol, some weight goals."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + soy milk + peanut butter + banana",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu scramble + spinach + wholegrain toast",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Soy yogurt + granola + berries + chia",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Akara (bean fritters) + pap + orange",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + brown rice + vegetables",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable curry + rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + quinoa",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach stew + wholegrain bread",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Tempeh + brown rice + broccoli",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean chili + wholegrain rice + avocado",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + plantain + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil dhal + rice + sautéed vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Fruit + mixed nuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fortified soy yogurt + berries",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted chickpeas / edamame",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "vegetarian",
    "name": "Lacto-Ovo Vegetarian Diet",
    "fullName": "Lacto-Ovo Vegetarian Diet",
    "description": "Plant-based plus eggs & dairy; abundant vegetables, legumes, whole grains; easy complete protein.",
    "icon": "leaf-outline",
    "difficulty": "Moderate",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "Plant-based plus eggs",
        "dairy",
        "abundant vegetables",
        "legumes",
        "whole grains",
        "easy complete protein."
      ],
      "avoids": [
        "Still plan iron",
        "zinc",
        "omega-3",
        "use eggs/dairy for B12",
        "calcium",
        "keep legumes central for protein"
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Vegetarian eating",
        "heart health",
        "gradual plant-forward transition."
      ],
      "cautionFor": [
        "Still plan iron",
        "zinc",
        "omega-3",
        "use eggs/dairy for B12",
        "calcium",
        "keep legumes central for protein"
      ],
      "guidelines": [
        "Academy of Nutrition",
        "Dietetics",
        "BDA"
      ],
      "clinicalNotes": [
        "~2000 kcal · Legumes + dairy/eggs · Iron+C · Fiber 30g+ · Omega-3",
        "Vegetarian eating, heart health, gradual plant-forward transition."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + oats + berries + nuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Cheese & vegetable omelet + toast",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + rice + vegetables + cheese",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil curry + rice + yogurt",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & egg fried rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach stew + wholegrain bread",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Paneer/tofu & vegetable curry + rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean chili + wholegrain rice + cheese",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable frittata + salad + bread",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + fruit",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Nuts + dried fruit",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "pescatarian",
    "name": "Pescatarian Diet",
    "fullName": "Pescatarian Diet",
    "description": "Vegetarian base plus fish & seafood; strong omega-3, lean protein & Mediterranean pattern.",
    "icon": "leaf-outline",
    "difficulty": "Moderate",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "Vegetarian base plus fish",
        "seafood",
        "strong omega-3",
        "lean protein",
        "Mediterranean pattern."
      ],
      "avoids": [
        "Choose low-mercury fish most often",
        "variety of plants for fiber",
        "still no other meat/poultry."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Heart",
        "brain health",
        "plant-forward eaters wanting quality protein",
        "omega-3."
      ],
      "cautionFor": [
        "Choose low-mercury fish most often",
        "variety of plants for fiber",
        "still no other meat/poultry."
      ],
      "guidelines": [
        "AHA",
        "Mediterranean-diet evidence",
        "BDA"
      ],
      "clinicalNotes": [
        "~2000 kcal · Fish 2–3×/wk · Legumes & whole grains · Omega-3 · Vegetables at every meal",
        "Heart & brain health, plant-forward eaters wanting quality protein & omega-3."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Smoked-mackerel + wholegrain toast + tomato",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + spinach + avocado + toast",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + oats + berries + seeds",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + orange",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + quinoa + leafy greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tuna + wholegrain pasta + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + rice + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sardine & tomato stew + wholegrain rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + sweet potato + broccoli",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish pepper soup + yam + greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Shrimp & vegetable stir-fry + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Sardines on crackers",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fruit + walnuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "flexitarian",
    "name": "Flexitarian Diet",
    "fullName": "Flexitarian Diet",
    "description": "Mostly plant-based with occasional meat/fish; flexible, sustainable, heart- & weight-friendly.",
    "icon": "leaf-outline",
    "difficulty": "Easy",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "Mostly plant-based with occasional meat/fish",
        "flexible",
        "sustainable",
        "heart-",
        "weight-friendly."
      ],
      "avoids": [
        "Keep the plant meals genuinely balanced (protein + fiber)",
        "make meat the occasional side",
        "not the centerpiece."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Reducing (not eliminating) meat",
        "gradual healthy transition",
        "budget",
        "sustainability."
      ],
      "cautionFor": [
        "Keep the plant meals genuinely balanced (protein + fiber)",
        "make meat the occasional side",
        "not the centerpiece."
      ],
      "guidelines": [
        "\"Flexitarian Diet\" (Blatner)",
        "EAT-Lancet",
        "AHA"
      ],
      "clinicalNotes": [
        "~2000 kcal · Plant-forward most days · Occasional lean meat/fish · Fiber 30g+ · Whole foods",
        "Reducing (not eliminating) meat, gradual healthy transition, budget & sustainability."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + milk + berries + nuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu scramble + toast + tomato",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + orange",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + rice + vegetables (meat-free)",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable curry + rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled chicken (occasional) + salad + quinoa",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach stew + wholegrain bread",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Vegetable & bean chili + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu stir-fry + brown rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish (occasional) + sweet potato + greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil dhal + rice + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fruit + nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Yogurt + berries",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted chickpeas",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "halal",
    "name": "Halal Diet",
    "fullName": "Halal Diet",
    "description": "Balanced nutrition using halal-permissible foods; halal-certified meats; no pork or alcohol.",
    "icon": "leaf-outline",
    "difficulty": "Moderate",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "Balanced nutrition using halal-permissible foods",
        "halal-certified meats",
        "no pork or alcohol."
      ],
      "avoids": [
        "Use halal-certified/zabiha meat",
        "avoid pork",
        "alcohol",
        "non-halal additives (some gelatin/enzymes)",
        "check labels."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Muslims and anyone following halal dietary law",
        "everyday balanced eating."
      ],
      "cautionFor": [
        "Use halal-certified/zabiha meat",
        "avoid pork",
        "alcohol",
        "non-halal additives (some gelatin/enzymes)",
        "check labels."
      ],
      "guidelines": [
        "Islamic dietary law",
        "general balanced-nutrition guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Balanced macros · Halal proteins · No pork/alcohol · Whole foods",
        "Muslims and anyone following halal dietary law, everyday balanced eating."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + wholegrain bread + olives + tomato",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Ful medames (fava beans) + bread",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Oats + milk + dates + nuts",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + milk",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Halal chicken + jollof rice + salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + plantain + halal beef",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lamb & vegetable tagine + couscous",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Lentil & vegetable stew + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled halal fish + rice + vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Halal chicken + yam + efo riro",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef & vegetable stew + rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & chickpea curry + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Dates + nuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + honey",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fruit + roasted chickpeas",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + bread",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "kosher",
    "name": "Kosher Diet",
    "fullName": "Kosher Diet",
    "description": "Balanced eating within kosher law; separate meat & dairy; kosher-certified foods; permitted species only.",
    "icon": "leaf-outline",
    "difficulty": "Moderate",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "Balanced eating within kosher law",
        "separate meat",
        "dairy",
        "kosher-certified foods",
        "permitted species only."
      ],
      "avoids": [
        "Don't mix meat",
        "dairy in a meal",
        "use kosher-certified (hechsher) products",
        "no pork or shellfish",
        "permitted fish have fins",
        "scales."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Jewish dietary observance and anyone following kosher rules."
      ],
      "cautionFor": [
        "Don't mix meat",
        "dairy in a meal",
        "use kosher-certified (hechsher) products",
        "no pork or shellfish",
        "permitted fish have fins",
        "scales."
      ],
      "guidelines": [
        "Jewish dietary law (kashrut)",
        "general balanced-nutrition guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Balanced macros · Meat/dairy separation · Kosher-certified · No pork/shellfish",
        "Jewish dietary observance and anyone following kosher rules."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Yogurt + granola + berries",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs (parve) + wholegrain toast + avocado",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + milk + banana + nuts",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cottage cheese + fruit + wholegrain toast",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Kosher chicken + rice + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Kosher beef + potato + salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable soup (parve) + bread",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean & vegetable stew + rice (parve)",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked kosher fish + quinoa + broccoli",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Kosher chicken + sweet potato + greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & chickpea stew + couscous",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Kosher beef & vegetable stir-fry + rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fruit + nuts (parve)",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + berries (dairy meal)",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Rice cakes + almond butter",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "paleo",
    "name": "Paleo Diet",
    "fullName": "Paleo Diet",
    "description": "Whole foods our ancestors ate — meat, fish, eggs, vegetables, fruit, nuts & seeds; no grains, legumes, dairy or refined sugar.",
    "icon": "leaf-outline",
    "difficulty": "Moderate",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "Whole foods our ancestors ate — meat",
        "fish",
        "eggs",
        "vegetables",
        "fruit",
        "nuts",
        "seeds",
        "no grains"
      ],
      "avoids": [
        "Excludes whole grains",
        "legumes (lowers fiber options)",
        "dairy (mind calcium)",
        "can be pricey — emphasize vegetables",
        "not just meat."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Whole-food focus",
        "cutting processed foods",
        "added sugar",
        "some weight/glucose goals."
      ],
      "cautionFor": [
        "Excludes whole grains",
        "legumes (lowers fiber options)",
        "dairy (mind calcium)",
        "can be pricey — emphasize vegetables",
        "not just meat."
      ],
      "guidelines": [
        "Paleo framework",
        "whole-food-nutrition principles"
      ],
      "clinicalNotes": [
        "~2000 kcal · Whole foods only · No grains/legumes/dairy/refined sugar · High vegetables & protein",
        "Whole-food focus, cutting processed foods & added sugar, some weight/glucose goals."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + avocado + sautéed vegetables",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 28,
          "max": 28
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sweet-potato hash + eggs + spinach",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fruit + nuts + coconut yogurt",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plantain + eggs + tomato",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + big salad + olive oil",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 28,
          "max": 28
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + roasted vegetables + avocado",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & vegetable stir-fry (no soy)",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 28,
          "max": 28
        },
        "cuisine": "Universal"
      },
      {
        "name": "Salmon + sweet potato + broccoli",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Steak + roasted vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 28,
          "max": 28
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + cauliflower rice + greens",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + plantain + sautéed spinach",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey + squash + zucchini",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Mixed nuts + berries",
        "calories": {
          "min": 190,
          "max": 190
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs (2)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple + almond butter",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plantain chips (coconut-oil baked)",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ]
  },
  {
    "id": "whole-food-plant-based",
    "name": "Whole-Food Plant-Based (WFPB) Diet",
    "fullName": "Whole-Food Plant-Based (WFPB) Diet",
    "description": "Minimally-processed plants — whole grains, legumes, vegetables, fruit, nuts & seeds; little/no oil, sugar or refined flour.",
    "icon": "leaf-outline",
    "difficulty": "Moderate",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "Minimally-processed plants — whole grains",
        "legumes",
        "vegetables",
        "fruit",
        "nuts",
        "seeds",
        "little/no oil",
        "sugar or refined flour."
      ],
      "avoids": [
        "Supplement B12 (and often vitamin D)",
        "include enough calories",
        "varied protein",
        "low-oil ≠ no healthy fats (use whole nuts/seeds/avocado)."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Heart-disease reversal",
        "cholesterol",
        "blood pressure",
        "weight",
        "type-2 diabetes management."
      ],
      "cautionFor": [
        "Supplement B12 (and often vitamin D)",
        "include enough calories",
        "varied protein",
        "low-oil ≠ no healthy fats (use whole nuts/seeds/avocado)."
      ],
      "guidelines": [
        "Ornish/Esselstyn programs",
        "ACLM",
        "plant-based nutrition research"
      ],
      "clinicalNotes": [
        "~2000 kcal · Whole plants · Minimal oil/sugar · B12 supplement · Fiber 40g+",
        "Heart-disease reversal, cholesterol, blood pressure, weight & type-2 diabetes management."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + ground flax + banana",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu scramble + vegetables + wholegrain toast",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Overnight oats + soy milk + chia + apple",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + orange",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Buddha bowl (beans, quinoa, greens, tahini)",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Lentil & vegetable stew + brown rice",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + sweet potato + steamed greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & spinach curry (no oil) + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Bean chili + wholegrain rice + avocado",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & lentil dhal + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tempeh + vegetable stir-fry (water-sauté) + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + plantain + efo riro",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Fruit + handful of nuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Roasted chickpeas / edamame",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chia pudding (soy milk)",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "traditional-african",
    "name": "Nigerian Traditional Balanced Diet",
    "fullName": "Nigerian Traditional Balanced Diet",
    "description": "Everyday West-African balanced eating — swallows, soups, rice & beans, fish & vegetables in sensible portions.",
    "icon": "leaf-outline",
    "difficulty": "Easy",
    "category": "Ethical, Cultural & Plant-Based",
    "principles": {
      "emphasis": [
        "Everyday West-African balanced eating — swallows",
        "soups",
        "rice",
        "beans",
        "fish",
        "vegetables in sensible portions."
      ],
      "avoids": [
        "Mind palm-oil",
        "salt quantity",
        "portion the swallow",
        "and load up on vegetable soups",
        "greens."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "General healthy eating rooted in local Nigerian/West-African foods",
        "flavors."
      ],
      "cautionFor": [
        "Mind palm-oil",
        "salt quantity",
        "portion the swallow",
        "and load up on vegetable soups",
        "greens."
      ],
      "guidelines": [
        "Nigerian food-based dietary guidelines",
        "WHO balanced-plate principles"
      ],
      "clinicalNotes": [
        "~2200 kcal · Balanced macros · Local whole foods · Moderate oil/salt · Vegetables & legumes daily",
        "General healthy eating rooted in local Nigerian/West-African foods & flavors."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Pap (ogi) + akara (bean cakes)",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yam + egg sauce (peppers, tomato)",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Moi-moi + custard/pap",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Bread + akamu + boiled egg",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Jollof rice + grilled chicken + salad",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Pounded yam + egusi soup + fish",
        "calories": {
          "min": 560,
          "max": 560
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + fried plantain (moderate oil)",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 78,
          "max": 78
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Ofada rice + ayamase sauce + fish",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Eba/amala (small) + efo riro + fish",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Rice + vegetable stew + chicken",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans porridge + plantain",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yam porridge (asaro) + fish + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Groundnuts (peanuts)",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted plantain (boli)",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fruit (orange, pawpaw, banana)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tiger-nut / kunu drink",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 4,
          "max": 4
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ]
  },
  {
    "id": "whole-food-reset",
    "name": "Whole-Food Reset (Detox-Style)",
    "fullName": "Whole-Food Reset (Detox-Style)",
    "description": "A short reset on whole, minimally-processed plants + lean protein; lots of water; no ultra-processed food, added sugar or alcohol.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "A short reset on whole",
        "minimally-processed plants + lean protein",
        "lots of water",
        "no ultra-processed food",
        "added sugar or alcohol."
      ],
      "avoids": [
        "No food \"flushes toxins\" — your liver",
        "kidneys do that",
        "the benefit is whole foods",
        "hydration",
        "cutting alcohol/ultra-processed food. Keep protein",
        "calories adequate — not a prolonged juice cleanse."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "A clean-eating reset",
        "post-festive reset",
        "breaking a junk-food habit."
      ],
      "cautionFor": [
        "No food \"flushes toxins\" — your liver",
        "kidneys do that",
        "the benefit is whole foods",
        "hydration",
        "cutting alcohol/ultra-processed food. Keep protein",
        "calories adequate — not a prolonged juice cleanse."
      ],
      "guidelines": [
        "WHO",
        "Harvard T.H. Chan",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~1800 kcal · Whole foods only · Added sugar ~0 · No alcohol · Water 2.5L+ · Fiber 30g+",
        "A clean-eating reset, post-festive reset, breaking a junk-food habit."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + berries + chia + plant milk",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Green smoothie (spinach, cucumber, apple, ginger)",
        "calories": {
          "min": 220,
          "max": 220
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap (ogi) + groundnuts + orange",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Veg omelet + tomato + avocado",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled fish + brown rice + big salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + steamed vegetables + small plantain",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Quinoa + chickpeas + roasted vegetables",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Efo riro (light oil) + small boiled yam",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Vegetable pepper soup + grilled fish",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Baked chicken + steamed greens + sweet potato",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry (light) + brown rice",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fresh fruit (any)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cucumber & carrot sticks",
        "calories": {
          "min": 50,
          "max": 50
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Handful of nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 7,
          "max": 7
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain yogurt + berries",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "clean-eating",
    "name": "Clean Eating",
    "fullName": "Clean Eating",
    "description": "Minimally-processed whole foods as a daily lifestyle — cook from scratch, read labels, limit refined & ultra-processed items.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Minimally-processed whole foods as a daily lifestyle — cook from scratch",
        "read labels",
        "limit refined",
        "ultra-processed items."
      ],
      "avoids": [
        "\"Clean\" isn't about perfection or cutting whole food groups — keep it balanced and flexible",
        "not restrictive."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Anyone wanting a simple",
        "sustainable \"eat real food\" upgrade."
      ],
      "cautionFor": [
        "\"Clean\" isn't about perfection or cutting whole food groups — keep it balanced and flexible",
        "not restrictive."
      ],
      "guidelines": [
        "Dietary Guidelines for Americans",
        "WHO",
        "Harvard Healthy Eating Plate"
      ],
      "clinicalNotes": [
        "~2000 kcal · Whole foods · Minimal ultra-processed · Fiber 30g+",
        "Anyone wanting a simple, sustainable \"eat real food\" upgrade."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Overnight oats + fruit + nuts",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain toast + eggs + avocado",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + pap + orange",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Greek yogurt + berries + seeds",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + brown rice + salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + boiled plantain + greens",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + sweet potato + vegetables",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Quinoa & vegetable bowl + chickpeas",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables + yam",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Chicken & vegetable stir-fry + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup + small swallow + fish",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & spinach stew + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fresh fruit + nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg + cucumber",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 4,
          "max": 4
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Plain yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "no-added-sugar",
    "name": "No-Added-Sugar",
    "fullName": "No-Added-Sugar",
    "description": "Cut added & refined sugars and sugary drinks; get sweetness from whole fruit and unsweetened foods.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Cut added",
        "refined sugars and sugary drinks",
        "get sweetness from whole fruit and unsweetened foods."
      ],
      "avoids": [
        "Whole fruit is fine — watch hidden sugars in drinks",
        "sauces",
        "cereals",
        "\"healthy\" snack bars."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Reducing a sugar habit",
        "dental",
        "metabolic health",
        "steadier energy."
      ],
      "cautionFor": [
        "Whole fruit is fine — watch hidden sugars in drinks",
        "sauces",
        "cereals",
        "\"healthy\" snack bars."
      ],
      "guidelines": [
        "WHO (free sugars <10%",
        "ideally <5%)",
        "AHA"
      ],
      "clinicalNotes": [
        "~2000 kcal · Added sugar <25g (ideally lower) · No sugary drinks · Fiber 30g+",
        "Reducing a sugar habit, dental & metabolic health, steadier energy."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Unsweetened oats + banana + peanut butter",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + tomato",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Unsweetened pap + groundnuts + pear",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Plain Greek yogurt + berries + nuts",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + brown rice + salad",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Wholewheat pasta + tomato & vegetable sauce",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + steamed vegetables + sweet potato",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken & vegetable stir-fry (no sugar sauce) + rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean chili + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pepper soup (fish) + small swallow",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Fresh fruit (whole)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Unsalted nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 7,
          "max": 7
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain yogurt + cinnamon",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "blue-zones",
    "name": "Blue Zones Longevity",
    "fullName": "Blue Zones Longevity",
    "description": "The plant-forward pattern of the world's longest-lived people — legumes daily, whole grains, vegetables, nuts; small fish/meat; moderate portions (\"eat to 80% full\").",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "The plant-forward pattern of the world's longest-lived people — legumes daily",
        "whole grains",
        "vegetables",
        "nuts",
        "small fish/meat",
        "moderate portions (\"eat to 80% full\")."
      ],
      "avoids": [
        "Keep meat small",
        "occasional",
        "make legumes and vegetables the base of the plate."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Long-term health",
        "longevity",
        "heart health",
        "gentle weight management."
      ],
      "cautionFor": [
        "Keep meat small",
        "occasional",
        "make legumes and vegetables the base of the plate."
      ],
      "guidelines": [
        "Blue Zones research",
        "EAT-Lancet",
        "Mediterranean evidence"
      ],
      "clinicalNotes": [
        "~1900 kcal · Legumes daily · Plant-forward · Mostly whole foods · Moderate portions",
        "Long-term health, longevity, heart health, gentle weight management."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + walnuts + fruit",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain sourdough + beans + tomato",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans (moi-moi) + orange",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Barley porridge + berries + flaxseed",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Lentil & vegetable soup + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + brown rice + garden salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & vegetable stew + wholegrain couscous",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Grilled fish (small) + beans + greens",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "White-bean & tomato stew + sautéed greens",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & lentil dhal + brown rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Minestrone + wholegrain bread",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu & vegetable stir-fry + barley",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Handful of almonds",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fresh fruit",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted chickpeas",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      },
      {
        "name": "Wholegrain crackers + hummus",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Mediterranean"
      }
    ]
  },
  {
    "id": "metabolism-lean",
    "name": "Metabolism & Lean Energy",
    "fullName": "Metabolism & Lean Energy",
    "description": "Protein-forward, fiber-rich meals with steady timing to support fat loss, muscle retention and stable energy.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Protein-forward",
        "fiber-rich meals with steady timing to support fat loss",
        "muscle retention and stable energy."
      ],
      "avoids": [
        "Protein and activity drive results — no single \"fat-burning\" food does",
        "keep the deficit modest."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Body recomposition",
        "toning",
        "staying full in a mild calorie deficit."
      ],
      "cautionFor": [
        "Protein and activity drive results — no single \"fat-burning\" food does",
        "keep the deficit modest."
      ],
      "guidelines": [
        "Academy of Nutrition",
        "Dietetics",
        "ISSN protein guidance"
      ],
      "clinicalNotes": [
        "~1700 kcal · Protein ~1.6g/kg · Fiber 30g+ · Regular meal timing",
        "Body recomposition, toning, staying full in a mild calorie deficit."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Egg-white & veg scramble + 1 toast",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries + oats + seeds",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein smoothie (whey, banana, milk)",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + boiled egg + orange",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + quinoa + salad",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + brown rice (½ cup) + greens",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + steamed vegetables (small plantain)",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey & vegetable stir-fry + small rice",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + cauliflower rice + greens",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pepper soup (fish) + steamed greens",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable bowl + small brown rice",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Plain Greek yogurt",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs (2)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Apple + peanut butter",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Edamame",
        "calories": {
          "min": 130,
          "max": 130
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "glow-skin",
    "name": "Glow & Skin Health",
    "fullName": "Glow & Skin Health",
    "description": "Antioxidant-rich produce, omega-3 fats, vitamin C & E, zinc and hydration to support skin and hair.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Antioxidant-rich produce",
        "omega-3 fats",
        "vitamin C",
        "E",
        "zinc and hydration to support skin and hair."
      ],
      "avoids": [
        "Diet supports skin but doesn't replace skincare or medical care",
        "sleep",
        "hydration matter too."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Skin health",
        "general radiance",
        "boosting antioxidant intake."
      ],
      "cautionFor": [
        "Diet supports skin but doesn't replace skincare or medical care",
        "sleep",
        "hydration matter too."
      ],
      "guidelines": [
        "British Association of Dermatologists",
        "Harvard Nutrition",
        "WHO"
      ],
      "clinicalNotes": [
        "~2000 kcal · Colorful produce daily · Omega-3 2×/week · Vitamin C daily · Water 2.5L+",
        "Skin health, general radiance, boosting antioxidant intake."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Berry & spinach smoothie + flaxseed",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Avocado toast + poached egg + tomato",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + walnuts + kiwi",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + pumpkin seeds + orange",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled salmon + quinoa + colorful salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Sardine & tomato salad + wholegrain bread",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chickpea & vegetable bowl + olive oil",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + sweet potato + sautéed greens",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked mackerel + roasted vegetables",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 26,
          "max": 26
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled chicken + carrot & pepper medley + yam",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & broccoli stir-fry + brown rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean stew + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Mixed berries",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Walnuts / almonds (small)",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot & pepper sticks + hummus",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Orange / kiwi (vitamin C)",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "budget-balanced",
    "name": "Budget-Friendly Balanced",
    "fullName": "Budget-Friendly Balanced",
    "description": "Affordable, nourishing whole foods — beans, eggs, seasonal vegetables and local grains — balanced without the price tag.",
    "icon": "sparkles-outline",
    "difficulty": "Easy",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Affordable",
        "nourishing whole foods — beans",
        "eggs",
        "seasonal vegetables and local grains — balanced without the price tag."
      ],
      "avoids": [
        "Buy seasonal",
        "in bulk",
        "frozen/canned vegetables count and cut waste."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Eating well on a tight budget",
        "large families",
        "students."
      ],
      "cautionFor": [
        "Buy seasonal",
        "in bulk",
        "frozen/canned vegetables count and cut waste."
      ],
      "guidelines": [
        "WHO",
        "Nigerian food-based dietary guidelines",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~2000 kcal · Low cost per serving · Legumes & eggs for protein · Balanced macros",
        "Eating well on a tight budget, large families, students."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Pap (ogi) + groundnuts + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Boiled eggs (2) + bread + tomato",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Akara (moderate) + pap",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Oats + milk + banana",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + rice + vegetable sauce",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg sauce + boiled yam",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 55,
          "max": 55
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans porridge + plantain",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Jollof rice (controlled) + egg",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Rice + vegetable stew + sardines",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans & spinach stew",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yam porridge (asaro) + vegetables",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Spaghetti + tomato & egg sauce",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Groundnuts (small handful)",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana / seasonal fruit",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled corn",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 25,
          "max": 25
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "meal-prep",
    "name": "Meal-Prep / Busy Professional",
    "fullName": "Meal-Prep / Busy Professional",
    "description": "Batch-cookable, portable, balanced meals that hold up through the week and beat the takeaway habit.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Batch-cookable",
        "portable",
        "balanced meals that hold up through the week and beat the takeaway habit."
      ],
      "avoids": [
        "Cool and store cooked food safely",
        "rotate a few recipes so it doesn't get boring."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Busy schedules",
        "office lunches",
        "cooking once and eating several times."
      ],
      "cautionFor": [
        "Cool and store cooked food safely",
        "rotate a few recipes so it doesn't get boring."
      ],
      "guidelines": [
        "Academy of Nutrition",
        "Dietetics",
        "food-safety guidance"
      ],
      "clinicalNotes": [
        "~2000 kcal · Batch-friendly · Balanced macros · Fiber 30g+",
        "Busy schedules, office lunches, cooking once and eating several times."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Overnight oats jars + fruit + seeds",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Egg & vegetable muffins + toast",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + granola + berries",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi (batch) + pap",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Chicken, rice & roasted veg meal-prep box",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans & brown rice bowl + salad",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Quinoa, chickpea & vegetable jar",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Jollof rice (portioned) + grilled fish",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked chicken + sweet potato + broccoli",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & bean chili (batch) + rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish stew (batch) + yam",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Turkey & vegetable pasta bake",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Boiled eggs (2)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Portioned nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 7,
          "max": 7
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt cup",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fruit + peanut butter",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "family-balanced",
    "name": "Family-Friendly Balanced",
    "fullName": "Family-Friendly Balanced",
    "description": "Crowd-pleasing balanced plates the whole family — kids and adults — will actually eat, from one pot where possible.",
    "icon": "sparkles-outline",
    "difficulty": "Easy",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Crowd-pleasing balanced plates the whole family — kids and adults — will actually eat",
        "from one pot where possible."
      ],
      "avoids": [
        "Adjust portions by age",
        "appetite",
        "go easy on added salt for young children."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Households cooking a single meal for everyone."
      ],
      "cautionFor": [
        "Adjust portions by age",
        "appetite",
        "go easy on added salt for young children."
      ],
      "guidelines": [
        "NHS Eatwell Guide",
        "WHO",
        "Nigerian food-based dietary guidelines"
      ],
      "clinicalNotes": [
        "~2000 kcal (adult) · Balanced plate · Vegetables at every meal",
        "Households cooking a single meal for everyone."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Pancakes (wholegrain) + fruit + milk",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + bread + baked beans",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + akara + orange",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Oatmeal + banana + peanut butter",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Jollof rice + grilled chicken + salad",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Rice + beans + plantain + fish",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Spaghetti bolognese + vegetables",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yam + egg sauce + greens",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Rice + vegetable & chicken stew",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eba (small) + efo riro + fish",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Vegetable soup + boiled plantain + fish",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fried rice (light oil) + grilled chicken",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fruit platter",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt + honey",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Popcorn (light)",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Groundnuts / roasted corn",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 7,
          "max": 7
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "student-quick",
    "name": "Student Quick & Cheap",
    "fullName": "Student Quick & Cheap",
    "description": "Fast, cheap, minimal-equipment meals that still balance protein, carbs and some vegetables.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Fast",
        "cheap",
        "minimal-equipment meals that still balance protein",
        "carbs and some vegetables."
      ],
      "avoids": [
        "Don't live on instant noodles alone — add an egg",
        "beans or vegetables to balance it."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Students",
        "dorms",
        "tiny kitchens and first-time cooks."
      ],
      "cautionFor": [
        "Don't live on instant noodles alone — add an egg",
        "beans or vegetables to balance it."
      ],
      "guidelines": [
        "NHS",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~2000 kcal · Cheap & fast · Some protein + veg each meal",
        "Students, dorms, tiny kitchens and first-time cooks."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Eggs + bread + banana",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Oats + milk + peanut butter",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 13,
          "max": 13
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + groundnuts",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + cornflakes + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Noodles + egg + mixed vegetables",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice + beans + sardines",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bread + egg sauce + tomato",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Jollof rice + boiled egg",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Yam + egg sauce",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 55,
          "max": 55
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans porridge + plantain",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Spaghetti + tomato sauce + egg",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 13,
          "max": 13
        },
        "cuisine": "Universal"
      },
      {
        "name": "Rice + vegetable stew + sardines",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Groundnuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bread + peanut butter",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "healthy-weight-gain",
    "name": "Healthy Weight Gain (Lean Mass)",
    "fullName": "Healthy Weight Gain (Lean Mass)",
    "description": "Calorie-dense whole foods with adequate protein for a gradual, healthy surplus — for hardgainers and naturally slim people.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Calorie-dense whole foods with adequate protein for a gradual",
        "healthy surplus — for hardgainers and naturally slim people."
      ],
      "avoids": [
        "Build the surplus from quality foods",
        "not junk",
        "and pair with resistance training. Unexplained weight loss should be checked by a clinician."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Building lean weight",
        "regaining weight after illness",
        "\"can't gain\" body types."
      ],
      "cautionFor": [
        "Build the surplus from quality foods",
        "not junk",
        "and pair with resistance training. Unexplained weight loss should be checked by a clinician."
      ],
      "guidelines": [
        "Academy of Nutrition",
        "Dietetics",
        "ISSN"
      ],
      "clinicalNotes": [
        "~2800 kcal · +300–500 kcal surplus · Protein ~1.6g/kg · Frequent calorie-dense meals",
        "Building lean weight, regaining weight after illness, \"can't gain\" body types."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Peanut-butter banana protein oats",
        "calories": {
          "min": 560,
          "max": 560
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs (3) + avocado + wholegrain toast",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 30,
          "max": 30
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + akara + groundnuts + milk",
        "calories": {
          "min": 540,
          "max": 540
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Full-fat yogurt + granola + nuts + honey",
        "calories": {
          "min": 520,
          "max": 520
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 22,
          "max": 22
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Jollof rice + grilled chicken + plantain",
        "calories": {
          "min": 700,
          "max": 700
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 78,
          "max": 78
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + fried plantain + fish",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 82,
          "max": 82
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Chicken, rice & avocado power bowl",
        "calories": {
          "min": 680,
          "max": 680
        },
        "protein": {
          "min": 45,
          "max": 45
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pounded yam + egusi soup + meat",
        "calories": {
          "min": 720,
          "max": 720
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 30,
          "max": 30
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Salmon + brown rice + olive-oil vegetables",
        "calories": {
          "min": 650,
          "max": 650
        },
        "protein": {
          "min": 40,
          "max": 40
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 28,
          "max": 28
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beef & vegetable stir-fry + rice",
        "calories": {
          "min": 660,
          "max": 660
        },
        "protein": {
          "min": 38,
          "max": 38
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 28,
          "max": 28
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken pasta (creamy, wholegrain)",
        "calories": {
          "min": 640,
          "max": 640
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 24,
          "max": 24
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yam porridge (asaro) + fish + greens",
        "calories": {
          "min": 620,
          "max": 620
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 74,
          "max": 74
        },
        "fat": {
          "min": 20,
          "max": 20
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Peanut butter + banana sandwich",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Trail mix (nuts + dried fruit)",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 28,
          "max": 28
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Protein smoothie (milk, whey, oats, PB)",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Cheese + wholegrain crackers",
        "calories": {
          "min": 250,
          "max": 250
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 24,
          "max": 24
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "mindful-eating",
    "name": "Mindful Eating & Portion Control",
    "fullName": "Mindful Eating & Portion Control",
    "description": "Habit-first — sensible portions, eating slowly, and tuning into hunger and fullness; no banned foods.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Habit-first — sensible portions",
        "eating slowly",
        "and tuning into hunger and fullness",
        "no banned foods."
      ],
      "avoids": [
        "A behavioral approach — pair it with balanced whole foods and mindful",
        "distraction-free meals."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Ending overeating",
        "emotional-eating patterns",
        "gentle weight management."
      ],
      "cautionFor": [
        "A behavioral approach — pair it with balanced whole foods and mindful",
        "distraction-free meals."
      ],
      "guidelines": [
        "Academy of Nutrition",
        "Dietetics",
        "Harvard Nutrition"
      ],
      "clinicalNotes": [
        "~1900 kcal · Portion-aware plate · Balanced macros · Slow, screen-free eating",
        "Ending overeating, emotional-eating patterns, gentle weight management."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + fruit + nuts (measured)",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + toast + tomato",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt + berries + granola",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + orange",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Balanced plate: ½ veg, ¼ rice, ¼ chicken",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + small plantain + salad",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam (measured) + greens",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Pasta (1 cup) + tomato & chicken sauce",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + vegetables + ½ sweet potato",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + salad + small swallow",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 36,
          "max": 36
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup + fish + small yam",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable bowl + ½ cup rice",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fruit (1 medium)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Yogurt (small)",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Small handful of nuts",
        "calories": {
          "min": 160,
          "max": 160
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "debloat-light",
    "name": "Debloat & Light",
    "fullName": "Debloat & Light",
    "description": "Light, easy-to-digest whole foods; lower salt, more water-rich produce and potassium, in smaller gentle meals.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Light",
        "easy-to-digest whole foods",
        "lower salt",
        "more water-rich produce and potassium",
        "in smaller gentle meals."
      ],
      "avoids": [
        "Persistent bloating or gut symptoms need medical review — this is a non-medical comfort plan",
        "not a treatment."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Feeling lighter",
        "reducing everyday bloat",
        "a gentle reset day."
      ],
      "cautionFor": [
        "Persistent bloating or gut symptoms need medical review — this is a non-medical comfort plan",
        "not a treatment."
      ],
      "guidelines": [
        "NHS",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~1800 kcal · Lower sodium · High-water foods · Gentle portions · Water 2.5L+",
        "Feeling lighter, reducing everyday bloat, a gentle reset day."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oatmeal + banana + ginger",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain yogurt + papaya + chia",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Egg-white omelet + cucumber + toast",
        "calories": {
          "min": 270,
          "max": 270
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 26,
          "max": 26
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + pawpaw",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Steamed fish + white rice + carrots & courgette",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled chicken + boiled potato + green beans",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & rice bowl (light, low-salt)",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish pepper soup (herbs, low salt) + yam (small)",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Grilled fish + steamed vegetables",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + courgette + small sweet potato",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & ginger broth + rice",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Tofu + steamed greens + small rice",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Papaya / melon slices",
        "calories": {
          "min": 60,
          "max": 60
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 15,
          "max": 15
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Cucumber sticks",
        "calories": {
          "min": 30,
          "max": 30
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain yogurt",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Banana",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 23,
          "max": 23
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "high-energy-vitality",
    "name": "High-Energy Vitality",
    "fullName": "High-Energy Vitality",
    "description": "Iron, B-vitamins, complex carbs and steady protein to fuel sustained energy through active days, pairing iron foods with vitamin C.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Iron",
        "B-vitamins",
        "complex carbs and steady protein to fuel sustained energy through active days",
        "pairing iron foods with vitamin C."
      ],
      "avoids": [
        "Ongoing fatigue can be medical (iron",
        "thyroid",
        "sleep) — get checked if it persists."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Busy",
        "active people wanting steady fuel and fewer afternoon energy crashes."
      ],
      "cautionFor": [
        "Ongoing fatigue can be medical (iron",
        "thyroid",
        "sleep) — get checked if it persists."
      ],
      "guidelines": [
        "WHO",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~2200 kcal · Complex carbs · Iron + vitamin C pairing · Regular balanced meals",
        "Busy, active people wanting steady fuel and fewer afternoon energy crashes."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + banana + peanut butter + orange",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 14,
          "max": 14
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + spinach + tomato",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + akara + orange",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 15,
          "max": 15
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Greek yogurt + granola + berries + seeds",
        "calories": {
          "min": 360,
          "max": 360
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Beans + brown rice + spinach (iron + fibre)",
        "calories": {
          "min": 500,
          "max": 500
        },
        "protein": {
          "min": 24,
          "max": 24
        },
        "carbs": {
          "min": 72,
          "max": 72
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Liver & vegetable sauce + rice",
        "calories": {
          "min": 490,
          "max": 490
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Grilled chicken + sweet potato + greens",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 68,
          "max": 68
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Fish + jollof brown rice + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Efo riro (with liver/fish) + small swallow",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beef & vegetable stir-fry + rice",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Bean & vegetable chili + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 64,
          "max": 64
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Trail mix (nuts + raisins)",
        "calories": {
          "min": 200,
          "max": 200
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "cuisine": "Universal"
      },
      {
        "name": "Orange + groundnuts",
        "calories": {
          "min": 190,
          "max": 190
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled eggs (2)",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Dates + walnuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "everyday-balanced",
    "name": "Everyday Balanced Maintenance",
    "fullName": "Everyday Balanced Maintenance",
    "description": "The sensible default — a balanced plate (½ vegetables/fruit, ¼ whole grains, ¼ protein) to maintain a healthy weight and steady health.",
    "icon": "sparkles-outline",
    "difficulty": "Easy",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "The sensible default — a balanced plate (½ vegetables/fruit",
        "¼ whole grains",
        "¼ protein) to maintain a healthy weight and steady health."
      ],
      "avoids": [
        "Adjust portions to your activity level and goals",
        "nothing is off-limits in moderation."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "General healthy adults maintaining weight",
        "the \"just eat well\" baseline."
      ],
      "cautionFor": [
        "Adjust portions to your activity level and goals",
        "nothing is off-limits in moderation."
      ],
      "guidelines": [
        "Harvard Healthy Eating Plate",
        "NHS Eatwell Guide",
        "WHO"
      ],
      "clinicalNotes": [
        "~2000 kcal · Balanced plate · Fiber 30g+ · Moderate everything",
        "General healthy adults maintaining weight; the \"just eat well\" baseline."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + fruit + nuts",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap + moi-moi + orange",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Yogurt + granola + berries",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + brown rice + salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Jollof rice (controlled) + chicken + salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + vegetables + sweet potato",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken & vegetable stir-fry + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable soup + small swallow + fish",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 28,
          "max": 28
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 420,
          "max": 420
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 60,
          "max": 60
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fresh fruit + nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Greek yogurt",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      },
      {
        "name": "Boiled egg + fruit",
        "calories": {
          "min": 150,
          "max": 150
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "weight-loss",
    "name": "Weight Loss (Everyday Fat Loss)",
    "fullName": "Weight Loss (Everyday Fat Loss)",
    "description": "A sustainable, moderate calorie deficit built on high protein, high fibre and plenty of vegetables — so you stay full while losing fat steadily.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "A sustainable",
        "moderate calorie deficit built on high protein",
        "high fibre and plenty of vegetables — so you stay full while losing fat steadily."
      ],
      "avoids": [
        "Aim for ~0.5kg/week",
        "not extreme cuts",
        "keep protein high to protect muscle. Pregnancy",
        "postpartum should NOT run a deficit."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Everyday fat loss without crash dieting",
        "slimming down and keeping it off."
      ],
      "cautionFor": [
        "Aim for ~0.5kg/week",
        "not extreme cuts",
        "keep protein high to protect muscle. Pregnancy",
        "postpartum should NOT run a deficit."
      ],
      "guidelines": [
        "WHO",
        "NICE",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~1500 kcal · Protein ~1.6g/kg · Fibre 30g+ · ~500 kcal/day deficit · Minimal sugary drinks",
        "Everyday fat loss without crash dieting; slimming down and keeping it off."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Egg-white & vegetable scramble + 1 toast",
        "calories": {
          "min": 260,
          "max": 260
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Overnight oats + berries + Greek yogurt",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 6,
          "max": 6
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi (small) + orange",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 34,
          "max": 34
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Protein smoothie (banana, milk, whey)",
        "calories": {
          "min": 280,
          "max": 280
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 4,
          "max": 4
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken salad + light dressing",
        "calories": {
          "min": 380,
          "max": 380
        },
        "protein": {
          "min": 36,
          "max": 36
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 16,
          "max": 16
        },
        "cuisine": "Universal"
      },
      {
        "name": "Fish + ½ cup rice + big vegetable side",
        "calories": {
          "min": 400,
          "max": 400
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + steamed vegetables (small plantain)",
        "calories": {
          "min": 410,
          "max": 410
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 56,
          "max": 56
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil soup + side salad",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables",
        "calories": {
          "min": 330,
          "max": 330
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 18,
          "max": 18
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken + cauliflower rice + greens",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable & tofu soup + small swallow",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pepper soup (fish) + steamed greens",
        "calories": {
          "min": 300,
          "max": 300
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Apple",
        "calories": {
          "min": 80,
          "max": 80
        },
        "protein": {
          "min": 0,
          "max": 0
        },
        "carbs": {
          "min": 21,
          "max": 21
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain Greek yogurt",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 8,
          "max": 8
        },
        "fat": {
          "min": 1,
          "max": 1
        },
        "cuisine": "Universal"
      },
      {
        "name": "Carrot & cucumber sticks",
        "calories": {
          "min": 50,
          "max": 50
        },
        "protein": {
          "min": 2,
          "max": 2
        },
        "carbs": {
          "min": 10,
          "max": 10
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled egg",
        "calories": {
          "min": 70,
          "max": 70
        },
        "protein": {
          "min": 6,
          "max": 6
        },
        "carbs": {
          "min": 1,
          "max": 1
        },
        "fat": {
          "min": 5,
          "max": 5
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "gluten-free-lifestyle",
    "name": "Gluten-Free Living",
    "fullName": "Gluten-Free Living",
    "description": "Everyday eating built on naturally gluten-free whole foods — rice, yam, plantain, potatoes, beans, maize, fish, meat, fruit & vegetables — with no wheat, barley or rye.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Everyday eating built on naturally gluten-free whole foods — rice",
        "yam",
        "plantain",
        "potatoes",
        "beans",
        "maize",
        "fish",
        "meat"
      ],
      "avoids": [
        "Gluten-free is medically NECESSARY only for coeliac disease or gluten sensitivity — for others it isn't proven healthier and can lower fibre/B-vitamins unless built on whole foods. Suspect coeliac? Get tested BEFORE cutting gluten. Watch label",
        "oat cross-contamination."
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "People who feel better off gluten",
        "or choose gluten-free",
        "naturally suits most Nigerian/West-African staples."
      ],
      "cautionFor": [
        "Gluten-free is medically NECESSARY only for coeliac disease or gluten sensitivity — for others it isn't proven healthier and can lower fibre/B-vitamins unless built on whole foods. Suspect coeliac? Get tested BEFORE cutting gluten. Watch label",
        "oat cross-contamination."
      ],
      "guidelines": [
        "Coeliac UK",
        "NHS",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~2000 kcal · No wheat/barley/rye · Whole naturally-GF foods · Fibre 30g+",
        "People who feel better off gluten, or choose gluten-free; naturally suits most Nigerian/West-African staples."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Pap (ogi/akamu) + groundnuts + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Boiled eggs + boiled plantain",
        "calories": {
          "min": 340,
          "max": 340
        },
        "protein": {
          "min": 16,
          "max": 16
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Moi-moi (steamed bean pudding) + orange",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 38,
          "max": 38
        },
        "fat": {
          "min": 11,
          "max": 11
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Oats (certified GF) + milk + berries",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Universal"
      }
    ],
    "lunchOptions": [
      {
        "name": "Jollof rice + grilled chicken + salad",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Beans + boiled yam + vegetable sauce",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Grilled fish + sweet potato + greens",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Amala (yam flour) + efo riro + fish",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 52,
          "max": 52
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Rice + vegetable stew + fish",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Eba (garri/cassava) + egusi soup + meat",
        "calories": {
          "min": 480,
          "max": 480
        },
        "protein": {
          "min": 26,
          "max": 26
        },
        "carbs": {
          "min": 54,
          "max": 54
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Grilled chicken + roasted vegetables + potatoes",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 42,
          "max": 42
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans porridge + plantain",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 70,
          "max": 70
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "snackOptions": [
      {
        "name": "Fresh fruit",
        "calories": {
          "min": 90,
          "max": 90
        },
        "protein": {
          "min": 1,
          "max": 1
        },
        "carbs": {
          "min": 22,
          "max": 22
        },
        "fat": {
          "min": 0,
          "max": 0
        },
        "cuisine": "Universal"
      },
      {
        "name": "Groundnuts / roasted nuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Plain yogurt + berries",
        "calories": {
          "min": 110,
          "max": 110
        },
        "protein": {
          "min": 10,
          "max": 10
        },
        "carbs": {
          "min": 14,
          "max": 14
        },
        "fat": {
          "min": 3,
          "max": 3
        },
        "cuisine": "Universal"
      },
      {
        "name": "Boiled corn",
        "calories": {
          "min": 120,
          "max": 120
        },
        "protein": {
          "min": 3,
          "max": 3
        },
        "carbs": {
          "min": 25,
          "max": 25
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      }
    ]
  },
  {
    "id": "lactose-free-lifestyle",
    "name": "Lactose-Free Living",
    "fullName": "Lactose-Free Living",
    "description": "Everyday eating without lactose — swap dairy for lactose-free or plant milks, hard/aged cheeses and fermented options, plus plenty of naturally dairy-free whole foods.",
    "icon": "sparkles-outline",
    "difficulty": "Moderate",
    "category": "Lifestyle & Goal-Based Nutrition",
    "principles": {
      "emphasis": [
        "Everyday eating without lactose — swap dairy for lactose-free or plant milks",
        "hard/aged cheeses and fermented options",
        "plus plenty of naturally dairy-free whole foods."
      ],
      "avoids": [
        "Get calcium",
        "vitamin D from fortified plant milks",
        "sardines",
        "leafy greens",
        "tofu",
        "almonds. Many tolerate small amounts"
      ]
    },
    "clinicalInfo": {
      "safeFor": [
        "Lactose intolerance",
        "dairy bloating/discomfort",
        "or choosing dairy-free."
      ],
      "cautionFor": [
        "Get calcium",
        "vitamin D from fortified plant milks",
        "sardines",
        "leafy greens",
        "tofu",
        "almonds. Many tolerate small amounts"
      ],
      "guidelines": [
        "NHS",
        "British Dietetic Association",
        "Academy of Nutrition",
        "Dietetics"
      ],
      "clinicalNotes": [
        "~2000 kcal · No lactose · Calcium 1000mg+ (fortified/greens/fish) · Vitamin D",
        "Lactose intolerance, dairy bloating/discomfort, or choosing dairy-free."
      ]
    },
    "breakfastOptions": [
      {
        "name": "Oats + lactose-free/soy milk + banana",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 12,
          "max": 12
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 8,
          "max": 8
        },
        "cuisine": "Universal"
      },
      {
        "name": "Pap (ogi) + groundnuts + orange",
        "calories": {
          "min": 310,
          "max": 310
        },
        "protein": {
          "min": 11,
          "max": 11
        },
        "carbs": {
          "min": 48,
          "max": 48
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Eggs + wholegrain toast + avocado",
        "calories": {
          "min": 350,
          "max": 350
        },
        "protein": {
          "min": 18,
          "max": 18
        },
        "carbs": {
          "min": 32,
          "max": 32
        },
        "fat": {
          "min": 18,
          "max": 18
        },
        "cuisine": "Universal"
      },
      {
        "name": "Moi-moi + boiled egg",
        "calories": {
          "min": 320,
          "max": 320
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 30,
          "max": 30
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      }
    ],
    "lunchOptions": [
      {
        "name": "Grilled chicken + brown rice + salad",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 34,
          "max": 34
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      },
      {
        "name": "Beans + plantain + vegetables",
        "calories": {
          "min": 470,
          "max": 470
        },
        "protein": {
          "min": 22,
          "max": 22
        },
        "carbs": {
          "min": 66,
          "max": 66
        },
        "fat": {
          "min": 10,
          "max": 10
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Fish + yam + efo riro",
        "calories": {
          "min": 460,
          "max": 460
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 50,
          "max": 50
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Lentil & vegetable stew + wholegrain rice",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 62,
          "max": 62
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      }
    ],
    "dinnerOptions": [
      {
        "name": "Baked fish + roasted vegetables + sweet potato",
        "calories": {
          "min": 440,
          "max": 440
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 44,
          "max": 44
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Chicken & vegetable stir-fry + rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 32,
          "max": 32
        },
        "carbs": {
          "min": 46,
          "max": 46
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "cuisine": "Universal"
      },
      {
        "name": "Vegetable pepper soup + fish + small swallow",
        "calories": {
          "min": 430,
          "max": 430
        },
        "protein": {
          "min": 30,
          "max": 30
        },
        "carbs": {
          "min": 40,
          "max": 40
        },
        "fat": {
          "min": 12,
          "max": 12
        },
        "isNigerian": true,
        "cuisine": "Nigerian"
      },
      {
        "name": "Tofu & vegetable coconut curry + brown rice",
        "calories": {
          "min": 450,
          "max": 450
        },
        "protein": {
          "min": 20,
          "max": 20
        },
        "carbs": {
          "min": 58,
          "max": 58
        },
        "fat": {
          "min": 14,
          "max": 14
        },
        "cuisine": "Universal"
      }
    ],
    "snackOptions": [
      {
        "name": "Fresh fruit + nuts",
        "calories": {
          "min": 170,
          "max": 170
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 20,
          "max": 20
        },
        "fat": {
          "min": 9,
          "max": 9
        },
        "cuisine": "Universal"
      },
      {
        "name": "Lactose-free yogurt",
        "calories": {
          "min": 100,
          "max": 100
        },
        "protein": {
          "min": 9,
          "max": 9
        },
        "carbs": {
          "min": 12,
          "max": 12
        },
        "fat": {
          "min": 2,
          "max": 2
        },
        "cuisine": "Universal"
      },
      {
        "name": "Roasted groundnuts",
        "calories": {
          "min": 180,
          "max": 180
        },
        "protein": {
          "min": 8,
          "max": 8
        },
        "carbs": {
          "min": 6,
          "max": 6
        },
        "fat": {
          "min": 15,
          "max": 15
        },
        "cuisine": "Universal"
      },
      {
        "name": "Hummus + vegetable sticks",
        "calories": {
          "min": 140,
          "max": 140
        },
        "protein": {
          "min": 5,
          "max": 5
        },
        "carbs": {
          "min": 16,
          "max": 16
        },
        "fat": {
          "min": 7,
          "max": 7
        },
        "cuisine": "Mediterranean"
      }
    ]
  }
];

export const FOOD_DICTIONARY: FoodItem[] = [
  {
    "id": "apple",
    "name": "Apple",
    "serving": "1 medium",
    "group": "Fruits",
    "calories": 95,
    "protein": 0,
    "carbs": 25,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "banana",
    "name": "Banana",
    "serving": "1 medium",
    "group": "Fruits",
    "calories": 105,
    "protein": 1,
    "carbs": 27,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "orange",
    "name": "Orange",
    "serving": "1 medium",
    "group": "Fruits",
    "calories": 62,
    "protein": 1,
    "carbs": 15,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "tangerine",
    "name": "Tangerine",
    "serving": "1 medium",
    "group": "Fruits",
    "calories": 47,
    "protein": 1,
    "carbs": 12,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "grapefruit",
    "name": "Grapefruit",
    "serving": "½ medium",
    "group": "Fruits",
    "calories": 52,
    "protein": 1,
    "carbs": 13,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "lemon",
    "name": "Lemon",
    "serving": "1 fruit",
    "group": "Fruits",
    "calories": 17,
    "protein": 1,
    "carbs": 5,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "lime",
    "name": "Lime",
    "serving": "1 fruit",
    "group": "Fruits",
    "calories": 20,
    "protein": 0,
    "carbs": 7,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "mango",
    "name": "Mango",
    "serving": "1 cup sliced",
    "group": "Fruits",
    "calories": 99,
    "protein": 1,
    "carbs": 25,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "pineapple",
    "name": "Pineapple",
    "serving": "1 cup chunks",
    "group": "Fruits",
    "calories": 82,
    "protein": 1,
    "carbs": 22,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "pawpaw-papaya",
    "name": "Pawpaw / Papaya",
    "serving": "1 cup cubes",
    "group": "Fruits",
    "calories": 62,
    "protein": 1,
    "carbs": 16,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "watermelon",
    "name": "Watermelon",
    "serving": "1 cup diced",
    "group": "Fruits",
    "calories": 46,
    "protein": 1,
    "carbs": 12,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "cantaloupe",
    "name": "Cantaloupe",
    "serving": "1 cup diced",
    "group": "Fruits",
    "calories": 54,
    "protein": 1,
    "carbs": 13,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "honeydew-melon",
    "name": "Honeydew melon",
    "serving": "1 cup diced",
    "group": "Fruits",
    "calories": 61,
    "protein": 1,
    "carbs": 15,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "guava",
    "name": "Guava",
    "serving": "1 fruit",
    "group": "Fruits",
    "calories": 37,
    "protein": 1,
    "carbs": 8,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "soursop",
    "name": "Soursop",
    "serving": "1 cup pulp",
    "group": "Fruits",
    "calories": 148,
    "protein": 2,
    "carbs": 38,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "african-star-apple-agbalumo",
    "name": "African star apple / Agbalumo",
    "serving": "2 fruits",
    "group": "Fruits",
    "calories": 67,
    "protein": 1,
    "carbs": 15,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "african-pear-ube",
    "name": "African pear / Ube",
    "serving": "100g pulp",
    "group": "Fruits",
    "calories": 260,
    "protein": 3,
    "carbs": 4,
    "fat": 26,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "avocado",
    "name": "Avocado",
    "serving": "½ fruit",
    "group": "Fruits",
    "calories": 160,
    "protein": 2,
    "carbs": 9,
    "fat": 15,
    "cuisine": "Universal"
  },
  {
    "id": "grapes",
    "name": "Grapes",
    "serving": "1 cup",
    "group": "Fruits",
    "calories": 104,
    "protein": 1,
    "carbs": 27,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "strawberries",
    "name": "Strawberries",
    "serving": "1 cup",
    "group": "Fruits",
    "calories": 49,
    "protein": 1,
    "carbs": 12,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "blueberries",
    "name": "Blueberries",
    "serving": "1 cup",
    "group": "Fruits",
    "calories": 84,
    "protein": 1,
    "carbs": 21,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "raspberries",
    "name": "Raspberries",
    "serving": "1 cup",
    "group": "Fruits",
    "calories": 64,
    "protein": 1,
    "carbs": 15,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "blackberries",
    "name": "Blackberries",
    "serving": "1 cup",
    "group": "Fruits",
    "calories": 62,
    "protein": 2,
    "carbs": 14,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "kiwi",
    "name": "Kiwi",
    "serving": "1 medium",
    "group": "Fruits",
    "calories": 42,
    "protein": 1,
    "carbs": 10,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "pomegranate",
    "name": "Pomegranate",
    "serving": "½ cup arils",
    "group": "Fruits",
    "calories": 72,
    "protein": 1,
    "carbs": 16,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "peach",
    "name": "Peach",
    "serving": "1 medium",
    "group": "Fruits",
    "calories": 59,
    "protein": 1,
    "carbs": 14,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "plum",
    "name": "Plum",
    "serving": "1 medium",
    "group": "Fruits",
    "calories": 30,
    "protein": 0,
    "carbs": 8,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "apricot",
    "name": "Apricot",
    "serving": "2 fruits",
    "group": "Fruits",
    "calories": 34,
    "protein": 1,
    "carbs": 8,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "cherries",
    "name": "Cherries",
    "serving": "1 cup",
    "group": "Fruits",
    "calories": 87,
    "protein": 1,
    "carbs": 22,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "fig",
    "name": "Fig",
    "serving": "2 fresh",
    "group": "Fruits",
    "calories": 74,
    "protein": 1,
    "carbs": 19,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "date",
    "name": "Date",
    "serving": "2 Medjool",
    "group": "Fruits",
    "calories": 133,
    "protein": 1,
    "carbs": 36,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "raisins",
    "name": "Raisins",
    "serving": "¼ cup",
    "group": "Fruits",
    "calories": 108,
    "protein": 1,
    "carbs": 29,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "prunes",
    "name": "Prunes",
    "serving": "4 pieces",
    "group": "Fruits",
    "calories": 91,
    "protein": 1,
    "carbs": 24,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "passion-fruit",
    "name": "Passion fruit",
    "serving": "2 fruits",
    "group": "Fruits",
    "calories": 35,
    "protein": 1,
    "carbs": 8,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "jackfruit",
    "name": "Jackfruit",
    "serving": "1 cup sliced",
    "group": "Fruits",
    "calories": 157,
    "protein": 3,
    "carbs": 38,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "breadfruit",
    "name": "Breadfruit",
    "serving": "1 cup",
    "group": "Fruits",
    "calories": 227,
    "protein": 2,
    "carbs": 60,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "coconut-fresh",
    "name": "Coconut, fresh",
    "serving": "½ cup shredded",
    "group": "Fruits",
    "calories": 141,
    "protein": 1,
    "carbs": 6,
    "fat": 13,
    "cuisine": "Universal"
  },
  {
    "id": "dragon-fruit",
    "name": "Dragon fruit",
    "serving": "1 cup",
    "group": "Fruits",
    "calories": 60,
    "protein": 1,
    "carbs": 13,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "cashew-apple",
    "name": "Cashew apple",
    "serving": "1 fruit",
    "group": "Fruits",
    "calories": 30,
    "protein": 1,
    "carbs": 7,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "tamarind-pulp",
    "name": "Tamarind pulp",
    "serving": "1 oz",
    "group": "Fruits",
    "calories": 68,
    "protein": 1,
    "carbs": 18,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "pear",
    "name": "Pear",
    "serving": "1 medium",
    "group": "Fruits",
    "calories": 101,
    "protein": 1,
    "carbs": 27,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "spinach",
    "name": "Spinach",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 41,
    "protein": 5,
    "carbs": 7,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "ugu-fluted-pumpkin-leaves",
    "name": "Ugu / Fluted pumpkin leaves",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 30,
    "protein": 4,
    "carbs": 4,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "ewedu-jute-leaves",
    "name": "Ewedu / Jute leaves",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 32,
    "protein": 3,
    "carbs": 6,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "efo-shoko-lagos-spinach",
    "name": "Efo shoko / Lagos spinach",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 28,
    "protein": 3,
    "carbs": 5,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "bitterleaf",
    "name": "Bitterleaf",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 30,
    "protein": 3,
    "carbs": 5,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "waterleaf",
    "name": "Waterleaf",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 22,
    "protein": 2,
    "carbs": 4,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "scent-leaf-efirin",
    "name": "Scent leaf / Efirin",
    "serving": "¼ cup",
    "group": "Vegetables",
    "calories": 6,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "amaranth-tete",
    "name": "Amaranth / Tete",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 28,
    "protein": 3,
    "carbs": 5,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "moringa-leaves",
    "name": "Moringa leaves",
    "serving": "1 cup",
    "group": "Vegetables",
    "calories": 13,
    "protein": 1,
    "carbs": 2,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "kale",
    "name": "Kale",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 36,
    "protein": 2,
    "carbs": 6,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "collard-greens",
    "name": "Collard greens",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 63,
    "protein": 5,
    "carbs": 11,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "swiss-chard",
    "name": "Swiss chard",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 35,
    "protein": 3,
    "carbs": 7,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "cassava-leaves",
    "name": "Cassava leaves",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 37,
    "protein": 4,
    "carbs": 6,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "lettuce",
    "name": "Lettuce",
    "serving": "1 cup shredded",
    "group": "Vegetables",
    "calories": 5,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "cabbage",
    "name": "Cabbage",
    "serving": "1 cup shredded",
    "group": "Vegetables",
    "calories": 22,
    "protein": 1,
    "carbs": 5,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "broccoli",
    "name": "Broccoli",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 55,
    "protein": 4,
    "carbs": 11,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "cauliflower",
    "name": "Cauliflower",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 29,
    "protein": 2,
    "carbs": 5,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "brussels-sprouts",
    "name": "Brussels sprouts",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 56,
    "protein": 4,
    "carbs": 11,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "carrot",
    "name": "Carrot",
    "serving": "1 medium",
    "group": "Vegetables",
    "calories": 25,
    "protein": 1,
    "carbs": 6,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "tomato",
    "name": "Tomato",
    "serving": "1 medium",
    "group": "Vegetables",
    "calories": 22,
    "protein": 1,
    "carbs": 5,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "cherry-tomatoes",
    "name": "Cherry tomatoes",
    "serving": "1 cup",
    "group": "Vegetables",
    "calories": 27,
    "protein": 1,
    "carbs": 6,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "onion",
    "name": "Onion",
    "serving": "1 medium",
    "group": "Vegetables",
    "calories": 44,
    "protein": 1,
    "carbs": 10,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "garden-egg-african-eggplant",
    "name": "Garden egg / African eggplant",
    "serving": "1 medium",
    "group": "Vegetables",
    "calories": 20,
    "protein": 1,
    "carbs": 5,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "eggplant-aubergine",
    "name": "Eggplant / Aubergine",
    "serving": "1 cup cubed, cooked",
    "group": "Vegetables",
    "calories": 35,
    "protein": 1,
    "carbs": 9,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "bell-pepper-tatashe",
    "name": "Bell pepper / Tatashe",
    "serving": "1 medium",
    "group": "Vegetables",
    "calories": 31,
    "protein": 1,
    "carbs": 7,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "chili-pepper-rodo",
    "name": "Chili pepper / Rodo",
    "serving": "1 tbsp chopped",
    "group": "Vegetables",
    "calories": 6,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "okra",
    "name": "Okra",
    "serving": "1 cup sliced, cooked",
    "group": "Vegetables",
    "calories": 35,
    "protein": 2,
    "carbs": 7,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "cucumber",
    "name": "Cucumber",
    "serving": "1 cup sliced",
    "group": "Vegetables",
    "calories": 16,
    "protein": 1,
    "carbs": 4,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "green-beans",
    "name": "Green beans",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 44,
    "protein": 2,
    "carbs": 10,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "green-peas",
    "name": "Green peas",
    "serving": "1 cup",
    "group": "Vegetables",
    "calories": 118,
    "protein": 8,
    "carbs": 21,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "sweetcorn",
    "name": "Sweetcorn",
    "serving": "1 cup",
    "group": "Vegetables",
    "calories": 132,
    "protein": 5,
    "carbs": 29,
    "fat": 2,
    "cuisine": "Universal"
  },
  {
    "id": "boiled-corn",
    "name": "Boiled corn",
    "serving": "1 ear",
    "group": "Vegetables",
    "calories": 88,
    "protein": 3,
    "carbs": 19,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "pumpkin",
    "name": "Pumpkin",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 49,
    "protein": 2,
    "carbs": 12,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "zucchini-courgette",
    "name": "Zucchini / Courgette",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 27,
    "protein": 2,
    "carbs": 5,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "celery",
    "name": "Celery",
    "serving": "1 cup chopped",
    "group": "Vegetables",
    "calories": 16,
    "protein": 1,
    "carbs": 3,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "beetroot",
    "name": "Beetroot",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 74,
    "protein": 3,
    "carbs": 17,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "radish",
    "name": "Radish",
    "serving": "1 cup sliced",
    "group": "Vegetables",
    "calories": 19,
    "protein": 1,
    "carbs": 4,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "turnip",
    "name": "Turnip",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 34,
    "protein": 1,
    "carbs": 8,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "asparagus",
    "name": "Asparagus",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 40,
    "protein": 4,
    "carbs": 7,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "mushroom",
    "name": "Mushroom",
    "serving": "1 cup sliced",
    "group": "Vegetables",
    "calories": 21,
    "protein": 3,
    "carbs": 3,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "bok-choy",
    "name": "Bok choy",
    "serving": "1 cup cooked",
    "group": "Vegetables",
    "calories": 20,
    "protein": 3,
    "carbs": 3,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "watercress",
    "name": "Watercress",
    "serving": "1 cup",
    "group": "Vegetables",
    "calories": 4,
    "protein": 1,
    "carbs": 0,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "spring-onion",
    "name": "Spring onion",
    "serving": "¼ cup",
    "group": "Vegetables",
    "calories": 8,
    "protein": 0,
    "carbs": 2,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "chicken-breast-skinless",
    "name": "Chicken breast, skinless",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 165,
    "protein": 31,
    "carbs": 0,
    "fat": 4,
    "cuisine": "Universal"
  },
  {
    "id": "chicken-thigh",
    "name": "Chicken thigh",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 209,
    "protein": 26,
    "carbs": 0,
    "fat": 11,
    "cuisine": "Universal"
  },
  {
    "id": "turkey-breast",
    "name": "Turkey breast",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 135,
    "protein": 30,
    "carbs": 0,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "beef-lean",
    "name": "Beef, lean",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 217,
    "protein": 26,
    "carbs": 0,
    "fat": 12,
    "cuisine": "Universal"
  },
  {
    "id": "goat-meat",
    "name": "Goat meat",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 143,
    "protein": 27,
    "carbs": 0,
    "fat": 3,
    "cuisine": "Universal"
  },
  {
    "id": "lamb",
    "name": "Lamb",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 258,
    "protein": 25,
    "carbs": 0,
    "fat": 17,
    "cuisine": "Universal"
  },
  {
    "id": "pork",
    "name": "Pork",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 242,
    "protein": 27,
    "carbs": 0,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "egg",
    "name": "Egg",
    "serving": "1 large",
    "group": "Proteins",
    "calories": 72,
    "protein": 6,
    "carbs": 0,
    "fat": 5,
    "cuisine": "Universal"
  },
  {
    "id": "egg-white",
    "name": "Egg white",
    "serving": "1 large",
    "group": "Proteins",
    "calories": 17,
    "protein": 4,
    "carbs": 0,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "tilapia",
    "name": "Tilapia",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 128,
    "protein": 26,
    "carbs": 0,
    "fat": 3,
    "cuisine": "Universal"
  },
  {
    "id": "mackerel-titus",
    "name": "Mackerel / Titus",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 205,
    "protein": 19,
    "carbs": 0,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "catfish",
    "name": "Catfish",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 105,
    "protein": 18,
    "carbs": 0,
    "fat": 3,
    "cuisine": "Universal"
  },
  {
    "id": "sardines",
    "name": "Sardines",
    "serving": "100g canned",
    "group": "Proteins",
    "calories": 208,
    "protein": 25,
    "carbs": 0,
    "fat": 11,
    "cuisine": "Universal"
  },
  {
    "id": "salmon",
    "name": "Salmon",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 206,
    "protein": 22,
    "carbs": 0,
    "fat": 13,
    "cuisine": "Universal"
  },
  {
    "id": "tuna-canned-in-water",
    "name": "Tuna, canned in water",
    "serving": "100g",
    "group": "Proteins",
    "calories": 116,
    "protein": 26,
    "carbs": 0,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "cod",
    "name": "Cod",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 105,
    "protein": 23,
    "carbs": 0,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "prawns-shrimp",
    "name": "Prawns / Shrimp",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 99,
    "protein": 24,
    "carbs": 0,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "crayfish-dried",
    "name": "Crayfish, dried",
    "serving": "1 tbsp",
    "group": "Proteins",
    "calories": 15,
    "protein": 3,
    "carbs": 0,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "snail",
    "name": "Snail",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 90,
    "protein": 16,
    "carbs": 2,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "periwinkle",
    "name": "Periwinkle",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 74,
    "protein": 11,
    "carbs": 4,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "stockfish-okporoko",
    "name": "Stockfish / Okporoko",
    "serving": "30g dried",
    "group": "Proteins",
    "calories": 96,
    "protein": 22,
    "carbs": 0,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "dried-fish",
    "name": "Dried fish",
    "serving": "30g",
    "group": "Proteins",
    "calories": 90,
    "protein": 18,
    "carbs": 0,
    "fat": 2,
    "cuisine": "Universal"
  },
  {
    "id": "beef-liver",
    "name": "Beef liver",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 175,
    "protein": 27,
    "carbs": 5,
    "fat": 5,
    "cuisine": "Universal"
  },
  {
    "id": "chicken-gizzard",
    "name": "Chicken gizzard",
    "serving": "100g cooked",
    "group": "Proteins",
    "calories": 154,
    "protein": 30,
    "carbs": 0,
    "fat": 3,
    "cuisine": "Universal"
  },
  {
    "id": "ponmo-cow-skin",
    "name": "Ponmo / Cow skin",
    "serving": "100g",
    "group": "Proteins",
    "calories": 224,
    "protein": 48,
    "carbs": 0,
    "fat": 3,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "brown-beans-oloyin",
    "name": "Brown beans / Oloyin",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 227,
    "protein": 15,
    "carbs": 41,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "black-eyed-peas",
    "name": "Black-eyed peas",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 198,
    "protein": 13,
    "carbs": 35,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "soybeans",
    "name": "Soybeans",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 298,
    "protein": 29,
    "carbs": 17,
    "fat": 15,
    "cuisine": "Universal"
  },
  {
    "id": "tofu",
    "name": "Tofu",
    "serving": "100g",
    "group": "Legumes & Plant Protein",
    "calories": 76,
    "protein": 8,
    "carbs": 2,
    "fat": 5,
    "cuisine": "Universal"
  },
  {
    "id": "tempeh",
    "name": "Tempeh",
    "serving": "100g",
    "group": "Legumes & Plant Protein",
    "calories": 192,
    "protein": 20,
    "carbs": 8,
    "fat": 11,
    "cuisine": "Universal"
  },
  {
    "id": "red-lentils",
    "name": "Red lentils",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 230,
    "protein": 18,
    "carbs": 40,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "green-lentils",
    "name": "Green lentils",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 230,
    "protein": 18,
    "carbs": 40,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "chickpeas",
    "name": "Chickpeas",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 269,
    "protein": 15,
    "carbs": 45,
    "fat": 4,
    "cuisine": "Universal"
  },
  {
    "id": "kidney-beans",
    "name": "Kidney beans",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 225,
    "protein": 15,
    "carbs": 40,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "black-beans",
    "name": "Black beans",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 227,
    "protein": 15,
    "carbs": 41,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "bambara-nut-okpa",
    "name": "Bambara nut / Okpa",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 220,
    "protein": 16,
    "carbs": 38,
    "fat": 2,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "pigeon-peas",
    "name": "Pigeon peas",
    "serving": "1 cup cooked",
    "group": "Legumes & Plant Protein",
    "calories": 209,
    "protein": 11,
    "carbs": 39,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "edamame",
    "name": "Edamame",
    "serving": "1 cup",
    "group": "Legumes & Plant Protein",
    "calories": 188,
    "protein": 18,
    "carbs": 14,
    "fat": 8,
    "cuisine": "Universal"
  },
  {
    "id": "moi-moi-bean-pudding",
    "name": "Moi-moi / Bean pudding",
    "serving": "1 wrap",
    "group": "Legumes & Plant Protein",
    "calories": 180,
    "protein": 10,
    "carbs": 18,
    "fat": 8,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "white-rice",
    "name": "White rice",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 205,
    "protein": 4,
    "carbs": 45,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "brown-rice",
    "name": "Brown rice",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 216,
    "protein": 5,
    "carbs": 45,
    "fat": 2,
    "cuisine": "Universal"
  },
  {
    "id": "ofada-rice",
    "name": "Ofada rice",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 210,
    "protein": 5,
    "carbs": 44,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "basmati-rice",
    "name": "Basmati rice",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 210,
    "protein": 4,
    "carbs": 46,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "millet",
    "name": "Millet",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 207,
    "protein": 6,
    "carbs": 41,
    "fat": 2,
    "cuisine": "Universal"
  },
  {
    "id": "sorghum-guinea-corn",
    "name": "Sorghum / Guinea corn",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 240,
    "protein": 7,
    "carbs": 52,
    "fat": 2,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "fonio-acha",
    "name": "Fonio / Acha",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 170,
    "protein": 4,
    "carbs": 38,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "oats",
    "name": "Oats",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 154,
    "protein": 6,
    "carbs": 27,
    "fat": 3,
    "cuisine": "Universal"
  },
  {
    "id": "whole-wheat-bread",
    "name": "Whole-wheat bread",
    "serving": "1 slice",
    "group": "Grains & Starches",
    "calories": 81,
    "protein": 4,
    "carbs": 14,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "white-bread",
    "name": "White bread",
    "serving": "1 slice",
    "group": "Grains & Starches",
    "calories": 75,
    "protein": 2,
    "carbs": 14,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "agege-bread",
    "name": "Agege bread",
    "serving": "1 slice",
    "group": "Grains & Starches",
    "calories": 90,
    "protein": 3,
    "carbs": 17,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "pasta-spaghetti",
    "name": "Pasta / Spaghetti",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 221,
    "protein": 8,
    "carbs": 43,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "semovita-semolina-swallow",
    "name": "Semovita / Semolina swallow",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 200,
    "protein": 6,
    "carbs": 42,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "wheat-swallow",
    "name": "Wheat swallow",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 180,
    "protein": 6,
    "carbs": 38,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "garri-eba",
    "name": "Garri / Eba",
    "serving": "1 wrap",
    "group": "Grains & Starches",
    "calories": 300,
    "protein": 2,
    "carbs": 73,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "fufu-akpu",
    "name": "Fufu / Akpu",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 330,
    "protein": 1,
    "carbs": 80,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "pounded-yam",
    "name": "Pounded yam",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 250,
    "protein": 3,
    "carbs": 57,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "amala",
    "name": "Amala",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 200,
    "protein": 2,
    "carbs": 48,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "tuwo",
    "name": "Tuwo",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 180,
    "protein": 3,
    "carbs": 40,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "yam-boiled",
    "name": "Yam, boiled",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 158,
    "protein": 2,
    "carbs": 38,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "sweet-potato-boiled",
    "name": "Sweet potato, boiled",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 180,
    "protein": 4,
    "carbs": 41,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "irish-potato-boiled",
    "name": "Irish potato, boiled",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 136,
    "protein": 3,
    "carbs": 31,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "cocoyam-boiled",
    "name": "Cocoyam, boiled",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 187,
    "protein": 1,
    "carbs": 46,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "plantain-boiled",
    "name": "Plantain, boiled",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 179,
    "protein": 1,
    "carbs": 48,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "plantain-roasted-boli",
    "name": "Plantain, roasted / Boli",
    "serving": "1 medium",
    "group": "Grains & Starches",
    "calories": 218,
    "protein": 2,
    "carbs": 57,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "plantain-fried-dodo",
    "name": "Plantain, fried / Dodo",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 310,
    "protein": 2,
    "carbs": 48,
    "fat": 12,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "cassava-boiled",
    "name": "Cassava, boiled",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 330,
    "protein": 3,
    "carbs": 78,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "couscous",
    "name": "Couscous",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 176,
    "protein": 6,
    "carbs": 36,
    "fat": 0,
    "cuisine": "Mediterranean"
  },
  {
    "id": "quinoa",
    "name": "Quinoa",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 222,
    "protein": 8,
    "carbs": 39,
    "fat": 4,
    "cuisine": "Universal"
  },
  {
    "id": "bulgur",
    "name": "Bulgur",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 151,
    "protein": 6,
    "carbs": 34,
    "fat": 0,
    "cuisine": "Mediterranean"
  },
  {
    "id": "barley",
    "name": "Barley",
    "serving": "1 cup cooked",
    "group": "Grains & Starches",
    "calories": 193,
    "protein": 4,
    "carbs": 44,
    "fat": 1,
    "cuisine": "Universal"
  },
  {
    "id": "pap-ogi-akamu",
    "name": "Pap / Ogi / Akamu",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 120,
    "protein": 2,
    "carbs": 26,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "cornflakes",
    "name": "Cornflakes",
    "serving": "1 cup",
    "group": "Grains & Starches",
    "calories": 100,
    "protein": 2,
    "carbs": 24,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "almonds",
    "name": "Almonds",
    "serving": "28g",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 164,
    "protein": 6,
    "carbs": 6,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "cashews",
    "name": "Cashews",
    "serving": "28g",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 157,
    "protein": 5,
    "carbs": 9,
    "fat": 12,
    "cuisine": "Universal"
  },
  {
    "id": "walnuts",
    "name": "Walnuts",
    "serving": "28g",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 185,
    "protein": 4,
    "carbs": 4,
    "fat": 18,
    "cuisine": "Universal"
  },
  {
    "id": "peanuts-groundnuts",
    "name": "Peanuts / Groundnuts",
    "serving": "28g",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 161,
    "protein": 7,
    "carbs": 5,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "tiger-nuts",
    "name": "Tiger nuts",
    "serving": "28g",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 120,
    "protein": 1,
    "carbs": 19,
    "fat": 7,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "pistachios",
    "name": "Pistachios",
    "serving": "28g",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 159,
    "protein": 6,
    "carbs": 8,
    "fat": 13,
    "cuisine": "Universal"
  },
  {
    "id": "pumpkin-seeds",
    "name": "Pumpkin seeds",
    "serving": "28g",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 151,
    "protein": 7,
    "carbs": 5,
    "fat": 13,
    "cuisine": "Universal"
  },
  {
    "id": "sesame-benniseed",
    "name": "Sesame / Benniseed",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 52,
    "protein": 2,
    "carbs": 2,
    "fat": 5,
    "cuisine": "Universal"
  },
  {
    "id": "egusi-melon-seeds",
    "name": "Egusi / Melon seeds",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 50,
    "protein": 2,
    "carbs": 1,
    "fat": 4,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "ogbono-seeds",
    "name": "Ogbono seeds",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 60,
    "protein": 1,
    "carbs": 2,
    "fat": 5,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "chia-seeds",
    "name": "Chia seeds",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 58,
    "protein": 2,
    "carbs": 5,
    "fat": 4,
    "cuisine": "Universal"
  },
  {
    "id": "flaxseed",
    "name": "Flaxseed",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 55,
    "protein": 2,
    "carbs": 3,
    "fat": 4,
    "cuisine": "Universal"
  },
  {
    "id": "sunflower-seeds",
    "name": "Sunflower seeds",
    "serving": "28g",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 165,
    "protein": 6,
    "carbs": 7,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "palm-oil",
    "name": "Palm oil",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 120,
    "protein": 0,
    "carbs": 0,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "olive-oil",
    "name": "Olive oil",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 119,
    "protein": 0,
    "carbs": 0,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "groundnut-oil",
    "name": "Groundnut oil",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 120,
    "protein": 0,
    "carbs": 0,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "coconut-oil",
    "name": "Coconut oil",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 117,
    "protein": 0,
    "carbs": 0,
    "fat": 14,
    "cuisine": "Universal"
  },
  {
    "id": "butter",
    "name": "Butter",
    "serving": "1 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 102,
    "protein": 0,
    "carbs": 0,
    "fat": 12,
    "cuisine": "Universal"
  },
  {
    "id": "peanut-butter",
    "name": "Peanut butter",
    "serving": "2 tbsp",
    "group": "Nuts, Seeds, Fats & Oils",
    "calories": 188,
    "protein": 8,
    "carbs": 6,
    "fat": 16,
    "cuisine": "Universal"
  },
  {
    "id": "whole-milk",
    "name": "Whole milk",
    "serving": "1 cup",
    "group": "Dairy & Alternatives",
    "calories": 149,
    "protein": 8,
    "carbs": 12,
    "fat": 8,
    "cuisine": "Universal"
  },
  {
    "id": "skim-milk",
    "name": "Skim milk",
    "serving": "1 cup",
    "group": "Dairy & Alternatives",
    "calories": 83,
    "protein": 8,
    "carbs": 12,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "evaporated-milk",
    "name": "Evaporated milk",
    "serving": "2 tbsp",
    "group": "Dairy & Alternatives",
    "calories": 42,
    "protein": 2,
    "carbs": 3,
    "fat": 2,
    "cuisine": "Universal"
  },
  {
    "id": "powdered-milk",
    "name": "Powdered milk",
    "serving": "2 tbsp",
    "group": "Dairy & Alternatives",
    "calories": 60,
    "protein": 3,
    "carbs": 5,
    "fat": 3,
    "cuisine": "Universal"
  },
  {
    "id": "greek-yogurt-plain",
    "name": "Greek yogurt, plain",
    "serving": "170g",
    "group": "Dairy & Alternatives",
    "calories": 100,
    "protein": 17,
    "carbs": 6,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "yogurt-plain",
    "name": "Yogurt, plain",
    "serving": "1 cup",
    "group": "Dairy & Alternatives",
    "calories": 149,
    "protein": 8,
    "carbs": 11,
    "fat": 8,
    "cuisine": "Universal"
  },
  {
    "id": "cheddar-cheese",
    "name": "Cheddar cheese",
    "serving": "28g",
    "group": "Dairy & Alternatives",
    "calories": 113,
    "protein": 7,
    "carbs": 1,
    "fat": 9,
    "cuisine": "Universal"
  },
  {
    "id": "wara-local-cheese",
    "name": "Wara / Local cheese",
    "serving": "50g",
    "group": "Dairy & Alternatives",
    "calories": 90,
    "protein": 7,
    "carbs": 1,
    "fat": 7,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "nono-fermented-milk",
    "name": "Nono / Fermented milk",
    "serving": "1 cup",
    "group": "Dairy & Alternatives",
    "calories": 120,
    "protein": 8,
    "carbs": 10,
    "fat": 5,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "cottage-cheese",
    "name": "Cottage cheese",
    "serving": "½ cup",
    "group": "Dairy & Alternatives",
    "calories": 110,
    "protein": 12,
    "carbs": 4,
    "fat": 5,
    "cuisine": "Universal"
  },
  {
    "id": "soy-milk",
    "name": "Soy milk",
    "serving": "1 cup",
    "group": "Dairy & Alternatives",
    "calories": 105,
    "protein": 6,
    "carbs": 12,
    "fat": 4,
    "cuisine": "Universal"
  },
  {
    "id": "almond-milk-unsweetened",
    "name": "Almond milk, unsweetened",
    "serving": "1 cup",
    "group": "Dairy & Alternatives",
    "calories": 39,
    "protein": 1,
    "carbs": 3,
    "fat": 3,
    "cuisine": "Universal"
  },
  {
    "id": "ice-cream",
    "name": "Ice cream",
    "serving": "½ cup",
    "group": "Dairy & Alternatives",
    "calories": 137,
    "protein": 2,
    "carbs": 16,
    "fat": 7,
    "cuisine": "Universal"
  },
  {
    "id": "garlic",
    "name": "Garlic",
    "serving": "1 clove",
    "group": "Herbs, Aromatics & Seasonings",
    "calories": 4,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "ginger",
    "name": "Ginger",
    "serving": "1 tbsp",
    "group": "Herbs, Aromatics & Seasonings",
    "calories": 5,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "locust-bean-iru-dawadawa",
    "name": "Locust bean / Iru / Dawadawa",
    "serving": "1 tbsp",
    "group": "Herbs, Aromatics & Seasonings",
    "calories": 15,
    "protein": 1,
    "carbs": 1,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "uziza-leaves",
    "name": "Uziza leaves",
    "serving": "¼ cup",
    "group": "Herbs, Aromatics & Seasonings",
    "calories": 5,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "utazi-leaves",
    "name": "Utazi leaves",
    "serving": "¼ cup",
    "group": "Herbs, Aromatics & Seasonings",
    "calories": 6,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "curry-powder",
    "name": "Curry powder",
    "serving": "1 tsp",
    "group": "Herbs, Aromatics & Seasonings",
    "calories": 7,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "thyme",
    "name": "Thyme",
    "serving": "1 tsp",
    "group": "Herbs, Aromatics & Seasonings",
    "calories": 3,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "tomato-paste",
    "name": "Tomato paste",
    "serving": "2 tbsp",
    "group": "Herbs, Aromatics & Seasonings",
    "calories": 30,
    "protein": 2,
    "carbs": 7,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "water",
    "name": "Water",
    "serving": "1 cup",
    "group": "Beverages",
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "zobo-hibiscus-unsweetened",
    "name": "Zobo / Hibiscus, unsweetened",
    "serving": "1 cup",
    "group": "Beverages",
    "calories": 5,
    "protein": 0,
    "carbs": 1,
    "fat": 0,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "kunu",
    "name": "Kunu",
    "serving": "1 cup",
    "group": "Beverages",
    "calories": 110,
    "protein": 3,
    "carbs": 22,
    "fat": 1,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "tiger-nut-milk-kunu-aya",
    "name": "Tiger-nut milk / Kunu aya",
    "serving": "1 cup",
    "group": "Beverages",
    "calories": 140,
    "protein": 3,
    "carbs": 24,
    "fat": 4,
    "isNigerian": true,
    "cuisine": "Nigerian"
  },
  {
    "id": "coconut-water",
    "name": "Coconut water",
    "serving": "1 cup",
    "group": "Beverages",
    "calories": 46,
    "protein": 2,
    "carbs": 9,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "orange-juice-fresh",
    "name": "Orange juice, fresh",
    "serving": "1 cup",
    "group": "Beverages",
    "calories": 112,
    "protein": 2,
    "carbs": 26,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "tea-unsweetened",
    "name": "Tea, unsweetened",
    "serving": "1 cup",
    "group": "Beverages",
    "calories": 2,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "black-coffee",
    "name": "Black coffee",
    "serving": "1 cup",
    "group": "Beverages",
    "calories": 2,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "cuisine": "Universal"
  },
  {
    "id": "chocolate-malt-drink-powder",
    "name": "Chocolate malt drink powder",
    "serving": "2 tbsp",
    "group": "Beverages",
    "calories": 80,
    "protein": 1,
    "carbs": 16,
    "fat": 1,
    "cuisine": "Universal"
  }
];
