# 00 — Proactive Companion Blueprint

*Phase Three. The layer that makes Gozlin **anticipate** instead of respond.*

This sits **on top of** the Health OS substrate (`docs/architecture/00`–`12`) and the
Gozlin coach (`docs/gozlin/01`–`09`). It does not rebuild either. Read
[`docs/architecture/01 §4`](../architecture/01-domain-architecture.md) first — the
**dependency rule is non-negotiable** and every module below obeys it.

---

## 1. The honest gap analysis

The pasted vision assumes we are building a companion from scratch. We are not. A
disciplined audit of the repo shows the *intelligence and voice* are largely done; the
gap is **time, senses, and out-of-app reach.**

| Vision capability | Status | Where it already lives / what's missing |
|---|---|---|
| Proactive, ranked coach interventions | **Exists** | `GozlinMomentEngine.buildMoments` already ranks present-tense beats per surface ("Your body's asking for rest"). It is the anticipation engine — minus the clock. |
| Daily / weekly / monthly briefings | **Exists** | `GozlinBriefingEngine` (daily), `GozlinProgressEngine.buildWeeklyReview` (weekly), `MonthlyRecapService` ("Welliva Wrapped"). Missing: **delivery** (they're pull-on-open, not pushed) and **yearly/5-year**. |
| Recovery intelligence | **Partial** | `GozlinRecoveryEngine` is a *training-load proxy* — "no wearables yet". Wearable signal makes it real. |
| Long-term storytelling | **Partial** | `MonthlyRecapService` + `JourneyService` (chapters) prove the deterministic-narrative pattern. Missing: year / anniversary / 5-year horizons + documentaries. |
| Predictive planning / goal-timeline changes | **Partial** | The *levers* exist (`applyWorkoutAdaptation`, `PlanSync`, `GOAL_CALORIE_MODIFIERS`, forecast `etaWeeks`). Missing: a **forward trigger** to pull them. |
| **Life Context** (wedding, pregnancy, surgery, exam, travel…) | **Missing** | No concept of a *future-dated, expiring* fact anywhere. This is the keystone. |
| Calendar / wearable / health-record / weather signals | **Missing** | Zero native plumbing. No `expo-notifications`, `expo-calendar`, health SDK, or image-picker installed. |
| Out-of-app notifications + attention orchestration | **Missing** | No notification port at all. |
| Multimodal (voice, photo meal analysis) | **Missing** | No STT, no vision endpoint, no image picker. M4 conversation-logging is the pipeline they plug into. |
| Plugin architecture | **Implicit** | `docs/architecture/01 §6` already states "new feature = new event types + a new engine reading Context." Needs a formal `HealthModule` contract. |
| Privacy / trust | **Partial** | M3 (`docs/architecture/09`) defines consent + boundary + export/erase. Needs new per-integration consent categories + an explainability trail. |

**Takeaway.** ~60% of the proactive companion is already standing in a more evolved form
than the vision assumes. The net-new work is **a clock (Life Context), senses
(Signals), and reach (Notifications + Multimodal)** — plus formalizing the plugin and
trust frameworks. We are layering, not rebuilding.

---

## 2. The one new idea: forward time

Everything anticipatory reduces to a single missing primitive. Today every engine reads
**present tense** — `GozlinMomentEngine` ranks `twin.flags` for *now*; `GozlinForecastEngine`
projects a *single* trend forward with no awareness of *events*. The companion cannot
anticipate because it has no model of the **future the user is walking into.**

> **Life Context** = the set of **future-dated, auto-expiring, user-controlled** facts
> that should bend coaching before they arrive, and stop mattering once they pass.

This is deliberately **not** a Memory Layer-3 Fact (those are durable and slow-changing —
"motivated by a wedding photo from years ago"). A Life Context entry is *temporally
bounded and forward-looking* — "wedding on Aug 12," "surgery on the 3rd," "antibiotics
finish Friday," "exam season starts in 2 weeks," "in Lisbon Mon–Thu." It has a lifecycle
(`active → completed | expired | dismissed`) and an `expiresAt`. The vision's own examples
are *all* Life Context triggers:

```
Travel detected            → hotel/bodyweight workout
Late nights increasing     → recovery recommendation
Stress increasing          → training intensity ↓
Wedding/pregnancy/surgery/ → goal-timeline change
  med-completion approaching
Vacation begins            → maintenance mode
Exam season                → mental wellbeing prioritized
Rain forecast              → indoor workout
```

Each is `(a forward signal) → (a plan delta)`. Build the forward signal once, as a domain,
and the deltas reuse seams that already exist.

---

## 3. New domains (obeying the dependency rule)

Dependencies point **inward and downward only** (`architecture/01 §4`). Every module
below is placed so that: external signals **write through the Timeline** (rule 5),
engines **read Context only** (rule 3), and OS/native access sits **behind a port**
(rule 4). Nothing imports `contexts/` or `app/`.

```
app/ → contexts/ →
  health-os/
    lifecontext/      DOMAIN  future-dated facts + lifecycle + expiry ──writes──► timeline (life.*)
    signals/          PORTS   calendar | wearable | weather | health-record
                              adapters normalize → timeline + propose lifecontext
    context/          EXTEND  HealthContext += { lifeContext.upcoming[], signals, mode }
    insights/
      anticipation/   PURE    Context → ranked Anticipation[] + CoachingMode
      story/          PURE    Memory → narrative artifacts (year/anniversary/5-yr/documentary)
    notifications/    PORT+   NotificationPort + attention-budget Orchestrator
    privacy/          EXTEND  per-integration consent categories + explainability trail
  platform/           EXTEND  + NotificationPort, + Source ports
```

### 3.1 `lifecontext/` — the keystone domain

```ts
type LifeEventKind =
  | "wedding" | "pregnancy_due" | "surgery" | "medication_course"
  | "exam_period" | "travel" | "vacation" | "competition" | "deadline"
  | "relocation" | "illness_recovery" | "holiday" | "anniversary";

interface LifeEvent {
  id: string;                       // ulid
  kind: LifeEventKind;
  title: string;
  window: { start: string; end?: string };   // local dates; end omitted = point event
  source: "user" | "calendar" | "inferred";
  confidence: number;               // 1.0 for user-entered, <1 for inferred
  status: "active" | "completed" | "expired" | "dismissed";
  createdAt: string;
  expiresAt: string;                // auto-prune horizon (window.end + grace)
  coachingHint?: CoachingMode;      // optional explicit mode request
}
```

`LifeContextRepository`: `add / confirm / snooze / dismiss / listActive / listUpcoming(horizonDays)`
+ a pure `expireDue(now)` sweep run at day-rollover. Each mutation appends a `life.*` Timeline
event (rule 5) so the Memory Center shows it and corrections/redactions work for free.
**Automatic expiration and user control** — the vision's exact words — are the two
load-bearing properties. Inferred entries (from Signals) are always *proposed*, never
silently committed (mirrors M4's confirm-before-commit discipline).

### 3.2 `signals/` — the senses

A `SignalSource` port per external system; each adapter normalizes raw data into either
**Timeline events** (`signal.calendar.busy`, `signal.wearable.sleep`, …) or **Life Context
proposals**. They are the *only* code that touches OS/native APIs, and every one is
**consent-gated** (M3 boundary) and **degrades to absent** (offline-first — the app is
fully functional with zero signals connected).

| Source | Native dep | Local/Network | Feeds |
|---|---|---|---|
| `CalendarSource` | `expo-calendar` | local, read-only | busy-day density → today's load; travel/event titles → Life Context proposals |
| `WeatherSource` | none (HTTP) | network, consent-gated | rain/heat → workout-environment anticipation |
| `WearableSource` | `react-native-health` / Health Connect | local | HRV/sleep/steps → **real** `GozlinRecoveryEngine`; late-nights/stress anticipations |
| `HealthRecordSource` | platform health store | local | meds/conditions → Profile re-fit + medication_course Life Context |

### 3.3 `insights/anticipation/` — the brain (pure, deterministic)

The generalization of `GozlinMomentEngine` from **present** to **forward** time. Reads the
extended `HealthContext`; emits ranked `Anticipation[]` and a computed `CoachingMode`. It
**re-scores nothing** — it pulls existing levers.

```ts
interface Anticipation {
  id: string;
  trigger: { kind: "life" | "signal" | "trend"; ref: string; leadDays: number };
  title: string; message: string;            // phrased by Persona, not the LLM's numbers
  delta?: PlanDelta;                          // workout swap / calorie band / mode change
  mode?: CoachingMode;
  priority: number;                           // same leverage scale as MomentEngine
  explanation: Explanation;                   // the "why Gozlin said this" trail
}

type CoachingMode =
  | "normal" | "travel" | "recovery" | "exam"
  | "work_pressure" | "maintenance" | "event_taper" | "medical";
```

`CoachingMode` is **derived state, not a store** — computed from active Life Context +
signals each day, and it *parameterizes existing generators* (workout intensity, calorie
band via `GOAL_CALORIE_MODIFIERS`, notification cadence, Persona tone). User-overridable
and always shown. This is the vision's "adaptive coaching modes" as a **policy over
existing levers**, not parallel plan logic.

### 3.4 `notifications/` — the reach

`NotificationPort` (schedule / cancel / permissions) with an `ExpoNotificationAdapter`
(local scheduled notifications — **no push server needed for v1**: daily briefing,
anticipations, and anniversaries are all locally schedulable). The
`NotificationOrchestrator` is an **attention-budget scheduler**: candidate notifications
(from Anticipation + Briefing + Story) compete under a daily budget, quiet hours, a
per-category cadence cap, priority preemption, and snooze — all from the Preferences
domain. It is the "intelligent notification orchestration that respects user attention"
requirement, and it never fires without consent.

### 3.5 `insights/story/` — long-horizon narrative

Extends the proven `MonthlyRecapService` discipline (deterministic from real logs,
emoji-contained, archived) to **year / anniversary / 5-year** horizons reading L2/L3
Memory, plus "achievement documentaries" (a Milestone-anchored fold). Anniversary
reflections are themselves a recurring Life Context entry stamped from
`journeyStartedAt`, so they flow through the same anticipation → notification path.

---

## 4. AI orchestration

The discipline is unchanged from `architecture/00 §2`: **deterministic core, LLM at the
seam, LLM never invents numbers.**

- **Anticipation + CoachingMode are pure functions** — fully testable, fully offline.
- The Haiku backend (`server/`, model-locked, forced tool-use + zod + self-repair) gains
  three endpoints, all behind the M3 consent boundary:
  - `POST /v1/lifecontext/parse` — free text ("I've got a wedding Aug 12") → a structured
    `LifeEvent` *proposal* (confirm-before-commit).
  - `POST /v1/log/photo` — meal photo → `LogDraft[]` (vision + forced tool-use; reuses
    M4's confirm card and idempotent commit).
  - `POST /v1/story/narrate` — a *summary* → grounded prose (numbers passed in, never
    invented).
- **Voice** is an input modality only: STT in front of the existing chat / log-extract
  pipeline — the deterministic router and provider seam are untouched.

---

## 5. Plugin architecture (formalized)

The dependency rule already makes the platform extensible; this names the contract so the
eight capabilities above — and future ones (sleep, glucose, mental health) — register
uniformly instead of being wired by hand.

```ts
interface HealthModule {
  id: string;
  eventTypes?: EventTypeSpec[];          // timeline catalog additions
  signalSources?: SignalSource[];        // senses it contributes
  contextContributors?: ContextContributor[]; // what it adds to HealthContext
  insightEngines?: InsightEngine[];      // pure engines reading Context
  surfaces?: SurfaceProducer[];          // in-app moment beats
  notificationProducers?: NotificationProducer[];
}
```

A module touches the core **only** through these slots; it cannot reach into another
domain (enforced by the existing `no-restricted-imports` lint). "New health module
without redesigning the core" becomes literally true.

---

## 6. Privacy & trust (extends M3)

The vision wants "the most transparent AI health companion in its category." We already
have the substrate (`architecture/09`: consent, boundary, export, erase, Memory Center).
Additions:

1. **Per-integration consent categories** — calendar, wearable, health-records,
   weather/location, photo, voice, proactive-notifications — each independently
   toggleable; each its own `ConsentRecord`.
2. **Explainability trail** — every `Anticipation` carries an `Explanation` ("I shortened
   today's workout because your calendar shows 6 hours of meetings"). Surfaced as
   "Why did Gozlin say this?" — the explanation taxonomy already flagged as a Phase-Two
   goal.
3. **"What Gozlin is watching"** — a Memory-Center surface listing every active signal
   and Life Context entry with its expiry, so the user sees (and can revoke) the full
   forward model.

---

## 7. Roadmap (P-series — additive, each shippable)

Slots onto the substrate roadmap. The "done right" versions want **M2** (Context
read-model) and **M3** (privacy/consent) landed; but P0/P1 can prototype against today's
`GozlinTwin`.

| Slice | Scope | Native? | Depends on |
|---|---|---|---|
| **P0 — Life Context** ⭐ ✅ **shipped** | `lifecontext/` domain + repo + lifecycle + expiry sweep + `life.*` events + "What's coming up" UI + structured entry. **No integrations** (manual entry). | JS-only | — (works on today's substrate) |
| **P1 — Anticipation + Modes** ✅ **shipped** | Forward-time engine (`GozlinAnticipationEngine`): Twin + **health profile** (pregnancy/injury/meds/conditions + free-text facts told to Gozlin) + Life Context + weather → ranked time-aware coaching + computed `CoachingMode`. Surfaced on the Life screen with the "add the date" loop. *(Auto plan-mutation from mode = follow-up.)* | JS-only | P0 |
| **P2 — Proactive delivery** ✅ **shipped** | `NotificationPort` + `ExpoNotificationAdapter` + Orchestrator (budget, quiet hours) + pushed daily briefing + anticipation alerts. | **expo-notifications + EAS dev build** | P1, M3 |
| **P3 — Calendar + Weather** ✅ **shipped** | `CalendarSource` (busy-day + travel proposals), `WeatherSource` (rain→indoor). First real external loop — the demo moments. | **expo-calendar** | P1, M3 |
| **P4 — Wearable + Recovery** ✅ **shipped** | `WearableSource` → real HRV/sleep/steps into `GozlinRecoveryEngine`; late-night/stress anticipations. Native HealthKit/Health Connect provider is the registered seam. | **health SDK (largest lift)** | P1, M3 |
| **P5 — Multimodal logging** 🟡 **to the M4 boundary** | Photo meal analysis (`/v1/log/photo` + picker + confirm card); voice (STT → chat/log-extract). Capture+draft cores + consent-gated seams shipped; commit rides M4. | **image-picker + STT** | M4 |
| **P6 — Long-horizon storytelling** ✅ **shipped** | `story/` engine + yearly/anniversary/5-year recaps + documentaries; anniversary anticipations. | JS-only | P0, P1 |

```
P0 ──► P1 ──► P2
           ├─► P3
           ├─► P4
           └─► P6
P5 ──► (depends on M4 conversation-logging)
Privacy: new consent category lands WITH each of P2/P3/P4/P5.
Plugin contract: formalize once 3+ modules exist (≈ after P3).
```

**The native cutover is the real cost.** P0/P1/P6 are pure JS and ship through the
current pipeline. **P2 onward requires leaving Expo Go for an EAS dev/prod build** with
config plugins (notifications, calendar, health, image-picker). That cutover — not the
engine work — is the schedule risk; call it out as its own milestone.

---

## 8. Testing & deployment

- **Testing** (same discipline — vitest, pure engines, injected `now`, golden fixtures):
  Life Context expiry **property tests**; Anticipation **determinism snapshots**;
  Orchestrator budget/quiet-hours tests; Signal-adapter **contract tests** against mocked
  OS APIs; photo/voice extraction unit tests + idempotent-commit property test; the M3
  privacy-boundary suite **extended per new consent category** (integration OFF → zero
  native reads, zero network).
- **Deployment**: server gains three Haiku-locked endpoints (key stays server-side). The
  **app's native build cutover (P2)** is the deployment inflection — config-plugin EAS
  builds replace Expo Go. Stage it: ship P0/P1 in the current channel to validate the
  forward-time model with users *before* paying the native-build cost.

---

## 9. First slice recommendation

Build **P0 — Life Context** first. It is the spine every anticipatory feature hangs on,
it ships standalone value immediately (countdowns, goal-timeline awareness, "what's
coming up"), it is pure JS / offline / deterministic (no native cutover, no new consent),
and it de-risks the whole phase by proving the forward-time model before we spend on
senses and reach.

> **Build log — P0 shipped.** `health-os/lifecontext/` (`lifecontext.types.ts` pure
> helpers + `LifeContextRepository` with lifecycle/expiry/`life.*` Timeline audit events),
> `life.added`/`life.resolved` added to the Timeline catalog, `K.LIFECONTEXT` key, barrel
> export, `expireDue()` swept at boot + day-rollover in `AppContext`, `useLifeContext`
> bridge hook + `app/life.tsx` ("What's coming up") + route + Profile entry button, Memory
> Center renders the new events. Vitest: 14 lifecontext tests (pure helpers + lifecycle +
> expiry sweep + idempotent import). `tsc`/`eslint`/`vitest` clean.

> **Build log — P1 shipped.** `services/gozlin/GozlinAnticipationEngine.ts` (pure):
> `buildAnticipations({ twin, bio, lifeEvents, healthConstraints, weather, weatherHint })`
> → `{ mode, modeLabel, modeReason, anticipations[] }`. `CoachingMode` (prenatal/medical/
> recovery/event_taper/travel/exam/work_pressure/maintenance/normal) derived by safety
> priority. **Health-profile coverage**: pregnancy (trimester guidance + due-date
> countdown), postpartum, injuries ("it's been N weeks…" via a linked recovery date),
> medications (category-aware + course-end countdown), other conditions (hypertension/
> diabetes/renal), AND free-text health facts the user told Gozlin (L3 `constraints`).
> Forward Life-Context events are kind-templated with proximity-weighted priority; weather
> + red-recovery add context beats. CTAs run an "add the date" loop that creates the dated
> Life Context entry so next time it's time-aware. Surfaced via `useAnticipation` +
> mode banner + cards on `app/life.tsx`. Vitest: 16 tests. tsc/eslint/vitest clean (98 total).
>
> **Build log — P3 Signals (calendar + weather) started.** `health-os/signals/` with pure,
> tested cores (`calendar/classify.ts` → calendar event ⇒ Life Context proposal;
> `weather/openmeteo.ts` → Open-Meteo forecast + indoor/outdoor hint) and lazy, graceful
> native adapters (`CalendarSource` over `expo-calendar`, `WeatherSource` over
> `expo-location` + Open-Meteo). **Requires a dev build** (Expo Go cannot grant
> calendar/location permission reliably) — see §7 note.

> **Build log — Privacy/consent foundation shipped.** `health-os/privacy/` (the
> companion-phase subset of M3): `consent.ts` (pure — per-integration `ConsentCategory`:
> calendar / location_weather / wearable / health_records / photo / voice /
> proactive_notifications, plus core ai_cloud + declared-future) + `ConsentRepository`
> (storage-backed, forward-compat `reconcile`, `local_processing` always-on). Every Signal
> adapter now **structurally consent-gates** its native reads (`CalendarSource`,
> `WeatherSource` short-circuit before touching the OS). `app/privacy.tsx` "What Gozlin
> watches" surface (`useConsent`) — grouped toggles + live "connected now" rows + revoke,
> reached from the Life header. Vitest: 10 consent tests.

> **Build log — P3 completed.** `SignalsCoordinator` (consent + permission gated boot /
> day-rollover sync, swept alongside `lifeContext.expireDue()` in AppContext) + `watching()`
> rows for the privacy surface; `useSignals` grants consent before the OS prompt
> (connecting = consenting). Vitest: +3 coordinator tests.

> **Build log — P2 Proactive delivery shipped.** `health-os/notifications/`:
> `NotificationPort` + lazy `ExpoNotificationAdapter` (`expo-notifications`, degrades to
> `unavailable` off the dev build — **no push server for v1**), a PURE attention-budget
> `orchestrator` (quiet hours w/ midnight wrap, daily budget, per-category cadence,
> priority preemption, send-once de-dupe, ledger prune), and `NotificationScheduler`
> (consent + permission gated; prefs/ledger persistence). `services/gozlin/
> GozlinNotificationPlanner` maps briefing + anticipations + a ready story → candidates
> (kept out of health-os per the dependency rule). Wired via a headless
> `ProactiveDeliveryRunner` (lays down the daily plan on open) + controls on `app/privacy.tsx`
> (enable/disable, quiet hours, daily budget). `expo-notifications` added to package.json.
> Vitest: 13 tests (orchestrator policy + scheduler gating).

> **Build log — P4 Wearable + Recovery shipped.** `health-os/signals/wearable/`: pure core
> (`WearableSnapshot` + `recoveryAdjustment` folding sleep / HRV-vs-baseline / resting-HR,
> `wearableHints`, `wearableBasis`) + `WearableSource` (consent-gated, cached, a
> `WearableProvider` seam where HealthKit / Health Connect plugs in — the big native lift —
> plus a `manual` ingest path so it delivers value before that). `GozlinRecoveryEngine`
> now folds the wearable adjustment (score + drivers + `basis` go REAL); threaded through
> `GozlinSnapshotInput` → `buildTwin` and loaded in `useGozlinSnapshot`, so real recovery
> propagates everywhere. Sleep-debt + strain anticipations added to `GozlinAnticipationEngine`
> (the score-based recovery beat suppressed when a wearable beat already explains it).
> Vitest: 10 tests.

> **Build log — P6 Long-horizon storytelling shipped.** `services/StoryService.ts` (pure,
> extends the MonthlyRecapService discipline — deterministic, emoji-contained, archived):
> `aggregate` over any date range → year / anniversary / five-year / journey-documentary
> `StoryArtifact`s + `buildDueStories` (what's ready today) + archive (`K.STORY_ARCHIVE`).
> `ensureJourneyAnniversary` stamps the next anniversary as a forward Life Context entry, so
> it flows through anticipation → notifications. AppContext generates/archives due stories +
> stamps the anniversary on load; `app/story/[id].tsx` renders an artifact (deep-linkable
> `/story/<id>` from a story notification). Vitest: 9 tests.

> **Build log — P5 Multimodal (capture + draft cores) shipped to the M4 boundary.**
> `health-os/multimodal/`: pure `photo.ts` (`draftsFromAnalysis` → deterministic, validated
> meal `LogDraft`s, idempotent ids; totals; edit; auto-check threshold) + `voice.ts`
> (transcript clean + log-vs-question routing) + consent-gated, provider-seam adapters
> (`MealPhotoSource` over an image-picker + vision-analyzer seam; `SpeechSource` over an STT
> seam — both null by default, real providers are the EAS/M4 cutover). The **commit** step
> (drafts → live nutrition state + Timeline) is owned by M4 conversation-logging; everything
> up to the confirmed draft is ready. Vitest: 10 tests.

> **Build log — Plugin contract formalized.** `health-os/modules/`: the `HealthModule`
> contract (id / eventTypes / consent / signalSources / producesNotifications) + a
> `HealthModuleRegistry` (aggregate event types, consent categories, senses + live
> `statuses()`) + `builtins` registering the five shipped companion modules (lifecontext,
> signals, notifications, story, multimodal) — the composition root, the one place that knows
> the concrete sources. A future module is one `register(...)` call. Vitest: 4 tests.
>
> **Phase Three status: P0–P6 all shipped** (P5 to the M4 boundary). Whole-project `tsc` +
> `eslint` clean; vitest 157 green. Remaining real-world work is the native cutover (§7):
> EAS dev build + config plugins (notifications/calendar/location installed; HealthKit /
> Health Connect, image-picker, STT providers to register) and the M4 commit path for P5.
