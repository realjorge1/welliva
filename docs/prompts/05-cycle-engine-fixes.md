# Prompt 5: the cycle brain, eleven engine fixes

> How to use: start a **new** Claude Code chat in the welliva folder, then paste everything below the line.
> Everything here works on the app build already on the owner's phone. Nothing needs a new build.
> Run this on its own. Do not run it at the same time as Prompt 6 (the nutrition engine): both touch shared files, and the owner's phone reloads on every save.

---

## Your roles

You are the lead engineer on **welliva's cycle engine**, the "brain" in `services/cycle/`. welliva is a React Native (Expo SDK 54) health app covering diet, workouts, habits, mood and water, plus an AI coach called **Gozlin**. On this job you wear six hats and switch between them deliberately:

1. **Senior mobile engineer.** Your code reads like the code around it, and every change has tests.
2. **Forecasting engineer.** You think in distributions, calibration and backtests, never in single numbers. A forecast is only as good as its measured hit rate.
3. **Women's-health product specialist.** You know the evidence on cycles, ovulation, LH tests, basal temperature and abnormal bleeding. You are **not** a doctor, and neither is the app. It notices, explains and refers. It never diagnoses, and it is **never contraception**.
4. **Clinical-safety reviewer.** Read every sentence the user will see and ask: could this frighten, mislead, shame, or be read as medical advice or as birth control? A late period may mean pregnancy: nothing you build may hide that or hand out false dates.
5. **Honesty reviewer.** Every number on screen is checked against the data behind it. If it says "5 of your last 6 forecasts landed inside the window", the code counts exactly that.
6. **The owner's translator.** The owner is the product owner, not a developer. Every question and update to them is plain English: no code words, no file names, no commands. Describe things by what they see on the phone.

## The mission

On 2026-11-16 the engine was audited by running the real code on made-up histories. The method is sound (the middle value of recent cycles, an 80% range instead of one date). The problems are in how it **reads what she logs**, how long it **trusts what she said at setup**, how **precise it pretends to be**, what it does **when she is late**, and that it **never checks its own accuracy**.

Fix all eleven, plus one owner decision (pill mode, Fix 12). Each fix has an **acceptance test** taken from the audit. Write those tests **first** (Phase 0) and watch them fail, then make them pass.

**Fix 1. Any bleeding between periods is recorded as a new period.** In `contexts/CycleContext.tsx` (`logDay`, about lines 536-540, with `PERIOD_FLOWS` on line 174), choosing Light, Medium or Heavy on any day outside a period opens a new period. Measured: steady 28-day cycles, a woman logs light bleeding on cycle day 14.
- The app resets her to "period, day 1" and moves her next period 13 days **later**.
- When the real period arrives, her history holds a 13-day cycle (skipped as "short") and a **15-day cycle that counts as real**. Her true 28-day cycle disappears.
- Two of these in six months would trigger a false "short cycles" doctor note.
- The "bleeding between periods" doctor check can only ever see spotting, because heavier bleeding was already turned into a period. It is blind to exactly what it exists to catch.
- *Acceptance:* the same history with a light-flow log on day 14 must leave `lastStart`, `likely` and every cycle length **identical** to the history without it, and must produce a between-periods day that the doctor check can see.

**Fix 2. The fertile window never widens.** In `predict.ts` (about lines 395-398) it is always exactly 7 days (ovulation − 5 to ovulation + 1). Measured: cycles ranging 24 to 40 days give a period window of ±8 days labelled "variable", yet a crisp 7-day fertile window, when ovulation could fall anywhere in about 17 days. It also appears from day one, built only on what she remembered at setup. `predict.ts` lines 5-7 criticise other apps for exactly this false precision.
- *Acceptance:* a very regular history (six 28-day cycles) gives a window of at most 8 days. The variable 24-40 history gives at least 14 days and says why in words. A user with no logged cycles gets a wide window labelled rough. More uncertainty never narrows the window.

**Fix 3. Once she is late, the dates go stale.** Measured, 10 days late on a 28-day history: it still says next period in 16 days and ovulation in **2 days**, because it never treats "no period yet as of today" as information. Parts of the app hold back when late, but the calendar painter (`visual.ts`) and the phone calendar entry (`services/calendar/events.ts`, about line 172) use the stale dates.
- *Acceptance:* with `lateBy > 0` and no positive test this cycle, no surface can show a next period earlier than today, a second-cycle projection from the missed date, or a "your estimated ovulation is N days away" for this cycle.

**Fix 4. Her setup answer never stops counting.** The prior is a fixed-strength normal-normal update, and the evidence is capped at the last 6 cycles with a spread that **grows** for irregular cycles, so the prior's share grows exactly for the people whose guess ("28") is least likely to be right. Measured, told 28:

| Her real cycles | Engine predicts |
|---|---|
| 36–44 days (middle 39.5) | 37 |
| same, with PCOS on profile | **35**, every month, forever |
| a steady 32 | 32 (fine) |

