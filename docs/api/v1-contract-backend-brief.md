# `/v1` response contract — brief for the backend repo

The Welliva app now **validates every `/v1` response at runtime** before using it
(`services/api/contracts.ts`, enforced in `services/api/WellivaApi.ts`). A payload
that doesn't match is rejected with a `ContractViolationError` and the app falls
back to its on-device engine — so a drift no longer corrupts data, but it **does
silently disable the AI feature**.

This document is the exact shape each endpoint must return. It is derived from
the guards, not from prose: if the server satisfies this, the app accepts it.

## Rules that apply to every endpoint

- **Auth**: every `/v1` route requires `Authorization: Bearer <supabase access token>`.
  There is no anonymous endpoint.
- **Error bodies** (any non-2xx) must be exactly:
  ```json
  { "error": { "message": "human readable", "code": "optional_code" } }
  ```
  A flattened `{"message": "..."}` is **not** accepted — the client falls back to
  showing a bare `API error 500`, losing every actionable message.
- **"Required" means the key must be present.** Where a value is nullable, send
  an explicit `null`; omitting the key fails validation.
- Extra keys are ignored **except** where a parse-only rule forbids them (below).

---

## 1. `POST /v1/nutrition/parse` — 12s budget

**The parse-only rule applies. This endpoint may NOT return nutrition figures.**

```json
{
  "items": [{ "quantity": 1, "unit": "cup", "food": "white rice" }],
  "model": "claude-haiku-4-5-20251001"
}
```

| Field | Requirement |
|---|---|
| `items` | array (may be empty) |
| `items[].quantity` | finite number, **required** |
| `items[].unit` | string, **required** (may be `""`) |
| `items[].food` | **non-empty** string, required |
| `model` | **non-empty** string, required |

**Forbidden anywhere inside `items`** (checked recursively, 6 levels deep). If any
of these key names appear, the whole response is rejected:

```
calories, kcal, energy, protein, proteins, proteinG, carbs, carbohydrates,
carbsG, fat, fats, fatG, fiber, sugar, sodium, nutrients, nutrition, macros
```

This is deliberate and load-bearing, not defensive coding. The model is a
**parser only**; every number in the app is resolved on-device from a cited
reference table so it can carry a verifiable provenance. A calorie figure from a
language model has no source to display, and once summed into a daily total it is
indistinguishable from a measured one. If the server starts sending them, the app
must fail loudly rather than absorb them.

## 2. `POST /v1/log/photo` — 25s budget

**Same parse-only rule.** A photo is a harder parse, not a different kind.

```json
{
  "items": [{ "quantity": 1, "unit": "bowl", "food": "jollof rice" }],
  "slot": "lunch",
  "note": "Looks like a restaurant portion.",
  "model": "claude-haiku-4-5-20251001"
}
```

| Field | Requirement |
|---|---|
| `items`, `model` | exactly as `/v1/nutrition/parse`, same forbidden-key rule |
| `slot` | optional; if present must be exactly one of `breakfast`, `lunch`, `dinner`, `snack` |
| `note` | optional; if present must be a string |

## 3. `POST /v1/nutrition/lookup` — 20s budget

**This is the one food endpoint that IS allowed to return numbers**, because its
first rung is USDA FoodData Central — a measured source with a verifiable id.

```json
{
  "results": [
    {
      "name": "Oats, rolled, dry",
      "serving": "100 g",
      "servingGrams": 100,
      "group": "Grains & Starches",
      "nutrients": { "calories": 389, "protein": 16.9 },
      "per100g": { "calories": 389 },
      "origin": "usda",
      "fdcId": 169705,
      "dataset": "SR Legacy",
      "description": "Oats, rolled, dry"
    }
  ],
  "resolvedBy": "usda"
}
```

| Field | Requirement |
|---|---|
| `results` | array (may be empty) |
| `resolvedBy` | exactly `usda`, `ai-estimate`, or `none` |
| `name` | **non-empty** string, required |
| `serving` | string, **required** (may be `""`) |
| `servingGrams` | number **or explicit `null`** — **the key must be present**. Omitting it fails. |
| `group` | string, required. Should be one of the app's display groups (below) — anything else is filed under "Your foods". |
| `nutrients` | object, **required** (may be `{}`). Keys are the app's nutrient names, values in label units (mg for minerals, mcg for vitamins A/D/K/B12/folate). |
| `per100g` | optional object |
| `origin` | exactly `usda` or `ai-estimate`, required |
| `fdcId` | **REQUIRED, finite number, whenever `origin: "usda"`.** |
| `dataset` | optional; if present must be exactly `SR Legacy`, `Foundation`, `FNDDS`, or `Branded` |
| `description`, `model`, `isRegional` | optional |

