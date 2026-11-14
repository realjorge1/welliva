# Upgrades for everyone (2026-11-14)

Built alongside the cycle work (`docs/prompts/03-cycle-lock-and-insights.md`) so that people who don't track a cycle get the same kind of care. The owner picked ideas 1, 2, 3, 4 and 6 from a list of six. Idea 5 (a lock for the whole app) was not picked.

**Status:** built, uncommitted. **Nothing here has been run on a phone.** Everything works on the app build already installed: `expo-file-system` is part of every build because the `expo` package depends on it. It is now also listed in `package.json` at the SDK's version. The JS moved from 19.0.21 to 19.0.24; the native changes between those versions are bug fixes only.

| # | What people see | Where | Logic | Tests |
|---|---|---|---|---|
| 1 | "That's water, not fat" after a weigh-in, with their own numbers | sheet after the weigh-in sheet (Deck) | `services/body/scaleJump.ts` | `services/__tests__/scaleJump.test.ts` |
| 2 | "Anything hurt?" after a workout; pain rests that area in the plan for 2 weeks | session summary | `services/training/pain.ts` | `services/training/__tests__/pain.test.ts` |
| 3 | "Worth mentioning to a doctor": weight, eating, mood, recurring pain | Home, after the cycle card | `services/checks/doctorNotes.ts` | `services/__tests__/doctorNotes.test.ts` |
| 4 | "We said / you did" for goal dates | forecast card in chat, the coach's forecast tool, new-chapter screen | `services/body/forecastMemory.ts` | `services/__tests__/forecastMemory.test.ts` |
| 6 | "Download my data" as a Word file saved where they choose | Trust → Your data | `services/export/*` | `services/__tests__/myDataExport.test.ts` |

## 1. That's water, not fat

- `scaleJump()` speaks only about **today's** reading, compared with the previous one if it is **1–7 days** old, and only for a rise of **0.5 kg or more**.
- Every day between the two readings must have recorded intake (`hasRecordedIntake`). One unknown day silences it.
- **The sum is tilted against speaking:** maintenance × 0.9, plus 800 kcal of unlogged food per day. It speaks only if at most half the rise could be fat **and** at least 0.4 kg can't be.
- Optional reason, only when grounded in their logs: a workout logged since the earlier reading, else a day with ≥1.4× their usual carbs (needs 7+ recorded days in the last 28).
- It never suggests eating less.
- **The cycle note wins.** If `cycle.view.water` speaks about today's reading (and the cycle lock isn't shut), this one stays quiet.
- `Deck` arms the two notes with **separate flags**. The cycle note's give-up timer would otherwise close this one.

## 2. Anything hurt?

- The answers are `painHistory` in the fitness profile (`@welliva_fitness_profile`, synced). There is one answer per session run, and a changed answer replaces it.
- `withRestingAreas(bio, painHistory, today)` adds resting areas to `bio.injuries` using words the existing `INJURY_RULES` know. It is applied in **`PlanSync.generateWorkoutWeek`** (every build path) and in `useWorkoutState`'s fingerprint check, so a new answer, or a rest window ending at a day change, rebuilds the plan. It is idempotent and returns the same object when nothing is resting.
- The player keeps its one question. This card is on the summary, only after real work (sets or exercises completed).

## 3. Worth mentioning to a doctor

| Note | Gate |
|---|---|
| weight-unplanned | ≥5% down from the first reading in 6 months (first reading ≥56 days before the latest; "now" = mean of the last 14 days), losing isn't a goal and the goal weight isn't below the start. Off postpartum. |
| weight-fast | Least-squares rate over 21 days ≥ max(1 kg, 1% of weight) a week; 4+ readings over 14+ days; first-ever weigh-in 28+ days ago. Off postpartum. |
| eating-low | Of the 14 closed days, 7+ **full days** (breakfast, lunch and dinner all logged), and ≥75% of them under `calorieFloor(bio)`. |
| mood-low | 8+ of the last 14 days averaging ≤ −0.3 valence ("Slightly Unpleasant" or lower). Days without a feeling don't count. |
| pain-recurring | Same area, 3 separate sessions, inside 14 days. |

- "Got it" (`@welliva_health_notes`) hides a note while its signature holds, and for at least `QUIET_DAYS` (60/30/30/14/14).
- None of these notes are counted by analytics.

## 4. We said / you did

- `@welliva_goal_forecast` keeps `first`, `prior` and `last` said dates for the current goal weight. `prior` is the latest date said on an earlier day, so a forecast shown twice in a day compares with what was said before today.
- "Said" means the forecast card rendered a forecast made **today** (`GozlinForecast.asOf`), or the agent's `get_forecast` ran. The tool returns `sinceLastTime` for the reply to use.
- A move of **14+ days** gets one line. The reason comes from the two rates when they differ by 15% or more, otherwise "because of how your weight has moved since then".
- The goal-reached effect in `useGamificationState` records `reachedOn` (the latest weigh-in's date). `app/new-chapter.tsx` then says the first date back.
- Once a goal is reached, its record is frozen: a later forecast for the same goal weight leaves it alone. Otherwise a forecast opened before the new-chapter screen would wipe the date that screen says back. A new goal weight starts a new record.
- Free users never see a forecast date (Gozlin is Pro), so they never get this line.

## 6. Download my data

- `services/export/docx.ts` is a hand-made .docx: an uncompressed ("stored") zip with CRC32, and every string XML-escaped. It was checked by opening a sample in Microsoft Word: the styles map to Title and Heading 1, the tables are intact and Unicode text reads back correctly.
- `myData.ts` builds the document: profile, weigh-ins, daily totals, every meal ticked or logged, water, workouts (how they felt, anything that hurt), habits including stopped ones, mood check-ins, the cycle log and what Gozlin remembers including conversations. An empty section says so.
- The cycle log is included only if tracking is on. If "Lock my cycle" is shut, the phone asks to unlock first; a cancelled unlock still saves the file, with a line saying the cycle log isn't in it.
- `saveFile.ts` uses `Directory.pickDirectoryAsync()`, the phone's own folder picker, then `createFile()` and `write()`. The module is loaded via `requireOptionalNativeModule("FileSystem")`.

## Legal

These changes were folded into the **still-unpublished v5** (`LEGAL_VERSION` stays 5, so people re-accept once):

- the "Your logs" line mentions where a workout hurt;
- "Why we use it" mentions resting a hurt area and the doctor notes;
- "Your rights" points to Download my data.

`npm run legal:publish` still waits for the owner's OK.

## Not done / to watch

- Nothing here has been device-tested.
- The new-chapter line only appears for people who saw a forecast after this shipped.
- The doctor notes read the meal ledger and food log for 15 days on Home. Keep an eye on that cost on the TECNO.
