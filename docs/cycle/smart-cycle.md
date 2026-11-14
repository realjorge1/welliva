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

## 2026-11-13: the lock and the insights

Built from `docs/prompts/03-cycle-lock-and-insights.md`, approved by the owner on 2026-11-12 and 13. Everything is free and nothing is counted in analytics. **Not device-tested.**

Owner's answers at kickoff: they had tried the tracker on their phone and nothing broke. The 5 November privacy update had already shipped, so the new wording raised `LEGAL_VERSION` to 5 ("14 November 2026"). They will make the next app build themselves.

### The lock

`services/cycle/lockRules.ts` (pure, tested), `lib/deviceUnlock.ts`, `contexts/CycleLockContext.tsx`, `components/cycle/CycleLockGate.tsx`.

- **One switch:** "Lock my cycle" in Cycle settings → Privacy. Off by default. Turning it on needs one successful unlock first.
- **Two ways to ask, whichever the installed build has:**
  - `device`: expo-local-authentication. Fingerprint or face, with the phone's PIN, pattern or password as the fallback (`disableDeviceFallback: false`). Installed 2026-11-13 with its config plugin (iOS Face ID line, Android `USE_BIOMETRIC`, both confirmed in the merged config). **Needs a new build.**
  - `biometric`: expo-secure-store, already in every build because it holds the sign-in session. A small secret is saved under its own keychain service so that reading it needs the fingerprint; that read is the unlock. No PIN fallback, so it's offered only with a strong biometric enrolled. This is what the build on the owner's phone uses until the next build.
  - Both are reached through `requireOptionalNativeModule`, never a normal import. A missing module means the switch isn't shown. A full Android export confirmed the bundle never imports the expo-local-authentication JS package.
- **Never locks anyone out.** If the phone's screen lock or fingerprint is removed, the gate lets her in, the lock switches itself off, and one line says so. A build without the module behaves as if the lock were off.
- **Relocks** after `LOCK_GRACE_MS` (60 s) in the background. iOS `inactive` is ignored. App-state changes that start while a prompt is up, or within `PROMPT_SETTLE_MS` (1.5 s) after it closes, belong to the prompt. Every cold start is locked: the session is in memory only.
- **Asks by itself once per opening:** once per focus, plus once after a fresh lock while she stays on the screen. A cancel leaves a calm locked screen with an Unlock button and never re-prompts by itself.
- **Behind it:** `/cycle`, `/cycle/setup`, `/cycle/settings`, `/cycle/learn` and every library page (they carry the doctor-summary share button).
- **Outside the cycle screens while locked** (`useCycleHidden()`): Home's card shows only "Cycle · locked" with Unlock, which goes straight to the cycle screen. Diet's target note says "+150 · planned", and the hungrier-week offer waits. Fitness says "Lighter session today" (dose "Eased for today") and hides the learned note. The water note after a weigh-in doesn't show. Notification centre cycle rows read "Private reminder" / "Private entry · Hidden while locked", and the status line says "a private reminder". Settings' Cycle row says "Locked". Trust hides the "Cycle in Gozlin chats" switch, as its twin in Cycle settings is behind the lock. The drawer's Cycle row stays as it is.
- **App switcher:** a plain cover goes over a cycle screen as the app leaves the foreground. iOS takes its snapshot after `inactive`, so the cover is in time there. **On Android the snapshot may be taken before the cover is drawn.** Not verified on a device. The fix would be a native screen-capture flag, which is the owner's call (a new native module).
- **Storage:** `@welliva_cycle_lock` ("1" when on) is in `DEVICE_LOCAL_KEYS`, so it never syncs and the backup move never touches it. "Delete all cycle data" leaves it as it is: it's a setting about the phone, not part of the log. Turning the lock off deletes the secure-store proof.
- **Known limit:** Gozlin's chat history can mention the cycle when she has let Gozlin see it. The lock doesn't cover the chat.
- **Also fixed:** the lock-screen follow-up "There's no period open to end" said "period" whatever the discreet setting. It now says "There was nothing open to end."

### Three doctor checks

`services/cycle/doctorChecks.ts` (thresholds), `flags.ts` (the notes), `library.ts` (pages). Each note has a signature built from its dates, so a dismissal holds until the evidence changes, and each has a line in the doctor summary.

