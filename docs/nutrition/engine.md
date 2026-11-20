# The nutrition engine (after the 2026-11-20 fixes)

What sets a user's calories and protein, how plans meet them, and how the numbers
follow her. Every threshold below is a named constant with a one-line "why" beside it in
the code; if real data shows one is wrong, change it there and say so. Measurements:
`docs/nutrition/engine-accuracy.md`. The audit this answers: memory note
"Diet engine audit 2026-11-16"; the build brief: `docs/prompts/06-nutrition-engine-fixes.md`.

Three rules hold everywhere:

- **`calculateNutritionTargets(bio)` stays pure** and is the only place a target is made.
  Everything that shapes it is a field on the bio (`pace`, `nearGoalTaper`,
  `maintenanceAdjustKcal`, `weightKg`, `activityLevel`). The clinical pass
  (`ConditionConstraints`) still runs last and has the final word.
- **No target ever moves silently.** A correction of the formula gets the
  TargetsVersion notice; a move from her own data (weight, an accepted offer) gets a
  once-shown "Your numbers moved" card and a record of why.
- **A missing value is not zero.** An unlogged day is unknown; a one-snack day is not a
  day; "didn't weigh in" is not "weighs nothing".

---

## Fix 1 — the target follows her weight

- **Trend, not a reading** — `services/nutrition/weightTrend.ts`: a time-aware
  exponential trend (`TREND_ALPHA_PER_DAY` 0.1). Typo guard: outside 25–400 kg dropped;
  a jump bigger than `OUTLIER_KG` (5) + `REAL_KG_PER_DAY` (0.2) × days since is held
  until a second reading within `HOLD_DAYS` (3) agrees (within `AGREE_KG` 2). The cycle
  tracker's water days pull at a quarter (`NOISY_SCALE_FACTOR`). A Profile weight edit is
  stored `explicit: true` on the weight log and restarts the trend there.
- **Effect-based moves** — `services/nutrition/weightRetarget.ts`: a move is applied only
  when calories change by `RETARGET_KCAL` (25) or protein by `RETARGET_PROTEIN_G` (5);
  smaller drift waits and accumulates. Not for under-18s, pregnancy, postpartum or
  underweight (a trend crossing INTO the no-cut range does apply: it removes a cut).
- **Taper** — within `TAPER_KG` (2) of her goal weight on a loss goal, `nearGoalTaper`
  halves the cut. Reaching the goal uses the existing new-chapter flow, which now starts
  from the trend weight (`useGamificationState.startNewChapter`).
- **Pace guard** — trend falling more than `PACE_GUARD_SHARE_PER_WEEK` (1%) in each of
  `PACE_GUARD_WEEKS` (3) weeks while on a cut → one calm offer to step the pace gentler;
  quiet for `PACE_GUARD_QUIET_DAYS` (56) after.
- **Where it runs** — after every non-explicit weigh-in (`useProfileState.followWeight`)
  and once a day from `AppContext` (weigh-ins can arrive by sync).
- **Plans after a move** — `services/nutrition/retargetPlans.ts`: today is resized only
  if nothing on it is eaten (no tick, no ledger line); stored days ahead are resized in
  place (same dishes); her hand-picked menu days are never touched.
- **Not changed:** the Transformation Forecast lives in Gozlin's code
  (`services/gozlin/GozlinTwin.ts`) and still reads the latest raw weigh-in.

## Fix 2 — the learning model gets data and becomes useful

- **Live writers** — `health-os/timeline/writers.ts`: `emitDayClosed` (called from
  `ScheduleService.processDayEnd`) and `emitBodyMeasurement` (from
  `logBodyMeasurement`). Idempotent: same payload → nothing; changed payload → a
  supersede-by-append correction of the current head; never throws. A closed day uses
  migration 001's own seed (`diet:<date>:dayclosed`); a weigh-in, which 001 seeded by
  array position, is matched by date and seeded `body:live:<date>`.
- **Catch-up** — migration 005 (`health-os/platform/migrations/005-catch-up-learning-
  days.ts`) adds closed days and weigh-ins for dates the timeline is missing. Additive,
  re-runnable.
- **Unknown is not zero** — `buildSeries` sets `intakeKcal` only for whole days (see
  Fix 8), else `null`; `tdee.step` adds `Q_UNKNOWN_INTAKE` (0.15² kg²) of weight noise on
  an unknown day instead of assuming she ate her burn. Refit-from-scratch is unchanged.
