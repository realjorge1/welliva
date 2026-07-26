# 07 — Progressive Profile Completion

**Goal:** stop treating the profile as a one-time onboarding form. Model it as a
**living completeness score** where each piece of information the user shares
**unlocks** a concrete personalization. Depth is earned over time, never demanded
up front.

Today: a 13-step onboarding writes `UserBio` once; later edits go through the
adaptive `updateUserBio` re-fit. There is no notion of "how complete is this profile"
or "what does the next field unlock." This adds that layer — additively, over the
existing bio.

## 1. Model

```ts
// health-os/profile/completeness.ts
export interface ProfileSignal {
  id: string;                         // e.g. "target_weight"
  label: string;                      // "Goal weight"
  /** Which profile/goal/pref field(s) presence is checked. */
  isPresent: (p: ProfileSnapshot) => boolean;
  weight: number;                     // contribution to completeness %
  tier: "core" | "personalize" | "deepen";
  /** The capability this signal turns on. */
  unlocks: UnlockId;
  /** One-line "why share this" shown in the nudge. */
  rationale: string;
}

export interface ProfileCompleteness {
  percent: number;                    // 0–100, weighted
  tier: "starter" | "personalized" | "deep";
  present: string[];                  // signal ids satisfied
  missing: ProfileSignal[];           // ranked by leverage (weight × unlock value)
  unlocks: UnlockId[];                // capabilities currently available
  nextBest: ProfileSignal | null;     // the single highest-leverage thing to add next
}
```

## 2. Signals → unlocks (the personalization ladder)

Each signal maps a piece of profile data to a feature that becomes meaningfully better
once it exists. Most of these features **already exist** — this just makes their
data-dependency explicit and gives the user a reason to fill them in.

| Signal | Tier | Unlocks | Already gated on this today? |
|---|---|---|---|
| goal + basics (age/sex/height/weight) | core | calorie & macro targets, diet match | yes (`calculateNutritionTargets`) |
| activity + experience | core | workout plan difficulty | yes (`WorkoutGenerator`) |
| dietary restriction + allergies | core | safe diet filtering | yes (`DietMatchService`) |
| **region** | personalize | true cross-continent meals | yes (`bio.region` → AI backend) |
| **cuisine preference** | personalize | cuisine-tiered meal selection | yes (`applyCuisinePreference`) |
| **equipment + training days** | personalize | equipment-aware programming | yes (in plan `inputHash`) |
| **target weight** | personalize | **Transformation Forecast** (ETA, success score) | yes (`GozlinForecastEngine` needs `targetWeightKg`) |
| **injuries / conditions / meds / pregnancy** | personalize | safety re-fit + medication advisories | yes (`buildContraindications`, `MEDICATION_DIET_RULES`) |
| **daily check-ins** (sleep/mood/stress) | deepen | Habit Awareness sleep/mood scores | yes (`GozlinHabitEngine` gates on check-ins) |
| **food dislikes** | deepen | dislike-aware meal generation | yes (`foodDislikes` filter) |
| **motivation / "why"** | deepen | personalized coach voice & briefings | yes (`@gozlin_identity.motivation`) |

> The insight: Welliva is *already* a progressive system — features quietly light up
> as data arrives. We are surfacing that ladder so the user can see and climb it,
> turning hidden dependencies into a guided journey.

## 3. Completeness tiers

| Tier | Threshold | Meaning |
|---|---|---|
| **Starter** | core signals present | Targets, a safe diet, a plan. The app works fully. |
| **Personalized** | + most `personalize` signals | Region/cuisine/equipment-tailored; forecast active; safety-aware. |
| **Deep** | + `deepen` signals | Habit/sleep/mood intelligence; remembered "why"; dislike-aware. |

Tiers are **descriptive, never gating the core experience.** A starter user gets a
complete plan; deeper tiers add intelligence, not access.

## 4. Surfacing — calm, non-nagging

- **Profile screen:** a `ProfileCompletenessCard` — a ring at `percent`, the tier
  label, and `nextBest` as one tappable suggestion ("Add your goal weight → unlock
  your Transformation Forecast"). One suggestion at a time, never a checklist wall.
- **Contextual unlock prompts:** when a user opens a feature that's dimmed for lack of
  data (e.g. the Forecast card with no `targetWeightKg`), it shows the *unlock* inline:
  "Set a goal weight to see your projected timeline" → opens the relevant editor.
- **Post-action reveal:** after the user adds a signal, a small "Unlocked: …"
  acknowledgement (reuses the existing celebration host, low intensity). Adding data
  feels rewarding, not like filling a form.

## 5. Data flow

```
ProfileRepository.update(patch)
   ├─ writes the bio/goals/prefs record (existing safety re-fit)
   ├─ emits profile.updated / goal.set / preference.changed events (L1)
   ├─ recomputes ProfileCompleteness ← signals registry
   ├─ persists @welliva_profile_meta { completeness, unlocks }
   └─ if new unlocks appeared → queue a calm "unlocked" beat
```

Completeness is **derived** from the current profile/goals/prefs snapshot — never a
separately maintained counter that can drift (the SSOT tenet). `@welliva_profile_meta`
caches the last computed value for instant render, recomputed on every update.

## 6. Feeding richer AI context

Completeness directly improves the **Context** read-model ([05 §B](./05-api-and-contracts.md)):
deeper profiles populate more of `HealthContext.identity` (motivation, constraints,
learned patterns) and unlock more `recent`/`body` signal — so the coach's advice gets
more personal exactly as the user invests more. The unlock ladder and the AI's
context richness are the same thing viewed from two sides.

## 7. Extensibility

A new personalization capability = **add one `ProfileSignal`** to the registry mapping
its required field(s) → its `UnlockId`. Completeness math, the nudge UI, and the
unlock acknowledgement all pick it up with no further wiring. (e.g. adding "sleep goal
→ smarter recovery" is a one-entry change.)
