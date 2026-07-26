/**
 * FOOD_SEED — a tiny bundled subset of the whole-foods dictionary (Phase D.4).
 *
 * The full FOOD_DICTIONARY (~200 items) is now fetched from Supabase Storage and
 * cached on device, so it no longer ships in the binary. This curated ~30-item
 * seed is the ONLY food data bundled in-app: it keeps the Foods screen and the
 * NutrientResolver fallback usable on a first launch that happens to be offline,
 * until the real catalog downloads. It spans every display group so the group
 * chips aren't empty. Once the remote catalog loads, it fully replaces this.
 */

import type { FoodItem } from "./FoodDictionary";

export const FOOD_SEED: FoodItem[] = [
  // Fruits
  { id: "apple", name: "Apple", serving: "1 medium", group: "Fruits", calories: 95, protein: 0, carbs: 25, fat: 0 },
  { id: "banana", name: "Banana", serving: "1 medium", group: "Fruits", calories: 105, protein: 1, carbs: 27, fat: 0 },
  { id: "orange", name: "Orange", serving: "1 medium", group: "Fruits", calories: 62, protein: 1, carbs: 15, fat: 0 },
  { id: "avocado", name: "Avocado", serving: "1/2 fruit", group: "Fruits", calories: 120, protein: 1, carbs: 6, fat: 11 },
  // Vegetables
  { id: "spinach", name: "Spinach", serving: "1 cup cooked", group: "Vegetables", calories: 41, protein: 5, carbs: 7, fat: 0 },
  { id: "broccoli", name: "Broccoli", serving: "1 cup", group: "Vegetables", calories: 55, protein: 4, carbs: 11, fat: 1 },
  { id: "tomato", name: "Tomato", serving: "1 medium", group: "Vegetables", calories: 22, protein: 1, carbs: 5, fat: 0 },
  { id: "carrot", name: "Carrot", serving: "1 medium", group: "Vegetables", calories: 25, protein: 1, carbs: 6, fat: 0 },
  // Proteins
  { id: "chicken-breast", name: "Chicken Breast", serving: "100g cooked", group: "Proteins", calories: 165, protein: 31, carbs: 0, fat: 4 },
  { id: "egg", name: "Egg", serving: "1 large", group: "Proteins", calories: 72, protein: 6, carbs: 0, fat: 5 },
  { id: "salmon", name: "Salmon", serving: "100g cooked", group: "Proteins", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "beef-lean", name: "Lean Beef", serving: "100g cooked", group: "Proteins", calories: 217, protein: 26, carbs: 0, fat: 12 },
  { id: "tofu", name: "Tofu", serving: "100g", group: "Proteins", calories: 76, protein: 8, carbs: 2, fat: 5 },
  // Grains & Starches
  { id: "brown-rice", name: "Brown Rice", serving: "1 cup cooked", group: "Grains & Starches", calories: 216, protein: 5, carbs: 45, fat: 2 },
  { id: "oats", name: "Oats", serving: "1/2 cup dry", group: "Grains & Starches", calories: 150, protein: 5, carbs: 27, fat: 3 },
  { id: "sweet-potato", name: "Sweet Potato", serving: "1 medium", group: "Grains & Starches", calories: 112, protein: 2, carbs: 26, fat: 0 },
  { id: "whole-wheat-bread", name: "Whole-Wheat Bread", serving: "1 slice", group: "Grains & Starches", calories: 82, protein: 4, carbs: 14, fat: 1 },
  // Legumes
  { id: "black-beans", name: "Black Beans", serving: "1/2 cup cooked", group: "Legumes", calories: 114, protein: 8, carbs: 20, fat: 0 },
  { id: "lentils", name: "Lentils", serving: "1/2 cup cooked", group: "Legumes", calories: 115, protein: 9, carbs: 20, fat: 0 },
  { id: "chickpeas", name: "Chickpeas", serving: "1/2 cup cooked", group: "Legumes", calories: 134, protein: 7, carbs: 22, fat: 2 },
  // Dairy
  { id: "greek-yogurt", name: "Greek Yogurt", serving: "170g", group: "Dairy", calories: 100, protein: 17, carbs: 6, fat: 1 },
  { id: "milk", name: "Milk", serving: "1 cup", group: "Dairy", calories: 122, protein: 8, carbs: 12, fat: 5 },
  { id: "cheddar", name: "Cheddar Cheese", serving: "28g", group: "Dairy", calories: 113, protein: 7, carbs: 0, fat: 9 },
  // Nuts & Seeds
  { id: "almonds", name: "Almonds", serving: "28g", group: "Nuts & Seeds", calories: 164, protein: 6, carbs: 6, fat: 14 },
  { id: "peanut-butter", name: "Peanut Butter", serving: "2 tbsp", group: "Nuts & Seeds", calories: 188, protein: 8, carbs: 6, fat: 16 },
  // Nigerian & West-African staples
  { id: "jollof-rice", name: "Jollof Rice", serving: "1 cup", group: "Nigerian Staples", calories: 265, protein: 5, carbs: 45, fat: 7, isNigerian: true, cuisine: "Nigerian" },
  { id: "beans-porridge", name: "Beans Porridge", serving: "1 cup", group: "Nigerian Staples", calories: 230, protein: 13, carbs: 38, fat: 4, isNigerian: true, cuisine: "Nigerian" },
  { id: "plantain", name: "Plantain", serving: "1 medium", group: "Nigerian Staples", calories: 218, protein: 2, carbs: 57, fat: 1, isNigerian: true, cuisine: "Nigerian" },
  { id: "egusi-soup", name: "Egusi Soup", serving: "1 cup", group: "Nigerian Staples", calories: 300, protein: 14, carbs: 12, fat: 23, isNigerian: true, cuisine: "Nigerian" },
  { id: "yam-boiled", name: "Boiled Yam", serving: "150g", group: "Nigerian Staples", calories: 177, protein: 2, carbs: 42, fat: 0, isNigerian: true, cuisine: "Nigerian" },
];
