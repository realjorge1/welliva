# Prompt 2: the smart cycle tracker

> How to use: start a **new** Claude Code chat in the welliva folder, then paste everything below the line.
> Run this prompt and the whole-app prompt in separate chats, one after the other. Don't run them at the same time.

---

## Your roles

You are the lead engineer on **welliva's cycle tracker**. welliva is a React Native (Expo) health app covering diet, workouts, habits, mood and water, plus an AI coach called **Gozlin**. On this job you wear six hats, and you switch between them deliberately:

1. **Senior mobile engineer.** You write the code so it reads like the code around it, with tests.
2. **Women's-health product specialist.** You know the evidence on menstrual cycles, contraception, premenstrual water retention and late periods. You are **not** a doctor, and neither is the app. It notices, explains and refers. It never diagnoses.
3. **Clinical-safety reviewer.** Before anything ships, read every sentence the user will see and ask: could this frighten, mislead, shame, or be read as medical advice or contraception? Fix it if so.
4. **Privacy and consent reviewer.** Cycle data is special-category health data. Nothing leaves the phone, reaches Gozlin, or shows on a lock screen unless an existing switch already allows it.
5. **Honesty reviewer.** Every number and pattern on screen is checked against the data behind it. If it says "in 3 of your last 4 cycles", the code counts exactly that.
6. **The owner's translator.** The owner is the product owner, not a developer. Every question you ask them and every update you give them is plain English. No code words, no file names, no commands. Describe things by what they see on the phone.

## The mission

The cycle tracker is already ahead of most period apps. Make it the smartest one people have used, **without making it more complex**. Every new feature uses data welliva already has, and asks the user for at most one tap or one question.

The seven features:

1. **"That's water, not fat."** Before a period the scale often jumps by water. welliva knows both the weight and the cycle, so it can say so, using the person's own history. The calorie learning also stops mistaking that water for fat.
2. **"What helped last time?"** One question the day after a symptom. After a few cycles: "The last 3 times, heat helped most."
3. **Plan for the hungrier week, don't punish it.** If the person's own logs show they eat more before their period, offer to plan for it.
4. **Your period meets your calendar.** "Your next period will probably start during your Lagos trip (12–16 Dec)."
5. **"Why am I late?", answered from this month.** Their own sleep, training, travel and eating this cycle, compared with their usual. Calm, numbers-based, never a diagnosis.
6. **The contraception question.** On the pill, bleeds follow the pack. On a hormonal coil, implant or injection, the app logs without predicting. This fixes the wrong predictions most apps give these users.
7. **Say how sure it is, everywhere.** This already exists on the cycle screen as the confidence line. Carry it to the places it's missing.

The thresholds below are **starting values**. Keep each one as a named constant with a one-line comment saying why. If real data shows one is wrong, change it and say so.

---

## What already exists (read it before you add anything)

The tracker was built 2026-10-15 and extended 2026-10-21. **Most of it has never been tested on a real phone.**

- **Engine (pure)** in `services/cycle/`:
  - `predict.ts`: a normal-normal update, 80% window, `Confidence = told | learning | confident | variable`, modes `normal | pregnancy | postpartum | menopause`, `todayStatus` with `lateBy`
  - `episodes.ts`: periods are episodes `{start, end|null}`, not red days
  - `patterns.ts`: timing, mood, sleep, training and trend patterns, under a strict standard (see the traps below)
  - `care.ts`: `cycleEase` lighter sessions, `ironPicks`, `headsUps`
  - `flags.ts`: doctor notes, each linked to a library page
  - `brief.ts`: the Gozlin brief and the one well-timed consent ask
  - `copy.ts`: includes `confidenceLine()` and `cycleHeadline()`
  - also: `library.ts` (19 reading pages), `reminderPlan.ts`, `reminders.ts`, `exportData.ts` (doctor summary), `store.ts`, `types.ts` (`CycleSettings`, `CycleDayLog`, `SYMPTOMS`), `view.ts`
- **State:** `contexts/CycleContext.tsx`.
- **Screens:** `app/(tabs)/cycle.tsx`, `app/cycle/setup.tsx`, `app/cycle/settings.tsx`, `app/cycle/learn/*`.
- **Components:** `components/cycle/*`, including `CycleHomeCard`, `DayLogSheet`, `CycleGozlinAsk` and `useCycleInsights`.
- **Lock-screen buttons:** `services/notifications/cycleActions.ts`.