| Note | Shows when | Page | Modes |
|---|---|---|---|
| `cramps_disruptive` | "Kept me from school, work or plans" (`stoppedDay`, under Cramps) on at least one day in 2 (`DISRUPTIVE_MIN_PERIODS`) of her last 3 (`DISRUPTIVE_WINDOW`) completed periods with cramps. The 2 days before a start count as that period's (`CRAMP_LEAD_DAYS`). | `cramps` | All but pregnancy |
| `heavy_periods` | Heavy flow on 3+ days (`HEAVY_DAYS`) in 2 of her last 3 completed periods that logged flow on 2+ days (`HEAVY_MIN_FLOW_DAYS`). Iron blood-test line with low energy on 2+ days inside them (`HEAVY_TIRED_DAYS`). | `heavy-bleeding` | Normal, postpartum, hormonal ("bleeds") |
| `between_periods` | Any flow (spotting included) more than 2 days clear of a period (`BETWEEN_MARGIN_DAYS`) in 2 of her last 3 completed cycles. Days within ±1 of the cycle's estimated ovulation (`OVULATION_SPOTTING_DAYS`, using `lutealFor`) don't count. | `bleeding-between-periods` (new) | Normal, postpartum |

- **A missing value is not zero.** A period with no cramps or no flow logged is left out of the denominator. When periods were skipped, the heavy note says "of the N recent periods you logged flow in".
- **Spotting around ovulation is explained instead.** The day sheet says "Light spotting around the middle of the cycle is common, often around ovulation." (`spottingNote`). It gives no date, and appears only in normal and postpartum.

### A positive ovulation test moves this cycle's dates

`predict.ts` (`fromTest`, `lastPositiveTest`, `LIVE_TEST_MIN_DAY` 6, `TEST_HALF_WIDTH` 2 personal / 3 default).

- **The anchor:** the last positive test from cycle day 7 (start + 6) to today. `personalLuteal` now uses the same `lastPositiveTest` rule. Ovulation = test + 1, likely start = ovulation + `lutealDays`, window ± `TEST_HALF_WIDTH`. It replaces the calendar estimate for this cycle, even a narrower one.
- **Calendar spacing:** `cycleLength` stays her usual length, which spaces the later calendar cycles. The dial's ring (`ringDays`) and the centre's "of about N" use this cycle's expected length (`lastStart → likely`).
- **Words:** `confidenceLine` → "Updated from your ovulation test on Tue 12 Nov.", `confidenceWord`/`glanceConfidence` → "From your test". The coach hears "fairly sure", never that a test was taken (no new coach words).
- **PCOS:** dates don't move, and the day sheet's test row says why. `personalLuteal` (the learning from 2+ completed cycles) does not treat PCOS specially; that was left as it was, because a period arriving 9–17 days after a positive is evidence ovulation happened.
- **Every reader follows:** late (counts from the new window), dial, Home card, reminders (the lean path, tested), trip, hungrier week, brief. Normal and postpartum only.

### Phase names and "What's at work today"

`copy.ts` (`PHASE_NAMES`), `hormones.ts` (pure, tested), `components/cycle/HormoneSheet.tsx`.

