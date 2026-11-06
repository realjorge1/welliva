# The smart layer

Eight small behaviours built on one pattern:

> **Notice → ask one question (or offer one tap) → remember the answer → say it back later, with proof.**

One sentence. One tap. Always says where the information came from. All eight are free. The insight *history* stays Pro.

Thresholds are starting values, kept as named constants with a one-line reason. If real data shows one is wrong, change the constant.

## What's where

| Folder | What it holds |
|---|---|
| `services/routine/` | The routine clock: "when does this person usually do X?" Pure. Don't import its `index.ts` from lock-screen code, because it pulls `load.ts`. |
| `services/smart/` | The rule for each feature, the arbiter and the ledger. Pure apart from each feature's small store. |
| `components/smart/` | The screen half: hooks and cards, all through `SmartCard`. |
| `services/notifications/usualActions.ts` | The lock-screen "Had my usual" button. |

## The rules every moment obeys

`services/smart/arbiter.ts` is the one arbiter. A new one was needed because the existing rankers rank within their own world: `GozlinMomentEngine` picks coach moments, `buildCoachDeck` picks Home's insight cards. Neither can see a reminder offer on a habit page.

- **Nothing in the first 3 days** of an account (`QUIET_FIRST_DAYS`).
- **Nothing on a rough day**, except the way out ("I'm OK actually").
- **At most 1 new moment per screen per day, 2 across the app** (`MAX_PER_SURFACE`, `MAX_APP_WIDE`). A moment already shown today keeps its place.
- **Welcome back outranks everything**, and owns its day.
- **Every answer is remembered.** A moment inside its cool-down never returns.
- **Exempt moments** skip the daily caps, not the first-days and rough-day silence. These are the direct answer to something the user just did (the chain chip, the new-habit offer) and a good-days card still waiting from an earlier day.

Priority decides who gets the slot. A new moment waits 800 ms (`CLAIM_SETTLE_MS`) and steps aside for a stronger rival, so the slot goes to what matters and not to whichever record loaded first. Rare moments rank above the daily usual:

| Moment | Priority |
|---|---|
| Welcome back | 100 |
| Short-day review | 61 |
| Hard day | 60 |
| Your why | 58 |
| Chain chip (exempt) | 55 |
| Good days | 52 |
| Your usual | 50 |
| Reminder move | 40 |
| Fresh start, anchor offer | 35 |
| Habit's hard weekday | 30 |

Honesty rules that apply everywhere:

- Every count counts exactly what it says, over a stated scope, from finished days.
- A missing value is not zero.
- Below a gate: say nothing, or plainly "still learning".
- Anything showing a correlation says "A pattern, not a cause."
- Every accepted change gets an Undo, through the app's one toast (`components/smart/receipt.ts`).

## The features

### 1. Reminders that move themselves
`services/smart/reminderMove.ts`, `ReminderMoveCard`. On a habit's page and on Reminders.
- Reads the routine clock: at least 8 days in 21 (`ROUTINE_MIN_COUNT`, `ROUTINE_WINDOW_DAYS`), same-day records only.
- Offers when the reminder is at least 45 min off the usual time (`MOVE_MIN_GAP_MINUTES`). The new time is 10 min before, rounded to 5.
- A button press within 15 min of the reminder measures the reminder, not the habit, so it's left out (`REMINDER_ECHO_MINUTES`).
- "Keep" holds for 30 days. It re-asks only if the usual time moved 60 min from the last offer.
- Snacks are excluded: a day can hold three.

### 2. "Your usual?"
`services/smart/usual.ts`, `usualLog.ts`, `usualStore.ts`, `useUsualMoment`, `UsualCard`. On Home, on Diet, and as a lock-screen button.
- The same items in a slot on 3 of the last 14 days, at least once in the last 7. Breakfast, lunch and dinner only.
- Someone following a plan (ticks on 50% or more of eaten days) has no usual: the plan is their usual.
- Shows from 60 min before the usual time until 90 min after.
- "Not my usual" stops it. It can return only from meals logged after that.