**The `fdcId` rule is the important one.** `origin: "usda"` is a claim that a food
composition laboratory measured this, and the app labels it "measured" for the
rest of that food's life. The `fdcId` is what makes that claim checkable at
fdc.nal.usda.gov. A `usda` result without one asserts an authority it cannot
produce, so it is refused outright rather than quietly downgraded — a server bug
here must be visible, not absorbed.

Never report `origin: "usda"` for a figure the model produced. Use
`origin: "ai-estimate"`; the app carries it on its weakest confidence rung and
labels it as an estimate everywhere it appears, which is honest and fine.

App display groups: `Fruits`, `Vegetables`, `Proteins`, `Legumes & Plant Protein`,
`Grains & Starches`, `Nuts, Seeds, Fats & Oils`, `Dairy & Alternatives`,
`Herbs, Aromatics & Seasonings`, `Beverages`.

## 4. `POST /v1/coach/chat` — 20s budget

```json
{ "reply": "…", "model": "claude-haiku-4-5-20251001" }
```

`reply` must be a string (may be empty). `model` must be a **non-empty** string.

## 5. `POST /v1/coach/turn` — 60s budget, NDJSON stream

One JSON object per line, `\n`-delimited. Three frame types:

```
{"type":"delta","text":"partial text"}
{"type":"done","content":[…],"stop_reason":"end_turn","model":"…","usage":{…}}
{"type":"error","message":"…"}
```

| Frame | Requirement |
|---|---|
| `delta` | `text` must be a string |
| `done` | `content` must be an **array**; `stop_reason` must be a string **or `null`** (the key must be present). `model` and `usage` optional. |
| `error` | `message` must be a string |

**`done.content` must be the FULL content array** — every block the model
returned, including `thinking` and `tool_use` blocks, not just the text. The
agent loop runs on-device and echoes that array back verbatim on its next
iteration. Sending only the text silently breaks multi-turn tool use, which
surfaces to users as "the coach forgot what it was doing" mid-task.

Malformed frames are **dropped**, not fatal — a single bad line won't kill a reply
the user is already reading. But if the `done` frame never arrives or fails
validation, the turn ends with "Coach stream ended without a result".

## 6. `POST /v1/diet/generate` — 30s budget

```json
{
  "schedule": { "...": "a DaySchedule" },
  "dailyNutritionEstimate": { "calories": 2100, "proteinG": 130, "carbsG": 230, "fatG": 70 },
  "dietName": "Balanced",
  "rationale": "…",
  "coachNote": "…",
  "model": "claude-haiku-4-5-20251001",
  "source": "ai"
}
```

| Field | Requirement |
|---|---|
| `schedule` | object, required (contents not pinned here — it's a large app-owned model) |
| `dailyNutritionEstimate` | object with **all four** of `calories`, `proteinG`, `carbsG`, `fatG` as finite numbers |
| `dietName` | **non-empty** string |
| `rationale`, `coachNote` | strings, required (may be `""`) |
| `model` | **non-empty** string |
| `source` | the literal string `"ai"` — **required** |

`source: "ai"` is pinned because the app uses it to distinguish a generated plan
from a deterministic on-device one. A plan mislabelled would be shown with an
attribution it hasn't earned.

## 7. `POST /v1/workout/generate` — 30s budget

```json
{
  "plan": { "...": "a GeneratedWorkoutPlan" },
  "rationale": "…",
  "coachNote": "…",
  "model": "claude-haiku-4-5-20251001",
  "source": "ai"
}
```

Same rules as diet: `plan` an object, `rationale`/`coachNote` strings, `model`
non-empty, `source` exactly `"ai"`.

## 8. `POST /v1/billing/trial/claim` — 8s budget

```json
{ "expiresAt": "2026-09-06T12:00:00.000Z", "claimedAt": "2026-08-30T12:00:00.000Z", "alreadyClaimed": false }
```

Both timestamps must be **strings that `Date.parse()` accepts** (ISO 8601). An
unparseable date would either grant Pro forever or revoke it instantly depending
on which way the `NaN` comparison fell. `alreadyClaimed` must be a boolean.

Return the same window with `alreadyClaimed: true` on every later call, including
after expiry — the server owns this window so the trial is once per account
rather than once per install.

---

## What to do

1. Add response-shape tests in the backend repo asserting each handler emits
   exactly the above — particularly the ones easy to get wrong: `servingGrams`
   present-and-nullable, `fdcId` mandatory under `origin: "usda"`, `source: "ai"`
   present, `model` non-empty everywhere, and the `{error:{message}}` envelope.
2. Add an assertion on `/v1/nutrition/parse` and `/v1/log/photo` that strips or
   rejects the forbidden nutrition keys **before** responding, so a prompt change
   that makes the model volunteer calories can't reach the client.
3. Confirm `/v1/coach/turn` emits the full `content` array on its `done` frame.
4. Report back any endpoint where the current implementation **cannot** meet this
   shape — the app-side guard is the thing that would need changing, and it
   should change deliberately rather than by loosening it to make a symptom go away.
