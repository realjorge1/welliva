# Gozlin — Progress Detective

**Phase 8 deliverable.** Role: Data Scientist + Behavioral Analytics Specialist.
Mission: go beyond *describing* the numbers to *explaining* them — deliver
**root-cause** reads of why progress is doing what it's doing.

> **The hallmark read:** *"Your weight hasn't changed in 10 days, but your workout
> performance is up 14%. That usually means muscle gain offsetting fat loss — plus
> water retention hiding it on the scale."*

Pairs with `services/gozlin/GozlinDetectiveEngine.ts`,
`components/gozlin/renderers/DetectiveCard.tsx`, and the `detective` chat intent.
Deterministic arithmetic over local history — fully offline. Extends the lighter
`detectFindings` (Phase 2 §6) with a single, explained root cause.

---

## 0. What it analyzes

`adherence` · `weight changes` · `workout history & performance` · `nutrition
logs` · `training volume`. It reads them **together** — the whole point is that
the story lives in the *combination* (a flat scale means nothing without the
training signal beside it).

Inputs: Twin (adherence, momentum, body trajectory), `DietHistoryEntry[]`,
`WorkoutLogEntry[]`, `SessionSummaryData[]` (per-session reps → performance),
`BodyLogEntry[]` (weigh-ins).

---

## 1. The two reads behind every case

- **Weight (recent):** `computeWeightTrend` over a 14-day window → signed
  kg/week + a windowed Δ. "Flat" = |rate| < 0.2 kg/wk.
- **Performance (recent vs prior):** training volume per session (reps, falling
  back to completion% for timed work), recent 14 days vs the prior 14 → a signed
  `deltaPct`. This is the *"+14%"* in the hallmark read.

These plus adherence and training load feed the auditable **metric strip** every
report leads with (`DetectiveMetric[]`, each tinted good / bad / neutral relative
to the goal).

---

## 2. Detection → root cause

`buildDetectiveReport` builds ranked candidate explanations, then names the
single highest-priority one as the marquee `rootCause`; the rest become
supporting `findings`. Every finding carries `evidence[]`.

| Kind | When | The read |
|---|---|---|
| **`root_cause` (recomposition)** | flat scale **+** performance up ≥8% | muscle gain offsetting fat loss + water masking it — *the hallmark* |
| **`plateau`** | flat scale, performance **not** rising, goal unmet, adherence OK | a genuine stall (the body has adapted) — change one variable |
| **`blocker`** | drifting the wrong way / low adherence while stalled / under-training | what's *measurably* holding progress back |
| **`accelerator`** | training clearly climbing / consistency moving the scale right | what's *measurably* driving progress forward |
| **`inconsistency`** | high day-to-day adherence variance (strong days next to zeros) | the swings are capping results — set a floor |

The lighter hidden-win / correlation findings from `detectFindings` are folded in
as supporting evidence, de-duplicated, capped to four.

---

## 3. Detecting the four asks explicitly

- **Plateaus** — `plateau` finding (true stall, distinct from recomposition).
- **Inconsistencies** — `inconsistency` finding (coefficient-of-variation on
  daily adherence).
- **Progress accelerators** — `accelerator` finding.
- **Progress blockers** — `blocker` finding.

---

## 4. Output & explainability

`GozlinDetectiveReport { headline, rootCause, metrics[], findings[], dataLimited }`
→ rendered by `DetectiveCard`; reachable via the **"Why am I stuck?"** chip or any
"why / plateau / stalled / what's going on" message.

Every number traces to a named source (Twin, BodyLogService trend, session
volume) and every finding ships its `evidence[]` + a `lever` — so the card can
always answer **"why are you telling me this?"**. When there isn't enough logged
data, `dataLimited` flips and the detective says exactly what to log to unlock the
investigation rather than guessing.

## 5. Storage / offline

Pure; reads local history only. **100% offline.**
