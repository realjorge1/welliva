# Prompt 3: the cycle lock, the doctor checks, ovulation and hormones

> How to use: start a **new** Claude Code chat in the welliva folder, then paste everything below the line.
> The lock needs a new app build before it can be tried on a phone. Everything else works on the current build.

---

## Your roles

You are the lead engineer on **welliva's cycle tracker**. welliva is a React Native (Expo SDK 54) health app covering diet, workouts, habits, mood and water, plus an AI coach called **Gozlin**. On this job you wear six hats, and you switch between them deliberately:

1. **Senior mobile engineer.** You write the code so it reads like the code around it, with tests.
2. **Women's-health product specialist.** You know the evidence on menstrual cycles, ovulation, hormones and abnormal bleeding. You are **not** a doctor, and neither is the app. It notices, explains and refers. It never diagnoses.
3. **Clinical-safety reviewer.** Before anything ships, read every sentence the user will see and ask: could this frighten, mislead, shame, or be read as medical advice or contraception? Fix it if so.
4. **Privacy reviewer.** Cycle data is special-category health data. This job adds a lock, so you also ask, for every screen: what does someone holding this unlocked phone see?
5. **Honesty reviewer.** Every number and pattern on screen is checked against the data behind it. If it says "in 2 of your last 3 periods", the code counts exactly that.
6. **The owner's translator.** The owner is the product owner, not a developer. Every question you ask them and every update you give them is plain English. No code words, no file names, no commands. Describe things by what they see on the phone.

## The mission

The cycle tracker is already one of the most complete period trackers around. This job adds the small things that were missing. Each one is light for the user (no new screens to learn, at most one extra tap) and each one matters. The owner approved every item below on 2026-11-12 and 2026-11-13.

In build order:

1. **The lock.** Fingerprint, face or the phone's PIN on everything cycle. The lock-screen notifications were already discreet; the open app was not.
2. **The three doctor checks.**
   - "Did it stop your day?" under Cramps.
   - Heavy periods, with a blood-test suggestion when they also logged low energy.
   - Bleeding between periods, which explains spotting around ovulation instead of warning about it.
3. **A positive ovulation test updates this month's dates.** Today it only counts after two whole cycles.
4. **Phase names in plain words, with "What's at work today"**: which hormone is leading, what it does, why now, and how long it usually lasts.
5. **The rest:**
   - "We said the 14th. It came on the 15th." when a period is logged
   - share my next dates
   - "Start testing on Thursday" for ovulation-test users
   - a "Mid-cycle twinge" symptom
   - logging discharge

The thresholds below are **starting values**. Keep each one as a named constant with a one-line comment saying why. If real data shows one is wrong, change it and say so.

---

## What already exists (read it before you add anything)

Read `docs/cycle/smart-cycle.md` first. It is the reference for the seven smart features built 2026-11-03 to 05. **Most of the tracker has never been tested on a real phone.**

- **Engine (pure)** in `services/cycle/`:
  - `predict.ts`: normal-normal update, 80% window, `Confidence`, modes `normal | pregnancy | postpartum | menopause | hormonal` (`cycleModeOf`), `todayStatus` with `phase` and `lateBy`.
    - Ovulation = likely start − `lutealDays`. `lutealDays` is `DEFAULT_LUTEAL_DAYS` (14) unless `personalLuteal()` finds positive tests in **two or more completed** cycles.
    - `fertileWindowAllowed()` decides whether a fertile window may exist at all.
  - `episodes.ts`: periods are episodes `{start, end|null}`, not red days. Choosing a flow on a day outside a period makes it a period day, **except spotting**.
  - `flags.ts`: doctor notes (`DoctorNoteId`), each with a `signature` so a dismissed note returns only when its evidence changes.
  - `library.ts`: 20 reading pages. `READING_FOR_NOTE` is exhaustive over `DoctorNoteId`.
  - `patterns.ts`: the patterns standard (see the traps below).
  - Also: `copy.ts` (`phaseLabel`, `cycleHeadline`, `confidenceLine`, `glanceConfidence`, `bleedWords`), `brief.ts` (Gozlin brief + the consent ask), `relief.ts`, `late.ts`, `upcoming.ts`, `hungry.ts`, `water.ts`, `contraception.ts`, `suggest.ts` (the one suggestion slot), `reminderPlan.ts` + `reminders.ts`, `exportData.ts` (CSV + doctor summary), `store.ts`, `types.ts`, `view.ts`.
