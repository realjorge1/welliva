# Gozlin

> **Gozlin is not a chatbot. Gozlin is a persistent AI health coach and transformation companion built into Welliva.**

This folder is the source-of-truth design + architecture for Gozlin. It pairs with
the working code under `services/gozlin/`, `components/gozlin/`, and `app/gozlin.tsx`.

| Doc | Phase | What it covers |
|-----|-------|----------------|
| [01 — Personality Bible & Communication Handbook](./01-personality-bible.md) | Phase 1 | Who Gozlin is: personality, coaching style, tone, communication principles, motivation / accountability / trust frameworks, response examples, interaction principles. |
| [02 — Intelligence Layer Architecture](./02-intelligence-architecture.md) | Phase 2 | How Gozlin thinks: the nine intelligence features, data-flow diagrams, decision trees, inputs/outputs, scoring systems, storage, and the offline-first plan. |
| [03 — AI Transformation Forecast System](./03-transformation-forecast.md) | Phase 3 | How Gozlin sees the future: the inputs, the measured-vs-predicted velocity model, Expected Goal Date, the Likelihood-of-Success composite, Recommended Adjustments, the formulas, UI concept, and user journeys. |
| [04 — Daily AI Briefings](./04-daily-briefings.md) | Phase 4 | Gozlin's morning sit-down: the briefing framework, section-by-section generation logic, the headline decision tree, the prompt/phrase templates, and the UI presentation. |
| [07 — Habit Awareness System](./07-habit-awareness.md) | Phase 7 | How Gozlin understands *life* habits (workouts, nutrition, hydration, sleep, mood, consistency): pattern detection, behavior scoring, risk prediction, habit rescue, the daily check-in, and the accountability ladder. |
| [08 — Progress Detective](./08-progress-detective.md) | Phase 8 | How Gozlin explains *why*: root-cause analysis over adherence, weight, training volume and workout performance — recomposition vs plateau vs blocker vs accelerator vs inconsistency, with an auditable metric strip. |

## Design lineage

Gozlin's *interaction architecture* (structured AI outputs, renderer dispatch, session
+ memory model, a mode/intent system, suggestion chips) is adapted from the document-AI
assistant in [`features/`](../../features). The **domain is completely different**: that
assistant reads documents; **Gozlin coaches a human through a body/health transformation.**

Gozlin does **not** introduce a parallel scoring stack. It is the *persona and
orchestration layer* on top of Welliva's existing deterministic intelligence
(`services/intelligence/*`, `services/CoachEngine.ts`). See `02` for the exact composition.

## The one success metric

> Users should eventually call Gozlin **"my coach"** — never **"the AI."**

Every decision in these docs and the code ladders up to that.
