# Gozlin — Intelligence Layer Architecture

**Phase 2 deliverable.** Role: Principal AI Systems Architect.
Mission: the complete, production-grade architecture of the Gozlin Intelligence Layer.

> **Success criteria:** every AI feature must be **explainable**, **deterministic when
> required**, and **capable of operating (at least partially) offline.**

---

## 0. Architecture at a glance

Gozlin does **not** re-implement scoring. Welliva already has a deterministic,
offline-first intelligence layer (`services/intelligence/*`, `services/CoachEngine.ts`).
Gozlin is the **orchestration + persona + memory** layer above it.

```
┌──────────────────────────────────────────────────────────────────────┐
│  UI                app/gozlin.tsx · components/gozlin/* (renderers)    │
├──────────────────────────────────────────────────────────────────────┤
│  PERSONA           GozlinPersona  (voice/tone)   GozlinChatEngine      │
│                    GozlinMemoryStore (4-tier memory, on-device)        │
├──────────────────────────────────────────────────────────────────────┤
│  GOZLIN ENGINES    Briefing · Forecast · Progress(+Weekly) ·          │
│  (pure, det.)      Recovery · Habit  ── all read ──►  GOZLIN TWIN      │
├──────────────────────────────────────────────────────────────────────┤
│  WELLIVA INTEL     CoachInsightEngine · NutritionInsightEngine ·       │
│  (already exists)   Diet/ExerciseRecommendation · Daily/WeeklyPlan ·   │
│                     WorkoutGenerator · CoachEngine                     │
├──────────────────────────────────────────────────────────────────────┤
│  STATE / STORAGE   AppContext (derived, SSOT)  ·  OfflineStorage       │
│                    (AsyncStorage)  ·  GozlinMemoryStore keys           │
└──────────────────────────────────────────────────────────────────────┘
                ▲ optional, online-only, never load-bearing
        ┌───────┴────────┐
        │  LLM Provider  │  phrasing polish + open-ended chat ONLY
        │  (seam, opt.)  │  deterministic fallback always present
        └────────────────┘
```

**Two design laws**
1. **Determinism by default.** Every feature produces a complete, correct result from
   on-device data with pure functions. An LLM (when configured + online) only *rephrases*
   already-decided content or handles free-form chitchat — it never decides plan logic.
2. **The Twin is the single read-model.** Every feature consumes one normalized snapshot
   (`GozlinTwin`) instead of re-deriving from raw state, so features stay consistent and cheap.

---

## 1. The AI Health Twin (central read-model)

The Twin is a **normalized, deterministic snapshot** of the user "right now," computed from
AppContext-derived state. Every other feature reads the Twin, not raw storage.

### Inputs
`UserBio`, `NutritionTargets`, `ConsumedNutrition`, `TodayDiet`, today's `WorkoutSession`,
`workoutDoneToday`, `GeneratedWorkoutPlan`, `WorkoutLogEntry[]`, `DietHistoryEntry[]`,
`StreakData`, `UserGoals`, `now`.

### Output: `GozlinTwin`
```ts
GozlinTwin {
  goal: PrimaryGoal
  identitySummary: string           // human one-liner: "losing fat, training 4×/wk"
  today: {
    calories:  { consumed, target, pct }
    protein:   { consumed, target, pct }
    water:     { consumed, target, pct }
    workout:   { planned?: focus, done, minutes }
    dayProgress: number             // 0–1 of waking day elapsed
  }
  momentum: {
    streak: number
    adherence7d: number             // 0–100  (ConsistencyScore)
    trainingLoad7d: number          // sessions in last 7d
    trend: "rising" | "steady" | "cooling"
  }
  recovery: RecoveryState           // see §8
  flags: GozlinFlag[]               // normalized signals (LOW_WATER, PROTEIN_LAG, …)
  asOf: string                      // ISO timestamp
}
```

### Scoring
- `pct = clamp(consumed / target, 0..2)`; `dayProgress` from the 07:00–21:00 waking window
  (reused from `CoachInsightEngine`).
- `adherence7d` ← `computeConsistency()` (existing `NutritionInsightEngine`).
- `trend` ← compare adherence of last 3 days vs prior 4 (rising/steady/cooling thresholds ±8).
- `flags` are normalized enums so downstream features and tests are stable.

### Storage / offline
Pure & ephemeral — recomputed on demand from already-loaded AppContext state. **Fully
offline.** Nothing persisted except a cached copy for the "last seen" diff (optional).

---

## 2. Daily AI Briefings

A once-per-day, proactively-generated coaching message — the front door to the relationship.

