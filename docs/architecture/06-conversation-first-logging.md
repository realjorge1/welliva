# 06 — Conversation-First Logging

**Goal:** the user tells Gozlin *"I had eggs and toast and went for a 5k run"* and the
system extracts **structured events** into the Timeline — confirmed, corrected, and
committed by the user. Logging stops being a form and becomes a conversation.

This sits on top of the foundation (Timeline event store) and reuses the server's
existing forced-tool-use machinery. The chat today is deterministic intent-routing
(`GozlinChatEngine`); this adds a **logging intent** that writes data.

## 1. Pipeline

```
  user utterance
        │
        ▼
  ┌──────────────────────────┐
  │ 1. EXTRACT               │  deterministic matchers first;
  │   utterance → LogDraft[] │  LLM tool-call fallback for the long tail
  └──────────────────────────┘
        │  drafts (NOT committed)
        ▼
  ┌──────────────────────────┐
  │ 2. RESOLVE               │  fill macros/calories from MealLibrary/
  │   enrich + validate (zod)│  EXERCISE_DATABASE; flag low-confidence
  └──────────────────────────┘
        │
        ▼
  ┌──────────────────────────┐
  │ 3. CONFIRM               │  inline confirmation chips in chat:
  │   user edits/approves    │  "Log these 2 items?" [Adjust] [Log]
  └──────────────────────────┘
        │  approved drafts
        ▼
  ┌──────────────────────────┐
  │ 4. COMMIT                │  append HealthEvents (idempotent by draftId)
  │   drafts → events (L1)   │  → recompact today's DaySummary (L2)
  └──────────────────────────┘
        │
        ▼
  Gozlin acknowledges in voice + the relevant card updates
```

**Confirmation is mandatory.** We never silently write inferred health data. This is
both an accuracy safeguard (LLMs miscount) and a trust/privacy stance
([09](./09-privacy-and-consent.md)).

## 2. The LogDraft contract

```ts
// health-os/timeline/logging/LogDraft.ts
export interface LogDraft {
  draftId: string;                    // stable per extraction → idempotent commit
  eventType: EventType;               // e.g. "nutrition.meal.logged"
  /** Human label shown in the confirmation card, e.g. "Eggs & toast (~320 kcal)". */
  label: string;
  payload: Record<string, unknown>;   // validated against the catalog schema on commit
  confidence: number;                 // 0–1; low-confidence drafts default UNchecked
  /** What still needs the user: missing/ambiguous fields. */
  needs?: ("amount" | "time" | "which_meal" | "intensity")[];
  source: "deterministic" | "llm";
}
```

A single utterance can yield several drafts (a meal + a workout + a weigh-in).

## 3. Extraction — deterministic first, LLM at the seam

Mirrors the app-wide tenet (deterministic core, LLM optional):

### Tier 1 — deterministic matchers (offline, free, instant)

A rule pack handles the common, high-signal cases without any network:
- **Food:** match against `constants/MealLibrary.ts` names/keywords + quantity words
  ("a bowl of", "2 eggs") → `nutrition.meal.logged` with macros from the library.
- **Water:** "drank/had **N** glasses/ml/oz of water" → `hydration.water.added`.
- **Workout:** match `EXERCISE_DATABASE` names or "ran/walked/cycled **N** km/min" →
  `workout.session.completed` / a cardio event.
- **Body:** "weighed **N** kg/lb", "waist **N**" → `body.measurement.logged`.
- **Check-in:** "slept **N** hours", "feeling stressed/great" → `checkin.logged`.

Deterministic drafts are high-confidence and work fully offline — the default path.

### Tier 2 — LLM extraction (the long tail, consent-gated)

When the deterministic pass is empty/partial and `ai_cloud` consent is on, call
`POST /v1/log/extract` with the utterance + `MinimizedContext`. The server uses
**forced tool-use** (`server/src/anthropic.ts` `callToolValidated`, the same mechanism
diet/workout generation already uses) to emit a schema-shaped `{ drafts: LogDraft[] }`,
zod-validated with one self-repair retry. The **server commits nothing** — it returns
drafts; the device decides.

```
tool: emit_log_drafts(drafts: LogDraft[])   // tool_choice forces this shape
```

> Reusing the existing forced-tool-use path is why this is low-risk: it is the proven
> pattern that already produces `DaySchedule`/`GeneratedWorkoutPlan` reliably on Haiku.

## 4. Resolve & validate

- Enrich missing macros from `MealLibrary` (and the AI diet generator's estimates as a
  fallback), missing exercise metadata from `EXERCISE_DATABASE`.
- Validate each draft's `payload` against the catalog schema for its `eventType`.
- Drafts with `needs[]` render an inline editor (a quantity stepper, a meal-slot
  picker) so the user resolves ambiguity in one tap.

## 5. Confirm (the UX contract)

In the Gozlin chat, extraction renders a **structured confirmation card** (a new
`__kind: "log-confirm"` in the existing `GozlinStructuredRenderer` dispatch):

```
┌─────────────────────────────────────────┐
│  Want me to log these?                   │
│  ☑ Breakfast · Eggs & toast   ~320 kcal  │  ← editable; tap to adjust
│  ☑ Run · 5.0 km                ~30 min   │
│  ☐ Weight · 78 kg  (low confidence)      │  ← unchecked by default
│            [ Adjust ]      [ Log 2 ]     │
└─────────────────────────────────────────┘
```

- Checked-by-default for high confidence; **unchecked for low confidence**.
- "Adjust" opens the per-draft editor; "Log N" commits the checked set.
- Nothing is written until the user taps Log.

## 6. Commit (idempotent)

```ts
async function commitDrafts(drafts: LogDraft[]) {
  const events = drafts.map(d => buildEvent({
    type: d.eventType, payload: d.payload, source: "coach",
    origin: { surface: "chat", sessionId, note: "conversation-logged" },
    id: ulidFromSeed(`draft:${d.draftId}`),       // ← idempotent: re-confirm = no dupe
  }));
  await timeline.appendMany(events);
  await memory.recompactDay(todayDate());         // today's summary updates immediately
}
```

- **Idempotency:** the event id derives from `draftId`, so a double-tap or a retry
  cannot create duplicates.
- **Provenance:** `source: "coach"` + `origin.note` marks these as conversation-logged
  → visible and filterable in the Memory Center ([08](./08-memory-center.md)).
- **Immediate feedback:** recompacting today's `DaySummary` means the nutrition rings,
  protein alert, and streak update the instant the user confirms.

## 7. Edge cases & safety

| Case | Handling |
|---|---|
| Ambiguous quantity ("some rice") | `needs: ["amount"]` → editor with a sensible default portion. |
| Past-time logging ("yesterday I…") | parse relative dates → event `localDate` = yesterday; recompact that day. |
| Duplicate of an already-logged meal | dedupe by `draftId`; the confirm card also flags "looks already logged". |
| Medical/▒safety claims ("my chest hurt") | NOT auto-logged as health data; routed to the existing `alert`-tone coach path (refer-out), never written as a measurement. |
| Offline | Tier-1 deterministic extraction still works; Tier-2 simply unavailable, surfaced as "I logged what I could offline." |
| Consent off for AI | only Tier-1 runs; no utterance leaves the device. |

## 8. Why this is safe to build

- It **writes through the same Timeline contract** as every other logger — no special
  storage path.
- It **degrades to deterministic + offline** by construction.
- It **cannot write without explicit user confirmation**, so an extraction error is a
  one-tap correction, never silent bad data.
- It **reuses the server's proven forced-tool-use** rather than inventing a new AI
  integration.
