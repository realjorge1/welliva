# Gozlin — Habit Awareness System

**Phase 7 deliverable.** Role: Behavioral Psychologist + Habit Formation Expert.
Mission: an AI companion that genuinely understands the user's habits — not just
fitness habits, **life habits**.

> **Success criteria:** users should feel like Gozlin *gets* their behavior —
> that it knows their rhythms, sees their slips coming, and has their back when
> one happens.

This pairs with the code in `services/gozlin/GozlinHabitEngine.ts`,
`components/gozlin/renderers/HabitCard.tsx`, `components/gozlin/CheckinModal.tsx`,
and the `habits` chat intent. It composes the existing intelligence and the Twin
(see [02](./02-intelligence-architecture.md) §9) — it adds **no new scoring** of
nutrition or recovery; it *reads behavior*.

---

## 0. What it watches

Across life domains, not just the gym:

| Domain | Source | Signal |
|---|---|---|
| **Workouts** | `WorkoutLogEntry[]` + plan | per-weekday completion, keystone day |
| **Nutrition** | `DietHistoryEntry[]` | weekday/weekend adherence, calorie creep |
| **Hydration** | Twin (today) | today's water vs goal (honest: a today-only read) |
| **Consistency** | streak + adherence | the compounding habit |
| **Sleep** | `GozlinCheckin.sleepHours` | self-reported, optional |
| **Mood / stress** | `GozlinCheckin.mood/stress` | self-reported, optional |

Sleep and mood are the **life habits the app can't measure on its own**. They
come from an optional daily **check-in** (`CheckinModal` → `@gozlin_checkins`,
on-device). Every habit read degrades gracefully when there are no check-ins.

---

## 1. Capabilities → deliverables

| Capability | Deliverable | Where |
|---|---|---|
| **Pattern detection** | `detectHabitPatterns` → `HabitPattern[]` | engine §2 |
| **Behavior scoring** | `scoreBehavior` → `BehaviorScore[]` | engine §3 |
| **Behavior prediction / risk detection** | `predictRisks` → `HabitRisk[]` | engine §4 |
| **Habit coaching / rescue** | `buildRescues` → `HabitRescue[]` | engine §5 |
| **Accountability** | the whole `GozlinHabitReport`, kind + tone gated | engine §6 |

---

## 2. Pattern detection

Deterministic mining over rolling windows. Each pattern carries a `confidence`
(0–1) that **gates whether Gozlin says it** — low confidence → it stays quiet.

- **Workout skip** — *"I've noticed Wednesday workouts tend to slip."* Buckets
  each planned training weekday's occurrences over 28 days; flags the worst with
  completion < 50%.
- **Keystone / anchor** — *"Your healthiest weeks begin when you complete Monday
  workouts."* Groups adherence by Monday-based week, partitions weeks by whether
  the anchor (earliest planned training day) workout happened, and surfaces the
  lift when anchor-done weeks run ≥15% more on-plan.
- **Mood link** — *"You tend to snack more on stressful days."* Correlates
  high-stress / low-mood check-in days against same-day meal adherence.
- **Sleep link** — *"Short nights cost you the next day."* Correlates < 6.5h
  nights against next-day adherence.
- **Weekend dip** + **lowest-adherence weekday** — reused from the existing
  `detectHabits` miner, tagged with their domain.
- **Bad habit (calorie creep)** — ≥3 of the last ~14 logged days well over the
  calorie target, against a deficit/maintenance goal.

Patterns are confidence-gated (≥0.5), ranked, capped to 6.

---

## 3. Behavior scoring

A 0–100 read per domain, each with the `drivers[]` (numbers) behind it and a
`trend` (rising / steady / cooling) from a recent-vs-prior comparison. Bands:
**Strong** ≥75 · **Solid** ≥55 · **Building** ≥40 · **Fragile** below.

- Training = sessions ÷ weekly target. Nutrition = 7-day adherence. Consistency =
  streak (blended) + adherence. Hydration = today's water %. Sleep = avg hours →
  curve. Mood = avg 1–5 → 0–100.
- Only domains with **real data** appear (sleep/mood need check-ins; hydration
  needs a water goal).

The **overall behavior score** is a domain-weighted composite over the domains
present (nutrition .30, training/consistency .25, hydration/sleep .07, mood .06,
re-normalized).

---

## 4. Behavior prediction (risk detection)

Gozlin getting *ahead* of a slip. `predictRisks` turns patterns + Twin flags into
ranked `HabitRisk[]`, each with a `likelihood`, a `whenLabel` ("today",
"tomorrow", "in 3 days", "this weekend"), the `why[]` evidence, and a `rescueId`.

- A **workout skip** pattern → a dated risk for that weekday's next occurrence.
- A **weekend dip** → flagged as the weekend approaches (Thu–Sun).
- **Setback** flag or a strong streak with the day's targets still open → a
  same-day streak risk.

Top 3 by likelihood.

---

## 5. Recovery strategies (habit rescue)

Each surfaced risk links to a concrete `HabitRescue` — small, ordered, do-able
steps with a compassion-first tone:

- **Workout rescue:** pre-pick a 20-min minimum, lay kit out, calendar-block it,
  10-min floor.
- **Weekend rescue:** set a weekend minimum, pre-log Saturday breakfast, plan the
  one social meal in.
- **Streak rescue:** smallest win now, no "making up", tell me when it's done.

---

## 6. The report + accountability ladder

`buildHabitReport` → `GozlinHabitReport { headline, overallScore, scoreLabel,
behaviorScores[], patterns[], risks[], rescues[], dataLimited, tone }`, rendered
by `HabitCard` and reachable via the **"My habits"** chip or the `habits` intent.

Tone follows the **Accountability ladder** (Phase 1 §6): an *incident* gets
silence; a *pattern* gets a kind, specific conversation + an offer to adapt. So
the report leads `honest` when there are skips/risks, `proud` when everything's
strong, and `warm` (never preachy) when data is thin.

---

## 7. Storage / offline

- Check-ins: `@gozlin_checkins` (on-device, one per day, pruned ~90d / capped).
- Everything else is pure functions over already-loaded local state.
- **100% offline.** No PII leaves the device.
