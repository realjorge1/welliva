# Fitness Module — Changelog

## 2026-07-05 — Skia motion layer + mascot (v4)

Verified: `tsc --noEmit` clean, `expo lint` 0 errors, vitest 240/240.
**Requires a native rebuild** (`npx expo run:android`) — two native modules added.

### ExerciseDB retired, Skia/Lottie in
- `@shopify/react-native-skia@2.2.12` + `lottie-react-native@~7.3.1` installed
  (SDK-matched). ExerciseDB is shelved, not deleted: `ExerciseMediaService`,
  `useExerciseDemo`, `ExerciseDemo` remain on disk but are no longer routed to
  by any screen (they already rendered nothing without an API key).
- `components/skia/skiaSafe.ts` — defensive `require` of Skia + `isSkiaAvailable`.
  Every Skia component pairs with a plain react-native-svg fallback, so the app
  never white-screens in the window before the native rebuild (or on reduced
  motion / any Skia-less surface).

### Animated demonstration figure (replaces the demo GIF)
- `fitness/animation/movementProfiles.ts` (PURE, tested) — a schematic side-view
  humanoid as two keyframe poses per movement pattern (squat/hinge/push/pull/
  core/cardio/flexibility + neutral). `resolveFigureMotion(id, category)` prefers
  the DB's precise `movementPattern`, falls back to category, then neutral.
- `fitness/components/ExerciseFigure.tsx` (+ `.skia.tsx`) — one Skia path
  recomputed each frame on the UI thread; loops one clean rep. Placed in the
  TRANSITION next-up card, the guide sheet, and exercise detail.

### Coach mascot (the "Duolingo-birdie" through-line)
- `fitness/components/CoachAvatar.tsx` (+ `.skia.tsx`) — a code-drawn character
  with moods idle/cheer/rest/push: continuous breathe + blink, springy pop on
  active moods, sparkles on cheer. Choreographed as a session through-line:
  hero at COUNTDOWN, reacts (flexes on final push) in the ACTIVE_SET ref row,
  breathes with you at REST, cheers inside the completion Ring.

### Lottie, ready but idle
- `components/motion/LottiePlayer.tsx` — thin safe wrapper; renders nothing
  without a `source`, so a designer `.json` drops in later with no screen edits.

### Tests
- `fitness/__tests__/movement.test.ts` (7) — every catalogued exercise resolves
  to a drawable profile; no keyframe pose escapes the 0–100 box; ping-pong
  symmetry; fallback chain.

## 2026-07-05 — Catalog ×3 + premium player (v2)

Verified: `tsc --noEmit` clean, `expo lint` 0 errors, vitest 217/217.