- *Acceptance:* with 6 or more counted cycles, the predicted cycle length is within 1 day of the median of her last 6, whatever she told us and whatever her profile says.

**Fix 5. Ovulation tests are dated from the last positive, not the first, and negatives are ignored.** `lastPositiveTest` (about line 298) is shared by `personalLuteal`, `predict` and `nextDates.testingStartLine`. LH positives usually run 1 to 3 days, and ovulation follows about 1 to 1½ days after the **first** positive. Measured: positives on cycle days 13, 14 and 15 put ovulation on day 16 when it most likely happened on day 14. A run of negatives past the estimated ovulation means ovulation (and the period) will be later, and today that evidence is thrown away.
- *Acceptance:* positives on cycle days 13, 14, 15 give `fromTest` on day 13 and ovulation on day 14. A run of negatives on the days around the estimate moves ovulation and the likely start later, and says why.

**Fix 6. The default second half of the cycle is 14 days; the cited study says 12.4.** `predict.ts` line 34 cites Bull et al. 2019 (mean luteal phase 12.4 days), but `DEFAULT_LUTEAL_DAYS` (line 45) is 14. Estimated ovulation comes out about a day early for most women, which pushes the two most fertile days to the edge of the window. 13 is the defensible default.

**Fix 7. The best free sign of ovulation is collected but ignored.** Clear-and-stretchy discharge is only compared with the estimate afterwards (`signs.ts`), and there is no temperature logging at all. For anyone who doesn't buy ovulation tests, which is most people, ovulation is always just "cycle length minus 14".

**Fix 8. The "80% window" has never been checked.** The engine never tests its own forecasts against her past periods, so nobody knows whether 8 of 10 land inside the window.

**Fix 9. A very long cycle is set aside, and may never come back.** `gapThreshold` (about line 168) is max(45, 1.75 × her usual). Past it, the cycle is excluded from predictions **and** from the "long cycles" doctor note until she answers "did you miss a log?". If she never answers, a real shift to long cycles never reaches either.

**Fix 10. The doctor notes mix two medical standards.** Short/long uses 21–35 days (`flags.ts` lines 123 and 135); "irregular" uses the FIGO 2018 variation limits (7 days for ages 26–41, 9 otherwise), and FIGO's own normal range for cycle length is 24–38 days.

**Fix 11. The same period logged on two phones reads as a 1-day cycle.** `services/cycle/store.ts` (about line 111) loads periods through `normalizePeriods`, which only checks shape. The sync merges by id, so two phones that each created the same period keep both copies, and the engine reads a 1-day "cycle" until her next edit tidies it.

**Fix 12 (owner decision, ask first).** On hormonal contraception the engine predicts **nothing** (decided 2026-11-03). But bleeds on the combined pill follow the pack, and are the most predictable of all. Competing apps have a pill mode.

The thresholds below are **starting values**. Keep each one as a named constant with a one-line comment saying why. If real data shows one is wrong, change it and say so.

---

## What already exists (read it before you add anything)

Read `docs/cycle/smart-cycle.md` first, then `docs/prompts/03-cycle-lock-and-insights.md` (its "traps" section applies here too). **Most of the tracker has never been tested on a real phone.**

- **Engine (pure), `services/cycle/`:**
  - `predict.ts`: `predict()`, `todayStatus()`, `buildCycles()`, `lutealFor()`, `personalLuteal()`, `lastPositiveTest()`, `cycleModeOf()`, `fertileWindowAllowed()`. Modes: `normal | pregnancy | postpartum | menopause | hormonal`.
  - `episodes.ts`: periods are episodes `{start, end|null}`. `normalizeEpisodes`, `togglePeriodDay`, `startPeriod`, `liveEpisodes`, `resolveEnd`.
  - `flags.ts` and `doctorChecks.ts`: doctor notes with `signature`s. `betweenPeriods()` reads day-log flow outside periods.
  - `visual.ts` (dial and calendar painting), `nextDates.ts` (the "we said / it came" receipt re-runs `predict` as of the day before), `late.ts`, `upcoming.ts`, `hormones.ts`, `signs.ts`, `copy.ts`, `brief.ts` (Gozlin brief), `reminderPlan.ts` + `reminders.ts` (headless path: `predict` + `todayStatus`, **never** `computeView`), `exportData.ts`, `store.ts`, `types.ts`, `view.ts`, `library.ts` (reading pages whose tests assert they quote the same thresholds the app acts on).
- **State:** `contexts/CycleContext.tsx`. **Screens:** `app/(tabs)/cycle.tsx`, `app/cycle/*`. **Components:** `components/cycle/*` (`DayLogSheet`, `CycleDial`, `CycleCalendar`, `CycleHomeCard`).
- **Outside the cycle folder:** `services/calendar/events.ts` and `sync.ts` (the "welliva" device calendar), `services/PeriodReportService.ts`, `services/notifications/cycleActions.ts`.
- **Tests:** `services/cycle/__tests__/*` (including `modes.test.ts`, `predict.test.ts`, `episodes.test.ts`, `late.test.ts`, `liveTest.test.ts`, `doctorChecks.test.ts`, `library.test.ts`).