### Data flow
```
Twin ──► BriefingEngine ──► GozlinBriefing { greeting, headline, focus[1..3], microAction, tone }
   ▲                              │
MemoryStore (lastBriefingDate, identity, recent wins) ──┘ (de-dupe + personalize)
                                  ▼
                    Persona.voice() ──► rendered Briefing card + chat opener
```

### Decision tree (headline selection)
```
if red-flag flag present                  → SAFETY headline (refer out), stop
elif setback (adherence7d < 35 & streak 0)→ RECOVERY headline (compassion, micro-action)
elif new milestone since last briefing    → CELEBRATION headline
elif a single dominant flag (e.g. PROTEIN)→ that flag's nudge
elif everything on pace                   → ON-TRACK affirmation
else                                       → IDENTITY/motivation fallback
```
- **Focus list** = top 1–3 prioritized `CoachInsight`s (existing engine), de-duplicated
  against what was said yesterday (MemoryStore).
- **Micro-action** = the single smallest next win (Motivation framework §5 of Phase 1).

### Inputs / Outputs
- **In:** Twin, MemoryStore(identity, lastBriefingDate, episodic wins), `now`.
- **Out:** `GozlinBriefing` (structured) → rendered as a card + seeded as the day's chat opener.

### Storage / offline
Reads/writes `gozlin_last_briefing` (date + headline id, for de-dupe). **Fully offline.**
Briefing is regenerated, not stored verbatim.

---

## 3. Transformation Forecasting

Turns current behavior into an honest projection of where it leads — explainable, never hype.

