/**
 * build-diet-dictionary.mjs — codegen: diet_dictionary (text) → constants/DietLibraryGenerated.ts
 *
 * `diet_dictionary` (repo root) is the HUMAN-EDITABLE source of truth for
 * Welliva's clinical diet library (105 special diets across 10 medical
 * families) AND a whole-foods dictionary (individual fruits, vegetables,
 * proteins, grains, etc. with per-serving macros). This script parses that text
 * file and emits typed `GENERATED_DIETS: DietData[]` and `FOOD_DICTIONARY:
 * FoodItem[]` modules that the app consumes.
 *
 * Re-run after editing diet_dictionary:
 *     node scripts/build-diet-dictionary.mjs
 *
 * Design notes:
 *  - Diets whose topic already exists in the hand-authored base DB are given the
 *    SAME id here, so the merge in DietDatabase.ts auto-skips them (base wins).
 *  - Single macro values become tight {min,max} ranges (no fabricated spread).
 *  - Cuisine is inferred from meal-name keywords (Nigerian / Mediterranean /
 *    else Universal) so the app's cuisine-preference tiers still work.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "diet_dictionary");
const OUT = join(ROOT, "constants", "DietLibraryGenerated.ts");
// Phase D.4 — the catalogs are served from Supabase Storage, not the bundle.
// The JSON here is the RUNTIME source (uploaded via scripts/upload-catalogs.mjs);
// DietLibraryGenerated.ts is kept only as a readable reference + is no longer
// imported by the app, so Metro leaves it out of the bundle.
const CATALOG_DIST = join(ROOT, "catalogs-dist");

// ── Intentional id per diet number ──────────────────────────────────────────
// Duplicates of an existing base-DB diet reuse the base id (→ merge auto-skips,
// keeping the richer hand-authored version). Everything else gets a fresh slug.
const ID_BY_NUMBER = {
  // A — Cardiovascular & Metabolic
  1: "mediterranean", 2: "dash", 3: "low-cholesterol", 4: "low-sodium",
  5: "tlc", 6: "portfolio", 7: "diabetic-friendly", 8: "diabetes-type1",
  9: "prediabetes", 10: "low-gi", 11: "metabolic-syndrome", 12: "calorie-counting",
  13: "keto", 14: "low-carb", 15: "intermittent-fasting",
  // B — Digestive & GI
  16: "ulcer-gerd-friendly", 17: "ulcer-gerd-friendly", 18: "gastritis",
  19: "ibs-low-fodmap", 20: "ibd-crohns-colitis", 21: "diverticulitis",
  22: "gluten-free", 23: "high-fiber", 24: "low-residue-diarrhea",
  25: "bariatric-post-surgery", 26: "lactose-free", 27: "sibo",
  // C — Renal, Hepatic & Endocrine
  28: "renal-friendly", 29: "dialysis", 30: "kidney-stone", 31: "liver-friendly",
  32: "cirrhosis", 33: "gallbladder-low-fat", 34: "pancreatitis",
  35: "thyroid-support", 36: "hyperthyroid", 37: "adrenal-support", 38: "gout-low-purine",
  // D — Hormonal, Reproductive & Life-Stage
  39: "pcos-friendly", 40: "endometriosis", 41: "fertility-preconception",
  42: "pregnancy", 43: "gestational-diabetes", 44: "postpartum-wellness",
  45: "menopause", 46: "pediatric", 47: "toddler", 48: "adolescent",
  49: "elderly-geriatric", 50: "sarcopenia",
  // E — Neurological, Cognitive & Mental Health
  51: "mind-brain", 52: "dementia-support", 53: "parkinsons",
  54: "multiple-sclerosis", 55: "epilepsy-keto", 56: "migraine",
  57: "depression-mood", 58: "anxiety-calming", 59: "adhd", 60: "sleep-support",
  // F — Immune, Inflammatory & Musculoskeletal
  61: "anti-inflammatory", 62: "autoimmune-protocol", 63: "rheumatoid-arthritis",
  64: "osteoarthritis", 65: "osteoporosis", 66: "lupus", 67: "psoriasis",
  68: "immunity-boosting", 69: "iron-deficiency-recovery", 70: "gut-health",
  // G — Cancer, Recovery & Clinical Nutrition
  71: "cancer-support", 72: "neutropenic", 73: "chemo-nausea",
  74: "post-surgery-recovery", 75: "wound-healing", 76: "burns-recovery",
  77: "hiv-nutrition", 78: "tuberculosis-recovery", 79: "dysphagia-pureed",
  80: "convalescence-soft", 81: "copd-respiratory",
  // H — Allergy, Intolerance & Elimination
  82: "dairy-free", 83: "nut-free", 84: "egg-free", 85: "soy-free",
  86: "shellfish-free", 87: "wheat-allergy", 88: "low-histamine",
  89: "low-salicylate", 90: "elimination",
  // I — Fitness, Performance & Body Composition
  91: "bodybuilding", 92: "cutting-fat-loss", 93: "athlete-endurance",
  94: "strength-athlete", 95: "high-protein", 96: "post-workout-recovery",
  // J — Ethical, Cultural & Plant-Based
  97: "vegan", 98: "vegetarian", 99: "pescatarian", 100: "flexitarian",
  101: "halal", 102: "kosher", 103: "paleo", 104: "whole-food-plant-based",
  105: "traditional-african",
  // K — Lifestyle & Goal-Based Nutrition (non-clinical, everyday goals)
  106: "whole-food-reset", 107: "clean-eating", 108: "no-added-sugar",
  109: "blue-zones", 110: "metabolism-lean", 111: "glow-skin",
  112: "budget-balanced", 113: "meal-prep", 114: "family-balanced",
  115: "student-quick", 116: "healthy-weight-gain", 117: "mindful-eating",
  118: "debloat-light", 119: "high-energy-vitality", 120: "everyday-balanced",
  121: "weight-loss", 122: "gluten-free-lifestyle", 123: "lactose-free-lifestyle",
};

// Category letter → Ionicons name for the diet badge.
const ICON_BY_CATEGORY = {
  A: "heart-outline", B: "nutrition-outline", C: "pulse-outline",
  D: "people-outline", E: "bulb-outline", F: "shield-checkmark-outline",
  G: "medkit-outline", H: "alert-circle-outline", I: "barbell-outline",
  J: "leaf-outline", K: "sparkles-outline",
};

// Acronyms to keep uppercase when building display names.
const ACRONYMS = new Set([
  "DASH", "TLC", "PCOS", "GERD", "IBS", "IBD", "SIBO", "CKD", "NAFLD", "MIND",
  "MS", "ADHD", "AIP", "HIV", "TB", "COPD", "WFPB", "GI", "FODMAP", "BRAT",
  "NTC", "PCO", "DASH",
]);

// Distinctive cuisine keywords (lowercase, substring match on meal/food name).
const NIGERIAN = [
  "pap", "ogi", "akamu", "akara", "moi-moi", "moimoi", "efo", "egusi", "jollof",
  "ofada", "ayamase", "amala", "eba", "fufu", "ewedu", "boli", "kunu",
  "tiger-nut", "tiger nut", "tiger nuts", "suya", "asaro", "plantain", "yam",
  "pounded yam", "beans porridge", "pepper soup", "garri",
  // West-African whole foods (dictionary): local greens, staples & seasonings.
  "ugu", "fluted pumpkin", "shoko", "bitterleaf", "waterleaf", "scent leaf",
  "efirin", "tete", "garden egg", "ogbono", "bambara", "okpa", "tuwo", "fonio",
  "acha", "cocoyam", "dodo", "ponmo", "stockfish", "okporoko", "periwinkle",
  "crayfish", "dawadawa", "locust bean", "uziza", "utazi", "zobo",
  "agbalumo", "star apple", "african pear", "oloyin", "wara", "nono",
  "semovita", "guinea corn", "cassava leaves", "soursop", "pawpaw",
];
const MEDITERRANEAN = [
  "hummus", "couscous", "shakshuka", "tahini", "feta", "falafel", "tzatziki",
  "bulgur", "ratatouille", "ful medames", "tagine", "mezze",
];

// Advanced-difficulty families/keywords (restrictive or clinically demanding).
const ADVANCED_CATEGORIES = new Set(["C", "G"]);
const ADVANCED_KEYWORDS = /keto|dialysis|elimination|autoimmune|pancreatitis|dysphagia|neutropenic|bariatric|renal|ckd/i;
const EASY_KEYWORDS = /mediterranean|dash|flexitarian|balanced|immunity|gut-?health|pediatric|nigerian traditional|high-fiber|sleep|menopause/i;

// ── Helpers ─────────────────────────────────────────────────────────────────

function titleCaseWord(word) {
  // Preserve known acronyms and short all-caps tokens; title-case hyphen parts.
  return word
    .split("-")
    .map((part) => {
      const bare = part.replace(/[^A-Za-z]/g, "");
      // Only preserve known acronyms uppercase — the source is ALL-CAPS, so a
      // blanket "short all-caps" rule would wrongly keep LOW, DIET, SOY, etc.
      if (bare && ACRONYMS.has(bare.toUpperCase())) {
        return part.toUpperCase();
      }
      if (part.length === 0) return part;
      return part[0].toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("-");
}

function cleanName(rawTitle) {
  // "DASH DIET (HYPERTENSION)" → "DASH Diet (Hypertension)"
  return rawTitle
    .split(/(\s+|\(|\)|\/)/)
    .map((tok) => {
      if (/^\s+$/.test(tok) || tok === "(" || tok === ")" || tok === "/") return tok;
      return titleCaseWord(tok);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(/[·,;]|(?:\s&\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "&");
}

function cuisineOf(name) {
  const n = name.toLowerCase();
  if (NIGERIAN.some((k) => n.includes(k))) return "Nigerian";
  if (MEDITERRANEAN.some((k) => n.includes(k))) return "Mediterranean";
  return "Universal";
}

function classifySlot(header) {
  const h = header.toUpperCase();
  if (/BREAK-?FAST/.test(h)) return "breakfast";
  if (/POST-WORKOUT/.test(h)) return "snack";
  if (/FUELING/.test(h)) return "snack";
  if (/BEDTIME/.test(h)) return "snack";
  if (/SNACK/.test(h)) return "snack";
  if (/MAIN MEAL/.test(h)) return "lunch";
  if (/FINAL MEAL/.test(h)) return "dinner";
  if (/MIDDAY/.test(h)) return "lunch";
  if (/EVENING/.test(h)) return "dinner";
  if (/BREAKFAST/.test(h)) return "breakfast";
  if (/LUNCH/.test(h)) return "lunch";
  if (/DINNER/.test(h)) return "dinner";
  return null;
}

function difficultyOf(letter, name) {
  if (ADVANCED_CATEGORIES.has(letter) || ADVANCED_KEYWORDS.test(name)) return "Advanced";
  if (EASY_KEYWORDS.test(name)) return "Easy";
  return "Moderate";
}

const rng = (v) => ({ min: v, max: v });

// Option line: "• Name — 340 kcal | P 18g · C 38g · F 14g"
const OPTION_RE = /^•\s*(.+?)\s+—\s+(\d+)\s*kcal\s*\|\s*P\s*(\d+)g\s*·\s*C\s*(\d+)g\s*·\s*F\s*(\d+)g/;
// Diet title: "1. MEDITERRANEAN DIET"
const TITLE_RE = /^(\d+)\.\s+([A-Z].*)$/;
// Metadata: "Focus    : ..."
const META_RE = /^(Category|Focus|Best for|Caution|Targets|Sources)\s*:\s*(.+)$/;

// ── Whole-foods dictionary helpers ──────────────────────────────────────────
// An ALL-CAPS line (no lowercase) between rules is a food-group header, e.g.
// "FRUITS", "NUTS, SEEDS, FATS & OILS", "PROTEINS (MEAT · POULTRY · …)".
const FOOD_GROUP_RE = /^[A-Z0-9][A-Z0-9 ,&·()'\/-]*$/;

// "FRUITS" → "Fruits"; "NUTS, SEEDS, FATS & OILS" → "Nuts, Seeds, Fats & Oils".
// Any trailing parenthetical (a sub-list) is dropped from the display label.
function normalizeGroup(raw) {
  return raw
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

// Stable slug id from a food name: "African Pear / Ube" → "african-pear-ube".
function foodSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Parse ───────────────────────────────────────────────────────────────────

const lines = readFileSync(SRC, "utf8").split(/\r?\n/);

const diets = [];
let cur = null;
let slot = null;

// Whole-foods dictionary accumulation (second half of the file).
const foods = [];
let foodMode = false;
let foodGroup = null;

function pushFood(label, kcal, p, c, f) {
  if (!foodGroup) return;
  let name = label;
  let serving = "";
  const sm = label.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (sm) {
    name = sm[1].trim();
    serving = sm[2].trim();
  }
  const cuisine = cuisineOf(name);
  const item = {
    id: foodSlug(name),
    name,
    serving,
    group: foodGroup,
    calories: kcal,
    protein: p,
    carbs: c,
    fat: f,
  };
  if (cuisine === "Nigerian") item.isNigerian = true;
  item.cuisine = cuisine;
  foods.push(item);
}

function pushMeal(name, kcal, p, c, f) {
  if (!cur || !slot) return;
  const cuisine = cuisineOf(name);
  const base = {
    name,
    calories: rng(kcal),
    protein: rng(p),
    carbs: rng(c),
    fat: rng(f),
  };
  if (cuisine === "Nigerian") base.isNigerian = true;
  base.cuisine = cuisine;
  if (slot === "breakfast") cur.breakfastOptions.push(base);
  else if (slot === "lunch") cur.lunchOptions.push(base);
  else if (slot === "dinner") cur.dinnerOptions.push(base);
  else if (slot === "snack") cur.snackOptions.push(base);
}

for (const line of lines) {
  if (line.startsWith("╔") || line.startsWith("║") || line.startsWith("╚") || line.startsWith("╠")) {
    // The whole-foods dictionary banner flips the parser into food mode and
    // closes the last open diet block.
    if (line.includes("WHOLE-FOODS DICTIONARY") && !foodMode) {
      if (cur) {
        diets.push(cur);
        cur = null;
      }
      foodMode = true;
      foodGroup = null;
    }
    continue; // banner boxes
  }

  // ── Food mode: parse single-food lines under ALL-CAPS group headers ────────
  if (foodMode) {
    const opt = line.match(OPTION_RE);
    if (opt) {
      pushFood(opt[1].trim(), Number(opt[2]), Number(opt[3]), Number(opt[4]), Number(opt[5]));
      continue;
    }
    const t = line.trim();
    if (
      t.length > 0 &&
      !t.startsWith("•") &&
      !t.startsWith("─") &&
      FOOD_GROUP_RE.test(t) &&
      t.replace(/[^A-Z]/g, "").length >= 3
    ) {
      foodGroup = normalizeGroup(t);
    }
    continue;
  }

  const title = line.match(TITLE_RE);
  if (title && ID_BY_NUMBER[Number(title[1])]) {
    if (cur) diets.push(cur);
    const number = Number(title[1]);
    const rawTitle = title[2].replace(/\s+DIET\s*$/i, " Diet").trim();
    cur = {
      _number: number,
      _rawTitle: title[2].trim(),
      id: ID_BY_NUMBER[number],
      name: cleanName(rawTitle),
      _meta: {},
      breakfastOptions: [],
      lunchOptions: [],
      dinnerOptions: [],
      snackOptions: [],
    };
    slot = null;
    continue;
  }
  if (!cur) continue;

  const meta = line.match(META_RE);
  if (meta) {
    cur._meta[meta[1]] = meta[2].trim();
    slot = null;
    continue;
  }

  const opt = line.match(OPTION_RE);
  if (opt) {
    pushMeal(opt[1].trim(), Number(opt[2]), Number(opt[3]), Number(opt[4]), Number(opt[5]));
    continue;
  }

  // A non-meta, non-option, non-bullet line that names a meal section.
  if (!line.startsWith("•") && line.trim().length > 0) {
    const s = classifySlot(line);
    if (s) slot = s;
  }
}
if (cur) diets.push(cur);

// ── Assemble DietData objects (dedupe: first id wins within generated set) ───

const seen = new Set();
const out = [];

for (const d of diets) {
  if (seen.has(d.id)) continue; // e.g. GERD + peptic ulcer both → ulcer-gerd-friendly
  seen.add(d.id);

  const categoryLine = d._meta["Category"] || "";
  const letter = (categoryLine.match(/^([A-K])\b/) || [])[1] || "A";
  const family = categoryLine.replace(/^[A-K]\s*·\s*/, "").trim() || "General";
  const focus = d._meta["Focus"] || "";
  const bestFor = d._meta["Best for"] || "";
  const caution = d._meta["Caution"] || "";
  const targets = d._meta["Targets"] || "";
  const sources = d._meta["Sources"] || "";

  out.push({
    id: d.id,
    name: d.name,
    fullName: d.name,
    description: focus,
    icon: ICON_BY_CATEGORY[letter] || "restaurant-outline",
    difficulty: difficultyOf(letter, d._rawTitle),
    category: family,
    principles: {
      emphasis: splitList(focus).slice(0, 8),
      avoids: splitList(caution).slice(0, 6),
    },
    clinicalInfo: {
      safeFor: splitList(bestFor).slice(0, 8),
      cautionFor: splitList(caution).slice(0, 6),
      guidelines: splitList(sources).slice(0, 8),
      clinicalNotes: [targets, bestFor].filter(Boolean),
    },
    breakfastOptions: d.breakfastOptions,
    lunchOptions: d.lunchOptions,
    dinnerOptions: d.dinnerOptions,
    snackOptions: d.snackOptions,
  });
}

