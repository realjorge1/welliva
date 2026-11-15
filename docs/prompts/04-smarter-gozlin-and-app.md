# Prompt 4: a smarter Gozlin, streak protection, Health Connect, a widget and languages

> How to use: start a **new** Claude Code chat in the welliva folder, then paste everything below the line.
> Health Connect and the widget need a new app build before they can be tried on a phone. The owner does builds; you only prepare them.

---

## Your roles

You are the lead engineer on **welliva**, a React Native (Expo SDK 54) health app: diet, workouts, habits, mood, water, a period tracker, and an AI coach called **Gozlin**. On this job you switch between five hats:

1. **Senior mobile engineer.** Your code reads like the code around it, with tests.
2. **Product designer for a premium app.** Every new moment is calm, light and beautiful. One hero per moment. Nothing noisy, nothing childish. Never a copy of Duolingo.
3. **Honesty reviewer.** Every number and every claim on screen is checked against the data behind it. If it says "12 days", the code counts exactly that. If Gozlin says something, it is true.
4. **Privacy reviewer.** Health data stays on the phone unless the user chose otherwise. Analytics never carries a health value or anything the user typed.
5. **The owner's translator.** The owner is the product owner, not a developer. Everything you ask them or tell them is plain English: no code words, no file names, no commands. Describe things by what they see on the phone. When they must do something, give numbered clicks, say why, and say whether it is optional.

## Ground rules (these override your defaults)

- **Only an explicit yes counts.** "continue", "ok" or a new question is not approval. Ask before every commit, push, branch switch, backend deploy, build, or public website change. Never start a build.
- **Answer what was asked, then stop.** Don't attach work nobody asked for.
- **Start by looking.** Run `git status` and `git branch`, then tell the owner in one or two plain sentences where things stand. A branch `work-2026-11-14` may exist with two commits the owner was still deciding whether to keep. Don't touch it until they've decided. If files under `fitness/animation/` show changes you didn't make, another session is working on them: leave them alone.
- **Their phone runs the app live from this computer.** Every save hot-reloads onto it. Each save must be valid code on its own: add a helper before the code that uses it, and delete uses before definitions. A file that needs several changes gets one write. Failures that happen in the background log once with `console.log`, never `console.warn` (the warning bar covers the bottom of the screen in their test app).
- **Low-end phones matter.** The test phone is a TECNO with under 1 GB of memory. No animation that loops forever, nothing that runs every frame when idle, no new Skia objects per frame.
- **House style:** the name is always lowercase "welliva". No dashed or dotted lines anywhere. No outlines on things you can't tap. Layouts must hold on short and tall phones with large text (about 1.3×).
- **No cosmetic counters.** A card that says it counts something counts exactly that.
- **Celebrations:** one hero per moment, no confetti, no party. See `components/celebration/` (the Flame, the Badge).
- **Windows traps:** run vitest from the uppercase path `C:\Users\George\confidencial\welliva`, or every test fails to load. Never have `Foo.tsx` and `foo.ts` in the same folder.
- **Legal:** privacy wording changes go into the still-unpublished `LEGAL_VERSION` 5 in `constants/legal.ts`. Never run `npm run legal:publish` without the owner's yes, because it updates the public website.
- **Backend:** the server is a separate repo at `../backend-welliva`. Pushing its `main` branch deploys it live. Run `npm test` and `npm run typecheck` there, then ask before pushing.
- **Checks before you say anything is done:** `npx tsc --noEmit`, `npx eslint` (the warning ceiling is 55), and the relevant vitest suites, all green. Tell the owner plainly what was checked and what was not: almost nothing here can be tried on a phone from this computer.

## The mission

The owner chose these on 2026-11-14.

**Gozlin (the AI coach):**
- **G1. Let Gozlin read what the app has learned.** (Already built; verify it.)
- **G2. Let Gozlin do things, not just talk.**
- **G5. Give Gozlin a longer memory.**
- **G7. Measure how smart Gozlin really is.**

