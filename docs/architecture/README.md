# Welliva — Personal Health OS Architecture

> The architecture blueprint for evolving Welliva from a feature app into a modular,
> long-lived **Personal Health Operating System**. This is design documentation:
> reviewable before code moves. Implementation is sequenced in
> [12-implementation-roadmap.md](./12-implementation-roadmap.md).

## Decisions locked for this blueprint

| Decision | Choice | Consequence |
|---|---|---|
| Canonical source of truth | **Local-first** | Device owns the data. A versioned on-device store (event log + migrations). AI backend stays **stateless**, consuming only summarized context. Optional E2E-encrypted sync is a future layer, not a dependency. |
| Delivery shape | **Blueprint first** | This doc set is the deliverable; code follows in milestones. |
| First user-facing feature | **Memory Center** | The trust centerpiece — ships right after the foundation (Timeline + migration runner). |

## How to read this

Read in order for the full picture; jump by concern using the table.

| # | Document | Answers |
|---|---|---|
| 00 | [Overview & principles](./00-overview-and-principles.md) | Why a "Health OS", the tenets, mission-vs-reality mapping |
| 01 | [Domain architecture](./01-domain-architecture.md) | The 7 domains, dependency rule, folder structure, ubiquitous language |
| 02 | [Data & schema](./02-data-and-schema.md) | The event store, event catalog, schema versioning, the key registry |
| 03 | [Memory architecture](./03-memory-architecture.md) | The four memory layers, compaction, retention, AI summary consumption |
| 04 | [Migration strategy](./04-migration-strategy.md) | The migration runner + the concrete migrations that preserve existing data |
| 05 | [APIs & contracts](./05-api-and-contracts.md) | Repository contracts, the Context read-model API, the backend API boundary |
| 06 | [Conversation-first logging](./06-conversation-first-logging.md) | NL → structured events pipeline + confirmation UX |
| 07 | [Progressive profile](./07-progressive-profile.md) | Completeness model + unlockable personalization |
| 08 | [Memory Center](./08-memory-center.md) | View / edit / delete / export / categorize |
| 09 | [Privacy & consent](./09-privacy-and-consent.md) | Consent flows, the AI data boundary, encryption, export/erase |
| 10 | [UI flows](./10-ui-flows.md) | Flow diagrams for the net-new surfaces |
| 11 | [Testing strategy](./11-testing-strategy.md) | Pure-engine, migration-fixture, privacy-boundary tests |
| 12 | [Implementation roadmap](./12-implementation-roadmap.md) | Milestones M0–M6, acceptance criteria, data-preservation gates |

## The one-paragraph version

Welliva already has most of the hard parts: an offline-first store, a 4-tier
on-device memory inside Gozlin, a `GozlinTwin` read-model that hands the AI
*summaries instead of raw logs*, and a deterministic intelligence layer. What it
lacks is a **single canonical event log**, a **persisted summaries tier**, a
**migration framework**, and the **user-facing trust surfaces** (Memory Center,
consent, progressive profile, conversation logging). This blueprint introduces a
`health-os/` domain layer that unifies the scattered history into one **Timeline**
event store, formalizes the **four-layer Memory**, exposes a **Context** read-model
that every AI feature consumes, and adds the trust surfaces — all **additively**,
behind a **versioned migration runner** that never destroys existing user data.

## Non-goals

- **Not a rebuild.** Existing engines (`services/intelligence/*`, `services/gozlin/*`)
  are re-framed as the Insights/Memory domains, not rewritten.
- **No backend source of truth.** The server stays stateless. No new auth dependency.
- **No analytics/telemetry collection** is introduced by this architecture.
