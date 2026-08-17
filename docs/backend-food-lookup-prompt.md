# Task: build `POST /v1/nutrition/lookup`

You are working in **`backend-welliva`**, the standalone server that holds the
Anthropic key and runs all AI for the Welliva mobile app.

The mobile app side of this feature is **already built, tested and merged**. It
calls an endpoint that does not exist yet. Your job is to build that endpoint so
it matches the contract below exactly. Nothing in the app needs to change.

---

## 1. What this feature is

Welliva ships a catalog of 205 whole foods plus a reference table of 44 measured
entries. That covers staples well and the rest of the world badly. A user
searching **"abacha"**, **"chin chin"**, or a specific branded cereal currently
gets nothing.

This endpoint is what the app calls when a food is missing. It answers the
question *"what is this food, and what's in it?"* — and it must answer honestly
about how confident it is.

**It is a free feature. Do not put it behind any paid tier.**

---

## 2. The rule you must not break

Welliva's nutrition layer has a documented, non-negotiable rule. From
`models/nutrients.ts` in the app:

> A number in a NutrientPanel must trace back to a measured source. Nothing here
> is ever produced by a language model. Gozlin may decide WHAT you ate; only
> NutrientResolver may say what that CONTAINS.

That rule is why your existing `/v1/nutrition/parse` endpoint returns only
`{quantity, unit, food}` and is schema-forbidden from returning nutrition.

**This endpoint is a deliberate, bounded exception**, and it is only acceptable
because of how it's bounded:

1. **A measured source is always tried first.** USDA FoodData Central. If USDA
   has the food, the model is never asked.
2. **A model estimate is never dressed as a measurement.** It comes back tagged
   `origin: "ai-estimate"`, and the app carries that tag on its weakest
   confidence rung — visibly labelled "AI estimate" on the food, on the day's
   totals, and in the end-of-period report, forever.
3. **You must never report `origin: "usda"` for a figure a model produced.**
   This is the single most important line in this document. The app's sanitizer
   treats any unrecognised origin as an estimate and requires a numeric `fdcId`
   before it will accept `usda` — so a mistake here fails safe — but do not rely
   on that. Get it right at the source.

---

## 3. The contract

### Request

```
POST /v1/nutrition/lookup
Authorization: Bearer <supabase access token>
Content-Type: application/json
```

```jsonc
{
  "query": "abacha",        // required, the user's raw search text
  "region": "Nigeria"       // optional, free text from the user's profile
}
```

Same auth gate and per-user rate limiting as every other `/v1` route. `region`
is a strong hint — "swallow", "pap" and "dodo" mean specific things to a Nigerian
user and something else or nothing at all otherwise.

### Response — 200

```jsonc
{
  "results": [
    {
      "name": "Abacha (African salad)",     // required, non-empty
      "serving": "1 cup",                    // required, human household measure
      "servingGrams": 180,                   // required, number or null
      "group": "Grains & Starches",          // required, see §4
      "nutrients": {                         // required, PER SERVING
        "calories": 310,
        "protein": 6.2,
        "carbs": 41,
        "fat": 13,
        "fiber": 4.1,
        "sodium": 380
      },
      "per100g": { "calories": 172 },        // optional but preferred
      "origin": "ai-estimate",               // required: "usda" | "ai-estimate"
      "fdcId": 169967,                       // REQUIRED iff origin === "usda"
      "dataset": "SR Legacy",                // iff usda: SR Legacy|Foundation|FNDDS|Branded
      "description": "typical home recipe, cassava + palm oil",
      "model": "claude-haiku-4-5",           // REQUIRED iff origin === "ai-estimate"
      "isRegional": true                     // optional, drives the app's "NG" tag
    }
  ],
  "resolvedBy": "ai-estimate"                // "usda" | "ai-estimate" | "none"
}
```

**Return at most 8 results.** The app truncates beyond that anyway, and a long
list turns a decision into a chore.