### Workout catalog: 24 → 72 sessions
- `fitness/data/workouts.ts` — 48 new authored sessions spread across all
  8 styles (cardio 8, HIIT 10, strength 18, core 9, endurance 6, power 6,
  mobility 8, recovery 7). Every session is grounded in recognized training
  methodology: ACSM-style high-intensity circuit protocol ("The Daily
  Dozen"), Tabata-inspired intervals ("Tabata Twenty"), McGill spine-stability
  big-three ("Spine Steel"), WHO-guideline balance work (Single-Leg Balance
  Hold), plus classic push/pull/legs splits, low-impact/no-jump variants and
  runner/desk-worker support sessions.
- `constants/ExerciseDatabase.ts` — 45 → 85 exercises. 40 new standard,
  well-documented movements (side plank, bird dog, hollow hold, skaters,
  step-ups, sit-to-stands, band rows, Y-T raises, doorway stretch, downward
  dog, …) with full setup/instructions/cues, honest effectiveness notes, and
  accurate `movementPattern`/`targetMuscles` so injury/pregnancy
  contraindication filtering applies automatically.
- Thumbnails: `ArtTile` gained 4 new hues (rose/forest/slate/midnight) and
  4 pattern variants (orbit/rings/dots/beams); every session has a unique
  icon+hue combo and no icon repeats more than twice (test-enforced).

### Premium guided-session player (`app/guided-session.tsx`)
All additive over the existing SessionService state machine:
- Exercise timeline strip (done/current/upcoming) + overall % in the top bar.
- Prominent "Position" card with expandable numbered how-to steps, shown in
  countdown and active set; next-exercise cards preview the setup position.
- Back control (`SessionService.goBack`): mid-set → restart the set;
  fresh set → return to the previous exercise, discarding its recorded
  result so summaries/achievements never double-count.
- "Round" vs "Set" wording per workout style; up-next preview during sets.
- Drill-list bottom sheet (whole session at a glance with live status).
- Completion celebration: confetti + trophy + headline stats before the
  summary takes over.
- Landscape support: `expo-screen-orientation` unlocks rotation on this
  screen only (relocks portrait on exit); two-pane landscape layout.
- Resume hardening: every user action persists the session immediately.

## 2026-07-04 — Fitness platform upgrade (v1)

Every change below is additive or a like-for-like rebuild; no existing
route, API, storage key, or navigation path was removed or renamed.
Verified: `tsc --noEmit` clean, `expo lint` 0 errors, vitest 209/209
(166 pre-existing health-os tests + 43 new fitness tests).

### New module: `fitness/`
| File | What / why |
|---|---|
| `fitness/types.ts` | Shared types for workouts, profile, recommendations, beats, progress, calendar. |
| `fitness/data/workouts.ts` | 24 authored workouts (warm-up/main/cool-down) composed **only** from `EXERCISE_DATABASE` ids so they run through the existing player offline. |
| `fitness/data/coaches.ts` | 5 original coach personas (editorial voice, no likenesses/imagery). |
| `fitness/data/beatMeta.ts` | Pure beat catalog (Node-safe for tests/services). |
| `fitness/data/beatSources.ts` | Metro-only `require()` map for the WAVs — split from meta so the test graph never touches asset loading. |
| `fitness/services/WorkoutCatalog.ts` | Resolution (duration/calories/equipment/muscles), token search, combined filters, per-user suitability (reuses `exerciseSuitability`), and `workoutToPlayerParams` — the guided-session param contract. |
| `fitness/services/RecommendationEngine.ts` | Deterministic daily recommendation with plain-language reasons: plan-first, recovery-aware (consumes the existing GozlinRecoveryEngine level), body-region balancing from `sessionHistory`, skip adaptation, equipment/level/duration fit. |
| `fitness/services/ProgressService.ts` | Pure stats over `workoutLog`/`sessionHistory`: streaks (with grace day), 8-week history, personal bests, snapshot. |
| `fitness/services/CalendarService.ts` | Month model merging weekly plan × log into completed/planned/missed/rest/future cells. |
| `fitness/services/FitnessProfileStore.ts` | The module's one storage key (`@welliva_fitness_profile`): prefs, favorites, recommendation memory; hydration-safe, corruption-safe, with an in-process change feed; export/reset data controls. |
| `fitness/services/FitnessNotifications.ts` | Opt-in reminders (training days, hydration, stretch, weekly summary). Cancels **only ids it scheduled** — the health-os notification planner is untouched. |
| `fitness/hooks/*` | `useFitnessProfile` (live, cross-screen-synced), `useBeatPlayer` (expo-audio wrapper), `useVoiceCoach` (expo-speech phase cues). |
| `fitness/components/*` | ArtTile (original code-drawn artwork), WorkoutCard, CoachBadge, MusicDock, WeekBars. |
| `fitness/__tests__/*` | 43 unit tests (see architecture doc → Testing). |

### New assets: 15 original workout beats
- `scripts/generate-beats.js` — a dependency-free procedural synthesizer
  (oscillators + shaped noise, seeded PRNG). No samples, no copyrighted
  melodies, no imitation of existing tracks; the compositions are original
  works generated for this project → royalty-free, commercial-use safe.
- `assets/audio/beats/*.wav` — 15 seamless loops (22 050 Hz/16-bit mono,
  ~10 MB total): Pop Cardio Pulse, Disco Sprint, Electro Strength, Funk
  Motion, Synth Run, House Endurance, Neon HIIT, Bass Boost, Power Circuit,
  Rhythm Climb, Dance Burn, Victory Drive, Focus Flow, Peak Energy,
  Cooldown Groove.

### New screens: `app/fitness/`
`library.tsx` (workout search/filters + the preserved exercise browser),
`workout/[id].tsx` (detail + fit % + start), `progress.tsx`,
`calendar.tsx`, `setup.tsx` (5 skippable steps), `settings.tsx`
(music/voice/reminders/data controls).

### Modified files (each kept fully backward-compatible)
| File | Change | Why safe |
|---|---|---|
| `app/(tabs)/exercise.tsx` | Rebuilt as the Fitness dashboard: greeting, streak chip, recommendation hero with reasons, continue-session card, quick-nav, week+recovery tiles, coach insight. | All previous features preserved: same plan-session launch params, tailored-match card, weekly plan list, regenerate button, recents, Gozlin doorway. The former "Browse" mode moved verbatim to Library → Exercises. The formerly inert trophy icon now opens the existing `/league` screen. |
| `app/guided-session.tsx` | Added MusicDock (beats), optional voice guidance, and `resume=1` support (restores the crash-recovery state SessionService already persisted; resumes paused). | Purely additive: new optional params; state machine, CoachEngine, milestones, summary and logging untouched. With music/voice off, behaviour is identical. Null-state guards added for the resume path only. |
| `app/_layout.tsx` | Registered the six `app/fitness/*` routes (setup as modal). | Additive Stack entries. |
| `vitest.config.ts` | Include `fitness/**/*.test.ts`. | Additive. |
| `package.json` | Added `expo-audio ~1.1.1`, `expo-speech ~14.0.8` (both Expo Go–compatible, SDK 54 versions via `expo install`). | New deps only. |
| `fitness profile ↔ screens` | — | New storage key; no existing key touched. |

### Explicit non-changes (integrity guarantees)
- `SessionService`, `CoachEngine`, `WorkoutGenerator`,
  `ExerciseRecommendationEngine`, `AppContext`, achievements, streaks,
  league, recap, diet, auth, onboarding: **zero edits**.
- No navigation route removed; `exercise/[id]`, `guided-session`,
  `session-summary` contracts unchanged.
- Completed library workouts log through the same pipeline, so
  achievements/streaks/league/recap count them automatically.

### Known limitations / future work
- Landscape in the player needs `expo-screen-orientation` (global
  `orientation: "portrait"` in app.json protects other screens for now).
- The exercise-vs-app streak definitions differ intentionally (fitness
  streak counts training days only).
- Clearing individual workout-log records would require an AppContext
  mutation API; deliberately deferred to keep this release read-only over
  app state (export + module resets shipped instead).
