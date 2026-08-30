# Welliva

A nutrition, training and habit app built around one rule: **a model may parse, but never number.**

Every calorie, gram and milligram Welliva shows you came from a food composition
table — USDA FoodData Central, the FAO's West African tables, or a
manufacturer's printed label — and carries that source with it for the rest of
its life. The AI coach can read your log, name a food, plan your week and argue
with you about your training. It is architecturally incapable of inventing a
number, and the app has nowhere to put one if it tried.

That is the whole product. Everything below is in service of it.

---

## The three doctrines

Read these before changing anything in `services/nutrition/`,
`services/gozlin/` or `models/nutrients.ts`. They are enforced by tests, and the
tests are the point.

**1. A model may parse, but never number.**
The vision endpoint (`/v1/log/photo`) and the text parser (`/v1/nutrition/parse`)
are contractually forbidden from returning nutrition figures. A photo log is
turned into the same free-text line you would have typed and run through the same
resolver — so there is physically nowhere for an invented macro to enter a daily
total. `NutrientResolver` is the only thing allowed to say what a food contains.
Pinned by `services/api/__tests__/contracts.test.ts`.

**2. Grounding, then receipts.**
Every number in a coach reply is checked against the evidence that produced it
(2% relative / 1 absolute tolerance; integers ≤ 10 ignored). A mismatch
regenerates once, then falls back to a deterministic reply. `receipts.ts` keeps
the provenance grounding would otherwise discard, so tapping a figure in the chat
shows which tool read it, from which field, and the raw value before rounding.
`/diet/receipts` does the same for your whole day.

**3. Two clinical gates, both offline.**
`screenForClinicalRisk()` runs *before* the model — emergency, symptom,
diagnosis, medication, self-harm, disordered eating. `outputSafety.ts` runs
*after* it — restriction, compensation-framing, diagnosis, body comment. Neither
is a prompt. Prompts reduce a rate; they do not floor it.

---

## What's in the box

| | |
|---|---|
| Clinical diets | **122** across 11 categories — renal, hepatic, oncology recovery, elimination protocols, life-stage nutrition, with per-condition hard constraints injected into the coach's context |
| Whole-food catalog | **205** curated entries, 9 groups, with USDA/WAFCT provenance per entry |
| Packaged foods | Barcode scan → Open Food Facts, keyless and free |
| Nutrients tracked | **32**, not just the four macros |
| Exercises | **141**, with a guided session player and a Skia-drawn demo figure |
| Achievements | 69 across 6 categories, all data-derived |
| Routes | 40 |
| Tests | 86 files, ~1,600 assertions |
| Database | 12 Postgres tables, RLS on all of them, 13 policies, 8 migrations |

Plus: habit tracking with weekly-quota streaks, an adaptive TDEE estimator (a
two-state Kalman filter that models adaptive thermogenesis), a monthly recap, a
consistency league, an event-sourced personal health OS, and a learning loop that
refits your plan from what actually happened.

**It works with no backend, no API key and no signal.** Catalogs resolve
cache → network → bundled seed, and every AI path degrades to a deterministic
on-device engine. This is a guarantee, not a fallback.

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in the Supabase URL + anon key
npx expo start
```

The app runs with **only** the two Supabase variables set. Everything else in
`.env.example` is optional and named for what it unlocks:

| Variable | Unlocks | Without it |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Accounts, cloud sync | Required |
| `EXPO_PUBLIC_API_URL` | Gozlin chat, AI plan generation, photo logging, USDA lookup | On-device deterministic engines |
| `EXPO_PUBLIC_REVENUECAT_*` | Subscriptions | Everyone is on the free tier |
| `EXPO_PUBLIC_EXERCISEDB_*` | Exercise demo GIFs | Renders identically without media |

The anon key is safe to commit — Row-Level Security is what protects the data,
not the key. Nothing else belongs in this file: the Anthropic key and the
RevenueCat secret key live only on the backend.

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm test             # vitest run
```