- **State:** `contexts/CycleContext.tsx` (`startPeriod`, `endPeriod`, `logDay`).
- **Screens:** `app/(tabs)/cycle.tsx`, `app/cycle/setup.tsx`, `app/cycle/settings.tsx`, `app/cycle/learn/*`.
- **Components:** `components/cycle/*`, including `CycleHomeCard`, `CycleDial`, `CycleCalendar`, `DayLogSheet` (the Ovulation test row only shows when the fertile window is on).
- **Lock-screen buttons:** `services/notifications/cycleActions.ts`, through `services/notifications/pipeline.ts`.

**Files outside the cycle screens that show or use cycle information.** The lock work needs every one of these:
- `app/(tabs)/index.tsx` (Home card)
- `app/(tabs)/diet.tsx` (hungrier-week card and target note)
- `app/(tabs)/exercise.tsx` (session eased for cramps or heavy flow)
- `components/navigation/Deck.tsx` (the water note after a weigh-in)
- `components/navigation/SideMenu.tsx` (the Cycle row)
- `components/notifications/center/ActivityCards.tsx` (receipts titled "Period")
- `app/(tabs)/privacy.tsx`, `app/(tabs)/settings.tsx`
- Gozlin: `components/gozlin/useGozlin.ts`, `useGozlinSnapshot.ts`, `services/gozlin/GozlinChatEngine.ts`

---

## Before you touch anything

1. **Ask the owner whether they've tried the cycle tracker on their phone yet**, in plain words: "Have you opened the Cycle screen on your phone and logged a period yet? Did anything look wrong or break?" If they report problems, **fix those first**.
2. **The app is running live on the owner's phone.** Metro hot-reloads every file you save onto their phone within seconds. A half-finished save is a crash in their hand. So:
   - Every save must be valid, working code.
   - Add new helpers **before** the edit that uses them, or write the whole file in one go.
   - Before removing anything, search for every remaining use of it.
   - Never drive or tap the phone yourself.
   - A full reload fixes a crashed phone: connect to `ws://localhost:8081/message` and send `{"version":2,"method":"reload"}`.
3. **The new native module is the biggest crash risk of this job.** The build on the owner's phone does **not** contain `expo-local-authentication`. Importing it the normal way throws at load and blanks the whole app on their phone. Load it with `requireOptionalNativeModule` (the pattern in `services/notifications/exactAlarms.ts`), or a guarded lazy `require`. When it's missing, the lock switch is simply not offered. Prove this works on the current build before going further.
4. Don't commit unless the owner asks. Never revert, stash or "tidy" files you didn't change for this job.
5. **Read your memory index first** (it loads automatically). These notes matter here: cycle tracking, smart cycle, cycle discoverability, legal & consent, notification system, analytics, no cosmetic counters, no dashed lines, design system, Home instrument (the react-native-svg bitmap-width trap), Skia GPU cache leak, responsive layout, low-end perf, live-device edits, LogBox toast trap, EAS build preflight, owner action steps, Windows file traps.
6. **Map before you build.** Where this prompt disagrees with the code, **the code wins**. Tell the owner in one plain line, then follow the code.

---

## Ground rules (non-negotiable)

### Cycle-specific traps (each of these has bitten before or is guarded by a test)

- **Storage:** put new data **inside the existing cycle documents** (`CycleSettings`, the day logs) wherever you can, so it rides the merge, the backup namespace (`@welliva_cycle_*` ↔ `@welliva_cycle_local_*`) and "Delete all cycle data". A new day-log field needs:
  - a line in `normalizeDayLog`;
  - a decision in `isEmptyDayLog`, since a day holding only the new field is not an empty day;
  - an export column.