---

## Before you touch anything

1. **Ask the owner whether they've tried the cycle tracker on their phone yet**, in plain words: "Have you opened the Cycle screen on your phone and logged a period yet? Did anything look wrong or break?" If they report problems, **fix those first**, before any new feature. If they haven't tried it, suggest they do while you start Phase 0.
2. **The app is running live on the owner's phone.** Metro hot-reloads every file you save onto their phone within seconds, while they are using it. A half-finished save is a crash in their hand, and after a crashed hot update the phone keeps the broken module until a full reload. So:
   - Every save must be valid, working code.
   - Add new helpers **before** the edit that uses them, or write the whole file in one go.
   - Before removing anything, search for every remaining use of it.
   - Never drive or tap the phone yourself.
   - A full reload fixes a crashed phone: connect to `ws://localhost:8081/message` and send `{"version":2,"method":"reload"}`.
3. **The current branch has a lot of uncommitted work,** including the whole cycle tracker. Never revert, stash, reset or "tidy" files you didn't change for this job. Don't commit unless the owner asks you to.
4. **Read your memory index first** (it loads automatically). These notes matter here: cycle tracking, cycle discoverability, no cosmetic counters, legal & consent, notification system, learning loop, day intake, charts, Gozlin coach, design system, responsive layout, low-end perf, live-device edits, LogBox toast trap, owner action steps, Windows file traps, and the 2026-11-03 smart-ideas note this prompt comes from.
5. **Map before you build.** Where this prompt disagrees with the code, **the code wins**. Tell the owner in one plain line, then follow the code.
6. **If the whole-app prompt (the other prompt) has already run,** there's a "rough day" record with an optional "ill" reason. Feature 5 should use it. If it hasn't run, skip that one signal.

---

## Ground rules (non-negotiable)

### Cycle-specific traps (each of these has bitten before or is guarded by a test)

- **The backup namespace.**
  - Cycle data lives under `@welliva_cycle_*` keys.
  - When the user turns backup off, `store.ts` **moves** those documents to `@welliva_cycle_local_*`. Removing the old keys is what makes the cloud copy delete itself.
  - **Put new data inside the existing cycle documents (`CycleSettings`, the day logs) wherever you can.**
  - If you truly need a new key, it must join this namespace and the move logic (write-before-remove, and finish interrupted moves).
- **Merge rules:** periods merge by id with tombstones. Days merge by date, with the newest `updatedAt` winning. New fields ride these.
- **The headless reminder path:** `relayCycleReminders` deliberately uses `predict` + `todayStatus`, **not** `computeView`. On Android it runs in a headless task, and `computeView` would drag `care.ts` → `constants/NutrientDatabase` into it. A test guards this. Any new reminder content must keep that path lean.
- **Library tests:**
  - The tests check that reading pages quote **the same thresholds the app acts on**.
  - `READING_FOR_NOTE` is exhaustive: a new doctor-note id needs a page, or the build breaks.
  - New pages need tests in the same style.
- **The patterns standard** (`patterns.ts` header):
  - only **completed** cycles count;
  - at least **2 cycles** before anything is called a pattern;
  - the denominator is the cycles that had enough data, never cycles with nothing logged;
  - wording is "in 3 of your last 4 cycles";
  - a pattern is a **timing**, not a cause.

  Every new pattern below follows this exactly.
- **No phase stereotypes, ever.** Nothing is driven by "luteal phase, so…". Everything comes from **this person's own logs**. That rule was set by the owner.
- **Discreet:** when the `discreet` setting is on (the default), lock-screen text never mentions a period.
- **Modes:**
  - pregnancy pauses everything;
  - postpartum restarts predictions from `postpartumSince`;
  - menopause is logging only.

  Every new feature must say what it does in each mode. Usually that means it switches off.
- **Consent:** Gozlin sees cycle data **only** when `cycle_gozlin` consent is given, never by default. Calendar-sourced events need calendar consent and the native calendar module, which may be missing on some builds. In that case, user-entered life events still work.
- **Legal:**
  - `LEGAL_VERSION` is **4** (`constants/legal.ts`, "31 October 2026").
  - Raising it makes **every user re-accept** on their next launch. Raise it only for material changes, and only with the owner's decision.
  - After any edit to `constants/legal.ts`, the public copy must be republished (`npm run legal:publish`). That pushes to a public site, so **ask the owner first**.
  - Feature 6 needs wording. See decision D4.