`npm test` currently fails 3 assertions **by design** — see [Known
gaps](#known-gaps).

---

## Architecture

```
app/                 Expo Router screens (40 routes; (tabs)/ behind a swipe drawer)
components/          UI library (components/ui) + per-feature component sets
contexts/            App state, split by domain into contexts/domain/*
models/              Pure domain types — nutrients, diet, workout, user
constants/           Diets, foods, exercises, nutrients, theme, legal documents
services/            The working layer:
  ├ nutrition/       Resolver, food log, intake ladder, lookup, Open Food Facts
  ├ gozlin/          The AI coach: agent loop, tools, grounding, receipts, safety
  ├ api/             Typed /v1 client + the contract it holds the backend to
  ├ billing/         Tier gates (FEATURE_MIN_TIER), quotas, trial
  └ sync/            Offline-first Supabase sync
health-os/           Event-sourced Personal Health OS — timeline, memory,
                     life context, anticipation, signals (calendar/weather/wearable)
fitness/             Workout library, recommendation engine, session beats
supabase/migrations/ Schema + RLS, idempotent
docs/                Architecture (00–12), companion blueprint, gozlin, legal
```

### The AI backend is a separate repository

`/backend-welliva` holds the Anthropic key and runs everything on **Claude
Haiku**. This app only knows its URL. Every `/v1` endpoint requires the signed-in
user's Supabase access token, and every caller here catches failure and falls back
to an on-device engine.

Because that repo is not in this tree, `services/api/contracts.ts` pins what the
app is entitled to assume — response shapes, the auth requirement, the route
table, and the parse-only rule — and
`services/api/__tests__/contracts.test.ts` fails if either side drifts.

### The lookup ladder

Finding a food is deliberately ordered so the cheapest, most trustworthy answer
wins:

**By name** — bundled catalog + your own foods → USDA FoodData Central →
a model estimate, labelled `ai-estimated` forever → "we couldn't find it".
The remote rungs run *only* on a total local miss.

**By barcode** — your own scanned foods → Open Food Facts → offer manual entry.
Called directly rather than proxied: Open Food Facts needs no key, and this is
the one lookup that has to work in a supermarket aisle on one bar of signal.

A scanned product resolves to a `branded` source — a manufacturer's declared
label. That is a real measurement and ranks above an AI estimate, but it is
transcribed by volunteers, so `services/nutrition/OpenFoodFacts.ts` runs a
plausibility gate first: 100 g of food cannot hold 400 g of fat, and a value that
fails physics is dropped rather than clamped.

### Privacy

Per-category consent gates, a user-facing Trust screen (`/privacy`), local-only
wearable reads where only the derived recovery score is surfaced, and real
server-side erasure through a `delete_account` RPC. `.env` is gitignored. No
analytics SDK.

---

## Known gaps

Named here rather than discovered later.

**The two legal entity constants are unfilled, and CI is red because of it.**
`LEGAL_POSTAL_ADDRESS` and `LEGAL_JURISDICTION` in `constants/legal.ts` still
hold placeholder text, and `constants/__tests__/legal.test.ts` fails on purpose
until they are real — they are interpolated verbatim into the privacy policy and
terms that users must accept. **The gate is correct and must not be relaxed.**
See [`docs/legal/store-submission.md`](docs/legal/store-submission.md).

**Apple Health / Health Connect is written but not installed.**
The adapters, the sleep-overlap merging, the HRV baselines and the platform
selector all exist and are tested; neither native package is a dependency yet, so
both providers report `unavailable` and the app behaves exactly as before. The
cutover is two installs and a build:
[`docs/companion/health-native-cutover.md`](docs/companion/health-native-cutover.md).

**No social layer, and no barbell logging.** Both are deliberate — the first
conflicts with the privacy posture, the second with a session player built around
time as the unit of work. Both are real competitive costs.

**Accessibility coverage is partial.** 73 of the 171 `.tsx` files under `app/`
and `components/` declare an `accessibilityRole`. Screen-reader labels are good on
the primitives and thin on the feature screens. See
[`docs/accessibility.md`](docs/accessibility.md).

---

## Contributing

The comments in this codebase explain *why*, not *what*. Match that. A change
that removes a constraint should explain what made the constraint unnecessary —
most of them are load-bearing, and several are the only thing standing between a
user and a number nobody measured.

Before opening a PR:

```bash
npm run typecheck && npm run lint && npm test
```

Three legal-gate failures are expected until the entity constants are filled.
Anything else red is yours.

## Further reading

- [`docs/AUDIT_2026-08-30.md`](docs/AUDIT_2026-08-30.md) — full audit and competitive analysis
- [`docs/architecture/`](docs/architecture/) — the health OS, 00–12
- [`docs/gozlin/`](docs/gozlin/) — the coach: agent loop, tools, safety
- [`docs/companion/00-proactive-companion-blueprint.md`](docs/companion/00-proactive-companion-blueprint.md) — anticipation, signals, modes
- [`docs/monetization/`](docs/monetization/) — tiers and the storefront
- [`docs/legal/store-submission.md`](docs/legal/store-submission.md) — what's required before submitting
