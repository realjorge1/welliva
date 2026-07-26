# 12 — Implementation Roadmap

Sequenced, additive milestones. Each is **shippable on its own**, leaves the app fully
working, and never destroys existing user data. Effort is rough relative sizing for one
engineer, not calendar promises.

## Principles for sequencing

1. **Foundation before features** — the Timeline + migration runner underpin
   everything, so M0 is first and the Memory Center (chosen first feature) is M1.
2. **Additive at every step** — new code runs alongside old; the old write paths stay
   live until a guarded retirement migration (004) flips them.
3. **Each milestone has a data-preservation gate** — a migration-fixture or
   round-trip test that proves no loss.

---

## M0 — Foundation (Timeline + migration runner)  · ~L

**Build the floor.** No user-visible change; everything additive.

- `health-os/platform/`: `KeyValueStore` port + `AsyncStorageAdapter` (wrap existing
  `OfflineStorage`), `keys.ts` registry, `clock.ts` (move date helpers), `id.ts`
  (ULID + `ulidFromSeed`).
- `health-os/timeline/`: `events.ts` envelope, `catalog.ts` (zod schemas + versions),
  `TimelineRepository`, `projections.ts`.
- `health-os/platform/migrations/`: `runner.ts`, `registry.ts`, **`001-backfill-timeline`**.
- Wire `runMigrations(store)` at the top of `loadData` (`AppContext.tsx:1183`).
- Vitest set up; **migration golden fixtures** (light/heavy/edge/fresh).

**Acceptance:** on a device with existing data, boot backfills a complete Timeline;
originals untouched; idempotent on second boot; validation gate passes; `tsc`/`eslint`
clean. **Data gate:** round-trip test (events → DaySummary == legacy DietHistoryEntry).

---

## M1 — Memory Center  · ~L  *(first user-facing feature)*