- **Values are storage strings:** add new ones, never rename.
- **The headless reminder path** (`relayCycleReminders`) uses `predict` + `todayStatus`, never `computeView`. A test guards this. It already passes the day logs to `predict`, so a change to `predict` reaches the reminders. Keep it lean.
- **Library tests:** pages must quote **the same thresholds the app acts on**. A new `DoctorNoteId` needs a page in `READING_FOR_NOTE` or the build breaks. New pages need tests in the same style.
- **The patterns standard** (`patterns.ts` header):
  - only **completed** cycles count;
  - at least **2 cycles** before anything is called a pattern;
  - the denominator is the cycles that had enough data, never cycles with nothing logged;
  - wording is "in 3 of your last 4 cycles";
  - a pattern is a **timing**, not a cause.
- **No phase stereotypes, ever.** Nothing is driven by "luteal phase, so…". The library's energy-and-training page promises this. The hormone card (Phase 4) **explains** the cycle. It never prescribes food, training or mood from it.
- **Modes:** every feature states what it does in normal, hormonal contraception, pregnancy, postpartum and menopause. `docs/cycle/smart-cycle.md` has the current table and `services/cycle/__tests__/modes.test.ts` holds it. Extend both.
- **The fertile window is opt-in (off by default).** When it's off, nothing in this job may give a date for ovulation or call a day fertile, including the hormone card and its picture.
- **Discreet:** with `discreet` on (the default), lock-screen text never mentions a period. Nothing in this job adds lock-screen text.
- **Analytics: none.** Owner's rule: cycle features are **never counted**, because the timestamp of a cycle message is cycle data. No `track()` for anything in this job, including the lock switch. If anything goes through the smart layer, add it to `UNCOUNTED_FEATURES` in `services/smart/types.ts`.
- **Gozlin:** add **no** new lines to the cycle brief. The coach-sees list lives in three places that must agree: `constants/legal.ts`, the consent blurb in `health-os/privacy/consent.ts`, and the Gozlin row in `app/cycle/settings.tsx`. If the brief's existing "what she logged today" line automatically picks up new day-log fields, check that the current words ("what you logged today") honestly cover them, and say so in your report.
- **Legal:**
  - `LEGAL_VERSION` is **4** and `LEGAL_LAST_UPDATED` is "5 November 2026" (`constants/legal.ts`).
  - The Privacy Policy's "What we collect" sentence lists the cycle log's fields one by one. **Discharge** and **"kept me from my day"** are new kinds of data, so they need words there. "Mid-cycle twinge" is a symptom, already covered by "symptoms you note".
  - Raising the version makes every user re-accept. Handle it per decision D2.
  - After any edit to `constants/legal.ts`, the public copy must be republished (`npm run legal:publish`). That pushes to a public site, so **ask the owner first**.

### Honesty

- Gates before claims. Below a gate, say nothing.
- **A missing value is not zero.** A period with nothing logged is unknown, not "no cramps".
- Every doctor note says what was seen, in their numbers, and that it's worth raising. It never names a condition.

### Project rules

- **Brand:** always lowercase "welliva" in any text the user sees.
- **Design system:** use `components/ui` and the tokens. `LayoutAnimation` is banned.
- **No dashed or dotted lines, anywhere,** including the hormone picture and calendar marks.
- **Performance:** the owner tests on a low-end TECNO phone. No looping animations. Every `FlatList` sets `removeClippedSubviews={false}`. Skia paths that change every frame must be volatile.
- **Responsive:** hold on short and tall phones at ~1.3× text size.
- **Logging:** background failures log once with `console.log`, never `console.warn` or `console.error`.
- **Windows traps:**
  - Never put `Foo.tsx` next to `foo.ts`. For example, a `CycleLock.tsx` component beside a `cycleLock.ts` module breaks the build.
  - `app/_layout.tsx` is CRLF.
  - Use `String.fromCharCode` for special characters typed through tool input.
  - Edit with the Edit/Write tools, never shell string-replacement.