// ── Assemble FoodItem objects (dedupe ids: append -2, -3 … on collision) ────

const foodSeen = new Set();
const foodsOut = [];
for (const item of foods) {
  let id = item.id;
  if (foodSeen.has(id)) {
    let n = 2;
    while (foodSeen.has(`${item.id}-${n}`)) n++;
    id = `${item.id}-${n}`;
  }
  foodSeen.add(id);
  foodsOut.push({ ...item, id });
}

// ── Emit ────────────────────────────────────────────────────────────────────

const header = `/**
 * DietLibraryGenerated.ts — AUTO-GENERATED. DO NOT EDIT BY HAND.
 *
 * Source of truth: /diet_dictionary (repo root).
 * Regenerate:      node scripts/build-diet-dictionary.mjs
 *
 * ${out.length} diets + ${foodsOut.length} whole foods parsed from the clinical
 * diet dictionary. Diets whose id already exists in the hand-authored
 * DIET_DATABASE are merged/skipped there (base wins), so GENERATED_DIETS is
 * additive only. FOOD_DICTIONARY is the ingredient-level whole-foods catalog
 * (fruits, vegetables, proteins, grains, legumes, dairy, Nigerian staples …).
 */

import type { DietData } from "./DietDatabase";
import type { FoodItem } from "./FoodDictionary";

export const GENERATED_DIETS: DietData[] = ${JSON.stringify(out, null, 2)};

export const FOOD_DICTIONARY: FoodItem[] = ${JSON.stringify(foodsOut, null, 2)};
`;

