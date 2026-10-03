/**
 * mealRules — what a meal IS, for the three questions every plan must answer:
 * which cuisine does it belong to, does it break the user's dietary restriction,
 * and which dish is it (as opposed to which portion of that dish).
 *
 * ── WHY ONE MODULE ──────────────────────────────────────────────────────────
 * The diet scorer, the day generator and the onboarding menu picker all ask
 * these questions. When each asked them its own way the answers disagreed: the
 * generator honoured cuisine (it narrowed every slot to Nigerian dishes) while
 * the scorer ignored it entirely, so an African user was told their plan was the
 * "Mediterranean Diet" and a vegetarian could be matched to a diet whose meals
 * were grilled fish. One definition, three readers.
 *
 * ── NAME-BASED, AND HONEST ABOUT IT ─────────────────────────────────────────
 * The catalog carries no ingredient lists, only names ("Efo Riro (no meat/fish)
 * + Small Swallow"), so restriction checks read the name. That catches what the
 * name says and cannot catch what it doesn't — which is why the scorer ALSO
 * steers restricted users to the diet authored for them (the vegetarian plan's
 * meals were written vegetarian), and this is the safety net underneath that.
 */
import type { MealCuisine } from "../../constants/DietDatabase";
import type { CuisinePreference, DietaryRestriction } from "../../models/user";

// ============================================================================
// CUISINE
// ============================================================================

/** What a catalog meal is tagged, or inferred: untagged Nigerian dishes carry only `isNigerian`. */
export function mealCuisine(meal: { cuisine?: MealCuisine; isNigerian?: boolean }): MealCuisine {
  return meal.cuisine ?? (meal.isNigerian ? "Nigerian" : "Universal");
}

/** The catalog cuisine a preference asks for. `mixed` asks for none in particular. */
export const PREFERENCE_CUISINE: Record<Exclude<CuisinePreference, "mixed">, MealCuisine> = {
  african: "Nigerian",
  asian: "Asian",
  western: "Western",
  mediterranean: "Mediterranean",
};

/**
 * How a kitchen reads on a label. The West-African kitchen is stored as
 * "Nigerian" — the name it had before it held Ghanaian and Senegalese dishes —
 * so a chip that says so would mislabel waakye and thieboudienne.
 */
export function cuisineLabel(cuisine: MealCuisine): string {
  return cuisine === "Nigerian" ? "West African" : cuisine;
}

/** The cuisine a preference asks for, or null for "a bit of everything". */
export function preferredCuisine(pref: CuisinePreference | undefined): MealCuisine | null {
  return pref && pref !== "mixed" ? PREFERENCE_CUISINE[pref] : null;
}

/** How a preference reads in a sentence: "African dishes", "Mediterranean dishes". */
export function cuisineWord(pref: CuisinePreference | undefined): string {
  switch (pref) {
    case "african":
      return "African";
    case "asian":
      return "Asian";
    case "western":
      return "Western";
    case "mediterranean":
      return "Mediterranean";
    default:
      return "global";
  }
}

/** Does this meal belong to what the user asked for? Everything does under `mixed`. */
export function servesPreference(
  meal: { cuisine?: MealCuisine; isNigerian?: boolean },
  pref: CuisinePreference | undefined,
): boolean {
  const want = preferredCuisine(pref);
  return want === null || mealCuisine(meal) === want;
}

/**
 * Diets whose NAME is a cuisine. Everything else in the catalog is named for
 * what it does (low-carb, DASH, high-protein), which reads fine over any
 * kitchen — but "Mediterranean Diet" at the top of an African user's plan reads
 * as "we ignored you", whatever dishes it actually serves.
 */
export const CUISINE_NAMED_DIETS: Record<string, MealCuisine> = {
  mediterranean: "Mediterranean",
  "traditional-african": "Nigerian",
  "traditional-asian": "Asian",
};

