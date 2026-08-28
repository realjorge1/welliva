# Server work — what the backend still owes the paid tiers

The client half of items 1, 2, 5–10 is shipped in this repo. This document is the
other half: four changes in the standalone `back-for-welliva` service, written as
contracts rather than prose, so they can be implemented without re-deriving what
the app expects.

Nothing here is optional if money is going to change hands. Client gating shapes
the experience; only the server protects the spend.

---

## 1. `POST /v1/log/photo` — meal photo → food names

**Status: not deployed. The app already calls it.**

The camera path is live in [app/diet/log-food.tsx](../../app/diet/log-food.tsx)
and degrades honestly when this 404s ("Couldn't read that photo just now.
Describe the meal below"). It is the last thing standing between the storefront's
photo-logging claim and it being true.

### Request

```jsonc
POST /v1/log/photo
Authorization: Bearer <supabase access token>
{
  "imageBase64": "…",        // raw base64, no data: prefix, quality 0.6 JPEG
  "mimeType": "image/jpeg",
  "region": "Nigeria"        // optional; the user's UserBio.region
}
```

### Response

```jsonc
{
  "items": [
    { "quantity": 2, "unit": "slices", "food": "white bread" },
    { "quantity": 1, "unit": "",       "food": "boiled egg" }
  ],
  "slot": "breakfast",       // optional: breakfast | lunch | dinner | snack
  "note": "Looks like a large portion",  // optional, one line
  "model": "claude-haiku-…"
}
```

### THE RULE THAT MATTERS

**This endpoint must never return calories, protein, carbs, fat, or any other
nutrition figure.** It identifies and portions; the device resolves the numbers
from USDA FoodData Central and the FAO West African tables, exactly as it does
for typed food.

This is not a style preference. A vision model's calorie estimate is
indistinguishable from a measured one once it has been summed into a daily
total, and the whole nutrition stack — the confidence rungs, the `ai-estimated`
tag, the "we'd rather say we don't know than make numbers up" promise on the log
screen — exists to make that distinction survivable. An endpoint that returns
numbers would route straight past all of it.

The client enforces this structurally: `MealPhotoResponse` has no numeric fields,
so extra keys are dropped on arrival. See
[services/api/WellivaApi.ts](../../services/api/WellivaApi.ts) and
[services/nutrition/MealPhotoCapture.ts](../../services/nutrition/MealPhotoCapture.ts).

### Notes

- Prompt for **plain, resolvable food names** ("jollof rice", not "a delicious
  West African rice dish"). The name is matched against the local catalogs, so
  florid output silently becomes an unmatched item.
- `unit` may be empty — the client renders `"1 boiled egg"` rather than
  `"1 serving of boiled egg"`.
- Return `{"items": []}` rather than an error when there is no food in frame.
  The client shows "couldn't make out any food" and does **not** spend a scan.
- Timeout budget is 25s client-side.

---

## 2. Enforce the tiers server-side

**Status: not implemented. This is the only thing that actually protects revenue.**

Today the coach cap lives in `AsyncStorage` on the phone
([services/billing/usage.ts](../../services/billing/usage.ts)). A reinstall
resets it and a modified client ignores it entirely.

### The webhook

1. **RevenueCat → Integrations → Webhooks** → `POST /v1/billing/webhook`, with
   the Authorization header value RevenueCat generates.
2. Verify that header. Read `app_user_id` — it is the Supabase user id, because
   the app configures the SDK with it (`configureBilling`).
3. Write `tier` (`free` | `plus` | `pro`) and `tier_expires_at` onto that user's
   profile row.

### The gate

The existing `/v1` JWT middleware reads that column and enforces:

| Path | Rule |
|---|---|
| `/v1/coach/turn`, `/v1/coach/chat` | daily cap by tier — **3 / 25 / 100** |
| `/v1/log/photo` | daily cap by tier — **0 / 5 / 30** |
| `/v1/diet/generate`, `/v1/workout/generate` | **`pro` only** (the `ai-plans` feature) |

Mirror the numbers from
[services/billing/tiers.ts](../../services/billing/tiers.ts) — that file is the
source of truth and the storefront's comparison table is generated from it, so a
server that disagrees makes the app a liar in whichever direction it drifts.

Return **402** past the cap with a JSON body; the client already degrades to its
deterministic on-device engines on any non-2xx.

### Two safeguards

- **Fail open on webhook lag.** A delayed webhook must brief­ly over-grant rather
  than lock out someone who just paid.
- **Keep the fair-use ceiling.** Pro's 100/day exists so a scripted abuser cannot
  run unbounded Haiku spend on one subscription. A real user never sees it.

### The insight trial — `POST /v1/billing/trial/claim`

**The client already calls this.** [trial.ts](../../services/billing/trial.ts)
asks the server to open the window and falls back to a local grant on any
failure, including the 404 it gets today. So this can ship independently of the
webhook, and the app needs no release when it does.

**Ship it in the same change as the tier gate above.** If the gate lands first, a
trialling free user gets Pro in the app and a 402 at 3 coach turns from the
server — the exact mismatch this endpoint exists to prevent.

```jsonc
POST /v1/billing/trial/claim
Authorization: Bearer <supabase access token>
{}

→ 200
{
  "expiresAt":      "2026-08-21T10:00:00Z",  // the window YOU will enforce
  "claimedAt":      "2026-08-19T10:00:00Z",
  "alreadyClaimed": false                     // true on every call after the first
}
```

Two profile columns: `trial_claimed_at`, `trial_expires_at`.

- `trial_claimed_at` null → set it to now, `trial_expires_at` to now + 48h,
  return `alreadyClaimed: false`.
- Otherwise → return the stored window unchanged with `alreadyClaimed: true`,
  **including when it has already expired.** That is the anti-farming property:
  a reinstall asks again, is told "claimed, and it ended on Tuesday", records
  that, and grants nothing. Do not 4xx this case — the client needs the window
  in order to honour it.

Then fold it into tier resolution:

```
effective_tier = max(billed_tier, now < trial_expires_at ? 'pro' : 'free')
```

That one line is what makes the app and the backend agree.

**Diagnosing the fallback:** `trialSource()` returns `"local"` when the window
was granted on-device because the endpoint could not be reached. If anyone
reports "it says Pro but the coach stopped answering", check that first.

⚠️ **Cost note:** a 48-hour Pro window is a worst case of ~200 Haiku turns given
away per user who reaches their first insight. If that bites, cap coach turns
during the trial rather than shortening the window — the window is what makes the
feature legible; the turns are what cost money.

---

## 3. Stop re-sending the user's background on every message

**Status: not implemented. Roughly halves cost per coach answer.**

Every turn of `/v1/coach/turn` currently ships the user's full context block. It
is identical between consecutive turns of the same conversation, and it is the
bulk of the input tokens.

Two changes, either of which pays for itself:

1. **Prompt caching.** Put the system prompt and the user-context block in a
   cached prefix and mark it with a cache breakpoint. Consecutive turns inside
   the TTL then re-read it at a fraction of input cost. This is the cheap one and
   requires no client change.
2. **Send the context block only when it changed.** The client holds a stable
   context; have it send a hash and let the server ask for the full block only on
   a miss. This needs a client change — say the word and it's a small one.

Halving cost per answer is what makes the caps in §2 affordable at their current
generosity, so this is worth doing *before* deciding any cap is too expensive.

---

## 4. Go-live blockers outside this repo

- **RevenueCat keys are empty in all three EAS profiles**
  ([eas.json](../../eas.json)). Until they are filled, `isBillingConfigured` is
  false, every buy button is inert, and gating fails open — **nobody can pay**.
  The console runbook is [setup.md](./setup.md); it is mostly clicking, plus one
  EAS build.
- **The whole diet catalog is now free.** Every diet — the 13 Condition mode
  protocols and the 5 specialist and regional plans included — and every
  recommendation built on one is available on Free, Plus and Pro. Nothing
  server-side depends on this, but any store listing or marketing copy that
  sells diets as a paid feature ("6 free diets", "22 clinical diets with Plus")
  is now wrong. What Plus sells is depth over the user's own data; what Pro
  sells is generated intelligence.
- **Play/App Store product prices must be changed to match the new list prices**
  (Pro is now **$6.99 / $58.99**, up from $3.50 / $35 — see
  [services/billing/pricing.ts](../../services/billing/pricing.ts)). The store is
  the authority on price at runtime; these constants are only shown where no
  offering can load.
- **A native rebuild is required** for the camera path — `app.json` now declares
  `cameraPermission` on the `expo-image-picker` plugin.
- **Two legal placeholders are unfilled** and are failing
  `constants/__tests__/legal.test.ts` right now: `LEGAL_POSTAL_ADDRESS` and
  `LEGAL_JURISDICTION` in [constants/legal.ts](../../constants/legal.ts). Both
  render verbatim in the privacy policy, terms and disclaimer, and both will fail
  store review.