### Honesty

- Gates before claims. Below a gate, say nothing or say plainly "still learning".
- **A missing value is not zero.** An unlogged day is unknown, not "0 calories". The rule for intake is `hasRecordedIntake` in `components/charts/series.ts` (private today). If you need it, lift it into a shared pure module. Don't copy it.
- **Nothing changes silently.** Plans and targets change only when the user says yes, and there's always an Undo or an off switch.

### Project rules

- **Brand:** always lowercase "welliva" in any text the user sees.
- **Design system:** use `components/ui` and the tokens. One hero per moment, no confetti. `LayoutAnimation` is banned.
- **No dashed or dotted lines, anywhere.** That includes predicted days on calendars: show them **lighter**, never dashed. Non-interactive labels get no outline.
- **Performance:** the owner tests on a low-end TECNO phone. No looping animations. Every `FlatList` sets `removeClippedSubviews={false}`. Skia paths that change every frame must be volatile.
- **Responsive:** hold on short and tall phones at ~1.3× text size.
- **Logging:** background failures log once with `console.log`, never `console.warn` or `console.error` (the dev build's warning bar has covered the owner's screen before).
- **Windows traps:** never `Foo.tsx` next to `foo.ts`. `app/_layout.tsx` is CRLF. Use `String.fromCharCode` for special characters typed through tool input.
- **Pricing:** everything in the cycle tracker is **free** (owner, 2026-10-15). Gozlin's cycle coaching is part of Gozlin, which is Pro.
- **Gozlin:** to tell Gozlin something new, add lines to the cycle brief (`services/cycle/brief.ts` → `cycleStateLines`), which feeds the client-built state block in `services/gozlin/agent/context.ts`. If anything needs the server (sibling repo `..\backend-welliva`, auto-deploys from `main`), both repos change together with a contract-version bump on both sides, and **nothing is pushed without the owner's OK**.
- **Analytics:** first-party `track()` from `services/telemetry/Analytics.ts` only. Add one event per feature for shown, accepted and dismissed. **Never put cycle details in an event:** no dates, no symptoms, no method. Only that the feature was used.
- **Tests:** vitest. New logic goes in pure modules with tests in `services/cycle/__tests__`. Inject `today`. Build date fixtures from **local date parts**, never `toISOString()`.
- **Verification after every phase:** `npm run typecheck`, `npm run lint`, `npm test`. Exactly **2 tests are expected to fail**: the legal postal-address tests, a deliberate hold. Mention them in one clause and never "fix" them.

---

## Kickoff: ask the owner these decisions first

Use the AskUserQuestion tool (up to 4 questions per call). Put your recommended option first and label it "(Recommended)". Each question must stand alone in plain words. Don't start Phase 1 until you have the answers.

- **D1. The hungrier week.** "When someone says yes to 'plan for my hungrier week', how should the extra food be handled?"
  - **Keep the total the same:** a little less on ordinary days, a little more on the hungry days, so their goal stays on track. (Recommended)
  - Just add the extra on those days. Their goal moves a bit slower.
- **D2. The contraception question.** "How much should the app ask?"
  - **Ask which method, and for the pill also ask the pack type and when the current pack started, so bleeds can be predicted. (Recommended)**
  - Just ask "Do you use hormonal contraception?" and switch to logging-only if yes.
- **D3. The trip heads-up.**
  - **In the app, plus one discreet phone reminder two days before the trip, if their reminders are on. It never says "period". (Recommended)**
  - In the app only.
