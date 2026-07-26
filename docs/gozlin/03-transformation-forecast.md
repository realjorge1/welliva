# 03 — AI Transformation Forecast System (Phase 3)

> **Mission:** let the user *see* their projected future self — and become emotionally
> invested in reaching it — without ever lying to them about the numbers.

Gozlin already coaches the present (briefings, insights) and reads momentum. The
Transformation Forecast is the part that points **forward**: given how the user
has actually behaved, where are they heading, when do they arrive, and how likely
is it? It is deterministic, fully offline, and explainable by construction.

Code: [`services/gozlin/GozlinForecastEngine.ts`](../../services/gozlin/GozlinForecastEngine.ts),
data layer [`services/BodyLogService.ts`](../../services/BodyLogService.ts),
UI [`components/gozlin/renderers/ForecastCard.tsx`](../../components/gozlin/renderers/ForecastCard.tsx).

---

## 1. The five outputs

| Output | Type | What it answers |
|--------|------|-----------------|
| **Current Projection** | `summary` | "Where am I heading right now?" |
| **Progress Velocity** | `velocity { perWeek, trend, label }` | "How fast, and is it speeding up or stalling?" |
| **Expected Goal Date** | `etaWeeks` + `expectedGoalDate` | "When do I get there at this pace?" |
| **Likelihood of Success** | `successScore` (0–100) + `successBand` | "How likely am I to actually make it?" |
| **Recommended Adjustments** | `adjustments[]` (ranked) | "What's the highest-leverage thing to change?" |

Every output ships with its **evidence** (`drivers[]`), a **confidence** level, and an
honest **`basis`** flag so the UI never presents a guess as a fact.

## 2. Inputs

| Input | Source | Role |
|-------|--------|------|
| Weight (trend) | `BodyLogEntry[]` weigh-ins | **Ground truth** velocity (regression) |
| Body measurements | `BodyLogEntry.waistCm` | Secondary signal / future composition read |
| Nutrition adherence | `DietHistoryEntry`, `momentum.adherence7d` | Energy-balance prediction + success score |
| Workout adherence | `workoutLog`, `momentum.trainingLoad7d` | Training subscore |
| Activity level | `UserBio.activityLevel` | Maintenance calorie baseline |
| Habits / consistency | `momentum.streak`, `momentum.trend` | Momentum subscore |
| Sleep *(if available)* | — *(not yet tracked)* | Gracefully omitted; never fabricated |
| Goal weight | `UserGoals.targetWeightKg` | The destination → goal date + success |

> **Sleep "if available":** the model treats sleep as an optional subscore. Until a
> sleep signal exists it simply isn't referenced — the forecast never invents one.

## 3. Core principle — **actuals beat the math**

Two independent estimates of velocity:

1. **Measured** — a least-squares regression over real weigh-ins (kg/week).
2. **Predicted** — energy balance: `(avgConsumed − maintenance) × 7 ÷ 7700`.

When real weigh-ins exist the **measured trend leads** and the prediction becomes a
cross-check. The scale is reality; the math is a model of reality. The `basis` field
records which won:

```
reliableMeasured = trend.perWeek ≠ null AND points ≥ 2 AND spanDays ≥ 7

basis =
  reliableMeasured AND prediction agrees in sign → "blended"     (reinforced)
  reliableMeasured                               → "measured"
  ≥5 days of calorie data                        → "energy_balance"
  otherwise                                      → "insufficient"
```

### Why regression, not last-minus-first

A single noisy weigh-in (water weight, a salty meal, time of day) can swing
`lastWeight − firstWeight` wildly. A least-squares slope over all points in the
28-day window resists that, and its **R²** (`trend.fit`) tells us how cleanly the
points fall on the line — which feeds confidence.

## 4. Progress Velocity — rate + shape

`perWeek` is the chosen velocity. Its **shape** is classified by comparing the
recent (14-day) slope to the overall (28-day) slope, relative to the goal direction:

```
goalDir = sign(goalWeight − current)   (or the goal-intent sign if no goal weight)

|rate| < 0.05            → "flat"
not moving toward goal   → "reversing"
|recent| > |rate|·1.15   → "accelerating"
|recent| < |rate|·0.85   → "slowing"     (plateau risk)
else                     → "steady"
```

## 5. Expected Goal Date

```
need = goalWeight − current            (signed amount still to change)

|need| < 0.3 kg                         → ETA 0  ("you're essentially there")
sign(need) ≠ sign(rate) OR |rate|<0.02  → no date  (wrong way / too slow to see)
else                                    → weeks = need / rate
                                          date  = today + round(weeks × 7) days
```