/**
 * Kitchens close enough that one reads as a variation of the other — the same
 * neighbours the day generator falls back to (DietPlanGenerator.cuisineTiers).
 * "Mediterranean Diet" is a fair headline for someone who chose Western food;
 * it is not one for someone who chose African food.
 */
const NEIGHBOUR_CUISINES: Record<MealCuisine, MealCuisine[]> = {
  Nigerian: [],
  Asian: [],
  Western: ["Mediterranean"],
  Mediterranean: ["Western"],
  Universal: [],
};

/** True when a diet's name contradicts the cuisine the user chose. */
export function dietNameContradicts(dietId: string, pref: CuisinePreference | undefined): boolean {
  const named = CUISINE_NAMED_DIETS[dietId];
  const want = preferredCuisine(pref);
  if (named === undefined || want === null || named === want) return false;
  return !NEIGHBOUR_CUISINES[want].includes(named);
}

/** The catalog diet that IS a cuisine's own tradition, if it has one. */
export function signatureDietFor(pref: CuisinePreference | undefined): string | null {
  const want = preferredCuisine(pref);
  if (!want) return null;
  const hit = Object.entries(CUISINE_NAMED_DIETS).find(([, c]) => c === want);
  return hit ? hit[0] : null;
}

/**
 * Ordered cuisine tiers for a preference. A planner tries each tier in turn and
 * uses the first that holds enough dishes, so a preference NARROWS the pool when
 * it can but never starves a slot. `null` = no preference ("a bit of everything").
 * The second tier is the kitchen plus its neighbours (NEIGHBOUR_CUISINES) and the
 * cuisine-neutral staples.
 */
export function cuisineTiers(pref: CuisinePreference | undefined): MealCuisine[][] | null {
  const want = preferredCuisine(pref);
  if (!want) return null;
  return [[want], [want, ...NEIGHBOUR_CUISINES[want], "Universal"]];
}

// ============================================================================
// DIETARY RESTRICTION
// ============================================================================

/*
 * Keyword families, matched on WORD boundaries so "eggplant" is not an egg and
 * "butternut" is not butter. Phrases that merely contain a trigger word but are
 * something else ("garden egg" is an aubergine, "peanut butter" has no dairy)
 * are neutralised before matching — see EXEMPT.
 */
