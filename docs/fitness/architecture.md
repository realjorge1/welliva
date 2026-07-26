# Fitness Module — Architecture

The fitness module turns Welliva's exercise tab into a premium, AI-guided
personal training platform: a recommendation-driven dashboard, a searchable
workout library with original coach personas and generated artwork, a
music-backed guided session with optional voice guidance, progress and
calendar views, a first-run setup flow, reminders, and data-safety controls.

Design pillar: **the module is a read-only layer over the existing app.**
It never mutates AppContext state, never bypasses the proven
`guided-session → session-summary → logWorkout` pipeline, and owns exactly
one new AsyncStorage domain (its preference profile). Everything else is
pure derivation — which is why the whole domain layer runs under Node in
vitest.

## Directory layout

```
fitness/
  index.ts                  public barrel (import from "@/fitness")
  types.ts                  all shared types
  data/
    workouts.ts             24 authored workouts (warm-up / main / cool-down)
    coaches.ts              5 original Welliva coach personas
    beatMeta.ts             15-beat catalog (pure metadata — Node-safe)
    beatSources.ts          id → require(".wav") map (Metro-only; never import in tests)
  services/
    WorkoutCatalog.ts       resolve/search/filter/suitability + player params (pure)
    RecommendationEngine.ts daily "what & why" recommendation (pure, deterministic)
    ProgressService.ts      streaks, weekly history, personal bests (pure)
    CalendarService.ts      month model: completed/planned/missed/rest (pure)
    FitnessProfileStore.ts  the module's own profile (AsyncStorage + change feed)
    FitnessNotifications.ts reminder scheduling (owns only its own notification ids)
  hooks/
    useFitnessProfile.ts    profile as live React state (synced across screens)
    useBeatPlayer.ts        expo-audio wrapper: play/pause/loop/next/volume/mute
    useVoiceCoach.ts        expo-speech phase announcements (optional)
  components/
    ArtTile.tsx             generated workout artwork (gradient + orbit rings)
    WorkoutCard.tsx         library list card (memoized)
    CoachBadge.tsx          coach monogram badge
    MusicDock.tsx           in-session music controls
    WeekBars.tsx            8-week consistency bars (plain Views, no chart lib)
  __tests__/                vitest (node env) — catalog, recs, progress,
                            calendar, profile, beats

app/fitness/
  library.tsx               Workouts + Exercises browser (search + filters)
  workout/[id].tsx          workout detail (blocks, fit %, coach, start)
  progress.tsx              goal ring, stats, consistency, personal bests
  calendar.tsx              month grid + day detail
  setup.tsx                 5-step first-run personalization (all skippable)
  settings.tsx              music/voice/reminders/data controls

assets/audio/beats/         15 original WAV loops (generated, royalty-free)
scripts/generate-beats.js   the procedural synthesizer that renders them
```

## Data model

### Single sources of truth (unchanged, read-only from this module)
| Data | Owner | Access |
|---|---|---|
| Body data, injuries, equipment, level, goal | `UserBio` (AppContext) | `useProfile()` |
| Weekly plan | `workoutPlan` (AppContext) | `useWorkout()` |
| Completed workouts | `workoutLog` (AppContext) | `useWorkout()` |
| Per-exercise session results | `sessionHistory` (AppContext) | `useWorkout()` |
| Streak/achievements | existing services | untouched |

### Module-owned state
`FitnessProfile` (`@welliva_fitness_profile`): goals, location, typical
duration, preferred styles, training days, milestone, music prefs
(enabled/volume/default beat), voice guidance, reminder prefs, favorites,
and a 21-entry `recommendationHistory` (the skip-adaptation memory).
Loaded through `useFitnessProfile()`, which subscribes to an in-process
change feed so every mounted screen stays in sync.

`@welliva_fitness_notification_ids`: the ids of notifications this module
scheduled — the only ones it will ever cancel.

## Key contracts

### The player contract (why nothing could break)
`workoutToPlayerParams(workout)` produces exactly the params the existing
guided-session screen already consumed for plan sessions:
`exerciseIds`, `sets`, `reps` (comma-joined arrays), `sessionLabel`,
`workoutSessionId` (`lib_<workoutId>`). Library workouts therefore run
through the untouched state machine (SessionService), coach engine, summary
and logging. Tests enforce: every referenced exercise exists in
`EXERCISE_DATABASE`, no workout repeats an exercise id (the player keys
results by id), and no reps string contains a comma.

Two **additive** params were introduced: `beatId` (preselects a music
track) and `resume=1` (restore the persisted in-progress session — the
crash-recovery data SessionService was already writing every 10 s).