- **Phase names:** "Follicular phase · building up to ovulation", "Mid-cycle · around ovulation" (the fertile-window wording when it's on), "Luteal phase · after ovulation, before your period". The how-it-works page lists the same names (tested). It also has a new "The four hormones" section.
- **The card:** one quiet line in Today (e.g. "Progesterone · at its highest about now"), opened from that line or the phase name under the dial. Sub-states after ovulation: rising (≤ `RISING_AFTER_OVULATION_DAYS` 4), at its highest, falling (≤ `FALL_BEFORE_PERIOD_DAYS` 3 before the likely start). It carries the prediction's confidence word, except during a period and once late (the window it would vouch for has passed).
- **Rules:** shapes, not levels. It never prescribes. A hormone is linked only to a physical symptom logged today (sore breasts, bloating, breakouts, headache), never mood or energy. With the fertile window off there's no ovulation date, mid-cycle speaks generally, and the picture shows only oestrogen and progesterone.
- **Picture:** static SVG, four typical curves stretched to her cycle, a solid today line, an ovulation dot (fertile window on), and "Typical shapes, not measured." No loop, no dashes, sheet-wide only.
- **Modes:** hormonal → one accurate line (`HORMONAL_HORMONES_LINE`, never "no ovulation"). PCOS → explained, untimed, no picture. Pregnancy and menopause → nothing. Postpartum before the first period → one line. Ages under 20 (`HORMONE_YOUNG_AGE`) or from 40 (`HORMONE_SWING_AGE`) → one line about bigger swings.

### The rest

`nextDates.ts`, `signs.ts`.

- **"We said the 14th. It came on the 15th."** (`startReceipt`): what `predict` said the day before the latest start, recomputed. Shown on the day the start was saved (its `updatedAt`), for a start within the last 3 days (`RECEIPT_WITHIN_DAYS`), under the one-tap row and on the Home card. It says a miss as a miss, and adds "Your next window now includes this cycle" only when that cycle is counted. Normal and postpartum, never for the first period after a birth.
- **Share dates** (`shareDatesLine`): a button on the Next period card (not once late) opens the share sheet with "My next period is likely 18–21 Nov", adding ", most likely Wed 19 Nov" only at "Fairly sure".
- **Start testing** (`testingStartLine`): inside the fertile box, for someone who has logged a test, with no positive this cycle, until ovulation + 1. The day is the earliest edge less (luteal + 3, `TESTING_LEAD_DAYS`), never before the period's expected end. With PCOS it adds "treat a positive as a hint". In the app only.
- **Mid-cycle twinge:** `mid_cycle_pain` in `SYMPTOMS`, for everyone, not a relief symptom, left out of the period-anchored timing patterns. The day sheet shows the calm line within ±2 of the estimated ovulation (normal and postpartum), and the safety line every time it's ticked. Its pattern (`twingePattern`) needs 2+ cycles within ±2 of the estimated ovulation, worded without "ovulation" when the fertile window is off.
- **Discharge:** `discharge` (`dry | sticky | creamy | clear_stretchy`) has a day-sheet row with the fertile window on only, and a solid lilac bar on clear-and-stretchy days in the calendar. It's a check, not an input (`dischargePattern`, judged by the last clear, stretchy day). It either lines up "in the 5 days before your estimated ovulation" or says "came later/earlier than my estimate … An ovulation test would tell us more."

### Every mode (2026-11-13 features)

Held by the second table in `modes.test.ts`. The lock works the same in every mode.

| | Cramps note | Heavy note | Between note | Test moves dates | Hormone card | "We said…" | Share | Start testing | Twinge / spotting explained | Discharge row |
|---|---|---|---|---|---|---|---|---|---|---|
| Normal | ✓ | ✓ | ✓ | ✓ | card | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hormonal contraception | ✓ | ✓ | – | – | one line | – | – | – | – | – |
| Pregnancy | – | – | – | – | – | – | – | – | – | – |
| Postpartum | ✓ | ✓ | ✓ | ✓ | card | ✓ | ✓ | ✓ | ✓ | ✓ |
| Menopause | ✓ | – | – | – | – | – | – | – | – | – |

### How much can appear on the cycle screen in a day

Nothing new takes the one suggestion slot (`suggest.ts`). The receipt sits under the one-tap row. The hormone line sits in Today. The start-testing line and the share button sit in the Next period card. The twinge and spotting lines appear only in the day sheet. The doctor notes keep their own section.

### What's stored

| Field | Where | Export | Erased by "Delete all cycle data" |
|---|---|---|---|
| `stoppedDay` | day logs (only beside cramps) | CSV `kept_from_day`; summary "Days cramps stopped school, work or plans: N." | Yes |
| `discharge` | day logs | CSV `discharge` (not in the doctor summary) | Yes |
| `mid_cycle_pain` | day logs' `symptoms` | CSV symptoms, summary "Most logged" | Yes |
| `@welliva_cycle_lock` | device-local key | No | No (decided: it's about the phone) |
| secure-store proof | this phone's keystore, own service | No | Deleted when the lock is switched off |

**What reaches Gozlin:** nothing new. The brief's "logged today" line lists symptoms, so "mid-cycle twinge" can appear there, which the existing words ("what you logged today", "symptoms you note") cover. `stoppedDay` and `discharge` are not in the brief. A test-dated window reaches the coach as "fairly sure".

**Legal:** `LEGAL_VERSION` 5, "14 November 2026". The Privacy Policy's cycle-log sentence now lists "whether cramps kept you from school, work or plans" and "discharge if you turn on the fertile-window estimate". `npm run legal:publish` waits for the owner's OK.

## Not done

- **No device testing.** Nothing here has run on a phone, including the original tracker.
- **`npm run legal:publish`** has to run before release, with the owner's OK, so the public pages match `constants/legal.ts` (now version 5).
- **The PIN fallback for the lock needs the owner's next build** (expo-local-authentication). Until then, the lock uses the fingerprint only.
- **Android app-switcher preview:** the cover may land after the snapshot. Blocking it for certain needs a native screen-capture module, which is the owner's call.