- **Pricing:** everything in the cycle tracker is **free**, including the lock.
- **Tests:** vitest. New logic goes in pure modules with tests in `services/cycle/__tests__`. Inject `today`. Build date fixtures from **local date parts**, never `toISOString()`.
- **Verification after every phase:** `npm run typecheck`, `npm run lint`, `npm test`. Every test must pass (the old 2 legal postal-address failures were resolved on 14 November 2026). On Windows, run the tests from an uppercase `C:\` working directory: a lowercase `c:\` makes every file fail on load with zero tests run.

---

## Kickoff: ask the owner these decisions first

Use the AskUserQuestion tool. Put your recommended option first and label it "(Recommended)". Each question must stand alone in plain words.

- **D1. Device check.** The question in "Before you touch anything", step 1.
- **D2. The legal wording (explain why you're asking).**
  - Why it matters: "Logging discharge and 'kept me from my day' are new kinds of information, so the Privacy Policy needs a few more words. If the app update with your 5 November privacy changes hasn't reached users yet, I can add them quietly. If it has, everyone will be asked to accept the updated terms once more the next time they open the app."
  - The question: "Has the app update with the 5 November privacy changes been released to users yet?"
  - Options: **Not yet**, Yes, Not sure.
  - If "Not sure", treat it as released: plan a version bump, but don't bump without a final OK.

**Decided for you.** List these in your preview so the owner can overrule any of them:
- The lock covers **this phone only**. It doesn't sync, because it depends on this phone's own screen lock.
- Heavy-period and between-periods thresholds as written below.
- The between-periods note is off on hormonal contraception, where bleeding between bleeds is common. The heavy-period note stays on.
- With PCOS on the profile, one positive ovulation test does not move the dates.
- "Mid-cycle twinge" is offered to everyone. The discharge row only shows with the fertile window on.
- Discharge is a check on the ovulation estimate, not an input to it.
- The hormone line sits in the cycle screen's Today section. The Home card doesn't change.

---

## Build plan

**Phase 0 (read only, no edits):** do the device check, then map every file named here and confirm the facts this prompt states. Work out how a new app build gets made on this project, and whether you can start one yourself (EAS login, local Android build) or the owner has to. Send the owner a plain preview of what they'll see, five lines at most, with no file names. Then ask the kickoff questions.

After **every** phase:
1. Run typecheck, lint and tests.
2. Give the owner a 3–5 line plain update: what's new, and where on the phone to try it.

### Phase 1: the lock

**What the user sees:**
- In Cycle settings, one switch: **"Lock my cycle"**, with one line under it: "Asks for your fingerprint, face or phone PIN before showing anything about your cycle."
- With it on:
  - opening anything cycle asks the phone's own unlock (fingerprint, face, or the phone's PIN or pattern as fallback);
  - Home's cycle card shows only **"Cycle · locked"** with an Unlock button;
  - the "Started today / Not yet" lock-screen buttons keep working, because they write without opening the app.

**Native setup:**
- `npx expo install expo-local-authentication`.
- Add its config plugin to `app.json` with an iOS `faceIDPermission` line in plain words ("welliva uses Face ID to unlock your cycle log.").
- `app.json`'s `android.permissions` is additive, so check the merged manifest has `USE_BIOMETRIC`.
- Run the EAS preflight checks from memory (`eas config`, `npm ci --dry-run --include=dev`) so the cloud build doesn't fail on a lockfile mismatch.
- Guard the import (see "Before you touch anything", step 3).

**Behaviour:**
- **Who can turn it on:**
  - Offered only when the module is present **and** the phone has a screen lock (`getEnrolledLevelAsync()` above NONE).
  - With no screen lock, the switch is disabled with one line: "Set a screen lock on your phone first."
  - Turning it on asks for one successful unlock first, which proves they can get back in.
- **Use the device fallback** (`disableDeviceFallback: false`), so a phone without fingerprint hardware still works with its PIN. There's no welliva PIN to forget.
- **What's behind it:** every cycle route, including `/cycle`, `/cycle/settings` and `/cycle/learn/*`. The learn pages carry the doctor-summary share button, which exports their data.
- **Relocking:** relock when the app has been in the background longer than `LOCK_GRACE_MS` (start at 60 s, so the share sheet and a quick app switch don't relock).
  - Ignore iOS `inactive`, and ignore the transitions the unlock prompt itself causes.
  - Prompt automatically **once** on opening. If they cancel, show a calm locked state with an Unlock button. Never loop prompts.
- **Never lock someone out of their own data:**
  - If the phone's screen lock is later removed, the lock can't work. Let them in, switch the lock off, and say so in one line.
  - If the module disappears, behave as if the lock were off.
- **Storage:** a device-local key that never syncs (`services/sync/syncKeys.ts`, `DEVICE_LOCAL_KEYS`). Remember that any unlisted `@welliva_` key syncs to the cloud.
  - Make sure the key isn't caught by the cycle backup move in `store.ts`.
  - Decide what "Delete all cycle data" does to it, and say what you chose.
- **Everything outside the cycle screens, while locked:** walk every file in the "outside the cycle screens" list. The rule: **nothing on screen names the cycle, a period, a symptom or a phase.**
  - **Home:** the "Cycle · locked" card. The Unlock button goes straight to the cycle screen after a successful unlock.
  - **Diet:** the target number stays correct, but the reason note doesn't name the cycle. The hungrier-week offer waits.
  - **Fitness:** an eased session says "Lighter session today", with no reason given.
  - **Deck:** the water note after a weigh-in doesn't show.
  - **Notification centre:** cycle receipts don't say "Period".
  - **Drawer:** the Cycle row stays as it is.
  - **Accessibility labels** follow the same rule.
- **App switcher:** the recent-apps preview can show the last screen. When the lock is on and the app leaves the foreground from a cycle screen, cover it. Check on Android whether the cover lands before the preview is taken.
  - If it doesn't, **don't** add another native module (screen-capture blocking). Report it to the owner as a separate choice.
- **Known limit, report it, don't build it:** Gozlin's chat history can mention the cycle when they've let Gozlin see it. The lock doesn't cover the chat.
- **Modes:** works in every mode. Nothing in it reads the cycle.
- **Tests:** the lock's decisions (available? locked now? relock after background time?) live in a pure module with injected clock and capabilities.

### Phase 2: the three doctor checks

All three are new `DoctorNoteId`s in `flags.ts`. Each has a signature built from the dates behind it, a page in `READING_FOR_NOTE`, a line in the doctor summary, and dismissal that holds until the evidence changes.

**2a. "Did it stop your day?"**
- **What the user sees:** when Cramps is ticked in `DayLogSheet`, one more chip under it: **"Kept me from school, work or plans."**
- **Storage:** a new day-log field, for example `stoppedDay?: true`. Drop it when Cramps is removed from that day, the same way `relief` is dropped.
- **The note** (`cramps_disruptive`): among the last 3 completed periods **in which cramps were logged**, the chip was ticked on at least one day in **2 or more**.
  - Wording, in their numbers: "Cramps kept you from your day in 2 of your last 3 periods with cramps (5 days in all)."
  - Page: the existing `cramps` page. Add a section on pain that stops your day being worth raising, and why: it is the signal clinicians look for. Name no condition on screen.
- **Modes:** on in every mode where cramps can be logged. Off in pregnancy.

**2b. Heavy periods** (`heavy_periods`)
- A period **counts** when flow was logged on 2 or more of its days. The note shows when heavy flow was logged on **3 or more days** in **2 or more** of the last 3 counted periods.
- If **low energy** was logged on 2 or more days inside those heavy periods, add: "Heavy periods and tiredness together are worth asking about. A simple blood test can check your iron."
- Page: the existing `heavy-bleeding` page. It must quote the same thresholds.
- **Modes:** on in normal, postpartum (after the first period) and **hormonal contraception**, since this is about how much bleeding, not when. Menopause already has its own note for any bleeding.

**2c. Bleeding between periods** (`between_periods`)
- **A between-day** is a day with any flow (spotting included) logged outside every period, more than `BETWEEN_MARGIN_DAYS` (2) before the next start and more than 2 after the previous end. A little spotting either side of a period is ordinary.
- **Spotting around ovulation is not counted.** For a completed cycle, estimated ovulation = next start − the luteal length `predict` would use. Days within ±1 of it are left out of the note.
- **The note:** 2 or more of the last 3 completed cycles contain a between-day.
  - Wording: "Bleeding between periods in 2 of your last 3 cycles (4 Oct, 2 Nov)."
  - Page: a new `bleeding-between-periods` page in the "when something changes" group. It covers what's common (around ovulation, just before or after a period, the first months of a hormonal method), what's worth raising, and the urgent signs already used elsewhere in the library.
- **The explanation in place of a warning:** when spotting is logged in `DayLogSheet` on a day within ±1 of this cycle's estimated ovulation, one calm line: "Light spotting around the middle of the cycle is common, often around ovulation." It gives no date, so it's fine with the fertile window off.
- **Modes:** off on hormonal contraception (decided for you). Postpartum counts only cycles after the first period. Off in pregnancy. Menopause already has its note.

### Phase 3: a positive ovulation test updates this month's dates

**What the user sees:** after logging a positive test, the Next period card, the dial's ovulation dot and the fertile window all move. One line says **"Updated from your ovulation test on Tue 12 Nov."**

**Rules (in `predict.ts`):**
- **The current cycle** is from the last period's start. A positive test on a day ≥ start + `LIVE_TEST_MIN_DAY` (6, the same lower bound as `personalLuteal`) and ≤ today anchors this cycle.
  - Use **the same anchor rule as `personalLuteal`** (which positive day counts), so the learned luteal length and the live update measure from the same point. If you change it, change both, with their tests.
- **Ovulation** = test day + 1. **Likely start** = ovulation + `lutealDays`. **Window** = ±`TEST_HALF_WIDTH`:
  - 2 days when the luteal length is their own;
  - 3 days on the default 14 (the library's 11–16 day range).
- The test is evidence about **this** cycle, so it replaces the calendar estimate for this cycle even when that estimate was narrower.
- **Fertile window** is re-anchored to the new ovulation. Parts already in the past are simply past.
- Add `fromTest: string | null` to `Prediction`. `confidenceLine` and `glanceConfidence` must say the window came from the test.
- **With PCOS on the profile, don't move the dates.** LH tests can read positive without ovulation there. Show one line saying so where the test is logged. Check how `personalLuteal` treats PCOS and say what you found.
- **Every reader stays consistent.** Late (a late period now counts from the new window), the dial, Home card, reminders (headless path), trip and hungrier-week placement (`hungryLedger` already freezes the past), and the brief (the coach already sees "when your next period is likely", so no new words).
- **Modes:** normal and postpartum only. Hormonal and pregnancy never predict.
- **Tests:** a regular cycle, a late-ovulation cycle (the period moves later), a test before day 6 (ignored), a future-dated test (ignored), PCOS (no change), and the lean reminder path producing the same plan as the view.

### Phase 4: phase names in plain words, with "What's at work today"

**4a. Plain names.** Keep the proper name and add a plain half in `phaseLabel` and wherever phases are named:
- "Follicular phase · building up to ovulation"
- "Mid-cycle · around ovulation" (or the fertile-window wording when it's on)
- "Luteal phase · after ovulation, before your period"

A test checks these match the phase list in the library's `how-it-works` page.

**4b. "What's at work today."** A new pure module, for example `services/cycle/hormones.ts`, with tests. Given today's phase, cycle day, prediction, mode, profile, fertile-window setting and today's logged symptoms, it returns the card.

**What the user sees:**
- One quiet line in the cycle screen's Today section, for example "Progesterone · at its highest about now".
- Tapping it, or the phase name under the dial, opens the full card in a sheet. Example, day 21:

  > **Progesterone: at its highest about now**
  > It's made by what's left of the follicle after it released the egg. It keeps the womb lining steady, and it warms you up a little (about half a degree).
  > **How long:** it usually starts falling in about 4 days. When it does, your period follows, likely Tue 25 Nov.
  > *Still learning: based on 2 cycles.*

- Under it, **a small picture**: four smooth curves (oestrogen, progesterone, LH, FSH) across **their** cycle. The first half stretches to their estimated ovulation and the second half is `lutealDays` long. It has a solid marker for today and a caption: "Typical shapes, not measured."
  - It's static: no animation loop, no dashed lines.
  - Read the react-native-svg bitmap-width memory before drawing.

**Content by phase** (have the clinical-safety hat check every sentence):

| Phase | What's at work | How long |
|---|---|---|
| Period | Oestrogen and progesterone at their lowest. Their fall started this bleed. FSH is already rising to grow the next egg. | Until bleeding stops, about their usual length |
| Building up | FSH grows a few follicles. One leads and makes **oestrogen**, which climbs and rebuilds the lining (and makes discharge wetter: link the discharge row when it's shown). | Until ovulation. This half varies, which is why late periods usually mean late ovulation. With the fertile window on: "oestrogen usually peaks in about N days". |
| Around ovulation | Oestrogen's peak sets off the **LH surge**, which is what ovulation tests detect. The egg is released about a day later and lives about a day. | The surge lasts 1–2 days |
| After ovulation | **Progesterone** leads, from what's left of the follicle, with a second smaller oestrogen rise. It peaks about a week after ovulation and raises resting temperature slightly. | Fairly fixed, 11–16 days (use their `lutealDays`). If there's no pregnancy, both fall and the period starts. |
| Late | The second half is steady, so a late period usually means ovulation came late this cycle. | Point to the existing late section. Don't repeat it. |

**Rules:**
- **Shapes, not levels.** No numbers for hormone levels, ever. Use "usually" and "about now", timed from their estimated dates, carrying the prediction's confidence word.
- **Never blame feelings on hormones.** No "you may feel irritable today".
  - A hormone is linked to a symptom **only when they logged that symptom today**, and **only physical symptoms**: tender breasts, bloating, breakouts, headache.
  - Example: "You logged sore breasts. That often comes with progesterone's rise."
  - Mood and energy are never linked.
- **A positive test (Phase 3) makes it exact:** "Your test caught the LH surge on Tue. Ovulation usually follows within a day and a half."
- **Fertile window off:** no ovulation date anywhere in the card. The "around ovulation" card speaks in general terms, and the picture shows only oestrogen and progesterone, with no ovulation mark.
- **Modes:**
  - **Hormonal contraception:** one line instead of the card. **Be accurate:** methods differ. Some stop ovulation; others, such as a hormonal coil, work mainly in the womb, and many users still ovulate. So: "Hormonal contraception changes how your own cycle's hormones rise and fall (some methods stop ovulation, others work mainly in the womb), so welliva can't time them. That's also why it logs your bleeding instead of predicting it." Never claim there's no ovulation.
  - **PCOS on the profile:** explain, don't time. No "how long" and no curves pinned to their dates, with one line saying why: ovulation can come late or not at all.
  - **Pregnancy, menopause:** off.
  - **Postpartum before the first period:** "After a birth, the cycle's hormones take a while to restart. This starts again with your first period."
  - **Ages under 20 and from 40** (named constants): one line saying hormones swing more at these ages.
- **Library:** update `how-it-works` (and `ovulation` where it overlaps) so the pages and the card say the same things. Test it.

### Phase 5: the rest

**5a. "We said the 14th. It came on the 15th."**
- When a period start is logged (screen button, "Started on another day?", Home card, or lock-screen button), compute what `predict` would have said **the day before the start**, from the episodes and day logs before it. It's a pure recompute, so nothing new is stored.
- **What the user sees:** one quiet line under the one-tap row on the cycle screen and on the Home card, for the rest of that day.
  - On the likely day: "Right on the day we said."
  - Inside the window: "We said around Thu 14 (12–16). It came on the 15th: inside the window, a day after the likeliest day."
  - Outside it: "It came 4 days after the window we gave (12–16)."
  - Never spin a miss. Add "Your next window now includes this cycle" only if the cycle actually counts (≥15 days, not a gap).
- **Gates:** a prediction existed, the start is within the last 3 days, and the mode is normal or postpartum (not the first period after a birth).

**5b. Share my next dates**
- A "Share dates" button on the Next period card opens the phone's share sheet with one line: "My next period is likely 18–21 Nov." Add "most likely Wed 19" only when the confidence is "Fairly sure".
- Nothing stored, no analytics. Only shown when a window exists, so never on hormonal contraception.

**5c. "Start testing on Thursday"**
- **Shown when:** the fertile window is on, a prediction exists, they've logged at least one ovulation test ever, there's no positive yet this cycle, and today is no later than the estimated ovulation + 1.
- **The day** = the window's earliest edge − (`lutealDays` + 3), never before the expected end of the current period. Shown inside the fertile box: "Test daily from Thu 14 Nov until you get a positive." If that day has passed: "Test daily now until you get a positive."
- **PCOS:** one line saying these tests can read positive without ovulation, so treat a positive as a hint.
- In the app only. The reminder budget (3 pending) is full.

**5d. "Mid-cycle twinge"**
- Add `mid_cycle_pain` to `SYMPTOMS` (label "Mid-cycle twinge"), offered to everyone. It's not a relief symptom.
- **When it's ticked on a day within ±2 of this cycle's estimated ovulation,** one calm line: "A twinge on one side around the middle of the cycle is common. It's often ovulation." Always followed by: "Pain that's sudden or severe, or comes with fever or fainting, needs seeing someone today."
- **A pattern in `patterns.ts`,** under the standard: in completed cycles where it was logged, it fell within ±2 days of estimated ovulation in 2 or more.
  - Fertile window off: "came around the middle of your cycle in 3 of your last 4 cycles".
  - Fertile window on: "…within 2 days of your estimated ovulation".
- Check every place that lists or counts symptoms (export, doctor summary, brief, tests that pin the list).

**5e. Logging discharge**
- A new day-log field `discharge?: "dry" | "sticky" | "creamy" | "clear_stretchy"`. One optional row in `DayLogSheet`, shown **only with the fertile window on**, like the Ovulation test row.
- A small mark on clear-and-stretchy days in the calendar (solid, never dashed).
- **A check, not an input.** After 2 or more completed cycles with clear-and-stretchy days logged, a pattern under the standard. Either "Your clear, stretchy days came in the 5 days before your estimated ovulation in 3 of your last 4 cycles", or, when they don't line up, "…came later than my estimate in 2 of 3 cycles. An ovulation test would tell us more."
- "An estimate, not birth control" stays on every fertile surface.
- **Legal per D2:** add discharge (fertile-window users only) and "whether cramps kept you from your day" to the Privacy Policy's cycle-log sentence.

### Phase 6: bring it together

1. **Export and doctor summary** (`exportData.ts`): new fields in the CSV. In the summary, the three new notes and the "kept me from my day" count. Ask yourself whether a doctor would want each line. If not, leave it out.
2. **Library:** all new and updated pages pass the threshold-matching tests, and every new note links to a page.
3. **Modes audit:** for each of normal, hormonal, pregnancy, postpartum and menopause, read through what every new feature shows. Extend `modes.test.ts` and the table in `docs/cycle/smart-cycle.md`.
4. **The quiet check:** count what can appear on the cycle screen on one day. The receipt, the hormone line and the start-testing line are informational and live in their own places. Nothing here may take the one suggestion slot (`suggest.ts`) from late, trip, water, what-helped or hungry week.
5. **The lock check:** with the lock on and the app not unlocked, open every screen in the app and confirm nothing names the cycle, a period, a symptom or a phase. List what you checked.
6. **Privacy check:** list every new piece of stored data. Check it's inside the backup namespace (or deliberately device-local, for the lock), in the export, and removed by Erase. Confirm nothing new reaches Gozlin, and nothing reaches the lock screen.
7. **Legal per D2**, and republish only with the owner's OK.
8. **Docs:** add a section per feature to `docs/cycle/smart-cycle.md`: rules, thresholds, files, storage fields.
9. **Memory:** update the cycle-tracking memory (the 2026-11-12/13 proposals are now built) and add any traps you learned.

---

## Done means

- Every item in the mission works end to end and in every mode.
- On the current build (without the native module) the app runs normally and the lock switch simply isn't offered.
- Typecheck and lint are clean. All tests pass.
- New pure logic has its own tests, and the library tests still prove the pages match the code.
- Legal wording handled exactly per D2, and nothing published without the owner's OK.
- No crash reached the owner's phone during the work.
- Nothing is committed unless the owner asked.

## Your final report to the owner (plain English, no jargon)

1. **What's new and where to find it:** one line per feature, saying where on the phone.
2. **How to try each one,** step by step. Some need history (a few cycles of logs) or the fertile window switched on. Say which, and what they'll see in the meantime.
3. **The new app build the lock needs:** if you can start it yourself, say so and do it once they agree. If they must do it, give click-by-click steps, why, and that the rest works without it.
4. **Anything else they must do,** for example approve publishing the updated privacy pages. Give steps, why it matters, and whether it's optional.
5. **Decisions you made on their behalf,** each in one line, so they can overrule.
6. **Anything you skipped or couldn't do, and why,** including the app-switcher preview and the Gozlin chat limit if they apply.
7. **One reminder, if it's still open:** the app must be **free to download** on Google Play (Play Console → Products → App pricing → "Make your app free"). Until then, nobody can install the app to see this work without paying.