> **Status: shipped 2026-06-29.** `health-os/memory/` (layers, pure `compaction`,
> `SummaryStore`, `MemoryRepository`, `LongTermStore` re-homing the Gozlin facts) +
> migration **`002-seed-summaries`** (round-trip + idempotency gates) + `compactDayIfPresent`
> hooked at both `processDayEnd` sites + `app/memory-center.tsx` (Timeline/About/Learned/
> Milestones/Preferences/Goals/Conversations tabs, correct-by-append, redact, tag, "forget
> everything"). Reached from Profile + the Gozlin header. Vitest: compaction (property),
> MemoryRepository (integration), migration002 (data gate). Two scoped decisions: (a)
> `DaySummary.nutrition.adherence` is **meals-based** so summaries are self-contained for
> backfill; (b) the live day-close hook **no-ops until forward Timeline writes land (M6)** —
> it compacts only days already in the Timeline, avoiding false "untracked" summaries during
> the transition. Backfilled history + correction-driven recompaction are fully live now.

**Make the memory visible and governable.** Depends on M0.

- `health-os/memory/`: `layers.ts`, `SummaryStore`, `compaction.ts`, `MemoryRepository`;
  **`002-seed-summaries`**; hook `compactDay` into `processDayEnd`.
- `LongTermStore` wraps existing `GozlinMemoryStore` (re-home, no behavior change).
- Memory Center UI: `app/memory-center.tsx` + event-detail modal (view, **correct**
  via append, **redact**, **tag**), category tabs over each layer.
- `TimelineRepository.correct/redact/tag`; lazy/dirty recompaction.

**Acceptance:** user can browse the unified timeline, correct a past meal (stats
recompute), redact an item (gone from everywhere), tag events. **Data gate:**
correction/redaction property tests; redacted-excluded-everywhere test.

---

## M2 — Context read-model + Insights migration  · ~M

**Generalize the Twin into the shared interface.** Quietly improves every AI feature.

- `health-os/context/`: `HealthContext` + `buildContext` (generalize
  `GozlinTwin.buildTwin` to read L2/L3 + a recent slice).
- Point engines (`intelligence/*`, `gozlin/*`) at `HealthContext` (back-compat shim so
  nothing breaks).
- `insights/provider.ts`: formalize the `LLMProvider` seam (existing
  `RemoteGozlinProvider`).

**Acceptance:** existing coach/forecast/briefing render identically but now source from
the persisted summaries; AI context size is bounded regardless of history length.
**Data gate:** Context-equivalence snapshot vs. today's Twin for fixture states.

---

## M3 — Privacy & consent  · ~M

**Make the local-first default explicit and user-governed.** Best landed before
collecting more via conversation logging.

- `health-os/privacy/`: `consent.ts`, `ConsentRepository`, `boundary.ts`
  (`withAiConsent` + `minimize`), `export.ts`, `erase.ts`; **`003-extract-settings`**
  (Preferences/ProfileMeta/Consent defaults).
- Route all `WellivaApi` calls through `withAiConsent`; add the lint rule.
- Consent sheet (first-run/policy-bump) + Privacy section in `settings.tsx`
  (toggles + export + erase).
- `EncryptedAdapter` (secure-store-backed key) applied to sensitive-health keys.

**Acceptance:** AI off → zero network, full local function; export produces JSON+MD;
erase-all returns clean baseline. **Data gate:** privacy-boundary suite
([11 §6](./11-testing-strategy.md)).

---

## M4 — Conversation-first logging  · ~M

**Turn chat into a logger.** Depends on M0 (Timeline) + M3 (consent boundary).

- `health-os/timeline/logging/`: `LogDraft`, Tier-1 deterministic matchers
  (`MealLibrary`/`EXERCISE_DATABASE`), commit + idempotency.
- Server: `POST /v1/log/extract` (forced tool-use `emit_log_drafts`); client
  `WellivaApi.extractLogs` behind `withAiConsent`.
- Chat: `__kind: "log-confirm"` renderer + per-draft editor; commit → recompact today.

**Acceptance:** "had eggs & a 5k run" → confirm card → two events logged → rings/streak
update; works offline at Tier 1; nothing logged without confirmation. **Data gate:**
extraction unit tests + idempotent-commit property test.

---

## M5 — Progressive profile  · ~S–M

**Surface the personalization ladder.** Mostly UI + a signals registry over existing
data-dependencies.

- `health-os/profile/completeness.ts`: `ProfileSignal` registry + `computeCompleteness`;
  `@welliva_profile_meta`.
- `ProfileRepository.update` recomputes completeness + emits "unlocked" beats.
- `ProfileCompletenessCard` on Profile; inline unlock prompts on dimmed features.

**Acceptance:** completeness ring + `nextBest` suggestion; adding a signal unlocks the
mapped feature with a calm acknowledgement. **Data gate:** completeness unit tests
across starter/personalized/deep profiles.

---

## M6 — Consolidation & hardening  · ~M

**Pay down the transition.**

- **`004-retire-redundant`** (guarded): archive + retire silos now fully superseded by
  the live Timeline write path.
- Flip remaining feature writes to append through `TimelineRepository` (diet/workout/
  water/body loggers) where not already.
- Mechanical relocation of re-framed files into `health-os/` per
  [01 §3](./01-domain-architecture.md); enforce the dependency-rule lint everywhere.
- Fill out the test suite to the CI gates in [11 §9](./11-testing-strategy.md).

**Acceptance:** one canonical write path; dependency rule enforced in CI; legacy silos
retired safely with archives retained. **Data gate:** pre/post-retirement parity test +
the retained `@welliva_archive_*` snapshots.

---

## Dependency graph

```
 M0 Foundation
   ├──► M1 Memory Center        (first feature)
   ├──► M2 Context + Insights
   │       └──► M4 Conversation logging
   ├──► M3 Privacy & consent ───► M4
   └──► M5 Progressive profile
 (M1..M5) ──► M6 Consolidation & retirement
```

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Backfill mis-encodes a silo | med | validation gate aborts version commit; originals retained; golden fixtures |
| AsyncStorage write contention during migration | low | runner is sequential + journaled; partitioned writes are bounded |
| AI extraction logs wrong data | med | mandatory user confirmation; low-confidence unchecked; idempotent commit |
| Engine regressions when switching to `HealthContext` | med | back-compat shim + Context-equivalence snapshots (M2 gate) |
| Encryption breaks reads on key loss | low | key in secure-store with OS backup semantics; encryption opt-in per-key; plaintext fallback path documented |
| Scope creep (it's a decade-platform prompt) | high | milestones are independently shippable; ship M0+M1 first, reassess |

## Definition of done (per milestone)

1. `tsc` + `eslint` clean (whole project, excluding `features/`).
2. The milestone's data-preservation gate passes.
3. No existing user-data key is deleted (until M6's guarded retirement).
4. New AI paths degrade to deterministic + offline.
5. Docs in this folder updated if a contract changed.