**Zero results is a valid, successful response.** Return
`{ "results": [], "resolvedBy": "none" }` with a 200. The app shows "No match
anywhere" and suggests a simpler search term. Do **not** invent a food to avoid
an empty list.

### Errors

Use the same error envelope as your other routes (`{ error: { message } }`). The
app surfaces `message` verbatim in a retry state, so make it human-readable.
There is no local fallback for this endpoint — the whole point is that the app
doesn't have the food — so a failure is visible to the user.

---

## 4. `group` must be one of these exact strings

The app buckets its Foods screen strictly by group. Anything unrecognised is
remapped client-side to `"Your foods"`, which works but loses the categorisation.

```
Fruits
Vegetables
Proteins
Legumes & Plant Protein
Grains & Starches
Nuts, Seeds, Fats & Oils
Dairy & Alternatives
Herbs, Aromatics & Seasonings
Beverages
```

---

## 5. Nutrient keys and units

`nutrients` and `per100g` use the app's `NutrientKey` names. **Any key not on
this list is silently dropped by the app**, so use these exactly.

| Key | Unit | | Key | Unit |
|---|---|---|---|---|
| `calories` | kcal | | `potassium` | mg |
| `protein` | g | | `calcium` | mg |
| `fat` | g | | `iron` | mg |
| `satFat` | g | | `magnesium` | mg |
| `transFat` | g | | `zinc` | mg |
| `monoFat` | g | | `vitaminA` | mcg |
| `polyFat` | g | | `vitaminC` | mg |
| `cholesterol` | mg | | `vitaminD` | mcg |
| `carbs` | g | | `vitaminE` | mg |
| `fiber` | g | | `vitaminK` | mcg |
| `sugar` | g | | `vitaminB6` | mg |
| `addedSugar` | g | | `vitaminB12` | mcg |
| `sodium` | mg | | `folate` | mcg |
| `water` | g | | `thiamin` | mg |
| `caffeine` | mg | | `riboflavin` | mg |
| `alcohol` | g | | `niacin` | mg |

Rules:

- **Sparse is correct.** Omit a nutrient you don't know. **Never send `0` to
  mean "unknown"** — the app renders a missing key as `—` and a `0` as a real
  measured zero, and the difference is the whole honesty contract.
- `calories` is effectively required: the app discards any result without it.
- Values must be finite and non-negative. The app drops anything else.

---

## 6. The ladder — implement in this order

### Rung 1 — USDA FoodData Central

Free API, key from <https://fdc.nal.usda.gov/api-key-signup.html>. Store it as a
server env var (`FDC_API_KEY`). **It must never reach the client** — that's the
entire reason this lives on the server rather than in the app.

```
GET https://api.nal.usda.gov/fdc/v1/foods/search
    ?query=<query>&pageSize=10&api_key=<key>
    &dataType=Foundation,SR%20Legacy,Branded
```

Implementation notes:

- Prefer `Foundation` and `SR Legacy` over `Branded` when both match — they're
  general foods rather than one manufacturer's product.
- FDC returns `foodNutrients` keyed by **nutrient number or name**, per 100 g.
  Map them onto the table in §5 — this mapping is the bulk of the work. Watch
  the units: FDC gives sodium in mg and vitamin A in µg RAE, which already match,
  but confirm each one rather than assuming.
- Derive a sensible `serving` + `servingGrams` from `foodPortions` where present;
  fall back to 100 g and set `serving: "100 g"`, `servingGrams: 100`.
- Set `fdcId` from the result, and `dataset` from FDC's `dataType`.
- Cache aggressively. Keyed on the normalised query, TTL of a week or more —
  USDA's data effectively never changes and you're rate-limited (1,000
  req/hour/key by default).

**If USDA returns usable matches, return them and stop.** Do not also call the
model. `resolvedBy: "usda"`.

### Rung 2 — model estimate

Only when rung 1 found nothing usable. This is for regional dishes composition
tables genuinely don't cover: abacha, ofada stew, kunu, chin chin, moi moi
variants, and their equivalents elsewhere.

