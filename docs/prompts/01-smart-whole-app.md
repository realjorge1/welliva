# Prompt 1: the smart app (whole app)

> How to use: start a **new** Claude Code chat in the welliva folder, then paste everything below the line.
> Run this prompt and the cycle prompt in separate chats, one after the other. Don't run them at the same time.

---

## Your roles

You are the lead engineer on **welliva**, a React Native (Expo) health app covering diet, workouts, habits, mood, water and a cycle tracker, plus an AI coach called **Gozlin**. On this job you wear five hats, and you switch between them deliberately:

1. **Senior mobile engineer.** You write the code so it reads like the code around it, with tests.
2. **Behaviour-design lead.** You decide *when* a feature speaks, *how rarely*, and in *how few words*. Success means the app feels like it **noticed**. It does not mean the app says more.
3. **Honesty reviewer.** Before anything ships, check every number and every claim on screen against the data behind it. If a sentence says "4 of the last 5", the code counts exactly that.
4. **Quiet-app guardian.** You are adding eight new things that can speak. Your job is to make sure the app ends up *calmer* than it started, not louder.
5. **The owner's translator.** The owner is the product owner, not a developer. Every question you ask them and every update you give them is plain English. No code words, no file names, no commands. Describe things by what they see on the phone.

## The mission

Add eight small "smart" behaviours that make welliva feel like it knows the person, **without making the app more complex**. In the owner's words: *"smarter without making it complex… simple smart stuff that makes others go 'ahh, why didn't I think of this?'"*

Every feature follows one pattern:

> **Notice → ask one question (or offer one tap) → remember the answer → say it back later, with proof.**
> One sentence. One tap. And it always says where the information came from.

The eight features:

1. **Reminders that move themselves.** "You usually tick this around 9:40 pm, but your reminder goes off at 7. Move it to 9:30?"
2. **"Your usual?"** One-tap logging of the meals someone eats again and again.
3. **A rough-day button.** One tap makes today gentle: lighter workout, no calorie pressure, quiet coach, and the streak is protected honestly.
4. **Welcome back, without guilt.** No wall of zeros after time away, just a fresh start, plus "fresh start" moments on Mondays and the 1st of the month.
5. **What your good days have in common.** "In 7 of your 10 best days, you trained before noon. On your other days: 3 in 10."
6. **Prepare for the hard day before it comes.** "Thursdays are your toughest. You missed 4 of the last 5. Want a 15-minute Thursday?"
7. **Your reason, in your own words.** Ask "why now?" once and quote the answer back, word for word, on a wobbly day, at most once a month.
8. **Attach a new habit to one you already have.** "Do it right after breakfast? You log breakfast around 8:10 most days."

Full specifications are below. The thresholds in them are **starting values**. Keep each one as a named constant with a one-line comment saying why. If real data shows a threshold is wrong, change it and say so in your report.

---

## Before you touch anything

1. **The app is running live on the owner's phone.** Metro hot-reloads every file you save onto their phone within seconds, while they are using it. A half-finished save is a crash in their hand, and after a crashed hot update the phone keeps the broken module until a full reload. So:
   - Every save must be valid, working code.
   - Add new helpers and components **before** the edit that uses them, or write the whole file in one go.
   - Before removing anything, search for every remaining use of it.
   - Never drive or tap the phone yourself.
   - If a crash does reach the phone, a full reload fixes it: connect to `ws://localhost:8081/message` and send `{"version":2,"method":"reload"}`.
2. **The current branch has a lot of uncommitted work** (hundreds of files). Never revert, stash, reset, discard or "tidy" files you didn't change for this job. Don't commit unless the owner asks you to.
3. **Read your memory index first** (it loads automatically). These notes matter here: no cosmetic counters, daily commitment, habit tracker, notification system, insight ledger, Gozlin coach, learning loop, day intake, design system, responsive layout, low-end perf, live-device edits, LogBox toast trap, owner action steps, monetization, Windows file traps, and the smart-ideas note from 2026-11-03 that this prompt comes from.
4. **Map before you build.** Each feature below names the files to read. Where this prompt disagrees with the code, **the code wins**. Tell the owner in one plain line, then follow the code.
5. **If the cycle prompt (the other prompt) has already run** in an earlier chat, the "rough day: ill" reason from feature 3 should feed the cycle tracker's "why am I late?" list. Check for it at the end. If it hasn't run yet, leave a clean read function so it can be used later.