const MEAT = [
  "beef", "steak", "lamb", "mutton", "goat", "pork", "bacon", "ham", "sausage", "suya",
  "chicken", "turkey", "duck", "liver", "kidney", "meat", "meats", "gizzard", "shawarma",
  "kebab", "prosciutto", "salami", "chorizo", "pepperoni", "veal", "oxtail", "burger",
  "meatball", "meatballs", "bolognese", "pancetta", "gyro", "souvlaki", "kofta",
  // The Asian kitchen's meat words that don't say "meat".
  "lechon", "chashu", "char siu", "bulgogi", "tonkatsu", "galbi", "kalbi", "keema",
  "tocino", "longganisa",
];
const FISH = [
  "fish", "salmon", "tuna", "mackerel", "sardine", "sardines", "tilapia", "catfish", "cod",
  "haddock", "trout", "anchovy", "anchovies", "shrimp", "shrimps", "prawn", "prawns",
  "crayfish", "seafood", "crab", "lobster", "mussel", "mussels", "clam", "clams",
  "oyster", "oysters", "calamari", "squid", "octopus", "periwinkle", "stockfish",
  "herring", "sea bass", "seabass", "bream", "hake", "scallop", "scallops",
  // Fish that hides in a broth or a condiment: dashi and bonito (Japanese stock),
  // nam pla and patis (Thai and Filipino fish sauce), bagoong and belacan (fish
  // or shrimp pastes), ikan bilis (dried anchovies).
  "dashi", "bonito", "katsuobushi", "eel", "unagi", "nam pla", "patis", "bagoong",
  "belacan", "ikan bilis",
];
const SHELLFISH = [
  "shrimp", "shrimps", "prawn", "prawns", "crayfish", "crab", "lobster", "mussel",
  "mussels", "clam", "clams", "oyster", "oysters", "periwinkle", "scallop", "scallops",
  "calamari", "squid", "octopus", "seafood", "bagoong", "belacan",
];
const PORK = [
  "pork", "bacon", "ham", "prosciutto", "salami", "chorizo", "pepperoni", "pancetta", "lard",
  "lechon", "chashu", "char siu", "tonkatsu", "tocino", "longganisa",
];
const DAIRY = [
  "milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "whey", "ghee", "paneer",
  "feta", "parmesan", "mozzarella", "ricotta", "halloumi", "labneh", "kefir", "tzatziki",
  "custard", "latte", "cheesecake", "gouda", "cheddar", "brie", "burrata", "skyr",
  // South Asian dairy that doesn't say "milk": lassi, raita, dahi and curd
  // (yoghurt), malai (cream), makhani (butter gravy), kheer (milk pudding).
  "lassi", "raita", "dahi", "curd", "malai", "makhani", "kheer", "nono",
];
const EGG = ["egg", "eggs", "omelet", "omelette", "frittata", "shakshuka", "quiche", "tamagoyaki", "tamago"];
const HONEY = ["honey"];
// Mirin, sake and Shaoxing wine are how alcohol reaches a teriyaki or a glaze.
const ALCOHOL = ["wine", "beer", "rum", "brandy", "sherry", "vodka", "liqueur", "mirin", "sake", "shaoxing", "soju"];
const GLUTEN = [
  "bread", "toast", "pasta", "spaghetti", "noodle", "noodles", "couscous", "bulgur",
  "barley", "rye", "wheat", "semolina", "semovita", "flour", "cracker", "crackers",
  "bagel", "croissant", "pita", "wrap", "tortilla", "pizza", "biscuit", "biscuits",
  "seitan", "farro", "freekeh", "pancake", "pancakes", "waffle", "waffles", "muffin",
  "sandwich", "bun", "breadcrumbs", "lasagne", "lasagna", "gnocchi", "orzo", "penne",
  "fusilli", "ravioli", "tagliatelle", "linguine", "sourdough", "baguette", "ciabatta",
  "focaccia", "brioche", "granola", "crumble",
  // Soy sauce is brewed with wheat (tamari is the gluten-free one), and so are
  // the sauces built on it; the rest are wheat breads, noodles and wrappers.
  "soy sauce", "teriyaki", "gochujang", "doubanjiang", "udon", "ramen", "soba",
  "dumpling", "dumplings", "gyoza", "wonton", "wontons", "bao", "naan", "chapati",
  "chapatis", "roti", "rotis", "paratha", "puri", "samosa", "samosas", "tempura", "panko",
];

/**
 * Phrases that contain a trigger word but are not the thing. Each is replaced
 * with a neutral token BEFORE matching (no regex lookbehind — Hermes support
 * for it has varied across React Native versions).
 */
const EXEMPT: RegExp[] = [
  /garden eggs?/g, // the African aubergine
  /egg ?plants?/g,
  /(peanut|almond|nut|cashew|cocoa|shea|seed|sunflower) butter/g,
  /(soy|soya|almond|oat|coconut|rice|cashew|plant) (milk|yogh?urt|cream)/g,
  /buckwheat/g, // a seed, not wheat
  /butter ?beans?/g, // lima beans
  // Gluten-free noodles and flours that would otherwise read as wheat.
  /(rice|glass|shirataki)[ -]noodles?/g,
  /(gram|chickpea|besan|rice|cassava|plantain|yam|corn|maize|millet|sorghum|teff|bambara)[ -]flour/g,
  /bean ?curd/g, // tofu, not dairy curd
  /kidney ?beans?/g, // rajma — a legume, not offal
];

