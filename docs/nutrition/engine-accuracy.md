# Nutrition engine accuracy: before and after

Measured by running the real code, not by reading it. Each table is produced by a test
file; set `REPORT=1` and run that file with `--silent=false --reporter=verbose` to
print it again.

- **Before** = the code on 2026-11-20, before the nutrition-engine fixes (the same
  numbers the 2026-11-16 audit found).
- **After** = the same code at the end of the 2026-11-20 job.

## 1. Daily targets for the sample people

`services/nutrition/__tests__/personas.test.ts`. Bio defaults from `DEFAULT_USER_BIO`,
no allergies, conditions or dislikes. "Gap" = target minus maintenance (what she burns,
by the formula). Protein is per kg of the protein basis (adjusted weight above BMI 30).

"After (as today)" is an account with no pace chosen: everyone who already uses the app
(the owner's decision D3: they keep their −500 until they pick a pace). "After (new
account)" is the new default every new account is written with: the steady pace.

| Person | Burns | Before: target / gap / protein | After (as today): target / gap / protein | After (new account, steady) |
|---|---|---|---|---|
| F 50 kg, 155 cm, 28, sedentary, lose | 1,401 | 1,200 / −201 (floor) / 1.2 | 1,200 / −201 / **1.6** | 1,200 / −201 (floor) |
| F 60 kg, 165 cm, 30, light, lose | 1,815 | 1,315 / −500 / 1.2 | 1,315 / −500 / **1.6** | **1,452 / −363** (20%) |
| F 120 kg, 165 cm, 40, sedentary, lose | 2,244 | 1,744 / −500 / 1.2 | 1,744 / −500 / **1.6** | **1,795 / −449** |
| M 140 kg, 180 cm, 35, light, lose | 3,238 | 2,738 / −500 / 1.2 | 2,738 / −500 / **1.6** | **2,591 / −647** |
| M 85 kg, 183 cm, 24, active, build muscle | 3,241 | 3,200 / **−41** / 1.6 | **3,541 / +300** / 1.6 | +324 (10%) |
| M 95 kg, 190 cm, 22, very active, athletic | 3,862 | 3,200 / **−662** / 1.6 | **4,062 / +200** / 1.6 | (no pace for this goal) |
| F 68 kg, 172 cm, 25, very active, athletic | 2,791 | 2,800 / +9 / 1.6 | **2,991 / +200** / 1.6 | (no pace for this goal) |
| F 72 kg, 168 cm, 34, active, build muscle | 2,482 | 2,782 / +300 / 1.6 | 2,782 / +300 / 1.6 | +248 (10%) |
| F 60 kg, 17 years old, light, lose | 1,905 | 1,405 / **−500** / 1.2 | **1,905 / 0** / 1.2 | 1,905 / 0 (never a cut) |
| F 47 kg, 165 cm (BMI 17.3), light, lose | 1,664 | 1,200 / **−464** / 1.2 | **1,664 / 0** / 1.2 | 1,664 / 0 (never a cut) |
| Pregnant, 2nd trimester (goal: lose) | 1,891 | 2,231 / +340 / 1.4 | 2,231 / +340 / 1.4 (unchanged) | unchanged |
| Postpartum (goal: lose) | 1,946 | 2,346 / +400 / 1.4 | 2,346 / +400 / 1.4 (unchanged) | unchanged |

Fibre before: 25 g (women) / 38 g (men) for everyone. After: 14 g per 1,000 kcal, kept
between 20 and 45 g — e.g. 20 g at 1,315 kcal, 39 g at 2,782 kcal, 45 g at 3,541 kcal.
Sugar: the new "under 10% of calories" rule never goes below the old 25 g / 36 g limits
at any of these targets, so sugar did not move for anyone here. Sodium: unchanged
(2,300 mg is an absolute daily limit, not a share of energy).

**Where nothing improved, and why:** the 50 kg sedentary woman still sits on the 1,200
kcal floor whatever her pace (a 20% cut would take her to 1,121, below the floor, which
wins); her protein moves to 1.6 g/kg.

