# 11 — Testing Strategy

The architecture is built to be testable: pure engines, an injectable clock, a storage
port (mockable), and an event log whose projections are deterministic folds. This
document defines what to test, at which layer, and the gates that protect existing user
data.

## 0. Current state & the one addition

Today's verification bar is **`tsc` + `eslint` clean** (the repo has no test runner
wired). The first foundation milestone adds a lightweight runner for the **pure layer**
— **Vitest** (fast, ESM-friendly, no native deps) for `health-os/` + `services/*` pure
modules. React Native screens are *not* unit-tested with a heavy harness; they're
covered by typed contracts + manual/visual checks (the existing discipline). The
high-value, automatable surface is the deterministic core and the migrations — that's
where tests pay off.

## 1. Test pyramid

```
        ▲  manual / emulator   ── screens, haptics, visual (user-run, as today)
        │  integration         ── repositories over a real AsyncStorage mock
        │  migration fixtures  ── golden v0 storage → asserted events (HIGH VALUE)
        │  property            ── projections == folds; idempotency; minimize()
        ▼  unit (pure engines) ── the bulk; fast, deterministic, inject `now`
```

## 2. Unit — pure engines

Every engine already takes `now?: Date` and pure inputs. Tests assert outputs for
fixed inputs.

- **Insights:** `buildForecast`, `generateCoachInsights`, `buildBriefing`,
  `buildHabitReport`, adaptive workout/nutrition — feed a crafted `HealthContext`,
  assert the structured output. (These engines move to consuming `HealthContext`; the
  tests pin that contract.)
- **Compaction:** `compactDay(events)` → exact `DaySummary`.
- **Completeness:** `computeCompleteness(snapshot)` → percent, tier, `nextBest`,
  unlocks for representative profiles (starter / personalized / deep).
- **Extraction Tier 1:** deterministic matchers — utterance → expected `LogDraft[]`
  (incl. quantity parsing, past-date parsing, the "no match" case).

Determinism test (a codebase-wide property): `f(input) === f(input)` and
`f(input, fixedNow)` is stable across runs — protects the "any past month regenerates
identically" guarantees (recap, summaries).

## 3. Property tests (the invariants from [02 §8](./02-data-and-schema.md))

| Property | Assertion |
|---|---|
| Projection = fold | for random event sets, `DaySummary.calories === Σ meal.logged.calories` (non-redacted, latest in supersede-chain) |
| Redaction excluded | a redacted event never appears in `byDay`, `query`, any summary, export, or `minimize()` output |
| Supersede resolves | latest non-redacted event in a chain wins the projection |
| Idempotent commit | committing the same `LogDraft[]` twice → identical Timeline |
| Minimize allowlist | `minimize(ctx)` output keys ⊆ the `MinimizedContext` allowlist (no leakage of new fields when `HealthContext` grows) |

## 4. Migration tests (the data-preservation gate — highest value)

Committed **golden fixtures** of real-shaped v0 storage:

```
__fixtures__/migrations/
  light-user.v0.json        # a week of data
  heavy-user.v0.json        # 6 months, multiple diets, weigh-ins, sessions
  edge-user.v0.json         # corrections, a redaction, empty days, pre-equipment bio
  fresh-install.v0.json     # all silos empty
```

Tests:
1. **Faithful encoding:** run runner over each fixture → assert event counts per type
   equal the source silo counts; assert a sampled day's folded `DaySummary` equals the
   legacy `DietHistoryEntry` (lossless round-trip).
2. **Idempotency:** run twice → second run yields zero new events; identical bytes.
3. **Crash-resume:** inject a failure after partition N → re-run completes; no dupes,
   no lost events.
4. **Validation gate:** corrupt a fixture so counts won't match → assert
   `schema_version` is **not** committed and the original silos are byte-for-byte
   intact (the "never lose data" guarantee, automated).
5. **Fresh install:** runner lands at the latest version with empty Timeline + default
   records.

These run in CI on every change touching `health-os/timeline/*`, `memory/*`, or
`platform/migrations/*`.

## 5. Integration — repositories over a storage mock

An in-memory `KeyValueStore` mock (a `Map`) lets repositories be tested for real
behavior without a device:

- `TimelineRepository`: append → byDay → redact → correct → query, across a month
  boundary (two partitions); index stays consistent.
- `MemoryRepository`: lazy compaction on read; recompaction after a correction; week
  rollup reads day summaries, not L1.
- Settings repos: `set()` writes the record **and** emits the change event (asserted on
  the Timeline).

## 6. Privacy-boundary tests (from [09 §6](./09-privacy-and-consent.md))

- **Network spy:** stub `fetch`. With `ai_cloud` denied, assert **zero** calls for
  every AI feature, and assert each feature still returns a deterministic result.
- **Outbound-body snapshot:** with consent granted, capture the serialized request body
  for `coachChat`/`extractLogs`; assert it contains no `HealthEvent`, no raw identifier,
  and only allowlisted keys. A snapshot test fails loudly if a future change widens the
  payload.
- **Erase completeness:** after `eraseAll()`, assert no `@welliva_*`/`@gozlin_*` key
  holds user data and `schema_version` is at clean baseline.
- **Encryption:** with the encrypted adapter on, assert the on-disk value for a
  sensitive key is not JSON-parseable plaintext.

## 7. Contract tests for the server boundary

The server is a separate package (`server/`, its own tests). The client side asserts:
- request/response **types** match `WellivaApi` (compile-time, via the shared shapes),
- the **forced-tool-use** extraction returns catalog-valid drafts (zod parse of a
  recorded fixture response), with the one self-repair retry path covered.

## 8. What we explicitly don't over-test

- Pixel/visual correctness of screens → manual/emulator (the user's loop today).
- Haptics → disabled app-wide behind a flag already; not tested.
- The LLM's prose quality → out of scope for unit tests; guarded by the deterministic
  engines owning all numbers/cards.

## 9. CI gates (proposed)

| Gate | Blocks merge? |
|---|---|
| `tsc` clean (whole project, excluding `features/`) | yes (existing bar) |
| `eslint` clean (incl. the dependency-rule `no-restricted-imports`) | yes |
| Vitest: unit + property + migration fixtures | yes for changes under `health-os/` |
| Privacy-boundary suite | yes for changes under `health-os/privacy`, `services/api`, `context` |
