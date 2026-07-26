# 05 — APIs & Contracts

Three contract surfaces: **(A)** the internal domain repositories (how code talks to
the store), **(B)** the **Context** read-model (how features/AI consume summarized
state), and **(C)** the external backend boundary (how the stateless server is called).

## A. Repository contracts (internal)

Repositories are the *only* code that touches the storage port ([01 §4](./01-domain-architecture.md)).
They expose intention-revealing methods, not raw key access.

### TimelineRepository

```ts
// health-os/timeline/TimelineRepository.ts
export interface TimelineRepository {
  /** Append one event. Idempotent on id. Returns the stored event. */
  append<T>(event: HealthEvent<T>): Promise<HealthEvent<T>>;
  appendMany(events: HealthEvent[]): Promise<void>;

  /** All non-redacted events for a local date, supersede-chains resolved. */
  byDay(date: string): Promise<HealthEvent[]>;

  /** Range query; partition-aware; never returns redacted. */
  query(q: { from?: string; to?: string; types?: EventType[]; limit?: number;
             includeRedacted?: boolean }): Promise<HealthEvent[]>;

  /** Soft-delete (Memory Center). Sets redacted=true; never erases. */
  redact(id: string): Promise<void>;

  /** Correction-by-append: emit a superseding event. Returns the new event. */
  correct<T>(originalId: string, payload: T): Promise<HealthEvent<T>>;

  /** Apply user tags (categorize). */
  tag(id: string, tags: string[]): Promise<void>;

  /** Hard erase for privacy (true delete). Guarded — see [09]. */
  eraseHard(predicate: (e: HealthEvent) => boolean): Promise<number>;

  index(): Promise<TimelineIndex>;
}
```

### MemoryRepository (the four layers)

```ts
export interface MemoryRepository {
  // L2 summaries
  daySummary(date: string): Promise<DaySummary>;        // compacts lazily if missing/stale
  rangeSummaries(from: string, to: string): Promise<DaySummary[]>;
  weekSummary(weekStart: string): Promise<WeekSummary>;
  monthSummary(periodKey: string): Promise<MonthSummary>;
  recompactDay(date: string): Promise<DaySummary>;      // after a correction/redaction

  // L3 long-term facts (wraps existing GozlinMemoryStore)
  facts(): Promise<LongTermMemory>;                     // motivation, prefs, constraints, patterns, episodes
  rememberFact(patch: Partial<LongTermMemory>): Promise<void>;
  addEpisode(ep: Episode): Promise<void>;               // also emits coach.episode to L1

  // L4 temporary
  conversation(): Promise<Message[]>;
  appendTurns(msgs: Message[]): Promise<void>;
}
```

### Settings repositories (record + change-event)

```ts
export interface GoalsRepository {
  get(): Promise<Goals>;
  set(patch: Partial<Goals>): Promise<Goals>;           // writes record + emits goal.set events
}
export interface PreferencesRepository {
  get(): Promise<Preferences>;
  set(patch: Partial<Preferences>): Promise<Preferences>; // writes record + emits preference.changed
}
export interface ProfileRepository {
  get(): Promise<HealthProfile>;
  update(patch: Partial<HealthProfile>): Promise<ProfileUpdateResult>; // safety re-fit + profile.updated + completeness
  completeness(): Promise<ProfileCompleteness>;          // [07]
}
```

> These wrap, rather than replace, today's `AppContext` callbacks
> (`updateGoals`, `setCuisinePreference`, `updateUserBio`). The existing
> safety-aware re-fit in `updateUserBio` (returns a `BioChangeSummary`) becomes
> `ProfileRepository.update`'s `ProfileUpdateResult`.

## B. The Context read-model (the AI/feature interface)

This is the contract that realizes *"future AI features consume summarized context
rather than raw historical logs."* It is the generalization of `GozlinTwin`.