### 3. Rough-day button
`services/smart/roughDay.ts`, `useRoughDay`, `RoughDaySheet`, `RoughDayLink`, `RoughDayWorkoutCard`. Under "Your week" on Home.
- The streak is **paused**: it neither adds nor breaks, and gets its own quiet mark. 5 a month (`ROUGH_DAYS_PER_MONTH`). Past that the day is still gentle, the streak just isn't paused, and the sheet says so first.
- Silences all reminders for the rest of that day.
- Offers a gentle walk or full rest. A walk is not logged: there's no manual workout path, and an invented duration would be fake.
- Dated reminders (meals, water, cycle) return by themselves. Repeating ones (habits, workouts) stand down until the next app open on a normal day.
- An "Ill" or "Travelling" reason feeds the cycle tracker's "why am I late?" (`components/cycle/useCycleInsights.ts`).

### 4. Welcome back without guilt, and fresh starts
`services/smart/welcomeBack.ts`, `useWelcomeBack`, `WelcomeBack`, `FreshStartCard`.
- After a week away: one calm screen with no counts. Start fresh, or pick up where you left off.
- Start fresh runs 7 days (`FRESH_START_DAYS`): easier workouts, and "Your week" counts from today. History stays.
- Fresh-start card: a thin week (1 or 2 kept days), on a Monday or the 1st, before noon, at most every 14 days. Never a notification.
- No birthdays: the profile has no date of birth.

### 5. What your good days have in common
`services/smart/goodDays.ts`, `useGoodDays`, `GoodDaysSheet`. A card in Home's insight deck, and rows in Memory → "What I've noticed".
- A day's score is the average of that day's Mind check-ins. No check-in means the day is left out. Today and rough days are left out too.
- Needs 21 scored days in the last 60. Best days are the top quarter, at least 6. Days tied at the cut-off all count as best; if that swallows over half the days, it stays silent.
- Reports a behaviour only if it happened on at least 60% of best days, on at least 4 of them, at a rate at least 25 points lower on other days, with at least 6 other days to compare. At most 3, biggest gap first.
- Unknown is not no. Each behaviour counts only days it can be known, and the card says so when that left days out.
- At most one new finding a week. Its identity is what it's about, not its numbers, so "8 of 11" next week isn't new (`findingKey` in `InsightLedger`).
- "Before noon" goes by when the session started. A dinner logged before 15:00 or on another day says nothing about dinner time.

### 6. Prepare for the hard day
`services/smart/hardDay.ts`, `useHardDay`, `HardDayCard`, `services/training/lighten.ts`.
- 3 of the last 5 planned sessions on one weekday missed, with at least 4 planned in 42 days, while other days run at 60% or better on 3 or more sessions.
- Only this week's plan was ever stored, so `@welliva_planned_days` records it going forward. The offer can't appear for about 4 weeks.
- Offered the evening before (from 17:00) or that morning (until 12:00). Lasts 4 weeks, then asks how it went. "Keep as is" holds 42 days.
- The short session drops sets and sections and adds no new moves. Deliberately plain counts: the learning engine's adherence model gets no live workout events.

### 7. Your reason, in your own words
`services/smart/why.ts`, `useWhyMoment`, `WhySheet`. Words live in Gozlin's identity memory: no second store.
- Asked once at the end of sign-up, skippable. Stored exactly as typed. Editable from Memory.
- Quoted at most every 30 days on a wobbly moment: the day after a run of 3 or more lapsed, the evening before a hard weekday, or the welcome-back screen. Never on a rough day.
- **The daily briefing does not receive it.** It used to quote it every day, which broke the once-a-month promise. Gozlin's chat knows it, as their exact words.

### 8. Attach a new habit to one you already have
`services/smart/anchor.ts`, `useAnchors`, `AnchorChainChip`.
- An anchor happens on at least 10 of 14 days, within a 45-min spread. The reminder lands 10 min after it.
- Offered when creating a habit, and once on a habit done under half of at least 6 due days.
- Once the anchor is logged, a "Next: vitamins?" chip shows for up to 3 hours. No new notification, ever.
- Deleting the anchor habit clears the tie, so the reminder stops saying "After Vitamins".