A cap of **156 weeks (~3 years)** prevents a near-zero velocity from projecting a
comically distant date — beyond it we say honestly that the goal "isn't in sight yet"
and lean on the adjustment instead.

## 6. Likelihood of Success — the composite

A weighted blend of five 0–1 subscores. This is the number the user feels.

| Subscore | Formula | Weight |
|----------|---------|--------|
| **Nutrition** | `adherence7d / 100` | 0.28 |
| **Direction** | velocity vs. a sustainable reference rate, toward the goal | 0.27 |
| **Training** | `trainingLoad7d / weeklyWorkoutTarget` (clamped) | 0.15 |
| **Momentum** | `½·(streak/14) + ½·trendScore` | 0.15 |
| **Coverage** | `0.6·(calDays/14) + 0.4·(weighIns/4)` | 0.15 |

```
successScore = round(100 × Σ wᵢ·sᵢ)
```

**Direction** is the subtle one — it encodes whether the user is actually moving
*toward* the goal, fast enough:

```
reference rate: lose 0.5 · gain 0.25 · maintain 0.15  (kg/week)

not moving        → 0.8 if goal is "maintain", else 0.3
moving wrong way  → 0.1
moving toward, with a goal weight → clamp(|rate| / refRate, 0..1)
moving toward, no goal weight     → 0.7
```

### Bands (the felt verdict)

| Score | Band | Voice |
|-------|------|-------|
| ≥ 72 | **On track** | green — "this is working" |
| 52–71 | **Achievable** | brand — "in reach, tighten one thing" |
| 32–51 | **At risk** | amber — "honest nudge" |
| < 32 | **Off track** | red — "let's reset, no shame" |
| `basis = insufficient` | **Calibrating** | grey — "give me a few more days" |

## 7. Recommended Adjustments

Candidates are generated from the **weakest subscores** and the Twin's flags, each
tagged with an estimated `impact ≈ weight × (1 − subscore)`. They're sorted by
impact, de-duplicated, and the top 3 are kept; `oneLever` is the strongest.

Examples: a weak **direction** with a fat-loss goal → *"Deepen the deficit ~200 kcal/day
or add a session."* A weak **coverage** → *"Weigh in 2–3×/week so I track the real trend,
not just the math."* All clear → *"Hold the course — consistency is the lever now."*

## 8. Confidence

```
high   : blended · OR measured(≥3 pts, R²≥0.5, span≥14d) · OR energy_balance(≥14d, cv<0.18)
medium : measured(≥2 pts) · OR energy_balance(≥8d, cv<0.3)
low    : everything else (incl. insufficient)
```

## 9. UI concept

The `ForecastCard` is built to be **felt**, top-to-bottom:

```
┌ Transformation forecast ───────────────────────────┐
│  78 %            Likelihood of success   [On track] │   ← hero
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░                             │
│  Now 82kg  ▓▓▓▓▓▓▓▓░░░░  Goal 76kg   · 6kg to go     │   ← goal progress
│  ↘ 0.4 kg/week down        📅 Sep 14, 2026           │   ← velocity · date
│  steady                       ~15 wk                 │
│  "The scale and your intake agree: you're trending   │   ← Current Projection
│   0.4 kg/week down — ~1.6kg over a month. Hold this  │
│   and you reach 76kg in about 4 months."             │
│  [High confidence] [88/100 adherence] [scale: …]     │   ← evidence
│  → Biggest lever: Add 1 session to hit your target.  │   ← adjustments
└─────────────────────────────────────────────────────┘
```

When no goal weight is set the goal-progress row becomes a one-line CTA to set one;
when data is thin the band reads **Calibrating** and the summary explains what's missing.

## 10. User journeys

**A. The new user (no data).** Forecast = *Calibrating*. Card nudges: *"I need a few
more logged days — or a couple of weigh-ins."* The scale icon in the header opens the
**WeighInModal** to log weight + set a goal. → emotional hook installed early.

**B. The committed user (3+ weigh-ins, logging meals).** `basis = blended`, **High
confidence**. They see a real velocity, a real date on the calendar, and an 78%
likelihood. The projected future becomes concrete and ownable.

**C. The plateauing user.** Velocity classified **slowing**; direction subscore drops;
likelihood slips from *On track* → *Achievable*. The top adjustment names the exact
lever. Honest, not alarming.

**D. The off-track user.** Velocity **reversing**; band **Off track** in red, but the
voice stays compassionate — the adjustment leads with a reset, never blame.

## 11. Design guarantees

- **Pure & deterministic** — inject `now`; identical inputs → identical forecast.
- **Offline-first** — pure arithmetic over local AsyncStorage; no network.
- **No parallel scoring** — composes the existing Twin / consistency engines.
- **Never hype** — every number carries evidence + a basis; thin data says so.
