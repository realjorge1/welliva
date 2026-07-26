# 01 — Domain Architecture

The Personal Health OS is organized as a set of **bounded domains** under a new
top-level module, `health-os/`. Each domain owns its data, its rules, and its
public API (a barrel `index.ts`). Cross-domain access goes through public APIs
only — never by reaching into another domain's internals.

## 1. The seven domains

```
┌─────────────────────────────────────────────────────────────────────┐
│                          health-os/                                  │
│                                                                      │
│   PROFILE        GOALS         PREFERENCES      (the "who & wants")   │
│   identity,      targets,      cuisine, food,                         │
│   bio, health,   target wt,    region, units,                        │
│   completeness   journey       equipment, days                       │
│        │            │              │                                 │
│        └────────────┴──────────────┘                                 │
│                     │ write events / read facts                      │
│                     ▼                                                 │
│   ┌──────────────────────────────────────────┐                       │
│   │  TIMELINE   append-only HealthEvent log   │  ← source of truth   │
│   └──────────────────────────────────────────┘                       │
│                     │ events                                         │
│                     ▼                                                 │
│   ┌──────────────────────────────────────────┐                       │
│   │  MEMORY    4 layers (history→summaries→   │                       │
│   │            long-term→temporary)           │                       │
│   └──────────────────────────────────────────┘                       │
│                     │ summaries + facts                              │
│                     ▼                                                 │
│   ┌──────────────────────────────────────────┐                       │
│   │  CONTEXT   bounded read-model the AI &     │  ← the interface     │
│   │            features consume (the "Twin++") │                       │
│   └──────────────────────────────────────────┘                       │
│                     │ context                                         │
│                     ▼                                                 │
│   ┌──────────────────────────────────────────┐                       │
│   │  INSIGHTS  pure deterministic engines      │                       │
│   │            (intelligence + gozlin) + LLM   │                       │
│   │            provider seam                    │                       │
│   └──────────────────────────────────────────┘                       │
│                                                                      │
│   PRIVACY (consent, export, erase, encryption)  cross-cuts all       │
│   PLATFORM (storage port, clock port, migrations) underlies all      │
└─────────────────────────────────────────────────────────────────────┘
```

### Domain responsibilities

