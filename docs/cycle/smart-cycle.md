# Smart cycle

Seven features that make the cycle tracker smarter without making it more complex. Each uses data welliva already holds and asks for at most one tap or one question. Everything here is free, like the rest of the tracker. Coaching on top of it is part of Gozlin (Pro).

Built 2026-11-03 to 05 from `docs/prompts/02-smart-period-cycles.md`. **Not yet tried on a real phone.**

## Owner's decisions

| Question | Decision |
|---|---|
| Hungrier week | Keep the total the same: a little less on ordinary days, a little more on the hungry ones. |
| Contraception | One question, "hormonal or not?". Yes means logging only. There is no pill-pack mode. |
| Trip heads-up | In the app, plus one phone reminder two days before. It never says "period". |
| Legal wording | The 31 October update hadn't shipped, so wording was added with no version bump (still `LEGAL_VERSION` 4). |
| Usage counting | **None of these features is counted, ever.** Each message appears at a point in someone's cycle, so its timestamp would tell our server when their period was due or late, and the privacy policy promises it never sees that. `UNCOUNTED_FEATURES` in `services/smart/types.ts` also keeps the hungrier-week card out of the smart layer's analytics. |

## The features

Thresholds are named constants in the files listed, each with a one-line reason. They are starting values: change them if real data says so, and say so.

### 1. "That's water, not fat"

`services/cycle/patterns.ts` (`weightPattern`), `water.ts`, `noisyWeightDays.ts`, `components/cycle/WaterNote.tsx`. Reading page: `scale-before-period`.

- **Baseline:** cycle days 6 to 12, stopping 8 days before the next start in a short cycle.
- **The rise:** the 5 days before the next start, through period day 2.
- **A cycle counts** with at least 2 weigh-ins in each. **It shows the rise** at 0.5 kg or more above its baseline.
- **Gate:** at least 2 cycles, and at least half of the cycles with enough weigh-ins.
- **Settles:** first period day from day 3 within 0.3 kg of the expected weight. Median across cycles, said only if known for 2.
- **A slow gain is not a rise.** Where the next cycle's baseline is known, each cycle is read against the line between the two baselines, so a steady gain is never called water and a steady loss can't hide a real rise.
- **The moment:** latest reading no more than 3 days old, in the rise or on period days 1 to 4, at least 0.5 kg up. Before the pattern exists, one general note, once (`waterNoteOn`).
- **Shown:** a sheet after a weigh-in from the bottom bar (`WaterAfterWeighIn` in `Deck.tsx`), and the slot on the cycle screen.
- **Calorie learning:** `health-os/learning/tdee.ts` multiplies scale variance by 4 on noisy days; nothing is subtracted. `health-os` never imports `services/cycle`: the dates are injected at both call sites (`AppContext` boot path and `useDayChange`). The models refit from scratch, so this corrects the past too.
- **The coach's weight trend:** also leaves those days out (`trendBodyLogs`). A straight line over 28 days with a 1 kg rise in its last week is off by about 0.28 kg a week, enough to make a steady 0.5 kg loss look stalled. Current weight and last weigh-in still read every reading.

### 2. "What helped last time?"

`services/cycle/relief.ts`, `components/cycle/ReliefQuestion.tsx`. Stored on the symptom day as `CycleDayLog.relief`.

- **The question:** about yesterday only, on the cycle screen and Home card, never a notification. One symptom a day: cramps, then headache, back pain, nausea. Stops for a symptom after 3 skips in a row.
- **Said back:** when the same answer won on at least 2 days and a tie is no winner, reading the last 6 answers. Scope is exact: "The last 3 times", or "on 3 of the last 4 days". Skips aren't in the denominator.
- **Where:** under the symptom in the day sheet, beside a heads-up, to the coach, in the doctor summary.
- **Safety:** no doses. A forward-looking heads-up leaves out a painkiller even when she chose it. "Nothing helped" 3 times, and more than anything else, becomes the `cramps_unrelieved` doctor note, linked to the cramps page.

