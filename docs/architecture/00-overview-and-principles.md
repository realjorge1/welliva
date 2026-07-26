# 00 — Overview & Principles

## 1. What "Personal Health Operating System" means here

A feature app answers *"what should I eat / do today?"*. A health **OS** answers
*"who is this person becoming, what does the system remember about them, and how does
every feature draw on that shared understanding?"* — for a decade, without a rewrite.

Concretely, that means three structural commitments:

1. **One memory, many features.** Every feature reads from and writes to a shared,
   inspectable memory rather than its own private silo. Today Welliva has six
   silos (`diet_history`, `workout_logs`, `session_history`, `body_logs`,
   `water_history`, Gozlin episodes). The OS unifies them behind a **Timeline** and
   a layered **Memory**.
2. **Summaries are the interface.** Features and AI never page through raw history.
   They consume a bounded, pre-digested **Context** read-model. This is what keeps
   the system fast and cheap as history grows from days to years.
3. **The user owns and can see the memory.** A transparent **Memory Center**, a
   **consent** boundary, and **export/erase** are first-class — not settings buried
   in a menu.

## 2. Design tenets

These are existing, proven disciplines in the codebase, promoted to architectural law.

| Tenet | What it means | Already practiced in |
|---|---|---|
| **Local-first** | The device is the source of truth. Everything works offline. | `services/OfflineStorage.ts`, `services/PlanSync.ts` |
| **Deterministic core, LLM at the seam** | Scoring/decisions are pure functions; the LLM is an *optional, swappable* provider behind an interface. | `services/intelligence/*`, `GozlinChatEngine` + `GozlinProvider` seam |
| **Summarize, don't stream raw** | AI consumes a read-model, never the raw log. | `GozlinTwin.buildTwin` |
| **Single source of truth per fact** | No fact is computed two ways. Derived data is *derived*, not stored twice. | The 2026-06-16 SSOT refactor (killed 6 duplicate engines) |
| **Local time authority** | All "today" logic is local, never UTC. | `toLocalDateString` / `parseLocalDate` / `todayDate` |
| **Pure + injectable clock** | Engines take `now?: Date` so they're testable and deterministic. | every `services/gozlin/*` engine |
| **Additive change** | New capability is layered on; existing data is never destroyed. | the context split (2026-06-22) preserved all internals |
| **Privacy by default** | Raw data stays on device; only minimized summaries cross the network, and only with consent. | new (this blueprint) |

## 3. Mission → reality map

The mission prompt assumes a greenfield. The repo is well past that. Here is the
honest gap analysis that scopes the real work.

| Mission requirement | Status | Where it lives / what's missing |
|---|---|---|
| Modular domain architecture (Timeline, Memory, Context, Insights, Goals, Preferences, Health Profile) | **Partial** | Domains exist implicitly across `services/`, `contexts/`, `models/`. Needs explicit module boundaries + a dependency rule → [01](./01-domain-architecture.md) |
| DB schema + migration preserving existing data | **Missing** | Storage is ad-hoc per service; no version field, no runner → [02](./02-data-and-schema.md), [04](./04-migration-strategy.md) |
| Four-layer memory (Event History, Summaries, Long-Term, Temporary) | **~70%** | Gozlin's Identity/Episodic/Behavioral/Conversational ≈ layers 3 & 4. Layer 1 (unified Event History) and layer 2 (persisted Summaries) are the gap → [03](./03-memory-architecture.md) |
| Conversation-first logging | **Missing** | Chat is deterministic intent-routing; it does not write logs → [06](./06-conversation-first-logging.md) |
| Progressive profile completion | **Missing** | Onboarding is a 13-step machine; no completeness/unlock model → [07](./07-progressive-profile.md) |
| Memory Center (view/edit/delete/export/categorize) | **Missing** | Only `clearGozlinMemory()` "forget me" exists → [08](./08-memory-center.md) |
| Privacy controls + consent + secure caching | **Partial** | All on-device already; no consent flow, no export, no at-rest encryption → [09](./09-privacy-and-consent.md) |
| APIs that consume *summarized* context | **Yes (generalize)** | `GozlinTwin` proves the pattern; generalize it into the Context domain → [05](./05-api-and-contracts.md) |

**Takeaway:** roughly 60–70% of the architecture exists in a more evolved form than
the prompt assumes. The work is *formalization + 7 net-new modules*, delivered
additively. We are not rebuilding.

## 4. The shape of the change

```
            BEFORE (today)                         AFTER (this blueprint)

   app/ ── contexts/AppContext ── services/*    app/ ── contexts/* ── health-os/
                  │                                              │
        six storage silos:                          ┌───────────┴────────────┐
        diet_history, workout_logs,                 │  Timeline (event log)   │  ← one source of truth
        session_history, body_logs,                 │  Memory (4 layers)      │
        water_history, gozlin_*                     │  Context (read-model)   │  ← what AI/Insights read
                  │                                  │  Insights / Goals /     │
        each feature reads its own silo             │  Preferences / Profile  │
                                                     │  Privacy / Platform     │
                                                     └─────────────────────────┘
                                                       behind a versioned migration runner
```

The migration runner backfills the Timeline from the six existing silos
**without deleting them** (forward-only, idempotent, originals retained as a safety
net during transition). See [04](./04-migration-strategy.md).

## 5. Reading guide for implementers

- If you are about to write storage code → read [02](./02-data-and-schema.md) first.
- If you are about to feed data to an AI feature → read [03](./03-memory-architecture.md) §"AI consumes summaries" and [05](./05-api-and-contracts.md).
- If you are touching anything the user can see about their data → read [08](./08-memory-center.md) and [09](./09-privacy-and-consent.md).
- The dependency rule in [01 §4](./01-domain-architecture.md) is non-negotiable; it is what keeps this maintainable for a decade.