```ts
// health-os/context/HealthContext.ts
export interface HealthContext {
  asOf: string;                       // ISO
  identity: {                         // from L3
    goal: PrimaryGoal | null;
    motivation: string | null;
    constraints: string[];            // injuries/conditions/time the user stated
    learnedPatterns: HabitPattern[];
    summary: string;                  // "losing fat, training 4×/week"
  };
  today: {                            // from L4 live + today's events
    nutrition: Metric; protein: Metric; water: Metric;
    workout: { planned: string | null; done: boolean };
    dayProgress: number;              // 0–1 of waking day
  };
  recent: {                           // from L2 — bounded
    days: DaySummary[];               // last 7–14
    week: WeekSummary;
    momentum: { streak: number; adherence7d: number; trainingLoad7d: number;
                trend: "rising"|"steady"|"cooling" };
  };
  body: GozlinBodyState;              // trajectory from L2/body events
  recovery: RecoveryState;
  flags: GozlinFlag[];                // normalized branch signals (exists today)
}

export function buildContext(input: {
  range?: { days: number };
  now?: Date;                         // injectable (determinism)
}): Promise<HealthContext>;
```

**Contract guarantees:**
- **Bounded size.** `recent.days` is capped (default 14). Context is a few KB
  regardless of total history → constant AI token cost for life.
- **Pure assembly.** `buildContext` reads Memory; it forms no opinions. Opinions are
  Insights' job.
- **Backward compatible.** `GozlinTwin` becomes a thin view over `HealthContext`
  (or `HealthContext` *is* the new Twin), so every existing engine keeps working.

### Insights consume Context, never storage

```ts
// every engine signature shape (already the discipline today):
generateCoachInsights(ctx: HealthContext): CoachInsight[];
buildForecast(ctx: HealthContext): GozlinForecast;
buildBriefing(ctx: HealthContext): GozlinBriefing;
// ...the LLM provider seam:
export interface LLMProvider { chat(req: { system: string; context: HealthContext;
                                           user: string }): Promise<string>; }
```

This is the structural enforcement of "AI consumes summaries": an engine *cannot*
read raw events because it is only handed a `HealthContext`.

## C. External backend boundary (the stateless server)

The server (`server/`, Claude-Haiku-locked) stays **stateless**. The current client
is `services/api/WellivaApi.ts` with three endpoints. The contract evolves only to
pass **Context** (not raw logs) and to add the extraction endpoint for
conversation-first logging.

### Existing endpoints (unchanged shapes)

| Endpoint | Request | Response |
|---|---|---|
| `POST /v1/diet/generate` | `{ bio, targets, date, dietId? }` | `DietGenerateResponse` |
| `POST /v1/workout/generate` | `{ bio, weekStart }` | `WorkoutGenerateResponse` |
| `POST /v1/coach/chat` | `{ system?, user }` | `{ reply, model }` |
| `GET /health` | — | ok |

### Evolution

1. **`/v1/coach/chat` gains a minimized context** instead of the app stuffing raw
   numbers into `system`:
   ```ts
   coachChat(args: { context: MinimizedContext; user: string }): Promise<CoachChatResponse>
   ```
   `MinimizedContext` is `HealthContext` passed through the **privacy boundary**
   ([09](./09-privacy-and-consent.md)) — health-flagged fields dropped/coarsened per
   consent. The deterministic engines still own all structured cards + grounding
   numbers; the LLM only handles open-ended prose (it never invents numbers — the
   existing rule).

2. **New `POST /v1/log/extract`** for conversation-first logging
   ([06](./06-conversation-first-logging.md)):
   ```ts
   // forced tool-use (reuses server/src/anthropic.ts callToolValidated)
   extractLogs(args: { utterance: string; context: MinimizedContext }):
     Promise<{ drafts: LogDraft[] }>
   ```
   Returns *drafts*, never commits. The device validates, the user confirms, the
   device appends events. The server touches no storage.

### Boundary invariants

- **Stateless:** no endpoint persists user data server-side. (Matches today.)
- **Consent-gated:** every outbound call passes `assertConsented("ai_cloud")`
  ([09](./09-privacy-and-consent.md)); with consent off or `EXPO_PUBLIC_API_URL`
  unset, deterministic local paths are used (the existing fallback discipline in
  `PlanSync`).
- **Minimized:** only `MinimizedContext` crosses the wire — never the raw Timeline,
  never identifiers beyond what's needed.
- **Model-locked:** server forces `claude-haiku-*`; the client cannot choose a model
  (existing `server/src/config.ts` rule).

## D. Error & offline semantics

Every repository and the Context builder are **offline-total**: they never throw on a
network condition (there is none for local reads), and AI calls degrade to
deterministic engines on failure — the pattern `PlanSync` already implements
app-wide. Storage errors are logged and fall back to the in-memory/default value
(the existing `readJSON` contract).