---

## Ground rules (non-negotiable)

### Honesty

- **No cosmetic counters.** Every count on screen counts exactly what it says, over a stated scope ("in 4 of your last 5 Thursdays"), using completed periods. Never claim more than the data shows.
- **A missing value is not zero.** An unlogged day is unknown. It is not "0 calories", "neutral mood" or "a miss". The rule for intake lives in `components/charts/series.ts` (`hasRecordedIntake`, currently private). If you need it, lift it into a shared pure module. Don't copy it.
- **Gates.** A learned claim appears only once its gate is met. Below the gate the app says nothing, or says plainly that it's still learning. Never show a premature number.
- **Patterns, not causes.** "Your best days usually had…" is fine. "Training makes you happy" is not. Anything that shows a correlation says "A pattern, not a cause" somewhere the user can see it.
- **Nothing changes silently.** No reminder moves, no plan changes, no target shifts unless the user tapped yes. Every accepted change gets an **Undo**.

### Restraint (the quiet-app rules)

- **One smart moment at a time.** At most one new suggestion per screen per day, and at most two across the whole app per day. Nothing in the user's first 3 days. Nothing on a rough day except the way out ("I'm OK actually"). Build this as one arbiter (see the final phase). Don't let each feature decide alone.
- **Every "Not now" or "Keep" is remembered.** Nothing asks the same question twice within its cool-down.
- **No new permanent Home cards.** Smart moments ride surfaces that already exist: the Home insight deck (`buildCoachDeck` + `services/gozlin/InsightLedger.ts`, opened once and then gone), the "Your week" area, the Notification centre, the screen the thing belongs to, Gozlin, and Memory.
- **No new push notifications of their own.** A smart moment can only ride a notification that already exists (for example, the meal reminder in feature 2).

### Project rules

- **Brand:** always lowercase "welliva" in any text the user sees.
- **Design system:** use `components/ui` and the tokens. Button's `style` goes on its outer box. One hero per moment, no confetti. `LayoutAnimation` is banned.
- **No dashed or dotted lines, anywhere.** The owner hates them. Non-interactive labels get no outline.
- **Performance:** the owner tests on a low-end TECNO phone. No looping or perpetual animations. Every `FlatList` sets `removeClippedSubviews={false}` (Android draw crash).
- **Responsive:** every new screen and card must hold on short and tall phones at ~1.3× text size. A control's own `flex: 1` collapses in a column.
- **Logging:** background failures log once with `console.log`, never `console.warn` or `console.error`. On the dev build those show a warning bar that has covered the owner's screen before.
- **Windows traps:** never create `Foo.tsx` next to `foo.ts` (TS1149). `app/_layout.tsx` uses CRLF line endings, so edit it line-ending-aware. Unicode escapes typed into tool input arrive literally, so use `String.fromCharCode` where it matters.
- **Storage and sync:** app keys start with `@welliva_` (or `@gozlin_`). They **sync by default** (a denylist engine, `services/sync/syncKeys.ts`).
  - List-shaped data needs a merge strategy in `services/sync/mergeStrategies.ts`, plus its test fixture.
  - Deleting something synced must **tombstone** it, or the other phone merges it back.
  - Device-only values (caches, "last shown" stamps that only matter on this phone) go on the denylist.
  - Every new key must be wiped by Erase and by Clear memory where relevant (check `services/sync/UserScope.ts` and the Gozlin memory key table).
- **Notifications:**
  - There is one response pipeline: `services/notifications/pipeline.ts`.
  - A new lock-screen button means a new action or category in `services/notifications/categories.ts` and a handler next to `mealActions.ts`, `habitActions.ts` or `waterActions.ts`.
  - Handlers are idempotent (the pipeline ledger), dated by the **fire date clamped to today**, and leave a journal receipt.
  - On Android a press can boot the app **headless**, so handler imports must stay lean: no food catalogs, no `NutrientResolver`, no `constants/NutrientDatabase`.
  - Respect the global pause (`services/notifications/pause.ts`) and iOS's 64-pending-notification budget.