## 2. Twenty-eight days of meal plans

`services/nutrition/__tests__/planFit.test.ts`. 28 consecutive days from the real
generator (bundled diets only; the downloaded clinical library is not in play), each
day measured against the person's target. The "after" targets include the new protein
for weight loss (1.6 g/kg), which raised the protein bar for the three losers.

| Person | Target (kcal / protein) before → after | Days within ±7% kcal | Days protein ≥ 90% | Avg fat | Distinct mains |
|---|---|---|---|---|---|
| F 60 kg light lose (3 meals) | 1,315 / 72 g → 1,315 / 96 g | 71% → **100%** | 93% → 89% | **142% → 124%** | 59 → 59 |
| F 120 kg sedentary lose (3) | 1,744 / 99 g → 1,744 / 131 g | **0% → 100%** | 43% → **93%** | 110% → 124% | 38 → 38 |
| M 80 kg moderate better health (4) | 2,701 / 96 g | **0% → 100%** (avg 62% → 99%) | 61% → **100%** | 85% → 123% | 24 → 24 |
| M 75 kg build muscle (4) | 3,009 / 120 g | **0% → 100%** (avg 71% → 105%) | 57% → **100%** | 81% → 114% | 42 → 42 |
| F 62 kg vegan lose (3) | 1,351 / 74 g → 1,351 / 99 g | 64% → **100%** | 0% → 0% (avg 75% → 69% of a higher target) | 122% → 120% | 57 → 57 |
| F 58 kg African improve fitness (3) | 2,012 / 70 g | 64% → **100%** | 100% → 100% | 97% → 104% | 29 → 29 |

Tolerances: calories within ±7% on at least 90% of days; protein at 90% or more on at
least 80% of days; fat no more than 130% on average. **Five of six now meet all three.**

**Where it did not improve, and why:** the vegan plan reaches about 69% of a 99 g
protein target (it was 75% of a 74 g target). Calories now fit every day, but the vegan
dishes and snacks this catalog holds can't carry 99 g of protein on 1,351 kcal. Each such
day now says so in one line ("Today's plan reaches 69% of your protein") instead of
looking complete. Closing it needs more vegan protein dishes (content, not arithmetic).

Speed: a plan day takes about 0.6 ms to build in tests (the 28-day replay of all six
people runs in well under a second); a 90-day menu builds in about 1 s.

## 3. The learning model, ten weeks of one person

`health-os/learning/__tests__/learningReplay.test.ts`. She truly burns 2,200 and eats
1,700; the formula guessed 2,000; she weighs in every third day on a scale that wobbles
about ±0.4 kg. Only her logging habit changes between rows.

| Logging habit | Learned burn before (miss) | Days read as "0 kcal" before | Learned burn after (miss) | Days of known intake after |
|---|---|---|---|---|
| Every day, in full | 2,095 (−105) | 0 | 2,095 (−105) | 70 |
| 3 days in 10: one snack only | 1,718 (**−482**) | 0, but 21 snacks read as whole days | **2,153 (−47)** | 49 (the 21 snack days are unknown) |
| 3 days in 10: nothing logged | 1,637 (**−563**) | 21 | **2,153 (−47)** | 49 (the 21 blank days are unknown) |
| Every day, at 75% of what she ate | 1,715 (−485) | 0 | 1,715 (−485) | 70 |

**Where it did not move, and why:** the complete logger's −105 is the filter still
leaning a little on the formula's 2,000 after ten weeks (it is inside the model's own
±120 confidence gate). The under-logger's −485 is *correct for her logging*: learned
minus logged (1,715 − 1,275 = 440) is close to her real 500-calorie deficit, so targets
built from it produce the change she asked for. This is why the learned number is never
shown as "your metabolism", only used for targets, with her agreement.

Before the fixes, none of this ran on a real phone after the one-time import: no live
code wrote meals or weigh-ins to the timeline. After: day-close and every weigh-in write
their events as they happen, and migration 005 catches up the days that were missed.