### Model (deterministic)
- **Energy balance path** (weight goals): `dailyDelta_kcal = (avgConsumed − target)` blended
  with `GOAL_CALORIE_MODIFIERS`; `weeklyKg ≈ (dailyDelta × 7) / 7700`. Scaled by
  `adherence7d` (a plan only works as far as it's followed).
- **Confidence band** from data coverage + variance: `low/med/high` (few tracked days or
  high day-to-day variance → wider band, lower confidence).
- **Goal ETA**: `weeksToGoal = remainingDelta / projectedWeeklyRate` (clamped; "—" if rate ≈ 0).

### Decision tree
```
if trackedDays < 5            → "not enough data yet" + what to log to unlock it
elif adherence7d < 40         → show the *adherence-limited* forecast ("at this consistency…")
else                          → show projection + band + the one lever that moves it most
```

### Inputs / Outputs
- **In:** Twin, `DietHistoryEntry[]` (consumed macros), `BodyLogEntry[]` (if present), goal.
- **Out:** `GozlinForecast { projectedRatePerWeek, etaWeeks, confidence, band, drivers[], oneLever }`.

### Scoring / explainability
Every forecast ships with `drivers[]` (e.g. "82% adherence", "−420 kcal/day avg") and a
single `oneLever` ("add 15g protein at breakfast") so it is **explainable by construction**.

### Storage / offline
Pure. Optionally caches the last forecast (`gozlin_forecast_cache`) to diff week-over-week.
**Fully offline** (it's arithmetic over local history).

---

## 4. Adaptive Workout Engine

Keeps training honest to the user's *actual* recovery, adherence, and equipment.

### Composition (no new generator)
```
WorkoutGenerator (existing, deterministic) ─► base plan
recommendTodayWorkout (existing)           ─► today's pick + reasons
RecoveryState (§8) + Habit (§7)            ─► adapt: intensity ↑/↓, swap day, deload
```

### Decision tree (today's adaptation)
```
if recovery = RED (overreached / poor)   → propose active recovery / mobility, hold intensity
elif missed this slot ≥2× (habit)        → propose moving the session to a kept day
elif streak strong & recovery GREEN      → offer optional stretch (extra set / +5 min)
elif equipment changed                   → regenerate via WorkoutGenerator (inputHash)
else                                      → today's planned session, unchanged
```

### Inputs / Outputs
- **In:** Twin, `GeneratedWorkoutPlan`, `WorkoutLogEntry[]`, RecoveryState, habit patterns, `UserBio.equipment`.
- **Out:** `AdaptiveWorkoutSuggestion { session, adaptation, reason, optional intensityDelta }`.

### Storage / offline
Plan persistence already handled by AppContext/`KEYS.WORKOUT_PLAN`. Adaptation is pure.
**Fully offline.** (Determinism preserved by reusing the generator's `inputHash`.)

---

## 5. Adaptive Diet Engine

Keeps nutrition matched to remaining daily budget and the user's real eating pattern.

### Composition (no new nutrition math)
```
NutritionInsightEngine (existing): rankMealSwaps · getProteinStatus · computeConsistency
DietRecommendationEngine (existing): recommendDiets · buildDietReasons
Twin.today budgets + Habit patterns ─► which lever to pull, phrased by Persona
```

### Decision tree
```
if over calorie target (pct>1.08)        → lighter-swap suggestion for remaining slots
elif protein lagging (PROTEIN_LAG flag)  → protein-forward smart swap (rankMealSwaps isBest)
elif no plan today                       → prompt to set today's plan (1 tap)
elif recurring dislike/skip (habit)      → suggest cuisine/plan change (setCuisinePreference / recommendDiets)
else                                      → affirm; surface best smart-swap as optional
```

### Inputs / Outputs
- **In:** Twin, `TodayDiet.schedule`, `NutritionTargets`, `DietHistoryEntry[]`, habits.
- **Out:** `AdaptiveDietSuggestion { kind: swap|protein|plan|cuisine|affirm, swap?: SmartSwap, reason }`.

### Storage / offline
All composed engines are pure & local; actions route through existing AppContext mutations
(`swapMeal`, `setCuisinePreference`, `autoGenerateDietPlan`). **Fully offline.**

---

## 6. Progress Detective

Finds the *non-obvious story* in the data — correlations, hidden wins, and stalls.

### Method (deterministic pattern mining over local history)
- **Hidden-win detection:** improvements the user hasn't noticed (e.g. protein adherence
  up 20% vs prior week; workouts up while scale flat → recomposition).
- **Correlation surfacing (heuristic, labelled as such):** align day-of-week / timing
  buckets, e.g. "low-energy days ↔ sub-50% water days." Reported as *observations*, never
  causal claims.
- **Stall diagnosis:** scale flat N days → check trend in workouts + waist + adherence to
  decide "plateau vs recomposition vs true stall," each with a different message + lever.

### Output
`ProgressFinding[] { kind: hidden_win | correlation | stall, title, detail, evidence[], lever? }`
ranked by usefulness. Each finding carries `evidence[]` (the numbers behind it) → explainable.

### Inputs / Storage / offline
- **In:** `DietHistoryEntry[]`, `WorkoutLogEntry[]`, `StreakData`, `BodyLogEntry[]`, Twin.
- Pure; reads local history only. **Fully offline.**

---

## 7. Weekly Reviews

The Sunday "sit-down with your coach" — a structured recap + the week ahead.

### Data flow
```
last-7-days history ─► computeWeeklySummary (existing) ─┐
WorkoutLogEntry[]   ─► sessions, completion ────────────┼─► WeeklyReview {
StreakData          ─► consistency ─────────────────────┤     wins[], watchouts[],
ProgressFinding[]   ─► the story (§6) ──────────────────┤     adherence, oneFocusNextWeek,
ForecastEngine      ─► trajectory line ─────────────────┘     trajectoryLine }
```

### Decision tree (the single next-week focus)
```
pick the lever with highest (impact × feasibility):
  impact   = how far the weakest pillar is from target
  feasibility = how close the user already is / how small the ask
→ exactly ONE focus for next week (never a list)
```

### Inputs / Outputs / storage / offline
- **In:** week window of history, Twin, findings, forecast.
- **Out:** `WeeklyReview` (structured card). Persists `gozlin_last_weekly_review` (week id)
  so it's offered once per week. **Fully offline.**

---

## 8. Recovery Intelligence

A lightweight, transparent readiness signal — WHOOP-inspired, but honest about its inputs.

> ⚠️ Without wearables, Welliva has **no HRV/sleep**. Recovery is therefore a *training-load
> & consistency* proxy, and Gozlin **says so**. (Wearable inputs are a clean future plug-in.)

### Scoring (0–100 → state)
```
load    = sessions in last 3 days, weighted by completion% and duration
density = consecutive training days without rest
score   = 100 − (load penalty) − (density penalty) + (rest recovery bonus)
state   = GREEN ≥70 · AMBER 40–69 · RED <40
```
Future inputs (sleepHrs, HRV, soreness self-report) slot in as additional penalties/bonuses
behind the same `RecoveryState` interface — no downstream changes.

### Output
`RecoveryState { score, state, drivers[], recommendation, basis: "training-load proxy" }`.

### Inputs / storage / offline
- **In:** `WorkoutLogEntry[]`, today's planned session, streak/week activity.
- Pure & local. **Fully offline.**

---

## 9. Habit Awareness System

Learns the user's *behavioral* patterns so accountability is specific and fair.

### Method
- **Slot pattern mining:** per weekday + meal/workout slot, compute completion rate over a
  rolling window (e.g. "Monday workout completed 1/4").
- **Streak & timing patterns:** typical log time, weekend-vs-weekday adherence, dropout risk.
- Patterns feed the **Accountability ladder** (Phase 1 §6): incident → silence; pattern →
  kind, specific conversation + an offer to adapt.

### Output
`HabitPattern[] { kind: skip|consistency|timing|weekend_dip, slot, rate, window, confidence }`
— `confidence` gates whether Gozlin says anything (low confidence → stays quiet).

### Inputs / storage / offline
- **In:** `DietHistoryEntry[]`, `WorkoutLogEntry[]`, `StreakData.weekActivity`.
- Derived/cached in MemoryStore (`gozlin_behavioral`). Recomputed on demand. **Fully offline.**

---

## 10. Conversational layer (GozlinChatEngine)

Free-text chat that *feels like the coach*, offline-first.

### Pipeline
```
user text ─► intent classify (rule-based, on-device)
          ├─ known intent (briefing/forecast/diet/workout/progress/recovery/memory)
          │     └► route to the matching engine ─► deterministic structured answer
          │        └► Persona.voice() phrasing  (+ optional LLM polish if online)
          └─ open-ended / smalltalk
                └► if LLM configured & online → grounded reply (Twin + memory as context)
                   else → graceful deterministic fallback + a useful suggestion chip
```

- **Deterministic when required:** all coaching *decisions* come from engines; the LLM
  only ever rephrases or handles open chat. Pull the LLM and the product still works.
- **Grounding:** the LLM (when used) is given the Twin snapshot + relevant memory as
  read-only context and is **forbidden from inventing metrics** (enforced by passing only
  real numbers and instructing quote-only usage).
- **Provider seam:** `GozlinChatEngine.respond()` is async with a synchronous deterministic
  core; the provider is injected and optional. Mirrors how `features/` swaps mock↔real AI.

### Storage / offline
Conversation tier persisted in MemoryStore (`gozlin_conversation`, capped & rolling).
Everything except optional LLM chat works **fully offline.**

---

## 11. Storage map

| Key | Tier | Written by | Notes |
|---|---|---|---|
| `@gozlin_identity` | Identity | Memory / user statements | goal "why", constraints, prefs |
| `@gozlin_episodic` | Episodic | Briefing / Progress | acknowledged wins/events (rolling ~90d) |
| `@gozlin_behavioral` | Behavioral | Habit system | cached learned patterns |
| `@gozlin_conversation` | Conversational | ChatEngine | rolling recent turns (capped) |
| `@gozlin_last_briefing` | meta | Briefing | de-dupe (date + headline id) |
| `@gozlin_last_weekly_review` | meta | Weekly | once-per-week gate |
| `@gozlin_forecast_cache` | meta | Forecast | week-over-week diff (optional) |

All keys live alongside `KEYS` in `OfflineStorage` conventions (AsyncStorage, JSON, local).
**No new backend.** No PII leaves the device unless the optional LLM chat is enabled.

---

## 12. Offline compatibility plan

| Capability | Offline behavior |
|---|---|
| Twin, Briefing, Forecast, Progress, Weekly, Recovery, Habit, Adaptive Diet/Workout | **100% offline** — pure functions over local state. |
| Persona phrasing | **100% offline** — deterministic templates. |
| Memory (all 4 tiers) | **100% offline** — AsyncStorage. |
| Open-ended chat | Online → LLM-polished; **offline → deterministic fallback** + suggestion chips. |
| Future wearables (HRV/sleep) | Plug in behind `RecoveryState`; offline once synced. |

**Guarantee:** with the network off and no API key, Gozlin still briefs, forecasts,
reviews, adapts plans, and holds an accountable (if more templated) conversation.

---

## 13. Determinism & explainability guarantees

- **Pure engines, injectable `now`** → same inputs ⇒ same outputs ⇒ unit-testable.
- **No hidden scoring** → every number Gozlin shows comes from a named existing engine or a
  documented formula in this file.
- **Every insight carries evidence** (`drivers[]` / `evidence[]`) so the UI can always
  answer "why are you telling me this?"
- **LLM is non-load-bearing** → it can fail, be absent, or be swapped without changing any
  coaching decision.

---

## 14. Build status (this slice)

Implemented under `services/gozlin/` + `components/gozlin/` + `app/gozlin.tsx`:
**Twin, Persona, MemoryStore, Briefing, Forecast, Progress(+Weekly), Recovery, ChatEngine**,
a structured-renderer set, and the coach screen.

**Now fully built** (no longer stubs): **Adaptive Workout** (Phase 5,
`GozlinAdaptiveWorkoutEngine`) and **Adaptive Nutrition** (Phase 6,
`GozlinAdaptiveNutritionEngine`); the **Habit Awareness System** (Phase 7,
`GozlinHabitEngine` + `CheckinModal` + `@gozlin_checkins` — see
[07](./07-habit-awareness.md)); and the **Progress Detective** (Phase 8,
`GozlinDetectiveEngine` — see [08](./08-progress-detective.md)). All compose the
existing Welliva intelligence + the Twin and stay pure / deterministic / offline.