**The whole app:**
- **A. A "streak at risk" evening reminder, plus streak freezes,** with premium animations. Light, and not a Duolingo copy.
- **B. Health Connect** (Android's health data hub), prepared for the next build.
- **C. A home-screen widget: proposal only.** The owner demands to give feedback before anything is built.
- **D. Translate the app:** plan first, then build in phases.

### Work order

1. **Send the owner two proposals first**, the widget (C) and the translation plan (D). Both need their answers, so they can think while you build the rest.
2. G7, measure first, so every later change has a before and after.
3. G1, verify.
4. G5.
5. G2. Build the app side, prepare the server side, then ask before deploying.
6. A.
7. B (prepare only).
8. D phases, once the owner has approved the plan.
9. C is built in a later job, after the owner picks a design.

---

## G7. Measure how smart Gozlin really is

**Why:** nothing records whether Gozlin actually answered or fell back to its simpler offline replies, or why. `recordGrounding()` and `recordOutputScreen()` count in memory only and reset when the app closes. Nobody reads them.

**Build:**
- In `services/gozlin/agent/GozlinAgent.ts`, give `AgentTurnResult` two required fields:
  - `outcome`: how the turn ended.
  - `toolCalls`: the number of tool calls made.
- Set both at **every** return. The `fallback()` closure takes the outcome as a parameter.
- The outcomes, as a closed union:
  - `answered`
  - `answered_after_fix_number` (rewritten once for an unbacked number)
  - `answered_after_fix_safety`
  - `ungrounded` (the number check failed twice)
  - `unsafe` (output safety replaced the reply)
  - `refused` (the model's refusal)
  - `empty`
  - `malformed` (tool_use with no calls)
  - `loop_cap`
  - `offline` (network or server error)
  - `no_backend` (no transport)
  - `cancelled` (aborted)
  - `clinical_screen` (answered before the model ran)
  - `locked` (server said Pro only)
- New analytics event `coach_turn: { result, tools, seconds }` in `services/telemetry/events.ts`:
  - add it to `AnalyticsEvents` and `KNOWN_EVENTS`
  - add `tools` and `seconds` to `ALLOWED_PROP_KEYS`
  - define the result union there too, since that file is the privacy boundary
  - `seconds` is rounded to one decimal
- Fire it from `components/gozlin/useGozlin.ts` where the turn result is handled (near the existing `result.source === "agent"` checks). Time it from send to result.
- New migration in `supabase/migrations/` with a view `analytics_coach_quality`. Per day it shows:
  - turns
  - share answered
  - a count for each fallback reason
  - median seconds
  - average tool calls

  Copy the grants pattern from `20261030120000_analytics.sql` (revoke from anon/authenticated, grant to service_role).
- The owner applies migrations by pasting them into Supabase (the command line doesn't work on this PC). Give them the steps: supabase.com → project → SQL Editor → New query → paste → Run. Expected result: "Success. No rows returned". Then tell them where to look: Table Editor → the view.
- **Privacy text:** "Analytics and tracking" in `constants/legal.ts` says usage events carry "the event name and nothing else". That is already loose, because existing events carry small labels. Make it exact within LEGAL_VERSION 5 (for example: "the event name and a short label such as which screen or which outcome, never what you typed or any health value"), and keep `legal.test.ts` green.

**Tests:** every exit path yields the right outcome. `sanitize()` keeps `coach_turn` props and drops anything else.

## G1. Gozlin reads what the app has learned (already built; verify)

Built 2026-11-14: `services/gozlin/agent/learned.ts`, tests in `services/gozlin/agent/__tests__/learned.test.ts`.

The learning engine (`health-os/learning/engine.ts`, `readIntelligence`) refits once a day. Gozlin now gets a gated brief in its state block:
- maintenance calories "by your logs", once the calorie model is confident
- their own fatigue curve
- tomorrow flagged as a likely slip (the adherence model's own decision)
- the kind of nudge that has worked with them
- a real behaviour change from the last 28 days

The number check and the receipts read the same brief.

**Check that it's there and its tests pass.** If the owner removed it, rebuild it from that description. The rules:
- the learned maintenance figure mixes real calorie burn with how fully someone logs food, so it is never presented as "your metabolism"
- calorie targets do **not** use it (`tdeeForTargets` has no caller)
- Gozlin never tells anyone to eat below their target because of it

## G5. A longer memory for Gozlin

**Today:**
- Gozlin sees the last 20 messages (`MAX_HISTORY_MESSAGES` in `services/gozlin/agent/context.ts`).
- It also sees facts the user asked it to remember (`remember_fact` / `recall_memory`, `GozlinMemoryStore`) and "tried something new" notes (`ExperienceStore`).
- Archived chats exist (chat-history archive), each with a title derived by `services/gozlin/conversationTitle.ts`, but Gozlin never sees them.

**Goal:** Gozlin can say "on 3 October we talked about your knee on squats, and you were going to try box squats. How did that go?"

**Build it with no extra AI call:**
- A small "earlier conversations" brief from what's already on the phone: each past thread's title and date, the facts and experiences saved in it, and anything the user said they'd try.
- Cap it hard: this block is sent on every turn and isn't cached, so it should be roughly the 5–8 most relevant or recent threads.
- It goes in the state block (TIER 3) like the cycle and learned briefs. TIER 1 must not change.

**Rules:**
- **Words from memory are not evidence for numbers.** Don't add anything from this brief to the grounding allowed set or the receipt ledger. Leave digits out of the rendered lines, or the model will cite a figure it can't back.
- It stays on the phone.
- Deleting chats, deleting the account, and "Download my data" (`services/export/`) must cover it.
- The Memory screen (Knows tab) shows what Gozlin remembers from past chats, with a way to forget an item.

**Offer the owner, don't build:** proper AI-written summaries of old chats. That needs a server change and costs a little per summary.

## G2. Gozlin can do things

**Today the write tools** are `log_food` (the template to copy), `remember_fact` and `note_experience`. Writes go through a confirmation sheet in `useGozlin.ts`: `ToolConfirmRequest`, `confirmResolverRef`, `pendingConfirm`.

**Add these tools.** Each one shows exactly what will change, waits for the user's tap, writes through the app's existing store, and offers Undo where the store allows it:

| Tool | Writes through | Watch out for |
|---|---|---|
| log water | the pours log (`reconcilePours`) | the streak counts only at the WHOLE water goal |
| log weight | `makeWeighIn` (BodyLogService) | the scale-jump note (`services/body/scaleJump.ts`) |
| log a workout | the existing manual workout log | `workout_logged` source |
| swap a meal | MealPlanContext | cuisine HARD restrictions (`mealRules.ts`) and allergens must still hold |
| move a planned workout | the workout plan | within the current week only |
| set a reminder | the ONE notification pipeline (`services/notifications/pipeline.ts`) | owner-stamped, honours "Pause all", iOS fire time is in SECONDS |
| add a habit | HabitsContext | default glyph and colour |

**Never add:**
- changing calorie or protein targets (deliberately not editable, because of the safety limits in the target calculation)
- deleting anything
- any write to period/cycle data

If a care flag for disordered eating exists, no food-related write that reduces intake. The clinical screen still runs before the model.

**Add activity labels** to `ACTIVITY` in `GozlinAgent.ts` (for example "logging that…").

**Server side:** tool schemas live in two places that must match byte for byte (`serverContract.test.ts` enforces this):
- this app's `services/gozlin/agent/tools.ts` (`TOOL_SCHEMAS`)
- `../backend-welliva/src/gozlin/tools.ts`

Then:
- Bump `GOZLIN_PROMPT_VERSION` in both.
- **Old app builds already on phones** don't have these tools. In the backend's `src/services/coachTurn.ts`, offer the new schemas only to clients whose prompt version is new enough. An old app asked to run an unknown tool returns an error round and wastes a turn.
- Run the backend's tests, then ask the owner in plain words before pushing: "this updates the live coach for everyone".

**Tests:** each tool's preview, confirm, cancel and write path. A cancelled confirmation writes nothing. The forbidden actions are absent from the schemas.

---

## A. "Streak at risk" reminder and streak freezes

**Today** (`services/commitment.ts`, `StreakService`, Home's "Your week" strip in `components/celebration/Commitment.tsx`):
- `readCommitment()` already returns `atRisk` (`streak > 0 && !keptToday && !pausedToday`).
- A "rough day" (`services/smart/roughDay.ts`) can protect the streak manually, with a monthly limit.

**What keeps a day:**
- a meal ticked
- a food log
- a workout
- a weigh-in
- a mood check-in
- a habit done
- the **whole** water goal (one glass does not)

**The evening reminder:**
- One notification at most per day, in the evening. Default around 20:00 local, kept as a named constant. Users can switch it off in notification settings.
- Sent only when all of these hold:
  - the streak is long enough to matter (pick a minimum such as 3 days and say why)
  - today isn't kept yet
  - it isn't a rough day
  - notifications aren't paused
- Cancelled the moment the day is kept (`onCommitmentKept`).
- If ignored several evenings in a row, it backs off.
- **The words are honest and calm.** Only suggest things that really keep the day; never "drink a glass of water". No guilt, no sad mascot, no countdown pressure. Something like: "Your 12-day streak is still open tonight. A quick check-in keeps it."
- Use the existing pipeline: a new category in `categories.ts`, copy in `copy.ts`. A lock-screen button is optional, and only if it really keeps the day in one tap.

**Freezes:**
- **Earning:** one freeze for every 7 days kept, holding at most 2 (named constants). Free for everyone, because the streak is tracking, not Pro.
- **Use:** a missed day uses one automatically. The streak continues, but the day is **not** counted as kept: "N days kept" doesn't grow. In the week strip that day shows a frost fill (fill only, no outline), not the kept fill.
- **Rough day comes first.** A manually protected rough day never uses up a freeze.
- **Sync:** the streak document syncs "last write wins" today. Freezes and frozen days must merge as a union, so two phones can't erase one. Check `services/sync/` and fix at least this part.
- **Gozlin:** a frozen day must not raise the "streak broken" flag. Gozlin's state block can mention that a freeze held yesterday.

**Premium animations, light:**
- **Using a freeze:** one quiet moment on the next app open. Your own design, not Duolingo's blue flame or ice cube. For example, frost settling over the flame's rim and then clearing. Under about 1.2 seconds, transforms and opacity only, respecting "reduce motion", no loop.
- **Earning a freeze:** no full-screen moment; a small change in the strip.
- **Show the owner a preview before wiring it in.** Use the filmstrip/HTML method used for the Flame (see the flame-celebration memory). Keep building while they look.

**Tests:** the reminder's conditions, cancelling on keep, freezes earned, used and capped, kept-day counts unchanged by freezes, rough day before freeze, the sync merge.

---

## B. Health Connect (prepare, don't build)

**What the owner asked:** does it need registration, a subscription, or legal steps? Is it safe? Could they get sued? The plain answers:
- It's free.
- It's Google's official way for apps to read health data.
- Google requires:
  - a declaration in Play Console (App content → Health apps), saying which data types and why
  - a privacy policy that says the same
  - using the data only for the app's health features, never ads, never sold

  Google reviews the declaration.
- The real risks are breaking those rules (Google can block the app) or mishandling data. Using Health Connect itself is not.

**What already exists:** read `docs/companion/health-native-cutover.md`. The adapter and its 28 tests are done. Only the package, the config plugin, the declaration and a build remain.

**Do:**
1. Install `react-native-health-connect` and its config plugin, requesting read-only access to the five types listed in that doc and nothing more. Point the permission-rationale screen at the Trust screen.
2. Confirm the current build still runs. The provider's guarded `require` keeps it "unavailable" until the next build.
3. Check the build will work without spending one: `eas config`, and `npm ci --dry-run --include=dev` for the lockfile (see the EAS preflight memory).
4. Write the privacy wording into LEGAL_VERSION 5: what is read, that it stays on the phone, never used for ads, never sold.
5. Update the Trust screen and consent copy to match.
6. Follow Google's naming rules when the Connect row says "Health Connect".
7. Write `docs/companion/health-connect-play-declaration.md` for the owner: click-by-click Play Console steps and the exact answer for each data type, in plain English.
8. Ask the owner whether an iPhone release is planned. If yes, Apple Health can go in the same build (same doc, iOS section).

## C. Home-screen widget: PROPOSAL ONLY, NO CODE

**The owner's brief:** "a Duolingo-type widget users can put on their home screen, but not one that begs them to come back. Something much cooler: smart, sweet, and light. I demand feedback first before any build."

**What exists:** `services/notifications/widgets.ts`, a data contract for a "today's habits" snapshot. It has no native widget yet.

**Deliver** one proposal page (an HTML artifact if available, otherwise a markdown file with images) containing:
- **2–3 concepts**, drawn at real sizes:
  - Android small and wide
  - iPhone small and medium
  - optionally the iPhone lock screen
- **What each shows through the day:** morning, afternoon, evening; kept and not kept; no data yet; offline.

  Ideas to weigh, not orders:
  - a calm "today" glyph combining calories, water and the flame
  - the one "next best thing" line from the smart layer
  - a look that changes with the time of day
  - the flame lighting up once the day is kept, without nagging words
- **What's possible, plainly:**
  - Home-screen widgets barely animate.
  - They refresh on the system's schedule (Android about every 30 minutes unless the app pushes an update; iPhone on a timeline).
  - Each platform needs its own native part and a new build.
  - The extra size it adds to the app.
- **Privacy:** nothing from the period tracker on a widget, ever. What a stranger holding the phone would see.
- **Free or Pro.** Recommend one.

Then **stop**: no packages, no code. Wait for the owner's pick.

## D. Translate the app (plan first)

**Background, from an assessment on 2026-11-03:**
- about 5–7 thousand strings in about 700 files
- plurals
- right-to-left languages
- legal text needs professional translation
- around 12 MB if 40 languages were bundled
- machine-translated health advice is a trust risk

The owner previously said not to build it if it would be heavy. Now they've asked for it, so make it light.

**Already done:** Gozlin replies in the phone's language (`utils/phoneLanguage.ts`, `services/gozlin/agent/replyLanguage.ts`, and number reading in `grounding.ts`).

**Phase 0, the plan.** Send it to the owner and wait for their yes. Cover:
- **Which languages first:** ask where their users are, and recommend 3–6.
- **How translations are made:** AI draft, plus human review for anything about health, safety, periods or legal.
- **How it stays light:** English stays inside the app. Other languages download on first use and are cached, like the food catalogs (`services/catalogs/CatalogLoader.ts`).
- **What stays English at first:** USDA food names, and legal documents until professionally translated.
- **Right-to-left** only if such a language is chosen.
- **In Settings:** follow the phone's language, or choose one.
- **Rough size and effort** per phase.

**Then build in phases:**
1. The setup: an i18n library that needs no new native build, plus a check that fails when new hard-coded text appears in converted screens.
2. One language end to end on the core screens: onboarding, Home, Diet, Fitness, the Gozlin screen's buttons and labels, Settings and notifications. The owner checks it on their phone.
3. The rest, screen group by screen group:
   - smart-layer copy
   - achievements
   - Gozlin's offline replies
   - the 19 cycle reading pages
   - and so on

Dates and numbers follow the language. Test that "1.840" and "1 840" still read correctly everywhere numbers are parsed.

---

## When you report back

Plain English, short:
1. What changed, described by what the owner will see on the phone.
2. What was checked (tests, type check), and what couldn't be checked without the phone or a build.
3. What the owner needs to do, as numbered clicks, with why and whether it's optional.
4. What is waiting for their answer.
5. A short "try this on your phone" checklist for the next time the app runs.