### The recommendation engine
`recommendToday(input)` is pure and deterministic per date. Priority:
1. already trained today → protect the win (rest);
2. recovery **red** (from the existing `GozlinRecoveryEngine`) → gentle
   low-energy library pick;
3. scheduled plan session → recommend it (unless skipped 2+ times this
   week → fresh library alternative at the same goal);
4. otherwise scoring over the library: duration fit, style preference, goal
   alignment, level match, body-region balance (from `sessionHistory`
   categories over the last 2 days), variety (recently-done demoted),
   skip-adaptation (repeatedly skipped picks demoted), favorites nudge,
   date-seeded tiebreak.
Every output carries ≤ 4 plain-language `reasons` and one `insight` line.

### Music (original workout beats)
`scripts/generate-beats.js` synthesizes all 15 loops from oscillators and
shaped noise with seeded PRNGs — no samples, no copyrighted material; the
compositions are original to this project and reproducible bit-for-bit.
22 050 Hz / 16-bit mono WAV, rendered wrap-around so loops are seamless.
Rendering knobs (BPM, key, patterns, bars) live in the script's `TRACKS`
table; re-run `node scripts/generate-beats.js` after editing, and mirror
any id changes in `beatMeta.ts` + `beatSources.ts`.

`useBeatPlayer` manages one `expo-audio` player imperatively (`replace()`
on track change, `loop = true`, volume/mute), sets
`playsInSilentMode: true` once, and wraps every native call in try/catch —
audio can never crash a workout. The dock pauses with the session and
stops on completion.

### Voice guidance
`useVoiceCoach(state, enabled)` speaks only on phase transitions
(countdown, set start, rest, next exercise, completion) via `expo-speech`.
Off by default; toggle in setup/settings. With it off the player is
byte-for-byte the old behaviour.

### Notifications
`syncFitnessReminders(profile)` is idempotent: cancel own ids → reschedule
from prefs (weekly triggers on training days at the chosen hour; daily
hydration/stretch; Sunday weekly summary). It never calls `cancelAll`, so
the health-os proactive-delivery scheduler is unaffected.

### Data safety
Settings → Your data: **Export** (profile + workoutLog + sessionHistory as
JSON via the share sheet), **Reset recommendations** (adaptation memory
only), **Reset fitness preferences** (module back to first-run; cancels its
reminders). Account-wide deletion remains in the app's main Privacy screen
— by design this module cannot delete app-owned history.

## Performance
- The tab layout's `Freeze` + display-toggle behaviour is untouched.
- Library list: memoized `WorkoutCard`, `FlatList` with tuned
  `initialNumToRender`/`windowSize`; catalog resolution happens once at
  module load (24 × 45 trivially small).
- Charts are plain Views (no SVG/chart-kit re-layout); artwork is
  code-drawn gradients (no image decoding, sharp at all densities).
- Recommendation memoized on its real inputs; date-seeded so it can't
  flicker between renders.
- Audio: a single reused native player; `.wav` decode is trivial.

## Accessibility
Roles/labels/selected-state on all interactive chips, dock buttons, day
cells and favorites; the design system's `AppText` already caps dynamic
type scaling per variant; touch targets ≥ 36 px with hitSlop; reduced-motion
users see the same information because animation is decorative only
(Reveal/pulse), never the sole carrier of meaning.

## Testing
`npm test` runs vitest (node env) over `health-os/**` and `fitness/**`.
The fitness suite (43 tests) covers: library integrity + player-param
round-trip, search/filter/equipment/suitability, recommendation rules
(plan-first, recovery caps, balance, determinism, skip adaptation),
streak/weekly/snapshot math, calendar statuses/padding/paging, profile
persistence/hydration/corruption/export, and beat catalog + generated
assets on disk. Anything importing `expo-*` or `beatSources.ts` stays out
of the test graph by construction.

## Extension points
- **New workout**: append to `data/workouts.ts` — tests validate it, every
  screen picks it up automatically.
- **New beat**: add a `TRACKS` entry in the generator, run it, add matching
  rows to `beatMeta.ts` + `beatSources.ts`.
- **New recommendation signal**: extend `RecommendationInput` and add a
  scored term in `pickLibrary` — inputs are injected, so tests stay easy.
- **Wearable recovery**: already flows in — `computeRecovery` accepts a
  `WearableSnapshot`, and the engine only consumes the resulting level.
- **Player queueing/crossfade**: add behind `UseBeatPlayer` without touching
  call sites.
- **Landscape player**: app-level `orientation` is global in `app.json`;
  adopt `expo-screen-orientation` per-screen when the native (EAS) cutover
  lands.