- **Offers** — `services/nutrition/adaptiveTargets.ts`: a proposal only when the model is
  confident, `MIN_COMPLETE_DAYS` (14) whole days and `MIN_WEIGH_INS` (8) weigh-ins in the
  last 28, no protected group, and `ADAPT_COOLDOWN_DAYS` (7) since the last. New
  maintenance = formula and learned blended by certainty (`FORMULA_SD_KCAL` 300 vs the
  model's σ), within ±`MAX_MAINTENANCE_ADJUST_SHARE` (25%) of the formula, one step at
  most `ADAPT_STEP_KCAL` (150). Accepting writes `bio.maintenanceAdjustKcal`.
- **Copy** — `tdeeDisclosure` now says "I only change your daily targets to match if you
  say yes" (true whether or not she has).

## Fix 3 — no ceiling

The 3,200 / 2,800 cap is gone. `MAX_PLAUSIBLE_KCAL` (5,500 men / 4,800 women, plus any
pregnancy surplus) only catches a mistyped bio. The floor (`calorieFloor`) stays.

## Fix 4 — plans that hit the target

- **Solver** — `services/nutrition/portionSolver.ts`: after the rotation picks the dishes
  (unchanged), each meal gets a serving from `SERVING_STEPS` (½ to 2), mains up to 2×,
  snacks (and mains named "(small)") up to 1½×. Priorities: calories within `KCAL_BAND`
  (5%) → protein ≥ `PROTEIN_MIN` (95%) → fat ≤ `FAT_MAX` (125%) → carbs → servings
  near 1× → an even spread. Exhaustive with exact pruning; ticked meals never move.
- **Extras** — when a day still misses (calories < `TOPUP_KCAL` 92%, protein <
  `TOPUP_PROTEIN` 90%, or fat > 125%) up to `MAX_TOPUPS` (2) snacks from the diet's own
  pool under the same hard rules (`mealVariety.topUpOptions`), kept only if they make
  the day better.
- **Honest line** — `planShortfall` → "Today's plan reaches N% of your calories /
  protein" on the Diet screen when a day ends under `SHORTFALL_KCAL_LOW` (93%) or
  `SHORTFALL_PROTEIN_LOW` (90%).
- **Schema** — `ScheduledMeal.servings` (absent = 1); macro ranges are stored already
  scaled; the name never changes (identity = slot + name). Shown as "1½×".
- **Paths** — `DietPlanGenerator.generateDietPlan` (used by PlanSync's local branch,
  onboarding, `updateUserBio`, Daily/WeeklyPlanEngine, menuBuilder),
  `fitScheduleToTargets` for AI-written days (`PlanSync.aiDay`) and re-targets,
  `menuBuilder.buildMenuDays` re-sizes each built day, swaps are offered sized
  (`rankMealSwaps` / `swapServings`). Hand-picked menu meals keep the amount she chose on
  the picker's servings dial.

## Fix 5 — pace

`services/nutrition/pace.ts`. `bio.pace` = gentle / steady / faster: losing = 10 / 20 /
25% of maintenance (never past `MAX_DAILY_DEFICIT_KCAL` 1,100 = 1 kg a week, never below
the floor); building = 5 / 10 / 15% within 150–500 kcal. **Absent pace = the account
predates pace and keeps its fixed −500 / +300** (owner's D3); onboarding writes "steady"
for every new account. Under 18, BMI under 18.5, pregnancy, postpartum: no cut at all, with
a calm line in the target guidance (`noCutLine`). UI: one Pace row on the onboarding
reveal and in Settings (`components/nutrition/PaceRow.tsx`, `paceOptions`).

## Fix 6 — protein in a cut

1.6 g/kg of the protein basis when a cut is actually applied on a loss goal (and for
muscle/performance, as before); 1.2 g/kg otherwise. A no-cut loss goal (teen,
underweight, pregnancy) keeps its own rule. The renal cap still wins.

## Fix 7 — how much she ate

`IntakeRecord.portion` (absent = 1; macros stored already scaled), `id` and `loggedAt`
on new ticks so a portion edit wins a cloud merge. `markMealConsumed` /
`markMealConsumedOnce` take an optional portion (default 1, so the lock-screen "Ate it"
is unchanged). `ScheduleService.setMealPortion` rescales the line in place (same tick
time, same name) and mirrors it on the plan as `portionEaten`; healing restores both.
UI: the "1×" pill on a ticked meal opens `components/diet/PortionSheet.tsx`.
**Merge limit, stated:** a line ticked before 2026-11-20 on another phone has no id, so
an edit here and the old copy there both survive a merge (as an un-tick can today).

## Fix 8 — what counts as a day

`services/nutrition/dayStatus.ts`: `complete` (she said so), `inferred` (≥
`INFER_MIN_MEALS` 3 planned meals ticked, or ≥ `INFER_MIN_SHARE` 70% of target),
`partial`, `none`. Day-close stamps `loggedness` and `targetCalories` on the history row;
older rows are inferred on read. "That's everything for today" (and "yes, that was all"
for a partial yesterday) — `components/diet/DayCompleteRow.tsx`. Readers moved to
whole days: chart trend lines, the Diet "% of target" trend, the weekly summary, the
period report, the weekly digest (which also stopped counting all-zero days as
"logged"), the cycle tracker's hungrier-week and late readings (`wholeDayIntake`), the
doctor notes, the "water, not fat" scale note, and the learning series. Unchanged on
purpose: adherence (plan-based), Home's week table and the data export (records of what
she logged, not averages).

## Fix 9 — training and the activity level

`services/nutrition/activityCalibration.ts`: after `CALIBRATION_WEEKS` (4) of logging in
every week, steady within `MAX_WEEKLY_SWING` (2), offer ONE step along sedentary → light
→ moderate → active toward what the sessions say; never to or from "very active"; quiet
for `ACTIVITY_COOLDOWN_DAYS` (28) after an answer; silent once the learning model is
confident; no offer for the protected groups. Exercise calories are never added back.

## Fix 10 — fibre and sugar

Fibre = 14 g per 1,000 kcal (`FIBER_G_PER_1000_KCAL`), kept within 20–45 g. Sugar = under
10% of energy (`SUGAR_ENERGY_SHARE`), never above the old AHA limit by sex. Sodium flat.

## Fix 11 — no made-up match percentages

`services/intelligence/dietFitLabel.ts`: "Strong fit" (≥ 87, or `isRecommended`), "Good
fit" (≥ 75, or `isSafeOption`), "Possible". The score stays the internal sort key; the
reasons say what was checked. The swap suggestion states the real difference from the
meal it replaces (`alternativeDifference`, "+12 g protein · 40 kcal less").

---

## The explained-correction protocol (TargetsVersion)

`TARGETS_ALGO_VERSION` is 3. `describeChange` now names each cause (age, adjusted-weight
protein, the ceiling, no cut under 18 / underweight, protein in a cut, fibre ≥ 5 g),
diagnosed by reproducing v1 and v2 (`legacyTargetsV1`, frozen; `legacyTargetsV2`, frozen).
A move from her own weight or an accepted offer is never described as a correction.

The notice is shown once and erased on "Got it", so `reconcileTargetsVersion`
also writes the same sentence to `@welliva_target_moves` as a `correction` move
(stored `seen`, so the move card never repeats what the correction card just
said). That is what keeps "Why did my number change?" answerable afterwards —
in Settings, and in the exported Word document under "Why your numbers changed",
which would otherwise read "your daily numbers haven't moved by themselves" on
the very day they moved most.

## Storage added (all under `@welliva_`, so erase and account deletion remove them)

| Key | What | Sync / merge | In the export |
|---|---|---|---|
| `@welliva_target_moves` | last 10 times her numbers moved by themselves, with the sentence | syncs; `mergeById` on `id`, newest `updatedAt` wins, cap 10 | "Why your numbers changed" |
| `@welliva_target_offers` | one record per offer kind and her answer | syncs; `mergeById` on `id` (the kind), newest `updatedAt` | "Suggestions and your answers" |
| `@welliva_day_complete` | `{ date: { complete, at } }` | syncs; `mergeByDate`, `preferField: "at"` (an undo wins) | "Days you marked complete" |

New optional fields on existing records (no new keys): `UserBio.pace / nearGoalTaper /
maintenanceAdjustKcal`, `BodyLogEntry.explicit`, `ScheduledMeal.servings /
portionEaten`, `IntakeRecord.portion / id / loggedAt`, `DietHistoryEntry.loggedness /
targetCalories`, and `nutrition.day.closed` payload `loggedness / targetCalories`. No new
kind of data and nothing new reaches analytics.
