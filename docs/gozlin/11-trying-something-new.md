# 11 — Trying Something New

> A user does an exercise for the first time. The next morning Gozlin asks, once, how it sat with them. Months later, when that exercise is back in the plan, Gozlin remembers what they said and shows where that memory came from.

**Status:** Phase 1 (exercises) is **built**, uncommitted in both repos. The owner answered D1–D7 on 2026-09-27 (§14). §15 lists the files and what's still to do. The design was written the same day, and the parts that changed during the build are marked in place.

**The stance.** Code decides **what** to ask and **when**. The model decides **how** to say it. Detecting that something is new, choosing whether to ask, timing the question and remembering the answer are all pure functions that run on the phone with `now` injected. The model phrases the question and the recall inside an ordinary conversation, and does nothing else. No model call is ever spent on deciding that something is new.

**What makes it feel human** is restraint, timing and memory, not clever wording. Most new things are never asked about.

---

## 1. What the code says, and where it changes the brief

These came out of reading the code, and each one changes part of the design.

| # | Finding | Where | Consequence |
|---|---|---|---|
| F1 | **AI-plan exercise ids depend on position.** They are built as `ai_<session>_<index>_<slug>`, so the same "Goblet Squat" gets a new id every week and in every slot. | backend `src/services/workout.ts:208` | Novelty keyed on `exerciseId` would flag every AI exercise as new, every week. Subjects are therefore keyed on a **canonical key** (§3.1), not on the id. |
| F2 | **Session history keeps only the newest 50 sessions.** At 5 sessions a week that is about 10 weeks. | `services/SessionService.ts:588` | "First time in 12 weeks" could be false once older sessions have been dropped. A small **seen-ledger** records first sightings and never drops them, and every claim names the date the evidence starts from (§3.2). |
| F3 | **Skipped exercises are stored as results** with no sets done, both when skipped and when a session ends early. | `SessionService.ts:325`, `:506` | "Tried it" means at least one completed set. Otherwise an exercise someone skipped could produce a question about it. |
| F4 | **`movementPattern` has only 7 values** (push/pull/squat/hinge/core/cardio/flexibility). | `models/workout.ts:9` | Anyone who trains has already done every pattern, so "a new pattern" almost never happens. Novelty needs a level in between: the **family** (§3.1). |
| F5 | **The demo figure's motion map is not a family map.** It maps tricep dips and dumbbell chest press to `pushup`, because that is how they are drawn. | `fitness/animation/exerciseMotions.ts` | It answers "how do we draw this?", not "would this feel new?". The families are written out by hand in their own table instead. |
| F6 | **Timeline workout events carry no exercise ids.** | `health-os/timeline/catalog.ts:50` | The timeline can't tell us what was done. Session summaries are the only per-exercise source. |
| F7 | **Receipts only exist for numbers.** A recall like "12 Sep — you said your back was tight" contains no number, so it would get no receipt. | `agent/receipts.ts` `receiptsFor` | A second kind of receipt is needed for quotes (§8.3). |
| F8 | **The chip bar rotates a pool of four, and tapping a chip sends its text as the user's message.** | `GozlinSuggestionBar.tsx` | A due question would get swapped out mid-read, and it is Gozlin's question, not something the user said. It becomes **a still row of its own directly above the bar**, which opens an answer sheet (§7.1). *(Built that way rather than as a pinned chip inside the bar, so the bar's animation code was left alone.)* |
| F9 | **The clinical screen runs only inside `runAgentTurn`.** | `agent/GozlinAgent.ts:204` | An answer typed into the sheet never reaches the model, so capture has to call `screenForClinicalRisk` itself (§9). |
| F10 | **Every `@gozlin_*` key syncs to the cloud by default** (sync uses a list of exclusions). The Trust screen promised "Everything below is off until you switch it on". | `services/sync/syncKeys.ts`, `app/(tabs)/privacy.tsx:62` | The facts behind D1 and D5. *Correction from the build:* the design also claimed existing users would see a default-on switch shown as "off". That was wrong: `ConsentRepository.get()` fills in missing categories with their defaults (`reconcile`). Only the pure `isGrantedIn` and `toRows` read a missing decision as `false`; both now fall back to `defaultGranted`. |
| F14 | **Keys with no merge strategy sync as last-write-wins, and a merge-by-id union would bring a deleted record back** from another phone. | `services/sync/mergeStrategies.ts` | Once notes sync (D5), two phones would overwrite each other's notes, or re-merge a forgotten one. The three `@gozlin_` keys get merge-by-id strategies, and **forgetting a note leaves a scrubbed tombstone** with a newer `updatedAt`, which the merge prefers (§10). |
| F11 | **Sampling by day fits badly with a two-morning window.** A 1-in-2 day draw mostly just moves the question to the second morning, when it is closer to stale. | `GozlinTrackerHabits.ts` (`sampled`) | Restraint samples the **subject**, not the day: some new things are never asked about, and the ones that are get asked on the first morning (§5). |
| F12 | **The bandit uses `Math.random`** and needs far more data than a handful of questions a month. | `health-os/learning/bandit.ts:54` | Not used in Phase 1. A plain, deterministic back-off does that job for now (§5). |
| F13 | **`app/memory-center.tsx` is the raw event record** ("Full record", a timeline `FlatList`). The remembered facts, each with a Forget button, are on `app/(tabs)/knows.tsx` (titled "Memory"), built on the same `useMemoryCenter` hook. | `app/(tabs)/knows.tsx` | "Things you tried" goes on the Memory screen, beside "How you've been feeling", using its `SectionHeader` / `ListRow` / `RemoveButton` pattern (§7.4). |

---

## 2. The pipeline

Every step is a pure function with `now` injected. Storage is only touched at the edges.

```
session saved ──► ingest ──► seen-ledger ──► detect ──► candidates ──► select ──► due question
                 (pure)       (store)        (pure)                    (pure)        │
                                                                                     ├─► pinned chip ──► answer sheet ─┐
                                                                                     └─► state-block line ─► model ────┤
                                                                                              note_experience ◄────────┘
                                                                                                    │
today's plan / their message / today's log ──► recall (pure) ──► ≤3 lines ──► model ──► recall receipt
```

| Step | Function (file) | Input → output |
|---|---|---|
| Canonicalise | `subjectOf(result)` (`novelty/subjects.ts`) | session result → `{ variantKey, familyKey, label }` |
| Ingest | `ingestSessions(ledger, sessions, now)` (`novelty/detector.ts`) | ledger + summaries → the next ledger (idempotent by `sessionRunId`) |
| Detect | `detectNovelty(ledger, sessions, now)` | → `NoveltyCandidate[]`, each with its evidence frozen at the time it was tried |
| Select | `selectQuestion(candidates, askLog, settings, now)` (`novelty/curiosity.ts`) | → `DueQuestion \| null` after every gate in §5 |
| Recall | `recallFor(records, triggers, askLog, now)` (`novelty/recall.ts`) | → at most 3 `RecallLine`s |
| Asked? | `askedInReply(reply, due)` / `recallsUsed(reply, shown)` | reply text → what the model actually did, for the log and for receipts |

---

## 3. Data model

### 3.1 Subjects: the canonical key

| Source id | Variant key | Family key |
|---|---|---|
| Catalog id (`push_03`, …; 140 in `EXERCISE_DATABASE`) | the id itself | from `EXERCISE_FAMILY[id]`, a hand-written table with a test proving every catalog id is mapped |
| `ai_<s>_<i>_<slug>` | the slug, normalised (singular, stop-words removed); if it matches a catalog name, the catalog id | the catalog family if it matched; otherwise a head-noun rule (squat, lunge, row, push-up, plank, bridge, deadlift, curl, press, crunch, pull-up, burpee, …); otherwise the slug itself |

Families are about what the next day feels like, not about what is drawn. Incline, decline and diamond push-ups are the `push-up` family. Tricep dips are their own family. So are Nordic curls, pistol squats and negative pull-ups.

### 3.2 Seen-ledger: `@welliva_exercise_seen`

This is an index of the workout log, so it lives beside the log in the `@welliva_` namespace. "Clear memory" leaves it alone, the same way it leaves the session history alone. "Reset data" wipes it along with everything else.

```ts
interface SeenLedger {
  version: 1;
  observedSince: string;        // YYYY-MM-DD, the oldest session this ledger has proof of
  sessionsSeen: number;         // sessions ingested since observedSince
  subjects: Record<string, {    // keyed by variantKey AND by `fam:<familyKey>`
    firstSeen: string; firstRunId: string; lastSeen: string; count: number;
    priorSessions: number;      // sessionsSeen at the moment of first sighting, frozen
    maxDifficulty?: Difficulty; // family entries only
  }>;
  recentRuns: string[];         // the last 80 sessionRunIds; this is what makes ingest idempotent
}
```

- **When it's written:** inside `SessionService.saveSummary`, the single place a session is stored. A catch-up pass also runs from `sessionHistory` whenever the coach screen mounts.
- **Holes in the record:** if the history is full (50) and even its oldest session was never ingested, some sessions may have been lost unseen. In that case `observedSince` moves forward to the oldest session we still have. The claim gets shorter; it never gets wrong.
- **At ship time** the ledger is seeded from the 50 sessions in the history, so `observedSince` becomes the oldest of them.

### 3.3 Curiosity log: `@gozlin_curiosity`

This records the questions that were opened. It is capped at 180 days, because only budget and back-off read it. Never asking about a subject twice comes from the ledger instead: a subject that has been asked about has been seen, so it can never be new again.

```ts
interface CuriosityEntry {
  id: string; kind: "exercise"; variantKey: string; familyKey: string; label: string;
  triedRunId: string; triedAt: string;          // ISO, the session's completedAt
  openedAt: string; opensAt: string; closesAt: string;
  status: "open" | "answered" | "dismissed" | "expired" | "ignored";
  turnsCarried: number;                         // agent turns that carried the line (cap 3)
  askedInChatAt?: string;
}
```

`openedAt` is written once, from an effect the first time the question is selected. It is never written on render.

### 3.4 Experience store: `@gozlin_experiences`

This is the memory itself. It holds at most 300 records, each kept for 365 days, newest first.

```ts
interface ExperienceRecord {
  id: string; kind: "exercise";
  variantKey: string; familyKey: string; label: string;   // label = the name they saw in the player
  triedOn: string;                                        // YYYY-MM-DD
  answeredAt: string;
  source: "asked-chip" | "asked-chat" | "volunteered";
  quote: string | null;            // their words, VERBATIM, ≤140 chars
  soreness: 0 | 1 | 2 | 3 | null;  // effect answer: none / a bit / quite / very
  enjoyed: "yes" | "mixed" | "no" | null;   // enjoyment answer
  feelings: string[];              // from a small MIND_LABELS subset
  clinical?: ClinicalRiskKind;     // their words tripped the clinical screen (§9)
  lastRecalledAt?: string;
}
```

**Effect** answers (soreness, feelings) feed coaching. **Enjoyment** answers are stored now, and in Phase 3 they turn into planning preferences. Declining to answer is recorded in the curiosity log as `dismissed`, not as a record here. There's nothing to remember, only something not to ask again.

### 3.5 Settings

The switch is a consent category, `experience_followups`, so it gets the existing audit trail. It is **on by default** (D1). It sits in a new consent group, `coaching`: behaviours over data the app already holds, as distinct from senses (what comes in) and reach (what goes out). The consent test pins that no sense or way out may ever default on.

---

## 4. Timing windows

The window is set by when the effect is actually felt. A question that isn't asked inside its window is dropped, never asked late.

| Kind | Opens | Closes | Why | Phase |
|---|---|---|---|---|
| New exercise | the later of **05:00 the next local day** and **session end + 10 h** | **session end + 48 h** | Next-day soreness usually starts 12–24 h after a new movement and peaks at 24–72 h. Asking the same evening is too early; after 48 h it feels like digging up the past. A session at 23:30 therefore opens at 09:30. | 1 |
| First late caffeine | 05:00 next day | 12:00 next day | Its effect is last night's sleep. | 3 (effect; D2/D3) |
| Alcohol | 05:00 next day | 14:00 next day | Next-morning effect. | 3 (effect; D2/D3) |
| Big late meal | 05:00 next day | 11:00 next day | Sleep and how the morning felt. | 3 (effect; D2/D3) |
| New meal, enjoyment only | 18:00 the same day | 12:00 next day | Liking is known straight away. | 2 |

Windows are computed from absolute times (`completedAt`), and the 05:00 anchor uses the local clock (`context.localClock`). That way a change of time zone or a clock change can't reopen a question that has closed.

---

## 5. The gates

A candidate is asked about only if it passes **every** gate below.

| Gate | Rule (Phase 1) | Why |
|---|---|---|
| **Switch and tier** | `experience_followups` is off, **or the account is not entitled to the coach** (`allows("coach-limit")`; the whole feature is Pro, D7) → the selector returns `null`, recall returns `[]`, `note_experience` returns `unavailable`, and no line reaches the state block. | One switch, enforced inside the engines rather than in the UI. Records already kept stay visible and forgettable on the Memory screen whatever the tier. |
| **Performed** | ≥2 completed sets, or ≥60 s of timed work. Skipped results never count (F3). | One aborted set is not "trying" something anyone will feel. |
| **Coverage** (the gap means something) | Measured when it was tried: ledger covers **≥28 days**, **≥8 prior sessions**, and sessions in **≥3 of the previous 6 weeks**. | In someone's first weeks everything is new, and silence in the log only means something from a person who logs regularly. The user who trains twice a week for a month is the smallest one who passes. |
| **Salience** | The family is new to the ledger. **Or** the family is known but this variant is harder than anything done in it before (for example, a first pistol squat after regular squats). Excluded: the `flexibility` category, and beginner cardio (march in place, step touch). **One** candidate per session, scored: new family 3, harder variant 2, +1 if `advanced`, +1 if nothing in its **category** was trained in the 6 weeks before. *(Built on category, not pattern: a session result carries its category, and an AI exercise's pattern never reaches the result.)* | Ask about the one new thing that mattered. A new stretch or an easier variant produces nothing worth asking about. |
| **Restraint** | `hash(variantKey + triedRunId) % 3 !== 0`, so about 2 in 3 of the candidates that pass are asked. | Deterministic, so the chip never flickers on re-render. It samples the subject, not the day (F11). |
| **Budget** | At most **1 open** question. At most **1 opened per local day**. At most **2 opened per rolling 7 days**. | A new programme can introduce five new movements in one week. The owner wants this to feel occasional. |
| **Expiry** | `now > closesAt` → `expired`. It counts as ignored only if the question was actually shown or carried. | A late question is worse than none. |
| **History** | Never ask twice about the same family; this falls out of the ledger. **Back-off** on consecutive ignores (dismissed, expired after being shown, or unanswered in chat): 2 in a row → 7-day pause, 3 → 21 days, 4 or more → 60 days. Any answer resets it. | A coach who is ignored should ask less often. The pause gets longer rather than switching the feature off. |

**The evidence each candidate carries** is exact about the ledger. For example: `first time on their log — 23 sessions logged since Mon 14 Jul`. It never says "8 weeks", because the ledger proves a session count and a start date, not a length of time.

---

## 6. Recall

Recall happens when a subject comes back. Its variant or family key has to match a record through one of these triggers:

| Trigger | How often | Why |
|---|---|---|
| The user's message names it (token and alias match, the same approach as `crossReference`) | Every time | They raised it themselves. Staying quiet about their own history would be amnesia. |
| It is in **today's planned session** (`snapshot.workoutSession`) | At most once per **21 days** per record. The 21 days only start once the model actually used it (a recall receipt was attached). | Without the limit, a Monday plan would bring up the same memory every Monday. |
| It is in a session logged today | Same as the plan trigger | The conversation right after a session. |

- **Order and limits:** message matches first, then exact variant before family, then newest first. At most **3** lines. Quotes are clipped to 140 characters, the same limit `identityEvidence` uses. **Records never leave the phone as a list**; only these lines do.
- **A family match names what they actually did:** "last time you tried *Nordic Hamstring Curls* (12 Sep)…" even when today's plan has the eccentric variant.
- **Dismissed and declined records** have nothing to recall and are skipped.

---

## 7. Where it shows up

No notifications in Phase 1.

### 7.1 The chip and the answer sheet

- **The chip** (`CuriosityChip`). While a question is open, a still row sits **directly above** `GozlinSuggestionBar`, never inside its rotation. It has a × for "not now". Its label is drawn deterministically from four phrasings, for example *"Nordic Hamstring Curl yesterday — how did it land?"*. The chip is UI, not Gozlin speaking, so a fixed template is fine here.
- **Tapping it opens `ExperienceAnswerSheet`** (`ui/Sheet`, since this is a decision rather than a document). The subtitle gives the reason: *"First time on your log. New movements often show up a day or two later."*
- **One tap is a complete answer.** The first row is *Nothing much · A bit sore · Quite sore · Very sore*, and it saves on the first tap.
- **Optional extras:** *Liked it · Mixed · Not for me*; up to 2 of *Proud, Satisfied, Tired, Drained, Frustrated* (words from the mood log); and free text of up to 140 characters.
- **Two ways out:** *Not now* (dismissed) and *Don't ask me these* (turns the switch off, with a toast pointing to Trust).
- **Once the question has been asked in chat, the chip disappears**, so it is never asked twice.

### 7.2 The state-block line

It rides in tier 3 while the question is open and has not yet been asked. It stops after **3 agent turns** that didn't use it. It is phrased as an instruction, because the risk is not the model missing it but the model reciting it (the lesson from `crossReferenceLines`):

```
WORTH ASKING ABOUT — only if the conversation leaves room; at most once; never in place of answering them:
Nordic Hamstring Curls, first on their log on Fri 26 Sep — 23 sessions logged since Mon 14 Jul.
Why now: new movements often show up a day or two later.
Ask how it sat with them, in passing, in your own words. "Fine" is a complete answer. Record what they say with note_experience. If it doesn't fit, leave it out — the app offers it another way.
```

- **After a reply**, `askedInReply` checks whether the reply names the subject in a sentence ending in "?". If so, it stamps `askedInChatAt`.
- **The next 2 turns then carry a capture line instead:** *"You asked about X. If their message answers it, record it with note_experience. Do not ask again."*
- **If no note is recorded after those 2 turns**, the question closes as `ignored`.
- `runAgentTurn` returns these facts in `result.curiosity`, and `useGozlin` writes them. The agent loop stays pure.

### 7.3 `note_experience` (new tool, in both repos)

```
note_experience({ exercise, quote, soreness: none|mild|moderate|severe|unsaid, enjoyed: yes|mixed|no|unsaid })
```

- **`quote` must be their exact words.** The tool normalises it and checks it is a substring of a user message in this request (the agent passes `turnText` into the tool context). Anything else is rejected with *"quote must be copied from their message"*. This check is what makes "you said…" true by construction; the model cannot paraphrase its way into a memory.
- **It resolves `exercise`** against the open question first, then the catalog, then today's and recent sessions. **Phase 1 accepts exercises only.** The schema has no food kind (see §9 on eating disorders).
- **No blocking confirmation sheet (decided).** It writes only their own words, checked verbatim, into a store they can see and delete. A **"Noted · Undo"** toast (`GozlinToast`, about 6 s) is the consent. Friction is what kills this feature, and a sheet for every "yeah my legs were wrecked" is exactly that friction.
- **At most 1 note per turn.** Without the injected `noteExperience` action it fails closed (`unavailable`), the same as the other write tools.
- **Source:** `asked-chat` if a question is open or was just asked, otherwise `volunteered`.

### 7.4 Memory Center and Trust

- **The Memory screen** (`app/(tabs)/knows.tsx`, F13) gets a new section, **"Things you tried"**, placed after "How you've been feeling". Each row shows the date, the label, their words and small tags for soreness and liking. Each row has a Forget button (the existing `RemoveButton`), and the section has **Forget all of these**. It is a mapped `ListGroup` like its neighbours, not a new `FlatList`; if one is ever added, it sets `removeClippedSubviews={false}`. `useMemoryCenter` gains `experiences`, `forgetExperience` and `forgetAllExperiences`.
- **Trust** gets a **"Coaching"** card with one switch, "Follow-ups on new things", and a note saying plainly that it starts on. The intro was reworded from "Everything below is off until you switch it on" to "Every sense and every way out below is off…", which is still exactly true.

### 7.5 Deferred

- A row in the check-in sheet.
- A quiet line on the session intro screen, for example *"12 Sep: 'hamstrings wrecked for two days'"*. That is the most useful spot for recall, but it is deterministic UI, not Gozlin, so it waits for sign-off (D6).

---

## 8. Evidence, grounding, receipts

### 8.1 One source for everything

`experienceEvidence(text, ctx)` in `agent/experiences.ts` returns `{ due, capture, recalls }`. It follows the `habitEvidence` / `identityEvidence` pattern: `twinStateMessage` renders from it, and `GozlinAgent` registers the same object in `collectAllowedNumbers` and in the receipt ledger. It is pure, so calling it twice cannot disagree.

### 8.2 Numbers

- The session count in the evidence ("23 sessions") is registered.
- Any digits inside a quote are registered, since they were shown to the model.
- **Relative days are rendered and registered** ("Fri 12 Sep, 15 days ago"). The model will say "two weeks ago", and "15 days ago" has to be backed. A number that isn't shown is never registered: the audit flagged exactly that looseness.
- Written dates are already exempt from grounding.

### 8.3 Receipts

- **Figures** join the existing trail under the new origin `experience-log`, labelled in `ORIGIN_LABEL` as "What you told me".
- **Quotes get a new kind of receipt.** A new `GozlinMessage.recalls?: RecallReceipt[]` holds `{ recordId, label, triedOn, quote, source }`, attached by `recallsUsed(reply, shownRecalls)` when the reply names the subject. `ReceiptTrail` shows it as one mono pill, **`YOU TOLD ME · 12 SEP`**. It opens a sheet with their words, the date, how it was captured ("You answered the morning after" / "You mentioned it") and a **Forget** action.
- **Attaching a recall receipt is what starts the 21-day recall limit.**

### 8.4 Prompt

- **Tier 1 gets a new "# Trying something new" section.** It contains no user data, so the shared cache survives. Draft:

> The current-state block sometimes offers one thing worth asking about: something they did for the first time. Ask only when it offers one, once, in passing, in your own words — never instead of answering them, and accept any answer, "fine" included. Record their answer with note_experience, copying their words exactly.
> When it shows what they told you about something before, you may bring it up where it helps, quoting them with the date. One occasion is one occasion: never say it caused anything, never call it an intolerance, allergy, injury or condition, and never tell them to avoid something because of it. If they describe pain, swelling or anything that sounds medical, do not interpret it — say it is worth having looked at.

- **Both repos:** the section and the tool go into the app (`context.ts`, `tools.ts`) and into backend `src/gozlin/system.ts` and `tools.ts`. `GOZLIN_PROMPT_VERSION` is bumped on both sides, so `serverContract.test.ts` catches any drift.
- **Size:** the new state-block lines add at most about 1.2k characters, well inside the server's 12k per message and 20k total.

### 8.5 Output safety

- **New rule kind, `attribution`.** It catches "you're (probably) intolerant / allergic / sensitive to X", "X doesn't agree with you", "your body can't handle / tolerate X", and "X caused / triggers your <symptom>".
- **Correction sent to the model:** *"state what they said and when; one occasion is not a cause."*
- **"Left you sore" and "made you sore" stay allowed.** That is their own report of ordinary training soreness. Banning it would make recall unusable.

---

## 9. Safety and eating disorders

- **Answers in chat** already pass through the clinical screen first. "My knee swelled after the lunges" gets the referral, the model never runs, and nothing is noted.
- **Free text in the sheet** runs `screenForClinicalRisk(text, bio)` before it is saved. If it trips:
  - the sheet shows the deterministic reply word for word;
  - the record is kept, since they are their words and they can see and forget them, and it is marked `clinical`;
  - it is recalled only together with a fixed instruction: *"they described a symptom last time; do not interpret it; if relevant, ask whether they have had it looked at."*
- **Eating disorders (Phase 1):**
  - no food kind in the engine's allowlist;
  - no food kind in the `note_experience` schema;
  - no food anywhere in the pipeline.

  "How did you feel after eating X?" teaches people to sort food into good and bad, so it waits for D2 and D3.
- **Proposed for D3 (a care flag):**
  - when the clinical screen returns `disordered_eating`, store `{ kind, at }` in `@gozlin_care_flags`, with no text;
  - it lasts 180 days and is cleared by "Clear memory";
  - while it is present, every food follow-up and every food recall is off, even after Phase 2 ships.

---

## 10. Privacy

- **What leaves the phone:** at most 1 question line and 3 recall lines per turn, only with Cloud AI on (`ai_cloud`), with quotes of 140 characters or less. The store is never sent.
- **Forgetting:**
  - The Memory screen can forget one record or all of them. So can the YOU TOLD ME sheet, at the moment a memory is used.
  - Forgetting leaves a **tombstone**: id, `forgotten`, a newer `updatedAt`, and no words (F14). A receipt on an old message holds only the record's id, label and date, never the words, so a Forget empties it too.
  - "Clear memory" (coach menu, and "Forget everything" on the Memory screen) wipes `@gozlin_experiences`, `@gozlin_curiosity` and `@gozlin_care_flags`, because they are spread into `G_KEYS` in `GozlinMemoryStore.ts`.
  - The seen-ledger survives, the same way the session history survives (§3.2).
- **Sync (D5: yes):** all three `@gozlin_` keys sync like the other memory tiers, merged by id rather than overwritten. The curiosity log merges too, so a question answered on one phone isn't asked on the other. The ledger (`@welliva_exercise_seen`) syncs last-write-wins; a stale copy heals on the next catch-up from the merged session history.

---

## 11. Failure modes

| Failure | Guard | Test |
|---|---|---|
| The same AI exercise counts as "new" every week (F1) | Canonical key: slug, then catalog match, then family | Same name, two plans, two positions → one subject, no candidate |
| "First time" is false because the history was capped (F2) | The ledger, plus the hole rule; claims always name `observedSince` | 60 sessions with a gap in ingest → `observedSince` moves forward and the evidence string matches |
| A skipped exercise triggers a question (F3) | Performed gate | A result that was skipped or had 0 sets never becomes a candidate |
| The same run is ingested twice (the player and the summary both save it) | `recentRuns` | Ingesting twice leaves the ledger identical |
| Everything looks new to a new user | Coverage gate | Day 1–27, or fewer than 8 sessions → no candidates, even for a brand-new family |
| New programme week → five questions | Budget, plus one candidate per session | 5 new families across 3 days → exactly 1 opened; 2 in 7 days at most |
| Asked late | `closesAt` | now = closesAt + 1 min → null; status `expired` |
| Asked again | Ledger never-new, chip hidden once `askedInChatAt` is set, capture line says "do not ask again" | Loop test: second turn carries no question line |
| Asked with no room / the model recites the line | Instruction framing, 3-turn cap | Loop: a turn that didn't use it still counts; the 4th turn carries nothing |
| The model invents a quote | Verbatim check in the tool | Paraphrase → rejected; exact substring → noted |
| A number in the line is rejected by grounding | `experienceEvidence` registers it | Loop: a reply quoting "23 sessions" and "15 days ago" passes and gets receipts |
| The same memory every Monday | 21-day recall limit per record once used | Plan on day 0 and day 7 → only day 0 carries it; a message mention on day 7 still does |
| A symptom is recorded and then interpreted | Clinical screen on sheet text, `clinical` flag, output rule | "rash after" → referral shown; recall line carries the fixed instruction |
| The switch shows off while the feature runs (F10) | `toRows` falls back to `defaultGranted` | Consent record without the key → the row reads the default |
| A time-zone or clock change reopens a window | Absolute times | Local-date shift doesn't move `closesAt` |

---

## 12. Test plan (vitest, `__tests__` folders)

The tests prove behaviour. They are not a regex checking the example it was written from.

- **`novelty/__tests__/subjects.test.ts`**
  - Every catalog id maps to a family.
  - Positional AI ids with the same name share a key.
  - Plural and singular forms collapse to one key.
  - An unknown AI name falls back to its own slug and never to a pattern.
- **`novelty/__tests__/detector.test.ts`**
  - Ingest is idempotent.
  - The hole rule works.
  - No false novelty while logging is sparse (1 session a fortnight), in the first 4 weeks, or for a skipped exercise.
  - A variant within a known family is not new; a harder variant is.
  - The evidence string's numbers equal the ledger's.
- **`novelty/__tests__/curiosity.test.ts`**
  - Every gate is tested on its own, then all together.
  - Window edges: 23:30 session; 05:00 versus +10 h; 48 h close.
  - Budget: 1 open, 1 a day, 2 a week.
  - Expiry.
  - Back-off ladder, and reset on an answer.
  - The sampler is stable across calls and passes about 2/3 over 300 synthetic subjects.
  - Switch off → null.
- **`novelty/__tests__/recall.test.ts`**
  - Recall appears **only** when the subject reappears (in the plan, the message or today's log).
  - At most 3; message matches first.
  - The 21-day limit only starts once the recall was used.
  - Family matches name the variant.
  - Dismissed and declined records are skipped.
- **`agent/__tests__/experiences.test.ts`** (agent loop, fake transport)
  - The question line appears only inside the window.
  - A reply quoting it passes grounding and carries a receipt, and `askedInReply` fires.
  - The next turn carries the capture line.
  - `note_experience` records the verbatim quote and rejects a paraphrase.
  - The clinical message path never records anything.
  - Switch off → no line and the tool returns `unavailable`.
- **`agent/__tests__/outputSafety.test.ts`**
  - New `attribution` cases, including the ones that must pass ("that left you sore for two days").
- **Eating-disorder gate**
  - A food log entry never produces a candidate.
  - `note_experience` refuses food.
  - The schema has no food kind.
- **`serverContract.test.ts`** stays green once the tool, the prompt and the version land in both repos.
- **Screen check** (manual, on device): Phase 1 acceptance, steps 1–5 below.

**Phase 1 is done when:**
1. A session with a never-done exercise is logged.
2. The next morning, and only then, the chip appears or the conversation asks, once.
3. A one-tap answer shows on the Memory screen.
4. With that exercise planned weeks later, Gozlin quotes it with a `YOU TOLD ME` receipt.
5. With the switch off, none of this happens.

Plus: full suite green apart from the two legal holds, and `tsc` and eslint clean.

---

## 13. Build order (followed)

1. **Pure engines:** `services/gozlin/novelty/{subjects,exerciseFamilies,detector,curiosity,recall}.ts`, with their tests.
2. **Storage:**
   - `services/gozlin/ExperienceStore.ts` (experiences and curiosity log, both in `G_KEYS`);
   - the ledger in `services/ExerciseLedger.ts`, wired from `SessionService.saveSummary`;
   - the consent category and the `toRows` fallback;
   - sync: merge strategies and tombstones, per D5 (no `syncKeys` change was needed; syncing is the default).
3. **State block, grounding, receipts:**
   - `agent/experiences.ts`;
   - `context.ts` (tier 1 section and tier 3 lines);
   - `GozlinAgent.ts` (registration, `result.curiosity`, recall receipts);
   - `tools.ts` (`note_experience`);
   - `receipts.ts` (origin label);
   - `outputSafety.ts` (`attribution`);
   - the backend mirror and the version bump.
4. **UI:**
   - `components/gozlin/useCuriosity.ts`;
   - `ExperienceAnswerSheet.tsx`;
   - the pinned chip;
   - the recall pill and sheet;
   - the "Things you tried" section on `knows.tsx`, via `useMemoryCenter`;
   - the Trust switch.

---

## 14. Decisions (answered by the owner, 2026-09-27)

| # | Decision | Answer | Where it lives |
|---|---|---|---|
| **D1** | On by default, or opt-in? | **On by default.** | `consent.ts` (`defaultGranted: true`, group `coaching`); Trust "Coaching" card; intro reworded |
| **D2** | Food follow-ups in Phase 1? | **No.** | No food kind in the engines or in the `note_experience` schema |
| **D3** | How is a disordered-eating signal remembered? | **A flag with no text, kept 180 days, cleared by "Clear memory", which turns off every food follow-up.** | `careFlags.ts`, `ExperienceStore.recordCareFlag`. Written from chat and from sheet text. Nothing reads it until Phase 2 |
| **D4** | Notifications, ever? | **Not before Phase 4; then opt-in, counted against the daily notification limit.** | Nothing built |
| **D5** | Do experience notes sync to the cloud? | **Yes.** | Merge strategies and tombstones (F14, §10) |
| **D6** | Chip, state-block line, or both? | **Both.** | `CuriosityChip` + `experienceEvidence` lines |
| **D7** | Free or Pro? | **Pro** — the whole feature. | `useCuriosity`: `enabled` needs `allows("coach-limit")` |

---

## 15. What was built (Phase 1)

**App — engines** (`services/gozlin/novelty/`):
- `exerciseFamilies.ts` — all 140 catalog ids, plus ordered name rules for AI exercises.
- `subjects.ts` — canonical keys and mention matching.
- `detector.ts` — the seen-ledger, `ingestSessions`, `detectNovelty`.
- `curiosity.ts` — windows, gates, budget, back-off, and the chat stages.
- `recall.ts` — recall triggers, `askedInReply`, `recallsUsed`.
- `types.ts`, `index.ts`.
- `services/gozlin/careFlags.ts`.

**App — storage:**
- `services/gozlin/ExperienceStore.ts` — experiences with tombstones, the curiosity log, care flags, change announcements.
- `services/ExerciseLedger.ts` — serialised ingest, fed from `SessionService.saveSummary`.
- `GozlinMemoryStore` — `G_KEYS` now includes the three keys.
- `mergeStrategies.ts` — three strategies.
- Consent category `experience_followups`.

**App — coach:**
- `agent/experiences.ts` — `experienceEvidence`, `isVerbatim`, `resolveNoteSubject`.
- `context.ts` — the tier 1 "# Trying something new" section, and the tier 3 lines.
- `GozlinAgent.ts` — evidence registration, `result.curiosity`, `result.clinicalKind`, recall receipts, one clock for the state block and the tools.
- `tools.ts` — `note_experience`.
- `receipts.ts` — `RecallReceipt`, labels.
- `outputSafety.ts` — the `attribution` rule.
- `GOZLIN_PROMPT_VERSION` is `2026-09-27.3`.

**App — UI:**
- `useCuriosity.ts`, `CuriosityChip.tsx`, `ExperienceAnswerSheet.tsx`, `RecallSheet.tsx`.
- `ReceiptText.tsx` — the YOU TOLD ME trail.
- `GozlinToast.tsx` — an action, for Undo.
- Coach screen wiring and "Clear memory" copy.
- The "Things you tried" section on the Memory screen.
- The Trust "Coaching" card.

**Backend:** `src/gozlin/system.ts` (the same section, version `2026-09-27.3`) and `src/gozlin/tools.ts` (`note_experience`, sorted between `log_food` and `recall_memory`).

**Not built, deliberately:**
- the check-in-sheet row and the session-intro recall line (§7.5);
- anything food (D2);
- notifications (D4);
- the bandit (F12).

**Verified by tests only, not yet on a device:** the chip, the sheet, the toast and the recall pill.

---

## 16. Later phases (outline only)

- **Phase 2 — food, enjoyment first.** Families come from catalog food groups; brands are never new. Density means logging the slot ≥5 days a week. Needs D2 and D3.
- **Phase 3 — passive linking and preferences.** A first late coffee next to 5 h of logged sleep, stated once, as a single observation about their own data. Two or more consistent answers become a stated preference (for example, a dislike feeding `WorkoutGenerator`). The bandit may start learning which question kinds a person actually answers.
- **Phase 4 — opt-in notifications** (D4).