- **The streak:** only today can be credited. `onCommitmentKept` fires from the write itself. Never fake a kept day. The pure logic is in `services/commitment.ts` and the writes are in `services/StreakService.ts`.
- **Pricing:** Free = tracking, Pro = Gozlin's AI. Gate with `allows(featureId)` from `services/billing/gating.ts`, with features listed in `services/billing/tiers.ts`. Never add a new paywall without the owner's decision.
- **Gozlin:**
  - The diamond mark is never animated or tinted.
  - To tell Gozlin something new, prefer adding a line to the client-built current-state block in `services/gozlin/agent/context.ts`.
  - If you must change Gozlin's prompt or tools on the server, that lives in the sibling repo `..\backend-welliva`, which auto-deploys from `main`. Both repos must change together with a contract-version bump on both sides, and **nothing is pushed without the owner's OK**.
- **Analytics:** first-party `track()` from `services/telemetry/Analytics.ts` only, never a vendor SDK. Add one event per feature for shown, accepted and dismissed, so the owner can see which features people use. It respects the `measurement` consent.
- **Tests:** vitest. Put new logic in pure modules with tests. Inject `today`/`now`. Build date fixtures from **local date parts**, never `toISOString()` (that slides dates a day west of Greenwich).
- **Verification after every phase:** `npm run typecheck`, `npm run lint`, `npm test`. Exactly **2 tests are expected to fail**: the legal postal-address tests, a deliberate hold by the owner. Mention them in one clause and never "fix" them.

---

## Kickoff: ask the owner these decisions first

Use the AskUserQuestion tool. It allows 4 questions per call, so use two calls. Put your recommended option first and label it "(Recommended)". Write each question so it stands alone in plain words. Don't start Phase 1 until you have the answers.

- **D1. Rough day and the streak.** "When someone taps 'rough day', what should happen to their daily streak?"
  - **Paused (Recommended):** the day neither adds to the streak nor breaks it, and it shows with its own quiet mark.
  - Counts as a kept day.
  - Breaks like any missed day.
- **D2. Rough-day limit.** "How many rough days per month?"
  - **3 (Recommended)**, 2, 5, or no limit.
- **D3. The workout on a rough day.**
  - **Offer a gentle walk or full rest, the user picks (Recommended).**
  - A lighter version of today's workout.
  - Leave the workout alone.
- **D4. Reminders on a rough day.**
  - **Silence all reminders for the rest of that day, back to normal tomorrow (Recommended).**
  - Keep the reminders they set themselves, silence only coaching nudges.
- **D5. Price.**
  - **All eight free (Recommended):** they run on the phone and cost nothing to serve. The history of opened insights stays Pro, as it is today.
  - "What your good days have in common" for Pro only.
- **D6. When to ask "why now?"**
  - **At the end of sign-up, optional and skippable (Recommended).**
  - On day 7, once.
  - Only if they open Memory.
- **D7. The lock-screen "Had my usual" button on meal reminders.**
  - **Yes (Recommended).**
  - In-app only.

---

## Build plan

**Phase 0 (read only, no edits):** map every file named below and confirm the facts this prompt states. Then send the owner a short plain-English preview of what they'll see when it's done: no file names, five lines at most. Then ask the kickoff questions.

After **every** phase:
1. Run typecheck, lint and tests.
2. Give the owner a 3–5 line plain update: what's new, and where on the phone to try it.
3. Then move on.

### Phase 1: Foundations, the "routine clock"

**The gap:** habit ticks are stored as **dates only**. `HabitLogs = Record<habitId, "YYYY-MM-DD"[]>` in `models/habit.ts`, under the key `@welliva_habit_logs`. Features 1 and 8 need the time of day.

**Build:**

1. **A small separate record of tick times.** Don't change `HabitLogs`. It syncs as a whole blob and many readers depend on its shape.
   - Shape: something like `@welliva_habit_tick_times`: habitId → `[{ date, at, via: "app" | "notification" }]`. `at` is a local ISO time with offset. Newest last, capped at ~60 per habit.
   - Write it from **every** path that ticks a habit today: `contexts/HabitsContext.tsx` (`toggleToday`) and the lock-screen `services/notifications/habitActions.ts`.
   - An un-tick removes that date's entry.
   - A tick for a past date records **no** time, because the moment of a back-fill isn't when the habit happened.
   - Merge strategy: union by habitId + date, newer `at` wins. Tombstones on removal.