### 3. Plan for the hungrier week

`services/cycle/hungry.ts`, `services/nutrition/dayTargets.ts`, `contexts/domain/useDayTarget.ts`, `components/cycle/HungryCard.tsx`.

- **Pattern:** the 5 days before a period against days 6 to (length − 6), recorded days only, at least 3 and 6 of them. A cycle qualifies at +150 kcal. At least 2 cycles and half of those with enough logs. The extra is the median, to the nearest 50, capped at 300.
- **Keeping the total:** the extra comes from the 10 days before the 5. At most 150 off any day, never below the floor (`calorieFloor`), never in the first 5 days of a cycle. If a floor bites or days are short, she gets less extra rather than a deeper cut.
- **The offer opens 15 days before the likely start, not the 3 in the brief.** The cuts need days to happen on; offered 3 days out there would be nothing left to spread over. A late yes gets what the days left can pay for that cycle.
- **Always an offer:** never by default. "No thanks" is final, and so is switching it off (the settings switch can turn it back on). Only in `normal` mode, never under 18, never underweight (BMI under 18.5). The words never say "make up for", "compensate", "earn", "burn off", "cheat" or "damage".
- **The day layer** (`dayTargets.ts`) is date → kcal + reason. The profile's target is never edited, and `TARGETS_ALGO_VERSION` is unchanged.
  - **Reads it:** Home's hero and yesterday fact, Diet's ring, "kcal left" and swap ranking, the trend's "% of target", the coach's today numbers and flags, the over-target insight.
  - **Deliberately doesn't:** the forecast, the coach's 14-day read, the period report, plan generation. They read long-run averages, and the total is the same. Macros don't move.
- **The past is frozen** in `hungryLedger`, because history doesn't keep a day's target and the prediction has moved on. Today and the future follow the plan, so when a period starts the extra stops by itself.
- **Going over never reads as failing:** `easyOnCalories` turns off the over-target insight ("lighter tomorrow") and the coach's `OVER_CALORIES` flag on a planned day.

### 4. Your period meets your calendar

`services/cycle/upcoming.ts`, `lifeMoments.ts`, `components/cycle/ComingUpCard.tsx`.

- **Sources:** Life Context travel, vacation, holiday, wedding, competition and exam-period entries that are active and within 60 days. Calendar entries only while calendar consent stands; inferred ones never.
- **Words:** "will probably start" when the likely day is inside the event, "might start" when only the 80% window touches it. The period after next gets a window √2 wider.
- **One-day events:** "likely day 2 of your period", plus a second sentence only if her own logs say something about that day (heaviest flow, then cramps). A race also gets her training pattern.
- **Always shows** the window and the confidence word underneath.
- **Heads-up:** from 3 days before. **Phone reminder:** trips only, 09:00 two days before, never says "period", replaces a heads-up due the same morning.
- **Lean path:** `reminders.ts` runs in Android's headless task. `upcoming.test.ts` walks its real import graph and fails if it reaches `care.ts`, `view.ts`, the food database or the `health-os` barrel.

### 5. "Why am I late?"

`services/cycle/late.ts`, `components/cycle/LateSection.tsx`, `useLateContext` in `useCycleInsights.ts`.

Compares this cycle with her last 3 completed cycles over the same days. At most 3 lines, in this order:

| Signal | Shown when |
|---|---|
| Illness | A Life Context recovery or a rough day marked "Ill" inside this cycle |
| Travel | A Life Context trip or vacation, or a rough day marked "Travelling" |
| Eating | Average down 20%, at least 7 recorded days each side |
| Training | Sessions or minutes a week up 50% and by at least 1 session or 60 minutes; or 2 a week with none logged before |
| Weight | 2 kg over the cycle, from the nearest weigh-in within 14 days of its start |
| Sleep | Down 45 minutes on average, at least 5 nights each side |
| Mood | Low days at least twice their usual share, at least 5 scored days each side and 3 low ones |