/**
 * Negations the catalog writes into names: "(no meat/fish)", "fish-free", "without egg".
 *
 * A negation ends at a comma. "Okra Soup (no swallow, extra fish)" negates the
 * swallow, not the fish — reading on to the bracket used to strip ", extra fish"
 * with it and serve that soup to vegetarians.
 */
const NEGATIONS: RegExp[] = [
  /\b(no|without|free of|minus)\s+[a-z/& -]+?(?=[),+;]|$)/g,
  /\b[a-z]+-free\b/g,
];

function cleanForMatching(name: string): string {
  let s = ` ${name.toLowerCase()} `;
  for (const re of NEGATIONS) s = s.replace(re, " ");
  // "cream of wheat" must still read as wheat for the gluten check, so it is
  // rewritten to plain "wheat" rather than blanked.
  s = s.replace(/cream of wheat/g, " wheat ");
  for (const re of EXEMPT) s = s.replace(re, " · ");
  return s;
}

/** One word-bounded alternation per family, compiled once. */
function family(words: string[]): RegExp {
  return new RegExp(`\\b(${words.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b`);
}

const RE = {
  meat: family(MEAT),
  fish: family(FISH),
  shellfish: family(SHELLFISH),
  pork: family(PORK),
  dairy: family(DAIRY),
  egg: family(EGG),
  honey: family(HONEY),
  alcohol: family(ALCOHOL),
  gluten: family(GLUTEN),
} as const;

const mentions = (clean: string, re: RegExp): boolean => re.test(clean);

/**
 * Does a meal NAME break the restriction? `none` never does.
 *
 * Kosher is approximated by what a name can reveal: no pork, no shellfish, and
 * no meat served with dairy. Halal likewise: no pork, no alcohol.
 */
export function breaksRestriction(
  name: string,
  restriction: DietaryRestriction | undefined,
): boolean {
  if (!restriction || restriction === "none") return false;
  const clean = cleanForMatching(name);
  switch (restriction) {
    case "vegetarian":
      return mentions(clean, RE.meat) || mentions(clean, RE.fish);
    case "vegan":
      return (
        mentions(clean, RE.meat) ||
        mentions(clean, RE.fish) ||
        mentions(clean, RE.dairy) ||
        mentions(clean, RE.egg) ||
        mentions(clean, RE.honey)
      );
    case "pescatarian":
      return mentions(clean, RE.meat);
    case "halal":
      return mentions(clean, RE.pork) || mentions(clean, RE.alcohol);
    case "kosher":
      return (
        mentions(clean, RE.pork) ||
        mentions(clean, RE.shellfish) ||
        (mentions(clean, RE.meat) && mentions(clean, RE.dairy))
      );
    case "gluten_free":
      return mentions(clean, RE.gluten);
    case "dairy_free":
      return mentions(clean, RE.dairy);
    default:
      return false;
  }
}

/** A plain-language name for a restriction, for reasons and warnings. */
export function restrictionWord(restriction: DietaryRestriction): string {
  switch (restriction) {
    case "gluten_free":
      return "gluten-free";
    case "dairy_free":
      return "dairy-free";
    default:
      return restriction;
  }
}

// ============================================================================
// ALLERGIES & DISLIKES
// ============================================================================

/**
 * Allergies are matched as SUBSTRINGS (see hasAllergen), and these short words
 * hide inside longer ones: "eel" in "steel-cut oats", "lassi" in "classic",
 * "patis" in "patisserie". Anchored to a leading space, they still catch "Grilled
 * Eel" and "Mango Lassi" without striking oats off an allergy plan.
 */
const SUBSTRING_TRAPS = new Set(["eel", "patis", "lassi", "curd", "dahi", "nono", "malai"]);
const forAllergy = (words: string[]): string[] =>
  words.map((w) => (SUBSTRING_TRAPS.has(w) ? ` ${w}` : w));

