# Welliva — AI coding instructions

> **Source of truth is [`README.md`](../README.md).** This file exists to stop an
> assistant making the specific mistakes this codebase punishes. If the two ever
> disagree, the README wins.

## What this app is

A nutrition, training and habit app for React Native (Expo SDK 54, expo-router,
TypeScript strict). Supabase for accounts and sync. **The AI runs on Claude Haiku
in a separate backend repository** (`/backend-welliva`) — this app only knows its
URL. Culturally-adapted diet options for African/Nigerian users are a first-class
concern, not an afterthought.

## The rule that overrides every other consideration

**A model may parse, but never number.**

Every nutrition figure comes from a food composition table — USDA, the FAO's West
African tables, or a manufacturer's printed label — and carries its source and a
`NutrientConfidence` rung for the rest of its life. `NutrientResolver` is the only
thing allowed to say what a food contains.

Concretely, do not write code that:

- reads a calorie/macro value out of a model response and stores or displays it;
- adds nutrition fields to `/v1/nutrition/parse` or `/v1/log/photo` handling;
- promotes a value to a stronger `NutrientConfidence` than its source justifies;
- shows a figure without the provenance the surrounding UI shows for its peers.

Failing toward *less* confident is always the safe direction. Tests enforce this:
`services/api/__tests__/contracts.test.ts`,
`services/nutrition/__tests__/foodLookup.test.ts`,
`services/nutrition/__tests__/openFoodFacts.test.ts`.

## Things that were true once and are not now

Assistants routinely suggest these from stale context. All are wrong:

| Stale belief | Reality |
|---|---|
| `constants/GeminiService.ts` generates plans | **Deleted.** AI is Claude Haiku, server-side, via `services/api/WellivaApi.ts` |
| Google Gemini is the AI provider | Claude Haiku, in a separate repo |
| Contexts live in `components/*Context.tsx` | `contexts/`, split by domain into `contexts/domain/*` |
| All user data MUST be in Supabase | **Offline-first.** The app is fully functional with no backend, no key and no signal. Supabase is sync, not the source of truth |
| The app uses a tab bar | A ChatGPT-style swipe drawer; every destination is still a `(tabs)` child so URLs held |
| `schema.sql` is the schema | `supabase/migrations/` — idempotent, 8 of them |

## Layout

```
app/            Expo Router screens (40 routes)
components/     components/ui is the design system; use it, don't re-roll primitives
contexts/       App state, split by domain (contexts/domain/*)
models/         Pure domain types. models/nutrients.ts is load-bearing
services/       nutrition/ · gozlin/ (the coach) · api/ · billing/ · sync/
health-os/      Event-sourced health OS. Imports NO React Native — keep it that way
fitness/        Workout library, rec engine, session beats
```

`health-os/` and `fitness/` are pure and unit-tested under plain Node. A
`react-native` import anywhere in them breaks the whole suite. Native modules go
behind a lazy, guarded `require` — see `health-os/signals/calendar/CalendarSource.ts`
or `services/nutrition/MealPhotoCapture.ts` for the pattern.

## House style

- **Comments explain *why*, not *what*.** Match the density around you. A comment
  restating the code is worse than none; a comment recording a constraint or a
  rejected alternative is why this codebase is maintainable.
- Every user-facing number must be real. If a card says it counts something, it
  counts exactly that — no rounded-up streaks, no placeholder totals.
- Every failure gets its own sentence and its own next move. "Nothing happened"
  is never an acceptable response to a user action.
- Use `components/ui` primitives (`Screen`, `Card`, `Button`, `AppText`,
  `ListRow`, `Sheet`, `Pill`) and `constants/theme` tokens. No raw hex, no
  bespoke buttons.
- `accessibilityRole` + `accessibilityLabel` on anything interactive. Gestures are
  the fast path, never the only path.

## Workflow

```bash
npx expo start          # dev server
npm run typecheck       # tsc --noEmit — must be clean
npm run lint            # eslint . — must have 0 errors
npm test                # vitest run
```

`npm test` fails **exactly three** assertions by design:
`constants/__tests__/legal.test.ts` refuses to pass while
`LEGAL_POSTAL_ADDRESS` and `LEGAL_JURISDICTION` hold placeholder text. **Never
"fix" this by relaxing the gate** — those strings go verbatim into a privacy
policy users must accept. See `docs/legal/store-submission.md`.

Anything else red is a real regression.

## Environment

Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are required;
the anon key is safe to expose because RLS is what protects the data. Everything
else in `.env.example` is optional and degrades cleanly. **No secret key ever
belongs in this repo** — the Anthropic key and the RevenueCat `sk_` key live only
on the backend.

## Further reading

- `docs/architecture/00–12` — the health OS
- `docs/gozlin/` — agent loop, tools, grounding, the two clinical safety gates
- `docs/AUDIT_2026-08-30.md` — audit and competitive analysis
- `docs/companion/health-native-cutover.md` — the pending HealthKit/Health Connect step