- **Nothing passes:** "Nothing stands out". It never says a cause.
- **"Most late periods arrive within a week"** is said only inside that week.
- **Next steps** reuse the app's own lines: the late-period page's test advice and `MISSED_AFTER_DAYS` (90). After a birth, the 90-day line becomes the after-a-birth page's.
- **Left out on purpose:** "a new or harder plan". The plan is rebuilt weekly and only the current one is kept, so that can't be said honestly. A harder plan shows up in sessions and minutes anyway.

### 6. The contraception question

`services/cycle/contraception.ts`, `predict.ts` (`cycleModeOf`, `countFrom`, `fertileWindowAllowed`), `copy.ts` (`bleedWords`).

- **Yes:** the `hormonal` mode. Pregnancy and menopause outrank it; it outranks postpartum. `predict` returns null, so no window and no fertile window can exist. No "late", no patterns, no gap questions, no reminders, and only the long-bleed doctor note. Every surface says "bleed", never "period".
- **Stopping is a fresh start** (`restartFrom`), from the bleed under way or that day. Earlier cycles stay on the calendar but aren't counted. A yes taken back within 3 days restarts nothing.
- **"Prefer not to say"** behaves as if never asked.

### 7. How sure it is

`confidenceWord` and `glanceConfidence` in `copy.ts`: "Fairly sure", "Still learning", "Varies for you". On the Home card, in the coach's brief, and under the trip and hungry-week messages. Hidden wherever no window is shown. The doctor summary gives the estimate's basis instead.

## Every mode

Held by `services/cycle/__tests__/modes.test.ts`.

| | Window | Fertile (if on) | Late | Trip | Water | What helped | Hungry week | Reminders |
|---|---|---|---|---|---|---|---|---|
| Normal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hormonal contraception | – | – | – | – | – | ✓ | – | – |
| Pregnancy | – | – | – | – | – | – | – | – |
| Postpartum | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Menopause | – | – | – | – | – | ✓ | – | – |

With tracking switched off, nothing shows, no target moves, and the coach's trend reads every weigh-in.

## How many things can appear in a day

- **Cycle screen:** one slot (`suggest.ts`): late, then a trip within 14 days, water, what helped, hungry week, then a trip further off. The existing Gozlin ask and doctor notes keep their own places.
- **Home card:** one heads-up line, the what-helped question, and the existing quick button.
- **Diet:** the hungry-week offer goes through the smart layer's one-a-day rule.
- **Phone:** at most 3 cycle reminders pending, as before.

## What's stored

Everything is inside the existing cycle documents, so it rides the existing merge, the backup namespace and the move logic, and "Delete all cycle data" erases it. No new storage keys.

| Field | Document | In the export |
|---|---|---|
| `contraception` | settings | CSV and doctor summary |
| `relief` | day logs | CSV and doctor summary |
| `planHungryWeek`, `hungryPlanFrom`, `hungryLedger` | settings | CSV |
| `hungryDeclined`, `waterNoteOn` | settings | No: flags about what was shown, like `gozlinAskDays` |

One trace outside them: the smart layer's device-local "shown" list holds the day the hungry-week card appeared, for a week at most. It never syncs, and erasing the cycle log clears it.

**What reaches Gozlin:** only under `cycle_gozlin` consent (`brief.ts`). The Privacy Policy, the consent row and cycle settings all list the same things, so a new brief line means new words in all three. Without consent the coach sees only numbers with no cycle meaning: a day's calorie target and a weight trend missing some days.

**Lock screen:** the trip reminder never names the period. Nothing about being late goes on a lock screen.

## Not done

- **No device testing.** Nothing here has run on a phone, including the original tracker.
- **`npm run legal:publish`** has to run before release, with the owner's OK, so the public pages match `constants/legal.ts`.