/** Allergy tokens the user can pick, expanded to the words a meal name would use. */
const ALLERGY_WORDS: Record<string, string[]> = {
  // Satay sauce and kuli-kuli are groundnut by another name.
  peanuts: ["peanut", "peanuts", "groundnut", "groundnuts", "peanut butter", "satay", "kuli"],
  tree_nuts: ["almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "hazelnut", "pecan", "pistachio", "pistachios", "nuts"],
  dairy: forAllergy(DAIRY),
  eggs: EGG,
  shellfish: SHELLFISH,
  fish: forAllergy(FISH.filter((w) => !SHELLFISH.includes(w))),
  wheat: [
    "wheat", "bread", "toast", "pasta", "couscous", "semolina", "semovita", "flour",
    "chapati", "naan", "paratha", "udon", "ramen", "soba", "dumpling", "soy sauce",
    // Matched as substrings, so the short ones carry their spaces: "roti" alone
    // is inside "protein", and "bao" inside "baobab".
    " roti", " bao ",
  ],
  soy: ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "natto"],
  gluten: GLUTEN,
};

/**
 * Does a meal name contain something the user is allergic to? Known allergy
 * tokens expand to their family ("peanuts" catches "groundnut"); anything the
 * user typed themselves is matched as written.
 *
 * Exemptions are NOT applied here: for an allergy a false alarm costs one dish,
 * a miss costs far more.
 */
export function hasAllergen(name: string, allergies: string[] | undefined): boolean {
  if (!allergies || allergies.length === 0) return false;
  const lower = ` ${name.toLowerCase()} `;
  return allergies.some((raw) => {
    const token = raw.trim().toLowerCase();
    if (!token) return false;
    const words = ALLERGY_WORDS[token] ?? ALLERGY_WORDS[token.replace(/\s+/g, "_")] ?? [token];
    return words.some((w) => lower.includes(w));
  });
}

/**
 * Dislike families → the words a meal name would use. A stored dislike like
 * "dairy" (Adaptive Nutrition's detector writes these) excludes "Cheese Omelet"
 * and "Greek Yogurt Bowl", not just meals literally named "dairy".
 */
const DISLIKE_WORDS: Record<string, string[]> = {
  dairy: ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "dairy"],
  egg: ["egg", "omelet", "omelette", "frittata"],
  eggs: ["egg", "omelet", "omelette", "frittata"],
  fish: ["fish", "salmon", "tuna", "mackerel", "sardine", "shrimp", "prawn", "seafood", "tilapia", "catfish"],
  "red-meat": ["beef", "steak", "lamb", "mutton", "goat", "pork", "bacon"],
  poultry: ["chicken", "turkey"],
  legume: ["bean", "lentil", "chickpea", "moimoi", "moi-moi", "akara", "hummus"],
};

/** Does a meal name touch something the user said they don't eat? */
export function hasDislike(name: string, dislikes: string[] | undefined): boolean {
  if (!dislikes || dislikes.length === 0) return false;
  const lower = name.toLowerCase();
  return dislikes.some((raw) => {
    const token = raw.trim().toLowerCase();
    if (!token) return false;
    return (DISLIKE_WORDS[token] ?? [token]).some((w) => lower.includes(w));
  });
}

// ============================================================================
// DISHES — a dish, not a portion
// ============================================================================

/*
 * The catalog authors the same dish several times at different portions and
 * preparations — "Akara (small) + Pap", "Akara (moderate portion) + Pap",
 * "Akara + Pap". To a person choosing breakfast those are ONE dish; the portion
 * is ours to size. Parenthetical notes are the portion/preparation, so the dish
 * is the name without them, with "&"/"and"/"+" treated as the same joiner.
 */

/** The dish a named meal is a portion of, as a stable comparison key. */
export function dishKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*(\+|&|\band\b|\bwith\b)\s*/g, " + ")
    .replace(/[^a-z0-9+ -]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\+\s*/g, " + ")
    .trim();
}

/** The dish's display name: the meal name with its portion notes removed. */
export function dishTitle(name: string): string {
  const title = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([+,&])/g, " $1")
    .trim();
  return title || name.trim();
}