**The sync story matters for Fix 1 and Fix 11:** `@welliva_cycle_periods` merges by id on `updatedAt`, with tombstones (`services/sync/mergeStrategies.ts`). The cycle days merge per date. Settings are last-write-wins as a whole object.

---

## Before you touch anything

1. **Ask the owner whether they've tried the cycle tracker on their phone**, in plain words: "Have you logged a period on your phone yet? Did anything look wrong?" If they report problems, fix those first.
2. **The app is running live on the owner's phone.** Metro hot-reloads every save within seconds, so a half-finished save is a crash in their hand. Every save must be valid code. Add helpers **before** the edit that uses them, or write the whole file in one go. Delete uses first and the definition last (a constant read inside `StyleSheet.create` counts as a use at load time). Before removing anything, search for every remaining use. Never drive or tap the phone. A full reload fixes a crashed phone: connect to `ws://localhost:8081/message` and send `{"version":2,"method":"reload"}`.
3. **No new native modules, no builds.** Don't start a build. Everything here is pure TypeScript.
4. Don't commit unless the owner asks. Never create or switch branches. Never revert, stash or "tidy" files you didn't change for this job.
5. **Read your memory index first.** Matters here: cycle tracking, smart cycle, cycle lock + insights, cycle discoverability, cycle engine audit, legal & consent, notification system, calendar write, analytics, no cosmetic counters, no dashed lines, live-device edits, owner action steps, explicit approval only, Windows file traps.
6. **Map before you build.** Where this prompt disagrees with the code, **the code wins**. Tell the owner in one plain line, then follow the code.
7. **Baseline first.** Run `npm run typecheck`, `npm run lint` and `npm test` before changing anything and write down the counts. Run tests from an uppercase `C:\` working directory: a lowercase `c:\` makes every file fail on load with zero tests run.

---

## Ground rules (non-negotiable)

### Engine rules

- **Pure and injected.** New logic lives in pure modules with tests in `services/cycle/__tests__`. Inject `today`. Build date fixtures from local date parts, never `toISOString()`.
- **One source of truth per idea.** `lastPositiveTest`/`personalLuteal`/`predict` share one anchor rule (Fix 5): change one, change all, with their tests. The headless reminder path must produce the **same plan** as the view (an existing test guards this; keep it passing and extend it to every new field it reads). Keep that path lean.
- **A forecast is a distribution.** Everything you add carries its uncertainty. Gates before claims: below a gate, say nothing.
- **A missing value is not zero.** Unknown is unknown.
- **Storage:** put new data **inside the existing cycle documents** (`CycleSettings`, the day logs) so it rides the merge, the backup namespace (`@welliva_cycle_*` ↔ `@welliva_cycle_local_*`) and "Delete all cycle data". A new field needs a line in its normalizer, a decision in `isEmptyDayLog` (a day holding only the new field is not empty), an export column appended at the **end** of `CSV_COLUMNS`, and a merge consideration. Values are storage strings: add, never rename.
- **Patterns standard** (`patterns.ts` header): only completed cycles count, at least 2 cycles before anything is called a pattern, the denominator is cycles with enough data, a pattern is a timing and not a cause.
- **No phase stereotypes.** Nothing is driven by "luteal phase, so…".
- **The fertile window is opt-in (off by default).** When it is off, nothing in this job may give an ovulation date or call a day fertile.
- **Never contraception.** "An estimate, not birth control" stays on every fertile surface. A wider window must never read as "safe days" outside it.
- **Modes.** Every fix states what it does in normal, hormonal, pregnancy, postpartum and menopause. Extend `modes.test.ts` and the table in `docs/cycle/smart-cycle.md`.
- **Discreet:** with `discreet` on (the default), lock-screen text never names the period. Nothing here adds lock-screen text.
- **Analytics: none.** Cycle features are never counted, because a cycle message's timestamp is cycle data. No `track()`. If anything goes through the smart layer, add it to `UNCOUNTED_FEATURES` in `services/smart/types.ts`.
- **Gozlin:** don't add lines to the cycle brief. The brief already says when the next period is likely: make sure widened windows, "late" and test-based dates read correctly there. The coach-sees list lives in three places that must agree (`constants/legal.ts`, `health-os/privacy/consent.ts`, `app/cycle/settings.tsx`).
- **Legal:** `LEGAL_VERSION` is 6 and the public copy is published. Temperature (Fix 7) is a **new kind of health data**, so it needs words in the Privacy Policy, a version bump (everyone re-accepts) and a republish (`npm run legal:publish` pushes to a public site: **ask the owner first**). See decision D2.

### Project rules

- Brand: always lowercase "welliva" in user-facing text. Use `components/ui` and the tokens. `LayoutAnimation` is banned.
- **No dashed or dotted lines anywhere.**
- **No cosmetic counters:** a card that says it counts must count exactly that, over a stated scope.
- Low-end TECNO phone: no looping animations; every `FlatList` sets `removeClippedSubviews={false}`; Skia paths that change per frame must be volatile.
- Responsive at ~1.3× text size on short and tall phones.
- Background failures log once with `console.log`, never `console.warn`/`console.error`.
- **Windows traps:** never put `Foo.tsx` next to `foo.ts` (check with a case-insensitive Glob before naming a new file); `app/_layout.tsx` is CRLF; use `String.fromCharCode` for special characters typed through tool input; edit with the Edit/Write tools, never shell string replacement.
- Everything in the cycle tracker is **free**.
- **Verification after every phase:** `npm run typecheck`, `npm run lint`, `npm test`. Every test must pass. Don't loosen a test to make it pass: if an old test pinned a wrong number, change it deliberately and say so in the report.

---

## Kickoff: ask the owner these decisions first

Use the AskUserQuestion tool. Put your recommended option first and label it "(Recommended)". Each question stands alone in plain words.

- **D1. Device check.** The question in "Before you touch anything", step 1.
- **D2. Temperature logging and the privacy words.** "One fix adds an optional body-temperature entry, which is a new kind of information, so the Privacy Policy needs a few more words. Has the update with your 15 November privacy changes (version 6) reached users yet?" Options: **Yes** / Not yet / Not sure. If yes or not sure: plan a version bump (everyone is asked to accept once more) and **do not bump or publish without a final OK**. If the owner would rather not touch the policy now: build everything else and leave temperature for later.
- **D3. One medical standard for the doctor notes (Fix 10).** Explain in plain words: "The app currently warns using two different rulebooks. I'd like to use one." Options: **Use the international FIGO 2018 rulebook everywhere: normal cycles 24 to 38 days, bleeding up to 8 days (Recommended)** / Keep today's 21 to 35 days and 7 days, and change the 'varies a lot' rule to match / Leave as is. For ages under 20, use 21 to 45 days (cycles are normally longer and more variable in the first years). State plainly that the first option makes the app warn **less** often.
- **D4. What discharge may do (Fix 7).** Today it is only a check on the estimate (owner-approved 2026-11-13). Options: **Let "clear and stretchy" mark today as a fertile day even outside the estimated window, which is the cautious direction, and never move any date (Recommended)** / Keep it a check only / Let it move the dates too.
- **D5. Pill mode (Fix 12).** "Right now, if someone says they use hormonal contraception, the app logs her bleeding and predicts nothing. For the combined pill, the bleed follows the pack, so the app could say 'your next bleed is likely on…'. Do you want that?" Options: **Yes, for the combined pill only, other methods stay log-only (Recommended)** / No, keep everything log-only.

**Decided for you.** List these in your preview so the owner can overrule any of them:
- A flow logged **inside or right at the edge of** the expected window starts a period automatically. Anything clearly earlier asks her one question in the log sheet. Unanswered means "not a period" and changes no forecast.
- Spotting never starts a period (unchanged). Menopause and pregnancy keep their current behaviour.
- A positive test never moves dates when PCOS is on the profile (unchanged). A **temperature** rise may, because it confirms ovulation after the fact.
- The late-period behaviour never invents a date: see Fix 3.
- Calibration is shown as a plain count ("5 of your last 6 forecasts landed inside the window") and only from 4 forecasts up.

---

## Build plan

**Phase 0 (no feature edits):** do D1, map every file named above, confirm the facts and line numbers stated in this prompt (they were read on 2026-11-16 and may have moved), and send the owner a plain preview of what they will notice, five lines at most. Then ask the kickoff questions. Then build the **proof harness**:

1. **Audit replay tests** (`services/cycle/__tests__/audit.test.ts`): one test per acceptance line above, using these recipes. They must fail now.
   - *S1/S2 (Fix 4):* 12 cycles of 36–44 days (use `[38,42,36,44,39,41,37,43,40,38,42,39]`), told 28; also with `pcos` on the profile and with age 17; plus a steady 32 × 12.
   - *S3 (Fix 1):* `history("2026-05-01", [28,28,28,28,28])`, usual 28, then log `flow: "light"` through the **real write path** (extract the decision from `logDay` into a pure function so you can test it) on cycle day 14.
   - *S4 (Fix 2):* regular `[28×6]` versus variable `[24,35,27,40,26,33]`, fertile window on.
   - *S5 (Fix 5):* five 28-day cycles, `ovulationTest: "positive"` on cycle days 13, 14, 15 of the latest cycle.
   - *S6 (Fix 3):* a 28-day history, today = last start + 40 (10 days late), fertile window on; check `predict`, `paintDays` and `cycleEventSpecs`.
   - *S7 (Fix 11):* two episodes with different ids and the same start, both through load and through merge.
2. **A seeded population simulator** (`services/cycle/__tests__/simulate.ts`, a seeded generator so tests never flake). Archetypes: regular 28, regular 32, irregular 24–40, long and variable 36–44 (PCOS-like), teen 21–45, and perimenopause (lengthening with variance). For each, generate 24 cycles with a known true ovulation (luteal ~ N(13, 1.5)), run `predict` as of each cycle start from cycle 3 on, and measure: how often the real start fell inside the window, the average error of `likely`, and the fertile-window width. **Record the before numbers** and save them in `docs/cycle/engine-accuracy.md`. This is the proof that the upgrade worked. Aim for: window hit rate between 0.75 and 0.90 for every archetype after 8 cycles; average error ≤ 1.5 days for regular archetypes. If a number can't be met, say why in the report rather than tuning until a test passes.

After **every** phase: run typecheck, lint and tests; give the owner a 3-5 line plain update (what's new, where on the phone to try it).

### Phase 1: clean history (Fix 11, and the repair half of Fix 1)

- **Fix 11:** on load (and after every sync adoption of `@welliva_cycle_periods`) run the list through `normalizeEpisodes`, and write it back **only if it changed**. `normalizeEpisodes` is deterministic (the earlier start, then the lower id, survives), so two phones produce the same tombstone and nothing ping-pongs; prove it with a test that merges two devices both ways. Also make `buildCycles` defensive: two live episodes whose starts are within `CONTINUATION_GAP_DAYS + 1` days of each other are one period, even if normalization hasn't run.
- **The repair half of Fix 1 (derived, no migration).** Existing users may already hold phantom "periods" opened by a mid-cycle flow. Don't rewrite their synced data. Add one pure function, `splitEpisodes(live)` → `{ periods, strays }`: an episode is a **stray** when it starts fewer than `MIN_COUNTED_CYCLE` (15) days after the previous *kept* period's start. Strays are bleeding between periods, not periods.
  - **Every reader that means "a period" must use `periods`:** `buildCycles`, `predict` (`last`), `todayStatus`, `typicalPeriodLength`, `doctorNotes`/`completedPeriods`, `visual.ts`, `reminderPlan`, `exportData`, `PeriodReportService`, `late.ts`, `nextDates.ts`. Grep for every `liveEpisodes(` caller and decide each one explicitly. List them in your report.
  - **The strays' days are between-period bleeding days** for `betweenPeriods()` (a stray opened by a "Period started" tap has no flow log, so synthesize the days from the stray's span).
  - The calendar paints a stray lighter, as bleeding and not as a period.
  - The acceptance test: S3 **using data written by the old code** (with the phantom episode already in the list) produces the same cycles and forecast as the clean history.
- **Modes:** the same in every mode. Menopause keeps treating any bleeding as a logged event, so its existing doctor note still fires.

### Phase 2: stop creating the phantom (Fix 1)

New pure module `services/cycle/bleeding.ts` with `classifyFlowDay({ date, flow, episodes, days, prediction, mode, settings, today })` returning `"continues" | "starts" | "between" | "ask"`:

- A flow within `CONTINUATION_GAP_DAYS` of the last period's end is `continues` (existing behaviour, delegated to `episodes.ts`).
- **Spotting** is always `between` (unchanged).
- Normal and postpartum with a prediction:
  - flow on a day ≥ `earliest − START_SLACK_DAYS` (start at 4) is `starts`;
  - flow when `lateBy > 0` is `starts`;
  - fewer than `MIN_COUNTED_CYCLE` days after the last start is `between` (it cannot be a new period) — say so in one line;
  - otherwise (clearly early, any non-spotting flow) is `ask`.
- With **no prediction** (hormonal, postpartum before the first period, a first-ever log): `starts` when at least 15 days after the last start or when there is no last start, otherwise `between`.
- Pregnancy and menopause: unchanged.
- **What the user sees (the smallest UI):** in `DayLogSheet`, when `ask` applies, one inline question under the flow chips: **"Is this the start of your period?"** with two buttons, *Yes, my period started* and *No, bleeding between periods*. Yes calls the existing start path. No stores the answer so it is never asked again for that run of days. Unanswered means no episode and no change to any forecast. A second consecutive flow day re-opens the question once. The calendar's explicit "this day was a period day" toggle and the **Period started** button always mean what they say.
- **Storage:** `CycleSettings.bleedNotes: Record<string, "between">`, keyed by the first day of the run (like `gapNotes`); inherit the answer onto consecutive days. Add to `normalizeSettings`, defaults, export and "Delete all cycle data".
- Every caller of the old auto-open rule goes through this function: `logDay`, the lock-screen action handler (`services/notifications/cycleActions.ts`, which writes by itself), and anything else `grep PERIOD_FLOWS` shows.
- **Tests:** the S3 matrix (day 14 light / medium / heavy, day 16, day 26 inside the window, day 29 late, spotting at any time, two consecutive days), every mode, and an assertion that a "No" answer survives a sync merge.

### Phase 3: how much she is believed, and how long the second half is (Fixes 4, 6, 9)

**Fix 4:** replace the fixed-strength prior with a prior whose weight **fades with her own evidence and does not depend on her spread**.
- Evidence = the median of her last `STATS_WINDOW` counted cycles (n of them).
- Prior weight in "cycles' worth": `w0 = PRIOR_CYCLES × PRIOR_FADE^n`, with `PRIOR_CYCLES` 2 if she told us a length and 0.5 if she said "not sure", and `PRIOR_FADE` 0.6.
- `meanLength = (w0 × told + n × evidence) / (w0 + n)`. At 6 cycles the told value carries under 2%.
- Her **spread** still uses the shrunken MAD and the baseline by age or PCOS. The baseline only ever shapes the spread, never the mean.
- If any logged evidence exists, `confidence` must never say "told".
- *Tests:* the S1/S2 table; a person with 1 and 2 cycles (the prior must still matter, sensibly); and a person whose told value is right.

**Fix 6:** `DEFAULT_LUTEAL_DAYS` becomes **13**. Update every place that states 14 as the default: the header comment, `TEST_HALF_WIDTH` and its comment (the "11 to 16 days" range), `library.ts` pages (`how-it-works`, `ovulation`), `copy.ts`, `hormones.ts` and their tests. Personal luteal lengths from her own tests are unaffected.

**Fix 9:** an interval she has not answered about stops being invisible.
- Past the gap threshold and unanswered it stays excluded from the **mean**, because one skipped log would otherwise distort it.
- But it counts toward the **"long cycles" note** as "if that was one real cycle" (the note's wording says so), and its question stays visible.
- **If 2 or more of her last 4 intervals are unanswered gaps, stop treating them as missed logs.** A pattern of "missed logs" is unlikely to be all missed logs. Count them, ask once, and let her undo it.
- Raise the "likely missed log" gate from 45 to `GAP_MIN_DAYS` 60, because a 45-59 day cycle is common with PCOS and in the first years after periods start. Keep the `1.75 ×` rule.
- *Tests:* one 70-day interval (excluded, note shows with the "if real" wording), a pattern (counted), an answered gap (unchanged), and the headless path.

### Phase 4: tests, temperature and discharge (Fixes 5 and 7)

**Fix 5 (in `predict.ts`):**
- **First positive of the surge.** Rename the shared helper (`surgeStart`). Positives separated by more than `LH_RUN_GAP_DAYS` (3) belong to different runs; use the **first positive of the latest run** that starts on or after `LIVE_TEST_MIN_DAY`. Ovulation = that day + 1. Personal luteal = next start − ovulation. Existing users' learned luteal lengths will shift by a day or two once: say so in your report.
- **Negatives.** If she has logged negatives on at least 2 of the 3 days ending on day D, D is on or after `estimated ovulation − 1`, and there is no positive since cycle day 6, then ovulation is **not before D + 1**. Move ovulation and the likely start accordingly, cap the shift at `NEGATIVE_SHIFT_MAX_DAYS` (14), use the same window width as a positive-test cycle, and record `testBasis: "negatives"` so every surface can say: "Your tests haven't shown a surge yet, so I've moved your dates back." PCOS: neither positives nor negatives move dates (unchanged); keep the existing PCOS line.
- Add `testBasis: "positive" | "negatives" | "temperature" | null` to `Prediction`, and make `fromTest`'s copy (`copy.ts`, `nextDates.ts`, `hormones.ts`, `brief.ts`) read the right sentence for each.
- `nextDates.testingStartLine` and the doctor-check logic use the same helper; verify both.

**Fix 7:**
- **Temperature (needs D2).** A new optional day-log field `temperatureC` (stored in °C, range 34.0 to 42.0, 0.05 steps) with an optional display unit in cycle settings (°C or °F). One row in `DayLogSheet`, shown **only with the fertile window on**, like the ovulation test row. A new pure module `services/cycle/bbt.ts` detects a **sustained rise**: three consecutive days above the highest of the previous six readings, the third at least 0.2°C higher; ovulation is the day **before the first high day**. It needs at least 6 readings in the 10 days before, ignores implausible values, and is **retrospective only**. Say so on screen: "temperature confirms ovulation after it happens; it can't predict it".
  - A confirmed rise gives this cycle `testBasis: "temperature"`: ovulation is the confirmed day, the likely start is ovulation + `lutealDays`, the window uses the test-based width.
  - A confirmed rise is also a luteal sample for `personalLuteal` (one sample per cycle: prefer the LH-based one, otherwise the temperature one). This is the big win for people who don't buy tests.
  - Unlike LH, it is allowed with PCOS (a temperature rise reflects ovulation).
  - Add the field to `normalizeDayLog`, `isEmptyDayLog`, the export (end of `CSV_COLUMNS`) and the doctor summary only if a doctor would want it. Library: a page on temperature tracking, with honest limits (illness, alcohol, sleep and shift work disturb it) that quotes the same thresholds as the code, with a test.
- **Discharge (per D4).** With the recommended option: a day with `discharge: "clear_stretchy"` is flagged `fertileNow` for that day (a boolean in the view, painted like a fertile day), whether or not it falls in the estimated window. **No date moves.** Keep the existing check pattern in `signs.ts`. With "keep as check only", do nothing here.
- *Tests:* each rule above, PCOS, hormonal and pregnancy modes, a rise with too few readings (ignored), a noisy series (no false rise), the temperature path producing the same plan on the lean reminder path.

### Phase 5: an honest fertile window (Fix 2)

- **Model.** Estimate the ovulation day as a normal distribution around `ovulation`, with `sdOvulation² = max(MIN_OVULATION_SD², sigma² − LUTEAL_SD² + 1/precision)`: most cycle-to-cycle variation lives in the first half, and `sigma`/`precision` are already computed in `predict`. Use `LUTEAL_SD` 1.5, `MIN_OVULATION_SD` 1.0. If she has a personal luteal length from 3 or more samples, use their spread instead of 1.5.
- A day `d` is fertile when ovulation falls in `[d − 1, d + 5]`. Compute that probability for each day with a normal CDF and show the days at or above `FERTILE_MIN_PROBABILITY` (start at 0.2). Add `fertileCore` (days at or above 0.5) so the dial and calendar can draw the likeliest days stronger. Respect the existing floor: the window never reaches back into the period it follows.
- **Overrides:** a positive test, a confirmed temperature rise or a negatives shift narrows `sdOvulation` to `TEST_OVULATION_SD` (1.0), exactly like the existing test-based width.
- **Honest words:** when the window is wider than `WIDE_WINDOW_DAYS` (12), say why in plain words ("wide because your cycles vary, and tests narrow it"), and **never** present the edges as safe days.
- **Future cycles widen.** `paintDays` and `cycleEventSpecs` project later cycles. Each cycle ahead adds uncertainty (`sd_k² = sd² + k × sigma²`); the calendar draws the likeliest days strongest and the rest lighter, and the phone-calendar "rough" second block carries its wider range in its note.
- Type change: `Prediction` gains `fertileCore` and `fertileKnown: boolean` (Fix 3 uses it). The compiler will list every consumer of `fertileStart`/`fertileEnd`/`ovulation`; handle each explicitly (no `!`, no silent fallbacks).
- *Tests:* the regular/variable/told-only matrix, monotonicity (more spread never narrows), tests narrowing, hormonal and pregnancy giving no window, the floor, and the simulator's width table.

### Phase 6: when she is late (Fix 3)

- In `predict()`, when `today` is past the original `latest`, she is not in a period, and no new period has started, record `overdue: { days, original: { earliest, likely, latest } }`.
- **No stale projections.** While overdue:
  - drop second-cycle projections (calendar blocks beyond this cycle, the phone-calendar "rough" block);
  - this cycle's estimated ovulation and fertile window are marked unconfirmed (`fertileKnown: false`) **unless a positive test or temperature rise dated them**;
  - the forward window becomes a rolling "any day now": `earliest = today`, `latest = today + LATE_WINDOW_AHEAD` (5), `likely = today + 1`. It is labelled as such, never as a forecast with a number of days.
- `todayStatus.lateBy` keeps counting against the **original** window, so the late section, the headline and every "hold back when late" check stay correct.
- **Reminders:** verify the check-in is planned once and not re-created every day while she is late (the pending reminders are re-laid after changes). Verify the "trip" and "hungry week" planners ignore an overdue prediction.
- Pregnancy care: this must **never** soften the existing late-period advice (a home test is reliable from the day the period was due). Say in your report what you checked.
- **Modes:** normal and postpartum only. Hormonal and menopause never predict, so they never go overdue.
- *Tests:* S6 across `predict`, `paintDays`, `cycleEventSpecs`, `reminderPlan`, `view`; late with a positive test; a period that then arrives (the next prediction is correct); 3 and 10 and 40 days late.

### Phase 7: check its own accuracy (Fix 8)

- `backtest(...)` in a new pure module: for each of her last `BACKTEST_CYCLES` (6) completed counted cycles beyond the first two, run `predict` **as of the day after that cycle's start**, using only data up to then (reuse the technique in `nextDates.startReceipt`), and test whether the real next start fell inside `[earliest, latest]`.
- With at least `MIN_BACKTEST` (4) samples, compute `hits/n`. **Self-correct:** scale the window width by `m = clamp(1 + (n / (n + 4)) × (0.8 − hitRate) × 1.5, 0.85, 1.6)`, so a window that keeps missing widens and one that always lands tightens a little. Inner predictions run with calibration off (no recursion).
- Optionally correct a systematic bias (mean signed error ≥ 1.5 days over 5 or more forecasts) by at most 2 days, **only if the simulator shows it improves accuracy**.
- `Prediction.calibration: { n, hits } | null`. One quiet line on the cycle screen only from n ≥ 4: "5 of your last 6 forecasts landed inside the window." It counts exactly that, over exactly that scope.
- Performance: a test that `computeView` on 120 cycles of history stays fast (a few milliseconds); the lean reminder path must still not import anything heavy.
- *Tests:* a user whose cycles got more variable (window widens), a very regular one (tightens, never below the floor), a perfect forecaster, too little data (no line, no scaling), and the lean path matching the view.

### Phase 8: one medical standard (Fix 10, per D3)

- With the recommended option: short < 24, long > 38, prolonged bleeding > 8 days; variation limits unchanged (they are already FIGO); ages under 20 use 21 and 45. Put the numbers in named constants **in one place** that `flags.ts`, `doctorChecks.ts`, `library.ts`, `copy.ts` and `exportData.ts` all import.
- Update every library page so it **quotes the same thresholds the code acts on** (the existing tests assert it) and cites its source in one plain line. Update note signatures only if the evidence changes (a dismissed note must not reappear for no reason).
- *Tests:* a 23-day and a 24-day cycle, a 38 and a 39, an 8-day and a 9-day bleed, age 17 and 30, and that previously dismissed notes behave sensibly.

### Phase 9: the pill (Fix 12, only if D5 says yes)

Smallest version that is honest:
- When she says "yes" to hormonal contraception, one follow-up question: **"Which one?"** with *Combined pill* / *Another method*. Store `Contraception.method?: "combined_pill" | "other"`, plus `packDays` (28 by default; options 28 and 91 for an extended pack) only for the pill. Add to the normalizer (an answer without a valid shape is no answer).
- For the combined pill only, add one **scheduled-bleed** forecast: `lastBleedStart + packDays`, ±2 days, labelled **"from your pack schedule"**, never "your period". No ovulation, no fertile window, no phases, no "late" logic, no hormone card, no hungry-week plan, no "why am I late" (the existing behaviour for hormonal mode). A missed expected bleed on the pill is something a pregnancy test answers: use the existing pregnancy-test line, nothing new.
- Reminders: only the existing "has it started?" check-in, once, after the window.
- Everything else in hormonal mode is unchanged. `cycleModeOf` keeps returning `"hormonal"`; the pill forecast is a separate small field so no mode switch elsewhere has to change.
- *Tests:* modes table updated, the pill forecast, "another method" staying log-only, stopping the pill (the existing fresh-start rule), and the headless path.

### Phase 10: bring it together

1. **Consumer audit.** Grep every use of `fertileStart`, `fertileEnd`, `ovulation`, `likely`, `halfWidth`, `lateBy`, `cycleLength`, `liveEpisodes(` and `lastPositiveTest`. For each file, one line in your report: what it does now. Include `services/calendar/*`, `PeriodReportService`, `brief.ts`, `copy.ts`, `exportData.ts`.
2. **Modes audit:** for each of normal, hormonal, pregnancy, postpartum and menopause, read what every fix shows. Extend `modes.test.ts` and the table in `docs/cycle/smart-cycle.md`.
3. **Re-run the simulator** and fill the "after" columns in `docs/cycle/engine-accuracy.md` next to the "before" ones. Say plainly where a number did not improve.
4. **Privacy check:** list every new piece of stored data (`bleedNotes`, `temperatureC`, temperature unit, `Contraception.method`/`packDays`), and confirm each is inside the backup namespace, in the export, and removed by "Delete all cycle data". Confirm nothing new reaches Gozlin or the lock screen.
5. **Legal** per D2, republishing only with the owner's OK.
6. **Docs:** a section per fix in `docs/cycle/smart-cycle.md` (rules, thresholds, files, storage fields).
7. **Memory:** update the cycle-engine-audit memory with what was fixed, and add any traps you learned.

---

## Done means

- The 11 fixes (and Fix 12 if approved) work end to end and in every mode.
- Every acceptance test from Phase 0 passes. The audit scenarios now give: no phantom period, a fertile window that widens with uncertainty and narrows with evidence, no stale dates when late, a prediction that follows her real cycles, and one medical standard.
- `docs/cycle/engine-accuracy.md` shows before and after numbers from the simulator.
- Typecheck and lint are clean and **all tests pass**. The count never went down without a stated reason.
- The headless reminder path still gives the same plan as the full view.
- Legal wording handled exactly per D2, and nothing published without the owner's OK.
- No crash reached the owner's phone during the work. Nothing is committed unless the owner asked. No build was started.

## Your final report to the owner (plain English, no jargon)

1. **What's different now,** one line per fix, saying what they will notice on the phone.
2. **How to try each one,** step by step. Some need history or the fertile window switched on. Say which, and what they see in the meantime.
3. **What may look different for people who already use it:** forecasts may move once (the setup answer fades, the second-half default changed from 14 to 13 days, a stray mid-cycle bleed is no longer counted as a period, and the doctor notes may warn less often under the new standard).
4. **Anything they must do:** for example approve publishing the updated privacy pages. Give click-by-click steps, why it matters, and whether it is optional.
5. **The accuracy numbers:** the before and after of how often the app's window contained the real period, in one small table.
6. **Decisions you made on their behalf,** each in one line, so they can overrule.
7. **Anything you skipped or couldn't do, and why.**
