# 04 — Daily AI Briefings (Phase 4)

> **Mission:** every morning, Gozlin greets the user by name of their journey, tells
> them what happened yesterday, what matters today, and the one move that keeps the
> momentum — a coach's sit-down, not a notification.

Code: [`services/gozlin/GozlinBriefingEngine.ts`](../../services/gozlin/GozlinBriefingEngine.ts),
UI [`components/gozlin/renderers/BriefingCard.tsx`](../../components/gozlin/renderers/BriefingCard.tsx),
voice [`services/gozlin/GozlinPersona.ts`](../../services/gozlin/GozlinPersona.ts).

---

## 1. The framework

A briefing is one structured object with these sections (each is *optional by content* —
an empty section simply doesn't render):

```
Greeting              "Good morning."                  ← day-part aware
Journey header        "Day 18 · Fat Loss Journey"      ← dayCount + journeyLabel
Headline              the emotional hook (decision tree)
─────────────────────────────────────────────
Yesterday Summary     ✓ Workout completed · ✓ Protein goal achieved
Today's Plan          "Strength + Recovery"
  Workout Focus       Upper Body Push · ~45 min. Recovery green.
  Nutrition Focus     Aim 2,100 kcal, 165g protein.
Risk Alerts           ⚠ Calories running over plan      ← only when present
Suggested Adjustments small concrete tweaks (from CoachInsights)
Gozlin Insight        "Your consistency is now 88%. …"  ← motivation
Your one move         the single smallest next win       ← micro-action
```

This maps 1:1 to the brief's required sections (Yesterday Summary, Today's Plan,
Workout Focus, Nutrition Focus, Motivation, Risk Alerts, Suggested Adjustments).

## 2. Worked example

> **Good morning.**
> **Day 18 · Fat Loss Journey**
> Right on pace. I'm right here if you need me.
>
> **Yesterday** — ✓ Workout completed · ✓ Every meal on plan · ✓ Protein goal achieved
> **Today · Strength + Recovery**
>  • Upper Body Push · ~45 min. Recovery green.
>  • Aim 2,100 kcal, 165g protein.
> **Gozlin insight** — Your consistency is now 88%. 18 days strong — you're building real momentum.
> **Your one move** — Keep the chain alive — same good choices as yesterday.

## 3. The journey header — "Day N"

```
journeyLabel = { lose_weight: "Fat Loss Journey",
                 build_muscle: "Muscle-Building Journey",
                 improve_fitness: "Fitness Journey",
                 increase_energy: "Energy Journey",
                 better_health: "Health Journey",
                 athletic_performance: "Performance Journey" }[goal]
             ?? "Wellness Journey"

startDate = UserGoals.journeyStartedAt        (stamped at onboarding)
          ?? earliest dietHistory date         (back-fill for existing users)
dayCount  = daysBetween(startDate, today) + 1  (null if no start signal)
```

`journeyStartedAt` is written once, at `completeOnboarding`, and never overwritten.

## 4. Generation logic — section by section

All section builders are pure functions of the **Twin** + yesterday's records.

### Yesterday Summary
Reads yesterday's `DietHistoryEntry` and `workoutLog`:
- workout logged → ✓ *Workout completed*
- meals: all on plan → ✓ *Every meal on plan*; partial → *m/n meals logged*; none → *Logging ran light*
- `consumedProteinG ≥ 0.9 × proteinTarget` → ✓ *Protein goal achieved*
- nothing logged → *"Fresh page today — let's make it count."*

### Today's Plan (theme)
A two-beat label like the example's *"Strength + Recovery"*:
- no plan → *"Set your plan + Hydration"*
- workout done → *"Recovery + Nutrition"*
- workout planned → `"<focus> + <Fuel|Recovery>"` (Fuel if recovery green)
- rest day → *"Recovery + Mobility"*

### Workout Focus & Nutrition Focus
Single lines off the Twin's `today` block — the planned session + duration + recovery
level, and the calorie/protein targets with a flag-driven nudge (over → "go lighter
tonight"; protein lag → "lead with it"; behind → "a solid dinner squares it").

### Motivation ("Gozlin Insight")
Leads with the literal consistency figure (matching the brief's *"Your consistency is
now 88%"*), then a momentum tail (streak / rising / reset) and the user's remembered
"why" when known.

### Risk Alerts
Surfaced **only when real**, kindly: recovery in the red, calories over plan, the scale
drifting against the goal direction, cooling consistency, light hydration. Capped at 3.

### Suggested Adjustments
Pulls from the already-prioritized **CoachInsights** (their whole job is "what to tweak")
plus a couple of flag-specific tweaks — **no parallel scoring**. Capped at 2.

### Micro-action ("Your one move")
The single smallest next win, chosen from the dominant flag (setback → a 10-min walk;
no plan → set it; protein lag → a protein snack; …).

## 5. Headline decision tree (preserved from Phase 2)

Priority order, first match wins:

```
no profile      → "Let's get you set up…"                       (motivation)
SETBACK         → reset() + "One small win today resets…"        (recovery)
streak milestone→ "That's N days straight. 🔥 …"                 (celebration)
OVER_CALORIES   → "You're over on calories — no drama…"          (nudge)
NO_PLAN         → "No meal plan yet today…"                       (nudge)
WORKOUT_PENDING → "Today's <focus> session is waiting…"          (nudge)
ON_TRACK / DONE → pickVariant(onTrack)                            (on-track)
else            → "Small consistent choices beat big ones."      (motivation)
```

A non–dead-end closer (`"I'll check in tomorrow."`) is appended except on celebrations,
where the win is allowed to stand alone.

## 6. Prompt / phrase templates

Briefings are **deterministic** — assembled from the seeded persona phrase banks in
`GozlinPersona.ts`, not an LLM, so they work fully offline and never hallucinate a
number. The day's date seeds variant selection, so the voice feels alive day-to-day
but stays reproducible and testable.

When the optional `GozlinProvider` LLM seam is wired, the **grounding prompt** in
`GozlinChatEngine.buildGroundingPrompt` constrains it to the Twin's real numbers
("Use ONLY the facts below — never invent numbers"). The briefing itself never depends
on it.

## 7. UI presentation

The greeting + headline render as the coach's **chat bubble**; the structured sections
render as the **BriefingCard** beneath it (journey pill, Yesterday, Today, Heads-up,
Suggested adjustments, the Gozlin-insight callout, and the highlighted one-move lever).
Tone drives every accent color via the shared `toneColor` mapping, so the whole card
reads as one designed system.

## 8. Triggering & cadence

The briefing is computed in `useGozlin` from live AppContext state and **seeds the
conversation** when the thread is empty — so opening Gozlin in the morning *is* the
briefing. It also answers the "briefing"/"greeting" chat intents on demand. (A future
scheduled local notification can reuse the exact same `buildBriefing` output verbatim —
the generation logic is already headless and pure.)

## 9. Design guarantees

- **Pure & deterministic** — inject `now`; same state → same briefing.
- **Offline-first** — phrase banks + local state, no network required.
- **No parallel scoring** — reuses Twin + CoachInsights.
- **Honest & kind** — risk alerts only when real; setbacks lead with a reset, never blame.