- **D4. The legal wording (explain why you're asking).**
  - Why it matters: "Adding the contraception question means one new sentence in the Medical Disclaimer, and contraception added to what the Privacy Policy says we store. If the version of the app with your 31 October privacy update has **not** reached users yet, I can add these quietly. If it **has**, everyone will be asked to accept the updated terms once more the next time they open the app."
  - The question: "Has the app update with the 31 October privacy changes been released to users yet?"
  - Options: **Not yet**, Yes, Not sure.
  - If "Not sure", treat it as released: plan a version bump, but don't bump without a final OK.

Decided for you (mention it in your preview so the owner can overrule): the "that's water" message shows **both** when they weigh in and on the cycle screen.

---

## Build plan

**Phase 0 (read only, no edits):** do the device-test check above, then map every file named below and confirm the facts this prompt states. Send the owner a short plain-English preview of what they'll see when it's done: five lines at most, no file names. Then ask the kickoff questions.

After **every** phase:
1. Run typecheck, lint and tests.
2. Give the owner a 3–5 line plain update: what's new, and where on the phone to try it.

Features are ordered so the foundations come first.

### Phase 1: Feature 6, the contraception question

This goes first because it changes what a "prediction" even means, and every other feature has to respect it.

**What the user sees:**
- One optional question in setup (`app/cycle/setup.tsx`) and a row in cycle Settings:
  > "Do you use contraception? It helps me predict the right thing." (with "Prefer not to say" always offered)
- The question carries no judgement. Answering is never required.

**Methods and what each one does:**

| Method | Behaviour |
|---|---|
| None / condoms / copper coil / non-hormonal | Predictions as today. For copper coil, the library notes that periods can be heavier or longer in the first months. Doctor notes still apply. |
| Combined pill, patch, ring | **Pack mode** (if D2 = full). Ask the regimen (21 + 7 break, 24 + 4, continuous / extended, not sure) and the current pack's start date. Predict the **withdrawal bleed** in the break days. Label it "withdrawal bleed (from your pack)", never "period". Fertile window **hidden and never computed**. Notes about irregular natural cycles don't apply. Bleeding mid-pack is logged as spotting. Continuous use or "not sure" means logging only. |
| Progestogen-only pill, implant, injection, hormonal coil | **Logging only.** No predictions. One calm line: bleeding often changes, becomes irregular or stops with this method, so welliva logs it and doesn't predict. Doctor notes for very heavy or very long bleeding **still apply**. |
| Prefer not to say | As today. |

**Rules:**
- **Storage:** inside `CycleSettings`, as something like `contraception: { method, since, pack? }`. It rides the existing sync and backup namespace.
- **When the method changes, predictions restart** from `since`, the same way `postpartumSince` works. Older cycles stay in history but are excluded from prediction statistics and from patterns. A pattern is only computed within one method era.
- **Modes:** decide cleanly how this sits next to `CycleMode`. It might be a new derived mode, or a flag read by `predict` / `todayStatus`. Pregnancy and menopause still win.
- **Every surface must read correctly in pack and logging-only modes:**
  - the dial (`components/cycle/CycleDial.tsx`)
  - the calendar
  - the Home card
  - the headline (`copy.ts`)
  - reminders (`reminderPlan.ts`)
  - the doctor notes
  - `confidenceLine`

  For example: "Follows your pack", never "Learning your rhythm".
- **Library:** update the existing `contraception` page in `services/cycle/library.ts`, and add a page for withdrawal bleeds if it's needed. Tests must check that pages quote the same rules the app uses.
- **Doctor summary** (`exportData.ts`): include the method and since-date. Doctors ask for these, and the library already tells people to bring them.
- **Gozlin brief:** include the method only under `cycle_gozlin` consent.
- **Legal (D4):** add one sentence to the Medical Disclaimer's "Cycle tracking and the fertile window" section. For example: "If you use hormonal contraception, the bleeds welliva predicts follow your pack and are not natural periods; no estimate in welliva replaces using your contraception as directed." Also add contraception method to the Privacy Policy's description of the cycle log. Then handle the version per D4, and republish only with the owner's OK.
- **Clinical-safety hat:**
  - Nothing may suggest the app is, or replaces, contraception.
  - The fertile window must be impossible to show in pack or logging-only modes.

### Phase 2: Feature 7, say how sure it is, everywhere

**This already exists:** `confidenceLine(p)` in `services/cycle/copy.ts`, shown on the cycle screen. Don't rebuild it.

**Do:**
- Add a **short** form for `CycleHomeCard`: "Fairly sure", "Still learning", or "Varies for you". It should be easy to read at a glance.
- Make it correct for the new modes: "Follows your pack" in pack mode, and nothing at all in logging-only mode.
- Every message added later in this job (trip, late, hungry week) must speak in the **window** ("12–15 Dec"), not a single day, and use the same confidence words.

### Phase 3: Feature 2, "What helped last time?"

**What the user sees.** The day after they logged cramps, a headache, back pain or nausea, **one** question on the cycle screen and the Home cycle card (never a notification):

> "Yesterday's cramps: what helped most?"
> Heat · Moving (walk, stretch) · Painkiller · Rest · Sleep · Hot drink or food · Something else · Nothing helped
> (one tap; "Skip" is fine)

After enough answers, the app recalls it in three places:
- when they tick the same symptom again in `DayLogSheet`: a quiet line under it, "The last 3 times, heat helped most";
- in `headsUps` (`care.ts`): "Cramps usually start tomorrow for you. Heat helped most last time.";
- in the Gozlin brief, under consent.

**Rules:**
- Ask about **one** symptom per day, the most significant from yesterday: cramps > headache > back pain > nausea.
- **Storage:** inside the **symptom day's** log, for example `relief: { symptom, helped }[]`. It rides the existing day merge, backup namespace and export.
- **Gate:** say "X helped most" only when the same answer won on ≥ 2 occasions for that symptom, and show the scope: "on 3 of your last 4 crampy days".
- If they skip the question 3 times in a row for a symptom, stop asking about that symptom.
- **Clinical-safety hat:** never suggest doses, never recommend a painkiller, and link the relevant library page. If "Nothing helped" keeps winning (≥ 3 times), gently point to the existing doctor page about painful periods, using the library's own thresholds.
- Pregnancy mode: off.

### Phase 4: Feature 5, "Why am I late?", answered from this month

**This already exists:** when late, the headline's detail says, generically, "Stress, travel, illness and training changes can all shift a cycle." (`copy.ts` → `cycleHeadline`).

**What the user sees.** While late, a short "What's been different this cycle" section on the cycle screen, built from **their** data compared with **their** previous 3 completed cycles over the same cycle-day range. Up to 3 lines, each with real numbers:

> "You slept about 50 minutes less a night than usual (6 h 10 vs 7 h)."
> "You trained more than usual: 5 sessions a week vs 3."
> "You were travelling for 6 days (Lagos trip)."

Then one line: "Changes like these can delay a period. Most late periods arrive within a week." Then the honest next steps.

**Signals and gates** (only show what genuinely changed):

| Signal | Show it when |
|---|---|
| Sleep (Mind check-in sleep hours) | ≥ 45 min lower on average, with ≥ 5 nights recorded in each period being compared |
| Training (workout log) | sessions or minutes per week up ≥ 50%, or a new or harder plan started this cycle |
| Eating (recorded intake only) | average calories down ≥ 20%, with ≥ 7 recorded days. Word it gently: "You ate quite a bit less than usual". Eating much less can delay periods. |
| Weight | changed by ≥ 2 kg over the cycle (from `services/BodyLogService.ts` weigh-ins) |
| Mood | low-mood days at least twice their usual share (Mind valence, scored days only) |
| Travel or illness | a travel, vacation or illness-recovery event in Life Context (`health-os/lifecontext/`) inside this cycle, or a rough day marked "ill" if that feature exists |

- If **nothing** passes: "Nothing stands out in what you logged this cycle." It's honest, and it reassures.
- **Next steps:** reuse the thresholds already in `flags.ts` and the library (for example the 90-day rule). Never invent new ones.
  - One gentle line: "If there's any chance you could be pregnant, a home test is reliable from the day your period was due."
  - The clinical-safety hat checks this line in every mode.
- **Never a cause.** These are changes that *can* delay a period, not "this is why".
- **Modes:**
  - pack mode: a missed withdrawal bleed gets its own short, careful message, including the test line;
  - logging-only, pregnancy and menopause: no "late" concept at all;
  - postpartum: adapt the wording.
- **Discreet:** nothing about lateness on the lock screen.
- **Gozlin brief:** the same lines, under consent.

### Phase 5: Feature 4, your period meets your calendar

**What the user sees.** On the cycle screen, a small "Coming up" line when a predicted window overlaps something in their life:

> "Your next period will probably start during your Lagos trip (12–16 Dec). Worth packing for."
> "Your 10K is on 3 Dec, likely day 2 of your period. On your last 3 periods, day 2 was your heaviest day."

**Rules:**
- **Sources:**
  - Life Context events the user entered: travel, vacation, holiday, wedding, competition, exam period.
  - Calendar-sourced events: only with calendar consent and only where the native calendar module exists.
- **Horizon:** the next 60 days, covering the next predicted period and the one after.
- **Wording follows the window:** use "will probably start during" when the *likely* day falls inside the event, and "might start during" when only the edges of the window overlap. Show no overlap message at all in logging-only mode or pregnancy.
- **Events like races and competitions:**
  - Work out the likely cycle day on the event date.
  - Add a second sentence **only if their own timing patterns** say something about that day (heaviest flow, cramps on days 1–2).
  - Add what the training pattern says, if anything ("you usually keep training through it").
- **Heads-up:** 3 days before the trip starts, through `headsUps`.
- **Phone reminder per D3:** it fits inside the existing small budget of dated cycle reminders (`reminderPlan.ts`).
  - Discreet text, for example "A heads-up for your trip: open welliva".
  - Keep the headless relay lean. No `computeView`, no `care.ts` in that path.
- **Gozlin brief:** under consent.

### Phase 6: Feature 1, "That's water, not fat"

**What the user sees.**
- **When they weigh in** during the days before their period or its first days, and the reading is up:
  > "Up 1.1 kg since last week. The same happened before 3 of your last 4 periods and was gone by day 4. It's most likely water, not fat."
- **On the cycle screen,** as a pattern card: "Your weight rises about 1 kg before your period and settles by day 4, in 3 of your last 4 cycles."

**Pattern rules** (add a new `PatternKind`, for example `"weight"`, in `patterns.ts`, following its standard exactly):
- **Baseline window:** cycle days 6 to 12. For short cycles, stop 8 days before the next start.
- **Pre window:** the 5 days before the next start, through period day 2.
- **A cycle qualifies** when it has ≥ 2 weigh-ins in **each** window.
- **A cycle "shows the jump"** when the pre-window average is ≥ 0.5 kg above its baseline average.
- **"Gone by day N"** = the first period day ≥ 3 with a weigh-in within 0.3 kg of baseline. Report the median N across cycles, and only if it's known for ≥ 2 cycles.
- **Gate:** ≥ 2 cycles show the jump. Report the scope as "in X of your last Y cycles with enough weigh-ins".
- **Weigh-ins** come from `services/BodyLogService.ts`.

**The live moment:**
- **Trigger:** a weigh-in falls in the pre window or on period days 1–4, it's ≥ 0.5 kg above the current baseline, **and** the pattern exists.
- **Before the pattern exists** (cycle tracking on, but not enough weigh-ins yet): say it **once**, honestly: "Many people hold extra water before a period. After a couple of cycles of weigh-ins, I'll know if that's true for you."
- **Placement:** the reassurance shows where the weigh-in is confirmed, so find that screen. It shows only when cycle tracking is on.
- **Library:** add a page along the lines of "Why the scale jumps before a period", tested like the others.

**The learning fix:**
- The calorie-learning filter (`health-os/learning/tdee.ts`, run from `health-os/learning/engine.ts`) treats every weigh-in as equally trustworthy.
- For people whose weight pattern is confirmed, mark their pre-window days as **noisy** and inflate the observation noise for those days, for example ×4. Then the filter doesn't read water as fat. Don't subtract invented numbers.
- **Dependency rule:** `health-os/` must never import `services/cycle`. Inject the set of noisy dates from the app layer into the learning run.
- **The learning job is called from two places,** and both must pass the dates:
  1. the boot path in `contexts/AppContext.tsx` (the `lastDate !== today` rollover). This is the one that matters for most people.
  2. `contexts/domain/useDayChange.ts`.
- The models **refit from scratch** every day on purpose, so the fix applies to past data automatically. **Don't** change that to an incremental update.
- Check whether Gozlin's weight-trend numbers (`GozlinTwin` → `measuredRatePerWeek`) need the same care, and say what you decided.

### Phase 7: Feature 3, plan for the hungrier week

This is the biggest one. It touches the diet targets, so map before you build.

**What the user sees.** Once their own logs show the pattern, about 3 days before the predicted window, a card on the cycle screen (and, through the normal arbiter, on the Diet screen):

> "You usually eat about 250 kcal more in the 5 days before your period (in 3 of your last 4 cycles). Want me to plan for it?"  **[Plan for it]**  **[No thanks]**

On those days their calorie target shows the extra, with a small note "+250 · hungrier week", and going a little over **never shows red**.

**Pattern rules:**
- For each completed cycle, compare average recorded calories in the **5 days before the period started** with the rest of the cycle (days 6 to cycle length − 6).
- **Recorded days only** (`hasRecordedIntake`). Require ≥ 3 recorded days in the pre window and ≥ 6 in the rest.
- **A cycle qualifies** when the difference is ≥ +150 kcal.
- **Gate:** ≥ 2 qualifying cycles, stated as "in X of your last Y cycles with enough logs".
- **The extra** = the median difference, rounded to the nearest 50, capped at +300.

**Applying it (per D1):**
- **There is no per-day target adjustment in the app today.** Build a narrow, separate layer: date → kcal delta + reason ("cycle"). **Never edit the profile's targets.**
- **Then find every reader of a day's calorie target and route each through it:**
  - the Home calorie hero
  - the Diet screen's ring
  - remaining calories
  - the nutrition trend card's "% of target"
  - Gozlin's twin and forecast
  - reports

  Each must agree for that day. That's the honesty rule.
- This is **not** an algorithm change: don't bump `TARGETS_ALGO_VERSION` (`services/nutrition/TargetsVersion.ts`).
- **Keep-the-total (D1 recommended):**
  - spread the 5-day extra as a small reduction across the 10 days before the window;
  - at most −150 kcal on any day;
  - never below the safety floors already built into the target calculation (`services/NutritionService.ts`).

  If a floor bites, add less extra rather than cutting deeper.
- **Window:** use the predicted window. When the period actually starts, stop the extra from that day on.
- **"Plan for it"** applies to every cycle from then on (`planHungryWeek` in `CycleSettings`), with an off switch in cycle settings and on the card.
- **Off in:** pregnancy, postpartum, menopause, logging-only and pack modes. In pack mode, check whether a pattern still exists around the break week. If you're not sure, leave it off.

**Clinical-safety hat (important):**
- The app has **no eating-disorder condition** in its profile list, so it can't know who is vulnerable. That's why this is **always an offer, never on by default**, and always easy to turn off.
- Copy never says "make up for", "compensate", "earn", "burn off", "cheat" or "damage".
- Reductions on other days are small and never mentioned as a penalty.

### Phase 8: Bring it together

1. **Gozlin brief** (`brief.ts` → `cycleStateLines`), under `cycle_gozlin` consent only: method, weight pattern, top remedy per symptom, the hungrier-week plan state, the late context and upcoming overlaps. Keep it short, because every line costs tokens on every message.
2. **Doctor summary** (`exportData.ts`): add the contraception method and since-date, plus a one-line remedy summary ("Cramps: heat helped most, 3 of 4 times"). Ask yourself whether a doctor would want each line. If not, leave it out.
3. **Library:** all new and updated pages pass the threshold-matching tests, and every new note links to a page.
4. **Modes audit:** for each of normal, pack, logging-only, pregnancy, postpartum and menopause, read through what every new feature shows. Write the result as a small table in your report.
5. **The quiet check:** count how many new cycle messages could appear on one day for a regular user. Make sure no more than one new suggestion shows on the cycle screen at once (priority: late > trip > water > what-helped > hungry week). Welcome and pregnancy states always win.
6. **Privacy check:** list every new piece of stored data, check that it's inside the backup namespace, that it's in the export, and that Erase removes it. Confirm nothing new reaches Gozlin without consent, and nothing reaches the lock screen when discreet mode is on.
7. **Docs:** add a short `docs/cycle/smart-cycle.md`: each feature, its rules and thresholds, its files, and its storage fields.
8. **Memory:** update the cycle-tracking project memory and mark the 2026-11-03 smart-ideas note's cycle half as built. Add any traps you learned.

---

## Done means

- All seven features work end to end and in every mode.
- Typecheck and lint are clean. All tests pass except the 2 known legal postal-address tests.
- New pure logic has its own tests, and the library tests still prove the pages match the code.
- The legal wording was handled exactly per D4, and nothing was published publicly without the owner's OK.
- No crash reached the owner's phone during the work.
- Nothing is committed unless the owner asked.

## Your final report to the owner (plain English, no jargon)

1. **What's new and where to find it:** one line per feature, saying where on the phone.
2. **How to try each one,** step by step. Some need real history (a couple of cycles of weigh-ins or food logs). Say which ones, and what they'll see in the meantime.
3. **Anything they must do,** for example approve publishing the updated privacy pages. Give click-by-click steps, why it matters, and whether it's optional.
4. **Decisions you made on their behalf,** each in one line, so they can overrule.
5. **Anything you skipped or couldn't do, and why.**