Use your existing Haiku setup. Suggested system prompt:

```
You estimate nutrition for prepared dishes that no food composition table covers.

Return ONLY a JSON array, 1-3 elements, each:
{
  "name": string,
  "serving": string,
  "servingGrams": number|null,
  "group": one of [Fruits|Vegetables|Proteins|Legumes & Plant Protein|
                   Grains & Starches|Nuts, Seeds, Fats & Oils|
                   Dairy & Alternatives|Herbs, Aromatics & Seasonings|Beverages],
  "nutrients": { calories, protein, carbs, fat, and any of
                 fiber/sugar/sodium/satFat you are reasonably confident of },
  "basis": string,      // what you reasoned from, e.g. "typical home recipe"
  "isRegional": boolean
}

Rules:
- "nutrients" describes ONE serving, in kcal and grams (sodium in mg).
- OMIT any nutrient you are not reasonably confident of. Never write 0 to mean
  "I don't know" — 0 means a measured zero.
- Base estimates on a typical home preparation, not a restaurant portion.
- If the query is not a food, or you genuinely cannot identify it, return [].
- Return the JSON array and nothing else.
```

Then, server-side:

- Set `origin: "ai-estimate"` and `model` to the real model id on **every**
  element. Never let the model set `origin` or `fdcId` itself.
- Copy `basis` into `description`.
- Drop any element without a name or without `calories`.
- `resolvedBy: "ai-estimate"`.

### Rung 3 — nothing

`{ "results": [], "resolvedBy": "none" }`, HTTP 200.

---

## 7. Validate before responding

Mirror the app's own sanitizer server-side. The app re-checks everything (last
gate before a number enters a user's daily total), but the server should not be
the thing that makes that check necessary.

- Strip any nutrient key not in §5.
- Drop non-finite or negative values.
- Reject `origin: "usda"` without a numeric `fdcId` — downgrade it to
  `ai-estimate` or drop the result. **Never upgrade in the other direction.**
- Cap `results` at 8.

---

## 8. Definition of done

- [ ] `POST /v1/nutrition/lookup` live, behind the same Supabase-JWT gate and
      per-user rate limit as the other `/v1` routes
- [ ] `FDC_API_KEY` in server env, never in any client-reachable payload
- [ ] USDA tried first; the model only runs on a USDA miss
- [ ] Every result carries a correct `origin`; `usda` always has a real `fdcId`
- [ ] Nutrient keys/units match §5; unknown nutrients omitted, never zeroed
- [ ] Empty result set returns 200 with `resolvedBy: "none"`
- [ ] USDA responses cached (≥1 week TTL, keyed on normalised query)
- [ ] Not gated behind any paid tier

### How to test it end to end

Once deployed, in the app: **Foods → search a food that isn't there** (try
"abacha", "chin chin", "pop tarts"). The empty state should offer
*Find "<query>"*. Tapping it opens a sheet that groups results under **Measured**
(green, with the USDA id shown) and **AI estimate** (amber, with the caveat).
Picking one saves it to the user's foods and opens it for logging.

Two checks worth doing deliberately:

1. Search something USDA definitely has (**"cheddar cheese"**) → must come back
   under **Measured** with a real `fdcId`, and must *not* have called the model.
2. Search a food already in the catalog (**"banana"**) → the *Find* button must
   **not appear at all**. The app never calls this endpoint for a food it
   already has; if you see a request for "banana" hit your server, something is
   wrong on the app side and I want to know.

---

## 9. Context you may want

- App-side contract: `services/api/WellivaApi.ts` → `FoodLookupResult`,
  `FoodLookupResponse`
- App-side orchestration + sanitizer: `services/nutrition/FoodLookupService.ts`
- Where results get stored: `services/nutrition/CustomFoodService.ts`
- The honesty rules you're operating inside: `models/nutrients.ts`
  (`NutrientSource`, `NutrientConfidence`, `CONFIDENCE_RANK`)