| Domain | Owns | Does NOT own |
|---|---|---|
| **Timeline** | The append-only `HealthEvent` log; append/query/redact; partitioning. | Interpretation, scoring, summaries. |
| **Memory** | The four layers; compaction (events → summaries); retention/pruning; long-term facts. | Raw UI; AI calls. |
| **Context** | Assembling the bounded read-model (`HealthContext`) from Memory + a recent-events slice. | Persistence; opinions/recommendations. |
| **Insights** | All recommendations/scoring/coaching (pure) + the LLM provider seam. | Storage (reads Context only). |
| **Goals** | Targets (calories, water, workouts), target weight, journey/chapter state. | How goals are *met* (that's Insights). |
| **Preferences** | Cuisine, food dislikes, region, units, equipment, training days, notification prefs. | Health-safety constraints (those are Profile). |
| **Profile** | Health identity: bio, conditions, injuries, meds, pregnancy; **completeness + unlocks**. | Preferences; goals. |
| **Privacy** (cross-cutting) | Consent records, the AI data boundary, export, erase, encryption policy. | — |
| **Platform** (foundation) | Storage port + adapters, clock port, id generation, the **migration runner**. | Any domain logic. |

> **Why Profile, Goals, and Preferences are separate.** They change on different
> cadences and carry different safety weight. A cuisine switch (Preferences) is
> trivial and frequent; a new injury (Profile) is safety-critical and re-fits the
> whole plan; a target-weight change (Goals) opens a new "chapter". Coupling them —
> as today's single `UserBio` partly does — makes every edit a whole-bio rewrite and
> blurs which changes must trigger a safety re-fit. See
> [welliva-adaptive-profile] history: `updateUserBio` already does safety-aware re-fit;
> this split makes the boundary explicit.

## 2. Mapping existing code onto the domains

No file is deleted on day one. Existing modules are **re-framed** (and, in a later
mechanical milestone, relocated) into the domain they already belong to.

| Existing | Domain | Treatment |
|---|---|---|
| `services/OfflineStorage.ts` | Platform | Becomes the AsyncStorage **adapter** behind the storage port; date helpers move to `platform/clock`. |
| `services/ScheduleService.ts`, `DietPlanGenerator.ts`, `NutritionService.ts`, `WorkoutGenerator.ts`, `SessionService.ts`, `StreakService.ts`, `BodyLogService.ts` | Timeline (writers) + Insights (generators) | Their **writes** become Timeline events; their **pure logic** stays as Insights. |
| `services/intelligence/*` | Insights | Re-export under `health-os/insights`. Unchanged. |
| `services/gozlin/*` | Memory (`GozlinMemoryStore`) + Context (`GozlinTwin`) + Insights (the engines) | `GozlinMemoryStore` → Memory layers 3/4; `GozlinTwin` → Context; engines → Insights. |
| `services/AchievementService.ts`, `ChallengeService.ts`, `TournamentService.ts`, `RivalEngine.ts`, `MonthlyRecapService.ts`, `JourneyService.ts`, `CelebrationService.ts` | Insights (+ Goals for Journey) | Pure engines stay; their records become Timeline events / Memory summaries. |
| `services/PlanSync.ts`, `services/api/*` | Insights (provider) + Privacy (boundary) | The network calls are gated by the Privacy consent boundary. |
| `models/*` | shared `health-os/types` | Types stay; domain-specific types move next to their domain over time. |
| `contexts/*` | UI binding layer | The 5 domain contexts become thin React bindings over `health-os/` repositories. |

## 3. Target folder structure

```
health-os/
  platform/
    storage/
      KeyValueStore.ts        # port (interface): get/set/remove/multiGet/keys
      AsyncStorageAdapter.ts  # current adapter (wraps OfflineStorage)
      SqliteAdapter.ts        # FUTURE drop-in for high-volume event reads
      keys.ts                 # the single key registry (supersedes KEYS)
    clock.ts                  # toLocalDateString/parseLocalDate/todayDate (moved)
    id.ts                     # ulid()/uuid() — sortable ids for events
    migrations/
      runner.ts               # runMigrations(): version gate + ordered steps
      registry.ts             # ordered list of Migration objects
      001-backfill-timeline.ts
      002-...
  timeline/
    events.ts                 # HealthEvent envelope + EventType union
    catalog.ts                # per-type payload schemas (zod) + versions
    TimelineRepository.ts      # append/appendMany/query/byDay/redact/correct
    projections.ts            # day/range fold helpers (events → totals)
    index.ts
  memory/
    layers.ts                 # the 4-layer types
    SummaryStore.ts           # layer 2 persistence
    LongTermStore.ts          # layer 3 (wraps GozlinMemoryStore facts)
    TemporaryContext.ts       # layer 4 (in-memory, conversation)
    compaction.ts             # events → daily/weekly/monthly summaries
    retention.ts              # pruning policy
    index.ts
  context/
    HealthContext.ts          # the read-model type (generalized GozlinTwin)
    buildContext.ts           # assemble from Memory (+ recent events slice)
    index.ts
  insights/
    index.ts                  # re-exports services/intelligence + gozlin engines
    provider.ts               # LLMProvider seam (RemoteGozlinProvider impl)
  profile/
    HealthProfile.ts          # bio/health types
    completeness.ts           # ProfileCompleteness + unlock gates
    ProfileRepository.ts
    index.ts
  goals/
    GoalsRepository.ts
    index.ts
  preferences/
    PreferencesRepository.ts
    index.ts
  privacy/
    consent.ts                # ConsentRecord + categories
    ConsentRepository.ts
    export.ts                 # buildExportBundle()
    erase.ts                  # eraseAll()/erasecategory()
    encryption.ts             # EncryptedStore port (secure-store-backed key)
    boundary.ts               # assertConsented() gate for outbound AI calls
    index.ts
  index.ts                    # the public health-os API barrel
```

`app/` (Expo Router screens) and `contexts/` stay where they are; they consume
`health-os/` through its barrels.

## 4. The dependency rule (non-negotiable)

Dependencies point **inward and downward only**:

```
app/  →  contexts/  →  health-os/{profile,goals,preferences,timeline,memory,context,insights,privacy}  →  health-os/platform
```

Hard constraints, enforceable with an ESLint `no-restricted-imports` rule:

1. **`platform/` imports nothing from any domain.** It is the floor.
2. **A domain never imports `contexts/` or `app/`.** (This is the discipline that
   `services/gozlin/gozlin.types.ts` already calls out — "types are defined locally
   so this package never creates a contexts → services cycle.")
3. **`insights/` never imports a storage module.** It reads `Context` and returns
   data. This is what guarantees "AI consumes summaries, not raw logs" structurally,
   not by convention.
4. **Only repositories touch the storage port.** Engines, contexts, and screens
   never call `KeyValueStore` directly.
5. **Writes go through Timeline.** A feature that records something the user did
   appends a `HealthEvent`; it does not write a bespoke key. (Goals/Preferences/
   Profile *settings* are an exception — see [02 §6](./02-data-and-schema.md).)

## 5. Ubiquitous language

One word per concept, used identically in code, docs, and UI copy.

| Term | Definition |
|---|---|
| **Event** | An immutable fact that something happened at a time (`HealthEvent`). |
| **Timeline** | The ordered, append-only log of all Events. |
| **Projection** | A value folded from Events (e.g. today's consumed calories). Never stored as a separate truth. |
| **Summary** | A persisted, compacted projection over a period (day/week/month). Memory layer 2. |
| **Fact** | A durable, slow-changing truth about the user (motivation, an injury, a learned pattern). Memory layer 3. |
| **Context** | The bounded read-model assembled for AI/features. Never the raw Timeline. |
| **Insight** | An interpretation/recommendation produced by an engine from Context. |
| **Correction** | An Event that supersedes an earlier Event's value (we never mutate history). |
| **Redaction** | Marking an Event hidden (excluded from all reads/summaries) without erasing it; the user can also hard-erase. |
| **Consent** | A versioned, per-category permission record gating data use (esp. outbound AI). |
| **Unlock** | A personalization capability that becomes available once a Profile signal is present. |

## 6. Why this scales for a decade

- **New feature = new event types + a new engine reading Context.** No schema rewrite,
  no migration of unrelated data. (e.g. adding sleep tracking = `sleep.*` events +
  a sleep engine; everything else is untouched.)
- **New AI model/provider = swap the `insights/provider.ts` implementation.** The
  deterministic core is unaffected. (The `GozlinProvider` seam already proves this.)
- **New storage engine (SQLite, encrypted, synced) = a new adapter behind the
  storage port.** No domain code changes.
- **Cost stays flat as history grows** because everything reads bounded **Summaries**,
  not the unbounded **Timeline**.
