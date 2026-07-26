# 08 — Memory Center

The trust centerpiece and the first user-facing feature after the foundation. A
transparent surface where the user can **see, edit, delete, export, and categorize**
everything the Personal Health OS remembers about them. If the system has a memory,
the user must be able to look it in the eye.

Route: `app/memory-center.tsx` (a Stack route in `app/_layout.tsx`, reached from
Profile → "What I remember" and from the Gozlin header). Built on the design system
(`components/ui/*`).

## 1. What it exposes (by memory layer)

The Memory Center is organized by **category**, each category reading a memory layer
through its repository — so the UI is a thin, honest window over the real model
([03](./03-memory-architecture.md)), not a separate store.

| Tab / category | Reads | Examples | Edit? | Delete? |
|---|---|---|---|---|
| **About you** (Profile facts) | L3 + Profile record | goal, motivation/"why", conditions, injuries, meds | ✎ edit | ⌫ clear a fact |
| **Preferences** | Preferences record | cuisine, region, dislikes, equipment, units | ✎ edit | ⌫ reset |
| **Goals** | Goals record | targets, goal weight, journey/chapter | ✎ edit | — (set, not deleted) |
| **What I've learned** (Behavioral) | L3 patterns | "you miss Wednesday workouts", "best weeks start Monday" | — | ⌫ dismiss a pattern |
| **Milestones** (Episodic) | L3 episodes | "first 7-day streak", "reached goal weight" | — | ⌫ forget |
| **Timeline** (raw history) | L1 events | every logged meal/workout/weigh-in/check-in | ✎ correct | ⌫ redact / erase |
| **Conversations** | L4 conversation | chat history with Gozlin | — | ⌫ clear |

A top-level **search + date filter + source filter** (app / coach-logged / imported /
manual) spans the Timeline tab so a user can find "that run I logged by talking last
Tuesday."

## 2. View

- **Timeline tab:** reverse-chronological, grouped by day (uses
  `@welliva_timeline_index` to lazily load month partitions as the user scrolls — no
  full load). Each row shows the event in plain language with its **provenance badge**
  (e.g. "logged by chat", "imported", "from your watch" later) and tags.
- **Fact tabs:** each fact rendered as an editable card with its source and
  last-updated time.
- Everything shown is the **real stored value**; nothing is hidden. "Transparent" is
  literal.

## 3. Edit — correction-by-append (the key design decision)

**We never destructively mutate history.** Editing a past event emits a *correction*
event that supersedes the original ([02 §2](./02-data-and-schema.md)):

```
TimelineRepository.correct(originalId, newPayload)
   → appends a new HealthEvent { supersedes: originalId, source: "user" }
   → marks the affected day dirty → MemoryRepository.recompactDay(date)
```

Why this over an in-place edit:
- **Derived stats stay honest.** Summaries/achievements recompute from the latest
  non-redacted event in each supersede-chain; a correction flows through cleanly.
- **Auditable & reversible.** The original is retained (greyed under "show history"),
  so a mistaken edit is recoverable and the record of *what the user said when* is
  preserved.
- **No corruption hazard.** There is no path where editing one number silently
  desyncs a stat computed elsewhere — because nothing is computed elsewhere; it's all
  folded from events.

Facts (L3) are simpler current-values; editing a fact overwrites its record and emits
a `profile.updated`/`preference.changed` event for the audit trail.

## 4. Delete — redact, then optionally erase

Two levels, deliberately:

1. **Redact (default "delete"):** sets `redacted: true`. Excluded from every read,
   summary, and AI context immediately (filtering is enforced once in
   `TimelineRepository.query`). Recoverable from an "Recently removed" view for a grace
   period. This is the everyday "remove this, it's wrong/private" action.
2. **Erase (hard delete):** true removal via `eraseHard(predicate)`, behind a confirm
   ("This permanently deletes N items and can't be undone"). For genuine
   right-to-be-forgotten. Triggers recompaction of affected days. Used by the
   category/range/all erase flows in [09](./09-privacy-and-consent.md).

Both recompact affected summaries so the rest of the app reflects the removal at once.

## 5. Export

```ts
// health-os/privacy/export.ts
buildExportBundle(opts: { categories?: Category[]; from?: string; to?: string }):
  Promise<ExportBundle>
```

- **Formats:** machine-readable **JSON** (full fidelity: events + facts + summaries +
  schema version) and a **human-readable Markdown** digest ("Your Welliva history").
- **Scope:** everything, or a category/date range.
- **Delivery:** written to a file and handed to the OS share sheet
  (`expo-file-system` + `expo-sharing`) — the data goes where the *user* sends it,
  never to us.
- **Round-trippable:** the JSON bundle is shaped so a future "import" migration
  (`source: "import"`) can restore it on a new device — the local-first answer to
  device loss until/unless E2E sync ships.

## 6. Categorize

- Users apply **tags** to events (`TimelineRepository.tag`) — e.g. "travel",
  "illness", "vacation" — to annotate context the system can't infer.
- Tags become a filter dimension in the Timeline view and a signal the coach can
  acknowledge ("your dip lined up with the week you tagged 'sick' — that's expected").
- Built-in categories (the tabs) are derived from event `type` namespaces; user tags
  are additive and free-form.

## 7. Trust guarantees the screen makes literal

| Promise | Mechanism |
|---|---|
| "You can see everything I remember." | Every layer has a tab; raw Timeline is browsable. |
| "You can fix what's wrong." | Correction-by-append + fact editing. |
| "You can make me forget." | Redact (soft) + Erase (hard), per item / category / range / all. |
| "Your data is yours to take." | JSON + Markdown export to the OS share sheet. |
| "Nothing here left your device without permission." | Provenance badges + the consent boundary ([09](./09-privacy-and-consent.md)). |

## 8. Dependencies & build notes

- Requires the foundation (Timeline + migration) so the raw view has real, unified
  data on day one — which is why it's sequenced first *after* M0
  ([12](./12-implementation-roadmap.md)).
- Reuses existing primitives: `Screen`, `Card`, `Pill`, `SectionHeader`, `Button`,
  `IconBadge`, `Reveal`. No new design system work.
- The "forget everything" action composes the existing `clearGozlinMemory()` plus the
  new `eraseHard` over the Timeline + summary keys — one honest button that truly
  empties the OS.