## What's stored

Every key below syncs unless noted. All are wiped by Reset data, sign-out and account deletion, because `purgeAppData` sweeps both prefixes and also resets the ledger's in-memory copy. "Clear memory" is Gozlin's Forget and Memory's Erase.

| Key or field | Holds | Merge | Clear memory? |
|---|---|---|---|
| `@welliva_habit_tick_times` | When each habit was ticked | by id, tombstones | No, it's a log |
| `@welliva_smart_shown` | Which moment took which slot | Device-local (denylisted) | Yes |
| `@welliva_smart_answers` | Every "Not now", "Keep" and "Move it" | by id | Yes |
| `@welliva_usuals_forgotten` | Usuals turned away | by id | Yes |
| `@welliva_rough_days` | Rough days | by date, tombstones | No, it would change the streak |
| `@welliva_fresh_start` | The running fresh start | Last write wins | No, it's a running programme |
| `@welliva_planned_days` | Planned workout days, going forward | by date | No, it's a log |
| `@welliva_short_weekdays` | Accepted short weekdays | by id, tombstones | No, it's their choice |
| `@gozlin_identity` (`motivation`, `motivationAt`, `motivationQuotedAt`) | Their why | Existing | Yes |
| `@gozlin_insight_ledger` | Opened insights, including good-days findings | Existing | Yes |
| `WaterHistoryEntry.firstAt` | First glass of each closed day | On the existing row | No, it's a log |
| `Habit.anchor` | What the habit is tied to | On the existing row | No, it's their choice |

"Clear memory" **removes** the keys rather than emptying them. An empty list merges with the cloud copy and brings everything back; a removed key syncs as a deletion.

## Three people, one week

Written by reading the code paths, not by watching a phone.

**Brand new, days 1–3.** Sign-up ends with an optional "why now?". Then nothing smart at all: the arbiter blocks every moment. The rough-day link is visible under "Your week", because it's theirs to press. The earliest possible lock-screen usual is day 3 or later, since it needs three days of the same meal. Reminder moves need 8 days, anchors 10, good days 21 check-in days, hard days about 4 weeks.

**Regular, day 40, lots of data.** At most two new things a day across the app, and most days one.
- Mon: a usual at breakfast on Home, the same one on Diet (counted once).
- Wed evening: nothing new if a usual already took Home today; the hard-day offer waits for Thursday morning.
- Thu morning: "Thursdays are your toughest…", which outranks the usual on Home, so the usual appears only on Diet.
- Sat: a good-days card leads the insight deck if nothing stronger wants the day. If unopened, it waits without taking a slot from new moments.
- Why: at most once a month. Reminder move: at most one per reminder per 30 days.

**Returner, back after 2 weeks.** One calm welcome screen and nothing else that day. It quotes their why if the month's allowance is free. Start fresh gives a week of easier workouts. In the days after, stale patterns stay quiet by themselves: a usual needs a meal in the last 7 days, an anchor needs 10 of 14 days, a run that ended two weeks ago hasn't "just lapsed", and weeks the app didn't see don't count as missed.

**Fixed after this walkthrough:**
- The daily briefing quoted their why every day.
- A daily usual could take Home's slot before a rare moment's records had loaded, so the hard-day offer might never appear.
- Checked at 320×569 with 1.3× text: the fresh-start card's long button labels stuck out of the card, and the rough-day sheet came out taller than the screen. The labels now stop at the card's edge; the sheet's middle scrolls and its answers stay put.
- Reset data left answers in memory, and the next "Not now" wrote them back.
- "Clear memory" emptied keys, which sync would have merged straight back.
- The lock-screen path loaded the whole coach and every food catalog through the analytics consent import (195 modules down to 70).

## Known gaps

- The "weekly look-back" place for the hard day wasn't built; the offer lives on Home and the habit's page.
- `mealActions` on the lock-screen path still loads the diet database through `ScheduleService`. It predates this work and only runs its top-level code once.
- Repeating reminders can't skip one day, so after a rough day they return at the next app open, not by themselves.
