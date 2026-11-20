# Prompt 6: the diet and nutrition brain, eleven engine fixes

> How to use: start a **new** Claude Code chat in the welliva folder, then paste everything below the line.
> Everything here works on the app build already on the owner's phone. Nothing needs a new build.
> Run this on its own. Do not run it at the same time as Prompt 5 (the cycle engine): both touch shared files, and the owner's phone reloads on every save.
> **Gozlin (the AI coach) is out of scope.** This is the calorie, macro, meal-plan and learning engine underneath the diet screens.

---

## Your roles

You are the lead engineer on **welliva's nutrition engine**. welliva is a React Native (Expo SDK 54) health app covering diet, workouts, habits, mood, cycle tracking and water, plus an AI coach called **Gozlin**. On this job you wear six hats and switch between them deliberately:

1. **Senior mobile engineer.** Your code reads like the code around it, with tests, and every save is valid code (the owner's phone reloads on each one).
2. **Nutrition scientist.** You know energy balance, adaptive thermogenesis, protein needs in a deficit, fibre and sugar guidance, and how MyFitnessPal, Lose It!, MacroFactor, Cronometer and Eat This Much actually behave. You cite the evidence in one plain line where you rely on it.
3. **Clinical-safety reviewer, with eating-disorder awareness.** A calorie number is a prescription in a user's mind. Never encourage a deficit for someone under 18, underweight, pregnant or postpartum. Never shame. Never moralise about food. Read every sentence the user will see.
4. **Learning-systems engineer.** You understand the Kalman model in `health-os/learning/`: it is only as good as the days that feed it, and "no data" must never be confused with "data that says zero".
5. **Honesty reviewer.** The owner's standing rule: **no cosmetic numbers**. A card that says it counts must count exactly that, over a stated scope, accurately.
6. **The owner's translator.** The owner is the product owner, not a developer. Every question and update to them is plain English: no code words, no file names, no commands. Describe things by what they see on the phone.

## The mission

On 2026-11-16 the nutrition engine was audited by running the real code on typical users. The formula underneath is the standard one. The problems start after day one: **the target never follows her weight**, **the part meant to learn her real metabolism never receives data**, and **the meal plans cannot feed anyone who needs more than about 2,000 kcal**. Fix all eleven below. Each has an **acceptance test**; write those tests **first** (Phase 0) and watch them fail, then make them pass.

**Critical**

**Fix 1. The target never follows her weight.** Weigh-ins logged on the quick-log card or through Gozlin are saved to the weight log but never change the weight the target is calculated from (`contexts/domain/useProfileState.ts`, `logBodyMeasurement`, about lines 415-420). The target only moves if she edits her weight on the Profile screen (that path does call `updateUserBio`). Someone who loses 10 kg keeps eating her day-one number, so her deficit shrinks month after month and she plateaus without knowing why. `startNewChapter` (`contexts/domain/useGamificationState.ts`) also starts from the stale profile weight.
- *Acceptance:* log weigh-ins that fall from 80 kg to 70 kg over 10 weeks through the quick-log path. The calorie and protein targets must have moved along the way, each move must be explained to her, and none may move on a single noisy reading.

**Fix 2. The part meant to learn her real metabolism never receives data.** `health-os/learning/tdee.ts` compares what she eats with what the scale does. Food days (`nutrition.day.closed`) and weigh-ins (`body.measurement.logged`) reach the timeline **only** through the one-time first-launch import (`health-os/platform/migrations/001-backfill-timeline.ts`, about line 264). Nothing writes them afterwards: the only live writers of timeline events are `LifeContextRepository` (2 places) and `services/gozlin/MindService.ts`. For anyone who installed after that import shipped, the model has never seen a meal or a weigh-in.
- Even if it did learn, nothing uses its result to set targets: `tdeeForTargets` has no caller, and `tdeeDisclosure` (about lines 205-206) says "your daily targets still start from that signup estimate".
- It also treats a day with nothing logged as eaten at exactly maintenance, and a day with one snack as a full day. The day-close writes 0 kcal for an unlogged day, which the filter reads as a starving day.
- *Acceptance:* a fresh install that logs 30 days and a weigh-in every few days ends up with timeline events for every closed day and every weigh-in; an unlogged day reaches the filter as "unknown", never as 0 or as maintenance; and once confident, the model changes her suggested target (with her one-tap agreement).

**Serious**

**Fix 3. A hard ceiling gives muscle-builders and athletes a deficit.** `services/NutritionService.ts` line 102 caps targets at 3,200 kcal (men) and 2,800 (women). Measured:

| Person | Burns per day | Target today | Result |
|---|---|---|---|
| Man, 85 kg, 183 cm, 24, active, build muscle | 3,241 | 3,200 | 41 under, instead of +300 |
| Man, 95 kg, 190 cm, 22, very active, athletic | 3,862 | 3,200 | **662 under** (−17%) |
| Woman, 68 kg, 172 cm, 25, very active, athletic | 2,791 | 2,800 | +9, instead of +200 |

- *Acceptance:* every gain or performance goal gets at least its modifier above maintenance, whatever the size of the person.

**Fix 4. Meal plans cannot feed bigger eaters.** Every dish comes in fixed, pre-written sizes (the biggest is about 400 to 740 kcal a meal) and nothing scales them (`services/nutrition/mealVariety.ts`, `planDay`, which picks the closest authored portion for calories only). 28 days of plans per person, measured against the target at the time:

| Person | Target | What the plans gave |
|---|---|---|
| Woman, 60 kg, light, lose weight, 3 meals | 1,315 | 104% of calories |
| Woman, 120 kg, sedentary, lose weight, 3 meals | 1,744 | **83%**, every day |
| Man, 80 kg, moderate, better health, 4 meals | 2,701 | **62%**, every day |
| Man, 75 kg, build muscle, 4 meals | 3,009 | **71%**, every day |
| Woman, 62 kg, vegan, lose weight, 3 meals | 1,350 | calories 103%, **protein 76%** (under 80% on 15 of 28 days) |
| Woman, 60 kg (first row) | 72 g protein | fat averaged **142%** of target |

The planner matches calories only, never protein, carbs or fat. Eat This Much, the best-known plan generator, scales servings until the day hits all the targets.
- *Acceptance:* see Phase 5 (a 28-day replay with tolerances).

**Fix 5. One weight-loss pace for everyone.** `models/nutrition.ts` (`GOAL_CALORIE_MODIFIERS`, about line 150) is always 500 kcal below maintenance: a harsh 28% cut for a 60 kg woman, a mild 15% for a 140 kg man, and small women hit the 1,200 kcal minimum. Her goal weight has no effect on the target. MyFitnessPal, Lose It! and MacroFactor all let her choose a pace.
- *Acceptance:* the deficit scales with the person, she can pick a pace, the goal weight tapers it near the end, and nobody under 18 or underweight is ever given a deficit.

**Medium**

**Fix 6. Protein is lowest for the people who need it most.** It is 1.2 g per kg for everyone except muscle-builders and athletes (1.6). Evidence for people in a deficit points to about 1.6 g per kg or more to keep muscle while losing fat.

**Fix 7. Ticking a planned meal cannot say how much she ate.** It records exactly the planned amount (`services/nutrition/IntakeLedger.ts`, `recordIntake`, and `ScheduleService.markMealConsumed`). Every logging app records the serving. Combined with Fix 4, a bigger eater's record shows the plan's shortfall rather than what she ate.

**Fix 8. There is no way to mark a day complete.** `services/nutrition/recordedIntake.ts` calls a day "recorded" once any macro is above zero, so one snack makes a day. Partial days drag down averages and trends, feed the cycle tracker's "you ate less this cycle" late-period reading (`services/cycle/late.ts`) and its hungrier-week reading (`hungry.ts`), and feed the learning model. MyFitnessPal has "Complete this entry" for exactly this.

**Fix 9. Her real training never changes the target.** The activity level chosen at onboarding stays for ever. MyFitnessPal and Lose It! add exercise calories back, and MacroFactor learns them. welliva does neither.

**Minor**

**Fix 10. Fibre, sugar and sodium limits are fixed by sex.** They don't follow how much she eats. Fibre guidance is 14 g per 1,000 kcal (`models/nutrition.ts` `BASELINE_NUTRITION`).

**Fix 11. The diet "92% match" is made up.** `services/DietMatchService.ts` (about lines 431-543) starts at 75, adds and subtracts hand-picked points, clamps at 96, and `app/(tabs)/diet.tsx` shows it as "92% match" (about lines 1972, 2054, 2083, 2602, 2745; and "N% nutrition match" on swap suggestions, about line 2426). That breaks the owner's rule against numbers that look measured but aren't.

The thresholds below are **starting values**. Keep each one as a named constant with a one-line comment saying why. If real data shows one is wrong, change it and say so.

---

## What already exists (read it before you add anything)

Read `docs/architecture/` (especially `03-memory-architecture.md` and `04-migration-strategy.md`), then the files below. The audit read them on 2026-11-16; line numbers may have moved.

- **Targets:** `services/NutritionService.ts` (`calculateNutritionTargets`, `maintenanceTdee`, `calorieFloor`; Mifflin–St Jeor, activity multipliers from `models/user.ts`), `models/nutrition.ts` (modifiers, baselines), `services/nutrition/ConditionConstraints.ts` (the clinical pass that has the final word), `services/nutrition/bodyWeight.ts` (adjusted weight above BMI 30), `services/nutrition/TargetsVersion.ts` (the **explained-correction protocol**: bump `TARGETS_ALGO_VERSION`, the one-time notice card `components/nutrition/TargetsRecalcCard.tsx`). `calculateNutritionTargets` has about a dozen callers (`app/onboarding.tsx`, `contexts/AppContext.tsx`, `contexts/domain/useProfileState.ts`, `useProfileSync.ts`, `useGamificationState.ts`, `services/intelligence/DailyPlanEngine.ts`, `WeeklyPlanEngine.ts`): keep its signature and keep it pure.
- **Plans:** `services/DietPlanGenerator.ts` → `services/nutrition/mealVariety.ts` (`planDay`, `closestPortion`, `inRotation`, `bagDraw`), `menuBuilder.ts`, `MealCatalog.ts`, `mealRules.ts` (hard restrictions, allergens, dislikes), `CustomMenuSchedule.ts`, `services/PlanSync.ts`, `constants/DietDatabase.ts`. **A meal's identity is `slot + name`** (the intake ledger and the plan heal each other by it): scaling must never rename a dish.
- **Intake:** `services/nutrition/IntakeLedger.ts` (append-only record of what was eaten, macros as they were at the tick), `DayTotals.ts` (`macrosOfMeal` is the only reader of a `{min,max}` row), `FoodLogService.ts`, `services/ScheduleService.ts` (`markMealConsumed`, `markMealConsumedOnce` for the lock-screen button, `processDayEnd`), `recordedIntake.ts`, `todayIntake.ts`.
- **Weight:** `services/BodyLogService.ts`, `useProfileState.ts` (`logBodyMeasurement`, `updateUserBio`), `services/nutrition/bodyWeight.ts`, and the cycle tracker's "water, not fat" days (`services/cycle/water.ts`, `loadNoisyWeightDates`).
- **Learning:** `health-os/learning/tdee.ts` (Kalman), `engine.ts` (`buildSeries`, `runDailyLearning`, `readIntelligence`), `health-os/timeline/*`, `health-os/platform/migrations/*` (001 backfill, 003 activity-level scale, registry), `contexts/domain/useDayChange.ts` and the boot path in `contexts/AppContext.tsx` (the two call sites of the daily learning job).
- **History and charts:** `models/diet.ts` (`DietHistoryEntry`), `components/diet/nutritionTrend.ts`, `components/charts/*`, `services/intelligence/NutritionInsightEngine.ts` (`rankMealSwaps`, `computeWeeklySummary`).
- **Match score:** `services/DietMatchService.ts`, `services/intelligence/DietRecommendationEngine.ts`.
- **Tests that exist and will need deliberate updates:** `services/__tests__/` and `services/nutrition/__tests__/` (`nutritionTargets.test.ts`, `targetsVersion.test.ts`, `mealVariety.test.ts`, `menuBuilder.test.ts`, `coldBoot.test.ts`, `dayTotals.test.ts`, `todayIntake.test.ts`), `health-os/__tests__/` (learning).

**Also read the owner-rule memories before coding:** day intake (the ledger), no cosmetic counters, meal variety, meal planner, learning loop, welliva-architecture, charts (an unlogged day is **all zeros** trap), live-device edits, owner action steps, explicit approval only, Windows file traps.

---

## Before you touch anything

1. **Ask the owner whether they've used the Diet tab for a few days on their phone**, in plain words: "Have you been logging meals on your phone? Did any number or meal look wrong to you?" If they report problems, fix those first.
2. **The app is running live on the owner's phone.** Metro hot-reloads every save within seconds, so a half-finished save is a crash in their hand. Every save must be valid code. Add helpers **before** the edit that uses them, or write the whole file in one go. Delete uses first and the definition last. Before removing anything, search for every remaining use. Never drive or tap the phone. A full reload fixes a crashed phone: connect to `ws://localhost:8081/message` and send `{"version":2,"method":"reload"}`.
3. **No new native modules, no builds.** Don't start a build. Everything here is TypeScript.
4. Don't commit unless the owner asks. Never create or switch branches. Never revert, stash or "tidy" files you didn't change for this job.
5. **Where this prompt disagrees with the code, the code wins.** Tell the owner in one plain line, then follow the code.
6. **Baseline first.** Run `npm run typecheck`, `npm run lint` and `npm test` and write down the counts. Run tests from an uppercase `C:\` working directory (a lowercase `c:\` makes every file fail on load with zero tests run).
7. **Sibling repo:** `..\backend-welliva` (Render, auto-deploys from `main`) can generate AI diet plans. **Do not edit it.** Check whether the app ever replaces a locally generated plan with a backend plan (`services/PlanSync.ts`); if it does, tell the owner and list what it would need.

---

## Ground rules (non-negotiable)

### Engine rules

- **`calculateNutritionTargets` stays pure and keeps its signature.** Anything it needs (pace, weight) comes from the `UserBio` it is given. New optional bio fields are back-compatible: undefined means today's behaviour.
- **The clinical pass has the final word.** `ConditionConstraints` runs last, always. No adaptive or pace logic may push a number past a clinical cap or floor.
- **Explain every move.** A number that changes by itself is a bug in the user's eyes. Every change to a user's calorie or protein target gets a plain reason, once (see "Explaining changes" below). Silent small drift is the one thing to avoid.
- **A missing value is not zero.** An unlogged day is unknown. A half-logged day is not a day. "Didn't weigh in" is not "weighs nothing". The learning model must be told which it is.
- **Gates before claims.** Below its gate, a learned number is not said out loud or used.
- **Safety rules** (decided; the owner can overrule in the preview, but they are not optional by default):
  - No calorie deficit under age 18, or when BMI is under 18.5, whatever the goal says; goal text says so calmly, without diagnosing.
  - Pregnancy and postpartum keep their current rules. **No adaptive calorie changes** under 18, in pregnancy, postpartum or when underweight.
  - No target below `calorieFloor`. No suggested weight goal with a BMI under 18.5.
  - A pace guard: if her smoothed weight falls faster than 1% of body weight a week for 3 weeks while she is on a deficit, offer once to ease the target up. Calm wording; never "you're doing too well".
- **Free:** all of this is free. (Free = tracking, Pro = Gozlin.) Don't gate any engine fix.
- **Never edit Gozlin's code** (`services/gozlin/*`, `components/gozlin/*`). They read `nutritionTargets` and diet history and will pick up the new numbers by themselves. List what they read in your report, and flag anything they would now misread (for example partial days in `GozlinAdaptiveNutritionEngine`) for the owner to decide on.
- **Analytics:** first-party and content-free (`services/telemetry/events.ts` documents what may be counted). Nothing about food, weight or calories is ever reported. Add no new `track()` calls unless they follow that file's rules, and say which you added.
- **Legal:** nothing here should add a new kind of data (the learning runs on data already on the phone). If you find anything that does, stop and ask the owner before going on.

### Storage and sync

Any new key needs, in this order: a sync decision in `services/sync/syncKeys.ts` (anything not on the device-local list **syncs**), a merge strategy in `services/sync/mergeStrategies.ts` **plus its fixture** (a test asserts every strategy has one), an entry in the data export (`services/export/myData.ts`), and inclusion in account deletion and "erase" (check how they enumerate keys). Document each new key and its merge rule in your report. Values are storage strings: add, never rename.

### Explaining changes (the TargetsVersion protocol)

`TARGETS_ALGO_VERSION` moves to **3** for anything that changes an existing user's number for a reason that isn't the user's own action (the ceiling, the protein change, fibre/sugar). Then fix a latent honesty bug before you rely on it: `describeChange` in `TargetsVersion.ts` blames **age** for every calorie move ("I corrected how I account for your age…"). Restructure it by cause and by version so each notice names the real reason and the real numbers:
- ceiling removed: "your target was capped for large frames; I removed the cap";
- protein in a deficit: "I now set protein higher while you're losing weight, which protects muscle";
- a move because **her weight changed** or because **the model learned her** is a different kind of notice (Fix 1 and Fix 2), shown once per move and never as "a correction".
Keep `legacyTargetsV1` frozen. Do not "fix" it.

### Project rules

- Brand: lowercase "welliva" in user-facing text. Use `components/ui` and the tokens. `LayoutAnimation` is banned. **No dashed or dotted lines anywhere.**
- **No cosmetic counters.** Any new line that counts or scores something says what it counts, over what scope, and is computed from real logs.
- Low-end TECNO phone: no looping animations; every `FlatList` sets `removeClippedSubviews={false}`; Skia paths that change per frame must be volatile.
- Responsive at ~1.3× text size on short and tall phones.
- Background failures log once with `console.log`, never `console.warn`/`console.error`.
- **Windows traps:** never put `Foo.tsx` next to `foo.ts` (check with a case-insensitive Glob before naming a file); `app/_layout.tsx` is CRLF; use `String.fromCharCode` for special characters typed through tool input; edit with the Edit/Write tools, never shell string replacement.
- **Tests:** vitest, pure modules, inject `today`, build date fixtures from local date parts (never `toISOString()`). Any test that touches schedules must clear `KEYS.INTAKE_LEDGER` too, or ticks leak between tests through healing.
- **Verification after every phase:** `npm run typecheck`, `npm run lint`, `npm test`. Every test must pass. Don't loosen a test to make it pass: if an old test pinned a wrong number, change it deliberately and say so in the report.

---

## Kickoff: ask the owner these decisions first

Use the AskUserQuestion tool. Put your recommended option first and label it "(Recommended)". Each question stands alone in plain words.

- **D1. Device check.** The question in "Before you touch anything", step 1.
- **D2. Updating her numbers from what the app learns.** "Once the app has watched about four weeks of her meals and weigh-ins, it can work out her real daily burn, which is often different from the formula. Should it change her calorie target by itself, or ask first?" Options: **Ask first, with one tap to accept, once a week at most (Recommended)** / Change it by itself and tell her / Never change it, only show what it found.
- **D3. People already losing weight today.** "Everyone who is losing weight is currently told to eat 500 calories below what they burn. The new default will be a share of what each person burns, so a small person gets a gentler cut and a large person a larger one. Should people already on the plan keep their current number?" Options: **Yes, keep their number until they choose a pace; new users get the new default (Recommended)** / No, move everyone to the new default and tell them why.
- **D4. Training days.** "Her real training could either quietly adjust her activity level, or add calories back on training days like MyFitnessPal does. The second counts her training twice, because the activity levels already include exercise." Options: **Suggest a better activity level from the training she actually logs, one tap to accept (Recommended)** / Do nothing / Add training calories back on the day (I'd want to plan it with you first, it is a bigger change).

**Decided for you.** List these in your preview so the owner can overrule any of them:
- Protein for weight loss moves to 1.6 g per kg (of the adjusted body-weight basis above BMI 30); everyone else stays as is. Clinical caps (kidney disease) still win.
- Calorie cap removed; a plain sanity bound stays (`MAX_PLAUSIBLE_KCAL`: 5,500 men, 4,800 women, before any pregnancy surplus).
- Default weight-loss pace is a **share of maintenance**: gentle 10%, **steady 20% (default)**, faster 25% (the hard maximum); never more than 1 kg a week; the picker shows the person's own numbers ("about 0.4 kg a week"). Muscle gain: gentle 5%, **steady 10% (default)**, faster 15%, between 150 and 500 kcal. Other goals keep their fixed modifiers.
- Near her goal weight the deficit halves inside `TAPER_KG` (2 kg); reaching it uses the existing new-chapter flow.
- A day counts as complete when she says so, or is **inferred** complete when at least 3 meal slots were recorded or her recorded calories reach 70% of her target. Inferred days are used for averages and learning; she can always correct a day.
- Every portion change is stored on the ledger line itself.

---

## Build plan

**Phase 0 (no feature edits):** do D1, map every file named above, confirm the facts and line numbers stated here, and send the owner a plain preview of what they will notice (five lines at most, no file names). Then ask the kickoff questions. Then build the **proof harness**, so the fixes are measured and not felt:

1. **Persona tests** (`services/nutrition/__tests__/personas.test.ts`) using these people, with `allergies: [], medicalConditions: [], foodDislikes: []` and the bio defaults from `DEFAULT_USER_BIO`. Record **before** numbers for target, maintenance, gap and protein g/kg:
   - F 50 kg, 155 cm, 28, sedentary, lose weight
   - F 60 kg, 165 cm, 30, light, lose weight
   - F 120 kg, 165 cm, 40, sedentary, lose weight
   - M 140 kg, 180 cm, 35, light, lose weight
   - M 85 kg, 183 cm, 24, active, build muscle
   - M 95 kg, 190 cm, 22, very active, athletic performance
   - F 68 kg, 172 cm, 25, very active, athletic performance
   - F 72 kg, 168 cm, 34, active, build muscle
   - plus a 17-year-old and an underweight adult on `lose_weight` (must get no deficit), and a pregnant and a postpartum woman (unchanged rules).
2. **28-day plan-fit tests** (`services/nutrition/__tests__/planFit.test.ts`): generate 28 days with `generateDietPlan` (the bundled base diets load without a network; check how `mealVariety.test.ts` sets up its fixtures and follow it, and note that the downloaded clinical library is not in play) for: F 60 kg light lose (3 meals); F 120 kg sedentary lose (3); M 80 kg moderate better health (4 meals, 178 cm, 35); M 75 kg build muscle (4 meals, 178 cm, 24); F 62 kg vegan lose (3); F 58 kg African cuisine, improve fitness (3). Assert the tolerances in Phase 5. They must fail now.
3. **Learning replay** (`health-os/__tests__/`): a 10-week synthetic person (known true maintenance, a fixed logging habit, noisy scale) played through `buildSeries` and the filter, as complete, partial and unlogged days.
4. **Before numbers** saved in `docs/nutrition/engine-accuracy.md`; the "after" columns are filled at the end.

After **every** phase: run typecheck, lint and tests; give the owner a 3-5 line plain update (what's new, where on the phone to try it).

### Phase 1: the target formula (Fixes 3, 5, 6, 10)

All inside the pure `calculateNutritionTargets`, plus the model constants.

- **Fix 3:** delete the ceiling. Keep a plain sanity bound (`MAX_PLAUSIBLE_KCAL`, above). The calorie **floor** stays.
- **Fix 5 (pace):**
  - New optional `UserBio.pace?: "gentle" | "steady" | "faster"` (and the same words for muscle gain). The deficit is `clamp(share × maintenance, ...)` as decided above, never past 1 kg a week (7,700 kcal per kg), never below `calorieFloor`. Add a pure `paceOptions(bio)` returning each option's kcal and "about N kg a week" for the picker.
  - Under 18 or BMI under 18.5: no deficit at all (the goal's modifier is floored at 0), as pregnancy already does. Add the matching calm line to the guidance the UI already renders.
  - Goal-weight taper and pace guard (above) live in small pure functions in a new `services/nutrition/pace.ts`, called by the layer that has the weight trend (Phase 2), not by `calculateNutritionTargets` (which only knows the bio).
  - **D3:** an existing weight-loss user keeps exactly their current deficit. The new default must apply only to a bio with no stored pace **and** no history (the onboarding path). Implement with an explicit stored value, never a hidden flag. When she opens the pace picker, "steady" is her pick if she wants the new default.
  - UI, smallest version: one **Pace** row on the onboarding plan reveal (no new step) and in Profile goals, showing her own numbers.
- **Fix 6:** protein 1.6 g/kg for `lose_weight`; the rest unchanged. The clinical pass still caps it.
- **Fix 10:** fibre `round(14 × calories / 1000)` clamped to 20 to 45 g (IOM: 14 g per 1,000 kcal); sugar `min(sex limit, round(0.10 × calories / 4))` (WHO 10% of energy, with the existing AHA limit as the ceiling); sodium stays flat (the guidelines are absolute) and is explained in a comment. `ConditionConstraints` interplay: its `fiberGPer1000Kcal` minimum uses the same 14, so the two agree.
- **Explain the changes** (see the protocol above): version 3, restructured `describeChange`, the notice for people whose number moved. Fibre and sugar are advisory: mention them in the notice only if they moved by 5 g or more.
- *Tests:* the persona table (before and after in the doc), the three ceiling rows, 17 and underweight, pregnancy/postpartum untouched, conditions still capping protein, grandfathering per D3, `targetsVersion.test.ts` updated deliberately, and the notice text for each cause.

### Phase 2: the target follows her weight (Fix 1)

- **A trend weight, not a raw reading.** New pure `services/nutrition/weightTrend.ts`: a time-aware exponentially weighted trend of her weigh-ins (smoothing about 10% a day, decaying across gaps), with:
  - a **typo guard**: a reading more than `OUTLIER_KG` (5) from the trend within a day is held until a second reading within 3 days agrees;
  - **noisy days down-weighted** (the cycle tracker's water days, `loadNoisyWeightDates`), never invented away;
  - a sanity range of 25 to 400 kg.
- **Effect-based retargeting.** After a weigh-in (and once a day), compute the targets for the trend weight. If calories moved by `RETARGET_KCAL` (25) or more, or protein by `RETARGET_PROTEIN_G` (5) or more, apply: update the profile weight, the stored targets, and today's and tomorrow's plan **only as far as safe**:
  - verify what `updateUserBio` does to today's already-ticked meals before calling it. If it rewrites them, write a lighter path that re-sizes **only the days still to come**, and today only when nothing is ticked yet. The intake ledger heals ticks by `slot + name`, but a changed day must never lose what she already ate;
  - the Profile weight edit stays an explicit "this is my weight" and wins over the trend;
  - `startNewChapter` and the Forecast read the trend.
- **Explain once.** A quiet one-time card in the same family as `TargetsRecalcCard`: "You've lost 3.2 kg, so I updated your numbers: 1,820 → 1,770 kcal." Keep the last 10 such moves in a small synced record (decision: merge strategy and erase per "Storage and sync") so "why did my number change?" always has an answer.
- **The pace guard and the taper** from Phase 1 run here.
- *Tests:* the 80 → 70 kg replay (targets moved, in steps, each explained once, none from a single noisy reading), a typo (760 for 76.0), two weigh-ins in a day, a gap, the water-day case, the retarget leaving today's ticks alone, and multi-device (two phones both weighing).

### Phase 3: honest records (Fixes 7 and 8)

**Fix 7: how much she ate.**
- `IntakeRecord` gains optional `portion` (omitted means 1). `markMealConsumed` / `markMealConsumedOnce` take an optional portion (default 1, so the lock-screen "Ate it" button and every existing caller are unchanged). The ledger stores the **scaled** macros.
- **One tap stays one tap.** After a tick, the meal row shows its serving ("1×"); tapping it opens a small sheet: *Less (½)*, *¾*, *As planned*, *1¼*, *More (1½)*, *Double*. Changing it replaces that ledger line (remove and add, keeping the original time). Check how an existing un-tick survives a cloud merge of the ledger, and make portion edits behave the same (or state the limit honestly).
- The meal's name never changes, so identity and healing are untouched. Free-form foods already have quantities.

**Fix 8: what counts as a day.**
- New pure `services/nutrition/dayStatus.ts`: `dayLoggedness(entry)` returns `"none" | "partial" | "complete" | "inferred"`. Explicit completion is stored in a new small synced document (`@welliva_day_complete`, a per-date record that merges as a union). Inference uses only fields already on a `DietHistoryEntry` (`mealsConsumed`, `totalMeals`, `consumedCalories`) plus the stored target, so **existing history needs no migration**: old days are simply inferred.
- UI, smallest version: one quiet **"That's everything for today"** action on the Diet screen once at least one meal is recorded (and for yesterday within the existing log window). **No new notification** (the reminder budget is spoken for).
- **Migrate every reader of `hasRecordedIntake` deliberately** (grep it): chart averages, `NutritionTrendCard` percentages and `MacroTrendCard`, `NutritionInsightEngine.computeWeeklySummary`, the learning series, and the cycle tracker's `hungry.ts` and `late.ts`. Rule: averages, trends and "you ate less" readings count only complete and inferred days; a partial day may still be **drawn**, lighter and never as zero. List each reader and what you decided. Adherence (`mealsConsumed / totalMeals`) stays plan-based and untouched.
- *Tests:* one snack is a partial day; three slots infer complete; her explicit "that's everything" wins over inference; old history is inferred correctly; and the cycle readers no longer count partial days.

### Phase 4: the learning loop gets data and becomes useful (Fix 2)

1. **Write the events, live.** Extract the event builders from migration 001 (the diet-day and body-measurement ones) into shared functions, and call them from the live writers: `processDayEnd` (day closed) and `logBodyMeasurement` (weigh-in). **Reuse 001's deterministic id seeds** (`ulidFromSeed`) so a re-emit is idempotent and never duplicates a backfilled row. Verify that `timeline.appendMany` actually dedupes by id and how `resolve` treats a repeat; if it doesn't, make the writers check first. Writers never throw into the caller: failure is a single `console.log`.
2. **Catch up the people who are behind.** A new forward-only migration (005, in the registry, version-gated, additive) that replays the existing diet history and body logs into the timeline **for dates the timeline is missing**. Never delete or rewrite. Test it on a store that is complete, one that is missing a month, and an empty one.
3. **Unknown is not zero.** `buildSeries` sets `intakeKcal` only for complete and inferred days (Phase 3), and `null` otherwise. In `tdee.ts`, a day with unknown intake must **widen the weight's uncertainty** (a small named process-noise term, about ±0.15 kg a day) instead of silently assuming maintenance. `refit from scratch, never incremental` stays: do not "optimise" it. The day-close value of 0 for an unlogged day must never reach the filter.
4. **Let it set the target** (per D2). A new pure `services/nutrition/adaptiveTargets.ts`: `proposeAdjustment(...)` returns `null` unless **all** of these hold: the model is `confident`; at least `MIN_COMPLETE_DAYS` (14) complete days and 8 weigh-ins in the last 28 days; none of the safety exclusions apply; and at least 7 days passed since the last applied or declined proposal. The new maintenance blends the formula's and the learned figure by the model's own uncertainty (the more sure, the more it counts), is clamped to within ±25% of the formula's, and a single step never moves the target by more than `ADAPT_STEP_KCAL` (150). The clinical pass runs after it. The result is a one-tap card: "I've watched 4 weeks of your meals and weigh-ins. Your numbers: 1,820 → 1,740 kcal. Why: you burn about 80 less than the formula says. [Use new numbers] [Keep mine]". "Keep mine" is remembered. Store the last decision in a small synced record with a merge rule.
5. **Fix the copy that would become untrue.** `tdeeDisclosure` currently says "Your daily targets still start from that signup estimate." That stops being true once a proposal is accepted: make the sentence state what is actually happening. Keep the rule from `tdee.ts`: the filter's number blends her body **and** her logging habits, so it drives targets but is never presented as a fact about her metabolism.
6. The two daily call sites (`useDayChange` and the boot path in `AppContext`) keep working, and learning still can't gate boot.
- *Tests:* the learning replay, with a person who under-logs by 25% (the target comes out right for **her logging**), a person with few complete days (nothing proposed), an unlogged week (uncertainty grows, no drift), the safety exclusions, the ±25% and 150 kcal limits, idempotent re-emit, and migration 005.

### Phase 5: plans that hit the target (Fix 4)

Only `mealVariety.planDay` and the helpers it uses; the rotation, the cuisine tiers, the hard rules and the variety guarantees do not change.

- **Servings.** After the rotation picks the dishes, a pure `services/nutrition/portionSolver.ts` chooses a **serving multiplier per meal** from fixed steps (½, ¾, 1, 1¼, 1½, 1¾, 2), with `maxServings` by slot (mains 2, snacks 1½) so nothing becomes absurd. It searches the (small) combination space exhaustively, deterministically. Priorities, in order: (1) calories within 5% of the day's target; (2) protein at 95% or more of target; (3) fat no more than 125% of target; (4) carbohydrate as the remainder. Ties go to servings nearest 1× and to the most even spread across meals.
- **Top-ups, never silent failure.** If the best combination still falls short (calories under 92% or protein under 90% of target), add up to `MAX_TOPUPS` (2) small extras drawn from the **same** safe pools (the diet's own snacks and the borrowing rules in `mealVariety`), filtered by the same hard rules (restriction, allergens, dislikes, cuisine), chosen to close the gap in protein first. They are ordinary snack entries with their own name and identity. Do not author new food content unless you must, and if you must, flag it for the owner (nutrition accuracy).
- **Honest shortfall.** If a very restricted diet still can't reach the target, the plan says so in one calm line ("Today's plan reaches 91% of your calories"), and never pretends.
- **Schema:** `ScheduledMeal` gains optional `servings` (omitted means 1). Min and max macros are scaled linearly; `macrosOfMeal` stays the single reader. The name is unchanged. The UI shows the serving where a meal is listed ("1½ ×"); the swap sheet sizes each alternative to the slot's remaining budget through the same solver.
- **Every generator path** must go through it: `DietPlanGenerator`, `menuBuilder` (the 90-day menus), `PlanSync`, `DailyPlanEngine`, `WeeklyPlanEngine`, the custom-menu projection, and swaps (`rankMealSwaps`). Prove it with a grep and a test per path. Eyeball 20 random dishes at 1.5× and 2× and lower `maxServings` per category for any that read absurd.
- **Acceptance (28-day replay, per persona, against that day's target):** calories within ±7% on at least 90% of days; **protein at 90% or more on at least 80% of days**; fat never above 130% on average; the day-to-day variety guarantees of `mealVariety.test.ts` still hold. For a restricted diet that genuinely can't (vegan protein, for instance), the test asserts the honest shortfall line instead, and your report says so.
- *Tests:* the six personas, swaps, a custom menu, an unscaleable dish, determinism (same inputs, same day), performance (a 90-day menu build stays quick), and the intake ledger still healing by `slot + name` after a plan with servings is rewritten.

### Phase 6: training changes the target (Fix 9, per D4)

With the recommended option: a pure `services/nutrition/activityCalibration.ts` reads her logged workouts. After `CALIBRATION_WEEKS` (4) of consistent logging that disagrees with her stated level, it proposes **one step** up or down the activity ladder, mapped from sessions per week (0-1 sedentary, 1-3 light, 3-5 moderate, 6-7 active; **never** proposes "very active", which needs information she hasn't given), showing what her calories would become. One-tap card, remembered if declined, **silent once the learning model is confident** (it already measures her real burn, so the two must never both act). Be careful with the activity-level scale (migration 003 changed it: `active` is the old "very active"). If D4 chose "do nothing", skip the phase. If D4 chose adding calories back, **stop and write the plan for the owner before coding**: the baseline would have to change to non-exercise activity only, and that moves everyone.
- *Tests:* a consistent trainer, an irregular one, a lapsed one, someone who logged too little (nothing proposed), the interplay with the learning model, and the notice text.

### Phase 7: no made-up match percentages (Fix 11)

- Keep `DietMatchService`'s score as the **internal sort key**. Show people a plain label and the **reasons** (`buildDietReasons` and `DietMatchScore.reasons` already exist): *Strong fit*, *Good fit*, *Possible*, each with its reasons ("Fits your dairy-free choice. Built for fat loss. Higher in protein."). Remove every percentage from the diet screen, the diet cards, and the plan sheets. Suggestions in the swap sheet that say "N% nutrition match" must instead say the real difference ("+12 g protein, 40 kcal under what's left"). Check what `rankMealSwaps` actually computes behind that percentage; if it is a real distance from the remaining budget, show the distance itself, and if it is an arbitrary scaling, drop it.
- Put the label mapping in one small shared function. Find the surfaces outside the diet screen that show the score (including any in Gozlin's cards) and list them in your report; **change only non-Gozlin surfaces**, and tell the owner which Gozlin ones still show a percentage so they can decide.
- *Tests:* the label bands, no "%" in any diet-match string, and the swap line shows real numbers.

### Phase 8: bring it together

1. **Consumer audit.** Grep every use of `nutritionTargets`, `calculateNutritionTargets`, `hasRecordedIntake`, `consumedCalories`, `todayDiet`, `ScheduledMeal` macros, and `bio.weightKg`. One line per file in your report: what it does now. Include the cycle tracker's `hungry.ts` and `late.ts`, the charts, the widget (`services/widget/*`), the export (`services/export/myData.ts`), and Gozlin's readers (listed, not edited).
2. **Re-run the personas, the plan-fit tests and the learning replay;** fill the "after" columns in `docs/nutrition/engine-accuracy.md`. Say plainly where a number did not improve and why.
3. **Cold-boot check:** replay the real launch sequence (`coldBoot.test.ts` patterns) with servings, complete-day flags and events in play: a plan rewrite must not lose a tick or a portion.
4. **Privacy and storage check:** list every new key, its sync decision, merge rule and fixture, its export, and that erase and account deletion remove it. Confirm nothing about food, weight or calories reaches analytics.
5. **Docs:** `docs/nutrition/engine.md` (one page per fix: rules, thresholds, files, storage), and a note in `docs/architecture/` where the timeline writers are described.
6. **Memory:** update the diet-engine-audit memory with what was fixed, and add any traps you learned.

---

## Done means

- The 11 fixes work end to end for every persona, and every acceptance test from Phase 0 passes.
- Existing users' numbers moved only for a stated, explained reason, or not at all (D3), and every move produced a plain one-time explanation.
- No under-18, underweight, pregnant or postpartum user is ever given a deficit or an adaptive cut.
- A fresh install's logs reach the learning model; an unlogged day is unknown, never zero; a partial day is never averaged as a day.
- `docs/nutrition/engine-accuracy.md` shows before and after for the personas, the 28-day plans and the learning replay.
- Typecheck and lint are clean and **all tests pass**; the count never went down without a stated reason.
- A plan rewrite never loses what she already ate, and meal identity (`slot + name`) is untouched.
- Gozlin's code is unchanged. No crash reached the owner's phone. Nothing is committed unless the owner asked. No build was started.

## Your final report to the owner (plain English, no jargon)

1. **What's different now,** one line per fix, saying what they will notice on the phone.
2. **How to try each one,** step by step (some need a few days of logging or a few weigh-ins; say what they see in the meantime).
3. **Whose numbers may move, and why:** large frames and athletes (the ceiling), people losing weight (protein, and pace if they choose), and anyone who weighs in (their numbers now follow their weight, with a note each time).
4. **Anything they must do,** with click-by-click steps, why it matters, and whether it's optional.
5. **The numbers:** before and after for the sample people, in one small table: target versus what they burn, and how close the 28-day meal plans came.
6. **Decisions you made on their behalf,** each in one line, so they can overrule.
7. **What Gozlin will now see or misread,** and what you left alone (partial days, match percentages in its cards, anything that reads the targets).
8. **Anything you skipped or couldn't do, and why,** including whether the backend ever replaces the locally built plan.