2. **Read the time sources that already exist. Don't duplicate them:**
   - meal ticks: `IntakeRecord.at` in `services/nutrition/IntakeLedger.ts`
   - free-form food: `FoodLogEntry.loggedAt` + `slot` in `services/nutrition/foodLogStore.ts`
   - water: `Pour.at` in `services/nutrition/waterPours.ts`
   - Mind check-ins: `services/gozlin/MindService.ts` / `GozlinMemoryStore`
   - workouts: find where a finished session's time is recorded
3. **A pure "routine clock" module.** Name it to fit the codebase, for example `services/routine/`. It answers "when does this person usually do X?":
   - Returns `{ medianMinute, spreadMinutes (interquartile range), count, windowDays }`, or `null` below the gate.
   - Uses only **same-day** records (logged on the date they're for), from the last 21 days.
   - Gate: at least 8 occurrences. "Consistent" means a spread of 60 minutes or less.
   - Handles the midnight wrap: a habit done at 23:50 one night and 00:10 the next is one routine, not two.
   - Ticks made from a reminder's own button within 15 minutes of it firing measure the *reminder*, not the habit. Exclude them from "usual time", but count them as evidence the reminder works.
4. **Tests** for all of it: wrap-around, back-fills ignored, gate behaviour, reminder-button exclusion.

### Phase 2: Feature 1, reminders that move themselves

**What the user sees.** On a habit that has a reminder, when the pattern supports it, one line on the habit's detail page and in the Notification centre's reminders section (`components/notifications/center/ReminderCards.tsx`):

> "You usually tick this around 9:40 pm. Your reminder goes off at 7:00. Move it to 9:30?"  **[Move it]**  **[Keep 7:00]**

**Rules:**
- **Suggest only when:**
  - the routine clock says "consistent", with ≥ 8 same-day ticks in 21 days;
  - the median differs from the reminder by ≥ 45 minutes;
  - fewer than half the ticks came from the reminder's own button (if most ticks come from the button, the reminder is working, so leave it).
- **Suggested time** = median minus 10 minutes, rounded to the nearest 5 minutes. A reminder should arrive just before the habit, not after it.
- **Move it:** change the reminder through the existing habit-reminder path (it cancels the stale `reminderIds`). Toast: "Moved to 9:30 pm · Undo".
- **Keep:** remember it per habit. Don't ask again for 30 days, and after that only if the median has moved ≥ 60 minutes from the time you last suggested.
- **The same for meals:**
  - Meal reminder slots: `services/notifications/mealReminders.ts`, compared with when the user actually logs that slot (intake ledger `at` / food log `loggedAt` + `slot`).
  - Water: `services/notifications/waterReminders.ts`. Only suggest shifting the **first** reminder of the day to just before their usual first drink. Keep it that simple.
- **Never** invent a reminder for something that has none. The meal-reminder module says it plainly: "the user picks the times, the app never invents one."
- **Not on Home.** This belongs to the thing's own screen and the Notification centre.

### Phase 3: Feature 2, "Your usual?"

**What the user sees.** Around their usual time for a meal, on Home and in the Diet screen's logging area:

> "Your usual breakfast? Oats with milk · coffee · about 420 kcal"  **[Log it]**

One tap logs it, then: "Logged · Undo". If D7 is yes, the existing meal reminder for that slot says "Your usual? Oats with milk, coffee" and carries a button **"Had my usual"**.

**Rules:**
- **Definition of a usual:** the same set of foods logged in the same slot on ≥ 3 of the last 14 days, at least once in the last 7. "Same set" = a fingerprint of normalised item names + amounts, ignoring order.
  - At most one usual per slot. If two qualify, pick the more frequent, with ties going to the more recent.
- **When it shows:** from (usual time − 60 min) until the slot ends, and only if nothing has been logged or ticked for that slot today.
- **People who follow the meal plan:** if they normally tick the planned meal for a slot, the existing "Ate it" reminder already covers it. Don't offer a usual for that slot. "Your usual" is for people who log free-form.
- **The numbers:** copy the items **and their macros exactly as recorded** on the most recent occurrence. Don't re-resolve them, and carry their confidence labels.
  - Write through `services/nutrition/FoodLogService.ts`'s normal add path. It enforces the back-log window, and the day gets credited to the streak.
  - `services/nutrition/DayTotals.ts` stays the only place that adds a day up. Never count from the plan.
- **Lock screen:**
  - Add a new action (and a category variant if needed) in `categories.ts`, handled beside `mealActions.ts`.
  - At **schedule time**, store the usual's id and a snapshot of its items and macros in the notification's data, so the headless Android handler never imports the resolver or the food catalogs.
  - Idempotent via the pipeline ledger, dated by the fire date clamped to today, with a journal receipt.
- **Forgetting:** "Not my usual any more" (from the chip's ⋯) forgets it, with a tombstone so it stays forgotten on every device.
- It never appears for a meal slot the user has turned off, and it never sends a notification of its own.

### Phase 4: Features 3 + 4, the rough day and welcome back

These share "gentle mode" plumbing. Build that once.

#### Feature 3: the rough-day button

**What the user sees.** A small, calm entry, "Rough day?", in Home's "Your week" area and in Gozlin's ⋯ menu. Tapping it opens one sheet:

> "Take it easy today?"
> Optional chips: Ill · Exhausted · Bad news · Travelling · Something else (the reason is never required)
> **[Make today gentle]**

For the rest of **today**:
- **Workout:** per D3. Use the existing "lighter session" machinery. `lightenSession` in `services/training/lighten.ts` takes an optional `reason`, so add one, and show it the way the Fitness tab already shows a lighter session (see `app/(tabs)/exercise.tsx`).
- **Diet:** today reads as "eat well enough". No red "over" state, no "X kcal left" pressure. The targets themselves don't change.
- **Habits:** today doesn't count as a miss for any habit. Treat it like an unscheduled day in the streak maths.
- **Streak:** per D1.
- **Gozlin goes gentle.** Add a state-block line along the lines of "Today they marked a rough day (reason, if given). Be brief and kind; don't push plans or targets." Proactive coaching nudges stop for the day.
- **Reminders:** per D4. Reuse the existing pause layer (`services/notifications/pause.ts`) with an automatic resume tomorrow, or the orchestrator's suppression in `health-os/notifications/`. Don't build a third mechanism.
- **The way out:** "I'm OK actually" undoes it for the rest of the day.

**Rules:**
- **Today only.** No back-dating, matching the today-only streak rule.
- **The cap (D2).** When it's used up, the sheet says so plainly. It can still offer the gentle workout and diet, but not the streak protection.
- **If they log something real that day anyway,** the day is simply kept. A kept day beats a rough day.
- **Honest everywhere.** Audit **every reader** of the streak and its ledger: `services/commitment.ts` (`liveStreak`, `readCommitment`, `keptOn`), `StreakService`, `AchievementService`, Gozlin's "setback" flag in `GozlinTwin`, `MomentEngine`, weekly digests and period reports.
  - A rough day is **not** a kept day.
  - It must never count toward streak milestones or achievements.
  - It must not trigger "setback" coaching.
- **Storage:** `@welliva_rough_days` as `[{ date, reason?, createdAt }]`, union-merged by date, tombstoned on undo.
- **For other features:** export a small pure read, for example "was this date a rough day, and was it marked ill?". The cycle tracker and training readiness can use it.

#### Feature 4: welcome back, without guilt

**What the user sees.** After **≥ 7 days with no kept day**, the first open shows one calm screen:

> "Welcome back." + one warm line
> **[Start fresh from today]** (primary)   [Pick up where I left off]

There is no count of missed days, no zeros and no red. Use the same gap that the "comeback" achievement uses (`services/AchievementService.ts`, the comeback gap constant), so "coming back" means one thing across the whole app.

- **Start fresh:**
  - The next 7 days of workouts run as an easier re-entry week through the training engine's own lighter path (`services/training`). Never fork the plan.
  - Home's "Your week" leads with "Fresh start · day 1" instead of a row of empty days. History stays truthful everywhere else.
  - The comeback achievement still fires.
- **Pick up where I left off:** nothing changes.
- **Feature 7 tie-in:** if they have a "why", show it here in their own words.
- **Fresh-start moments:** at most once every 14 days, on a Monday morning or the 1st of the month. Birthday only if the profile holds a real date of birth; it stores age today, so skip birthdays unless that exists.
  - Only when the last 7 days were *thin* (≤ 2 kept days) but not *absent* (absent means the welcome-back screen instead).
  - One card: "New week. Want a fresh start?" with the same two choices. **Never** as a push notification.
- **Copy:** match the tone of the `COMEBACK` lines in `services/commitment.ts`. Never "you missed…", never "it's been X days".

### Phase 5: Feature 6, prepare for the hard day

**What the user sees.** The evening before (in the app, on their next open), or in the weekly look-back:

> "Thursdays are your toughest: you missed 4 of the last 5 planned workouts on a Thursday. Want a 15-minute Thursday?"  **[Make Thursdays short]**  **[Keep as is]**

**Rules:**
- **Source:** workouts planned for each weekday in the plan, against the workout log.
- **Gate:**
  - that weekday had ≥ 4 planned sessions in the last 6 weeks;
  - ≥ 3 of the last 5 were missed;
  - completion on **other** weekdays is ≥ 60% (so it's about that day, not everything).
- **Make Thursdays short:** that weekday's session becomes a ~15-minute version built by the training engine (`services/training`: dose and time logic, `lightenSession`). Never hand-write a workout.
  - It lasts 4 weeks. Then ask once, with the real number: "Thursdays have gone better: 4 of the last 4. Keep them short?"
- **Keep as is:** don't ask about that weekday again for 6 weeks.
- **The learning engine already predicts this.** `health-os/learning/adherence.ts` (`AT_RISK_THRESHOLD`) is surfaced through `readIntelligence()` in `health-os/learning/engine.ts`.
  - Check whether its "shrink tomorrow" decision is shown anywhere today.
  - Once it's past its own gate, use it to decide *when* to offer. The weekday counts are the explanation the user sees.
  - **Don't build a second prediction model.**
- **Habits (one line, optional):** a scheduled habit missed on the same weekday ≥ 4 of the last 5 times can get a single offer: "Move it off Thursdays?"

### Phase 6: Feature 7, your reason in your own words

**This already half-exists. Reuse it.**
- Gozlin has a slot: `GozlinIdentityMemory.motivation`, written by `rememberMotivation()` in `services/gozlin/GozlinMemoryStore.ts`.
- Gozlin's chat reads it ("their stated why", in `services/gozlin/agent/context.ts`), and so does `services/gozlin/GozlinBriefingEngine.ts`.
- Today it's only filled if the user happens to say it in chat.
- **No second store.**

**What the user sees:**
1. **Asked once (D6).** An optional, skippable question: "In one sentence — why now?", with example placeholders ("I want to keep up with my kids", "I want to feel strong again").
   - Saved **exactly as typed** (trim only).
   - Editable from Memory → "Who you are" (`app/(tabs)/knows.tsx`).
2. **Quoted back rarely,** at most once every 30 days, on a wobbly moment:
   - the day after a streak of 3 or more lapses;
   - the evening before a known hard weekday (feature 6);
   - on the welcome-back screen (feature 4).

   > "On 3 November you said: "I want to keep up with my kids." Still true?"  **[Still true]**  **[Change it]**  **[Not now]**

**Rules:**
- Never on a rough day.
- Their exact words in quotes, never paraphrased and never rewritten by AI.
- **Fix the template in `GozlinBriefingEngine.ts`.** It currently says `Still aiming at ${motivation}`, which reads badly with a full sentence ("Still aiming at I want to keep up with my kids"). Quote the words instead.
- Erase and Clear memory remove it (check that they do). It syncs with the identity tier.

### Phase 7: Feature 8, attach a new habit to one you already have

**What the user sees:**
1. **When creating a habit** (`app/habit/new.tsx`), the reminder step offers one suggestion from their real routine:
   > "Do it right after breakfast? You log breakfast around 8:10 most days."  **[After breakfast]**

   That sets the reminder to the anchor time + 10 minutes, and the reminder text becomes "After breakfast: vitamins".
2. **For a habit that's struggling** (done on < 50% of its scheduled days in the last 14, with ≥ 6 scheduled days) and has no anchor yet, offer once:
   > "Vitamins have been tricky. Want to tie them to breakfast? You log breakfast around 8:10 on most days."
3. **The chain moment:** when the user logs the anchor in the app (ticks breakfast), a small one-tap chip appears: "Next: vitamins? **[Done]**". No new notification.

**Rules:**
- **Anchors** are anything the routine clock (Phase 1) marks consistent: breakfast, lunch or dinner logs, the first water of the day, the Mind check-in, a workout, or another habit.
  - Needs ≥ 10 of the last 14 days, with a spread ≤ 45 minutes.
- **Model:** add an optional `anchor?: { kind; label }` to `Habit` in `models/habit.ts`.
  - Optional field, no migration, the same approach `weeklyGoal` used.
  - The reminder copy reads it.
- **Pricing doesn't change:** custom habits are Pro today (the `habits` feature id), and the three linked habits stay free.

### Phase 8: Feature 5, what your good days have in common

Build this last among the features. It uses the most data and has the strictest honesty bar.

**What the user sees.** At most one new one per week, as a card in the Home insight deck (opened once, then gone until a genuinely new finding), and listed under Memory → "What I've noticed":

> "Your best days have something in common: in 7 of your 10 best days, you trained before noon. On your other days: 3 in 10."

Opening it shows up to three such findings, each with **both** numbers, and the line "A pattern, not a cause."

**Rules:**
- **Day score** = that day's average mood from Mind check-ins (valence, in `services/gozlin/mind.ts`; one day can hold several entries).
  - Days without a check-in are **left out**. A gap is not "neutral".
- **Gate:** ≥ 21 scored days in the last 60. "Best days" = the top quarter, and must be at least 6 days.
- **Candidate behaviours,** each a yes/no per day, from real records only:
  - trained at all
  - trained before noon
  - reached the water goal
  - ticked all planned meals
  - logged dinner before 20:00
  - did any habit
  - did a specific habit (one candidate per active habit)
  - slept ≥ 7 h (only where sleep was recorded)
- **Report a behaviour only if all of these hold:**
  - it happened on ≥ 60% of best days;
  - it happened on other days at a rate at least 25 percentage points lower;
  - it appears on at least 4 best days.

  Show at most 3, ordered by the size of the gap. If nothing passes, **show nothing**.
- **Scope:** a behaviour's counts include only days where it *could* be known (sleep only on nights with sleep recorded), and the card says so.
- **Identity in the insight ledger:** a content fingerprint, so the same finding doesn't come back as "new" (follow how learned findings are keyed in `InsightLedger.ts`).
- **Price:** per D5. Note that `insights` is currently a Pro feature id in `tiers.ts`, so read what it gates before you decide where this fits.

### Phase 9: The quiet layer, and polish

You've added eight voices. Now make sure the app is **calmer** than before.

1. **One arbiter decides what appears:**
   - at most 1 new suggestion per screen per day and 2 app-wide per day;
   - welcome-back outranks everything;
   - nothing during a rough day except "I'm OK actually";
   - nothing in the first 3 days after install;
   - every cool-down respected.

   Before writing a new one, check whether an existing ranker can host these as candidates: `services/gozlin/GozlinMomentEngine.ts`, `buildCoachDeck`, or the notification orchestrator in `health-os/notifications/`. **Prefer extending one.**
2. **One list of everything this job stores,** wired into Erase and Clear memory. Check each key syncs, or is denylisted, on purpose.
3. **Walk through three people** by reading the code paths, and write down what each would see over a week:
   - a brand-new user (day 1–3)
   - a regular (day 40, lots of data)
   - a returner (back after 2 weeks away)

   Anything that would feel noisy, repetitive or preachy gets fixed.
4. **Docs:** add one short doc, `docs/smart/README.md`, covering each feature, its rules and thresholds, its files, and the keys it stores.
5. **Memory:** update the project memory. Mark the 2026-11-03 smart-ideas note as built, and add any traps you learned.

---

## Done means

- All eight features work end to end.
- Typecheck and lint are clean. All tests pass except the 2 known legal postal-address tests.
- New pure logic has its own tests.
- No crash reached the owner's phone during the work.
- Nothing is committed unless the owner asked.

## Your final report to the owner (plain English, no jargon)

1. **What's new and where to find it:** one line per feature, saying where on the phone it lives.
2. **What to try first on the phone,** step by step.
3. **What only works after a new app build is installed:** lock-screen buttons on Android while the app is fully closed rely on the installed build. Say this plainly, and say whether they need to do anything.
4. **Decisions you made on their behalf,** each in one line, so they can overrule.
5. **Anything you skipped or couldn't do, and why.**