writeFileSync(OUT, header, "utf8");

// ── Emit runtime JSON catalogs (Phase D.4) ───────────────────────────────────
// These are what the APP loads at runtime (fetched from Supabase Storage). The
// manifest carries a content hash per catalog so the on-device cache knows when
// to refresh. Upload with: node scripts/upload-catalogs.mjs
mkdirSync(CATALOG_DIST, { recursive: true });
const dietJson = JSON.stringify(out);
const foodJson = JSON.stringify(foodsOut);
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const manifest = {
  diet_library: hash(dietJson),
  food_dictionary: hash(foodJson),
  generatedAt: new Date().toISOString(),
};
writeFileSync(join(CATALOG_DIST, "diet_library.json"), dietJson, "utf8");
writeFileSync(join(CATALOG_DIST, "food_dictionary.json"), foodJson, "utf8");
writeFileSync(join(CATALOG_DIST, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`Catalog JSON → catalogs-dist/ (diet ${manifest.diet_library}, food ${manifest.food_dictionary})`);

// ── Report ──────────────────────────────────────────────────────────────────
const totalOptions = out.reduce(
  (n, d) =>
    n + d.breakfastOptions.length + d.lunchOptions.length +
    d.dinnerOptions.length + d.snackOptions.length,
  0,
);
console.log(`Parsed ${diets.length} diet blocks → ${out.length} unique ids`);
console.log(`Total meal options: ${totalOptions}`);
const thin = out.filter(
  (d) => d.breakfastOptions.length === 0 || d.lunchOptions.length === 0 ||
    d.dinnerOptions.length === 0 || d.snackOptions.length === 0,
);
if (thin.length) {
  console.warn(`⚠ ${thin.length} diet(s) missing a meal slot:`, thin.map((d) => d.id).join(", "));
} else {
  console.log("✓ every diet has breakfast/lunch/dinner/snack options");
}

// Whole-foods dictionary report.
const foodGroups = [...new Set(foodsOut.map((f) => f.group))];
console.log(`Parsed ${foods.length} whole foods → ${foodsOut.length} unique ids`);
console.log(`Food groups (${foodGroups.length}): ${foodGroups.join(", ")}`);
console.log(`Wrote ${OUT}`);
