# 10 — UI Flow Diagrams

ASCII flow diagrams for the net-new surfaces. They show the *paths*, the
decision points, and which layer/repository each step touches — a bridge between the
architecture and the screens. Existing screens (tabs, onboarding, guided session) are
unchanged and omitted.

## 1. App boot (with migrations)

```
 app launch
     │
     ▼
 AppProvider mounts ──► loadData()  [contexts/AppContext.tsx:1183]
     │
     ▼
 runMigrations(store)               ◄── version-gated; first boot only does work
     │   ├─ 001 backfill Timeline from 6 silos (idempotent, originals kept)
     │   ├─ 002 seed DaySummaries
     │   └─ 003 extract Preferences/ProfileMeta/Consent defaults
     ▼
 read records (bio/goals/prefs/plan) ──► hydrate domain contexts
     │
     ▼
 day-change? ──yes──► processDayEnd(lastDate) ──► compactDay(lastDate) [L2]
     │ no
     ▼
 consent decided? ──no──► show Consent sheet (§5)
     │ yes
     ▼
 app ready
```

## 2. Memory Center — browse / edit / delete

```
 Profile ──"What I remember"──►  MEMORY CENTER
                                     │
   ┌─────────────────────────────────┼───────────────────────────────────┐
   ▼                ▼                ▼                ▼                    ▼
 About you      Preferences      Timeline        Milestones          Conversations
 (L3+Profile)   (Prefs rec)      (L1 events)     (L3 episodic)        (L4)
   │                                │
   │ tap a fact                     │ tap an event
   ▼                                ▼
 edit fact ──► record overwrite   ┌─────────────────────────────┐
   + profile.updated event        │ event detail                │
                                   │  • plain-language + macros  │
                                   │  • provenance badge         │
                                   │  • tags                     │
                                   │  [ Correct ] [ Redact ] [⋯] │
                                   └─────────────────────────────┘
                                       │           │         │
                              correct ▼     redact ▼   erase ▼ (confirm)
                       append superseding   set          eraseHard()
                       event (source:user)  redacted=true (permanent)
                              │                  │              │
                              └──────────────────┴──────────────┘
                                          │
                                          ▼
                              recompactDay(date)  ── summaries + stats update
```

## 3. Conversation-first logging

```
 user types in Gozlin chat: "had eggs & toast, ran 5k"
     │
     ▼
 EXTRACT
   ├─ Tier 1 deterministic (MealLibrary / EXERCISE_DATABASE)  ── always, offline
   └─ Tier 2 LLM /v1/log/extract  ── only if ai_cloud consent + gaps remain
     │
     ▼ LogDraft[]
 RESOLVE (enrich macros, validate zod, flag needs[])
     │
     ▼
 CONFIRM card in chat
   ┌─────────────────────────────────────┐
   │ Want me to log these?               │
   │ ☑ Eggs & toast   ~320 kcal          │
   │ ☑ Run · 5.0 km   ~30 min            │
   │ ☐ Weight 78 kg   (low confidence)   │
   │        [ Adjust ]     [ Log 2 ]     │
   └─────────────────────────────────────┘
     │ user adjusts? ──► per-draft editor ──┐
     │ user taps Log                         │
     ▼                                       │
 COMMIT  appendMany(events, id=ulidFromSeed(draftId))  ◄── idempotent
     │
     ▼
 recompactDay(today) ──► rings/protein/streak update + Gozlin acknowledges
```

## 4. Progressive profile — unlock loop

```
 Profile screen
     │
     ▼
 ProfileCompletenessCard
   ┌────────────────────────────────────────┐
   │   ◐ 64%   Personalized                   │
   │   Next: Add your goal weight             │
   │   → unlock your Transformation Forecast  │
   │                      [ Add it ]          │
   └────────────────────────────────────────┘
     │ tap
     ▼
 relevant editor (Goals/Profile/Prefs)
     │ save
     ▼
 ProfileRepository.update(patch)
   ├─ record write + change event (L1)
   ├─ recompute ProfileCompleteness (signals registry)
   └─ new unlock? ──yes──► "Unlocked: Transformation Forecast" beat (low-intensity)
     │
     ▼
 the unlocked feature is now live (e.g. Forecast card renders)
```

Dimmed-feature path:

```
 user opens Forecast with no target weight
     ▼
 Forecast card shows inline unlock: "Set a goal weight to see your timeline"
     ▼ tap ──► goal-weight editor ──► (same update loop above)
```

## 5. Consent flow

```
 first run after onboarding (or policy version bump)
     ▼
 ┌──────────────────────────────────────────────┐
 │  Your data stays on your phone.               │
 │  Welliva works fully offline.                 │
 │                                               │
 │  Use AI in the cloud for richer coaching?     │
 │  Gozlin only sends a short summary —          │
 │  never your full history.        [ ⃝ off ]    │
 │                                               │
 │  [ Maybe later ]        [ Continue ]          │
 └──────────────────────────────────────────────┘
     │
     ▼ persist ConsentRecord { version, decisions, at }
     │
     ├─ ai_cloud ON  ──► AI features call the backend via withAiConsent(minimize)
     └─ ai_cloud OFF ──► AI features use deterministic local engines (full function)

 Settings → Privacy (anytime): same toggles + Export + Erase + link to Memory Center
```

## 6. Erase-everything flow

```
 Settings → Privacy → "Delete all my data"
     ▼
 confirm 1: "This permanently deletes everything Welliva remembers."
     ▼
 confirm 2 (type/hold): irreversible
     ▼
 eraseAll() = eraseHard(timeline) + clear summaries + clearGozlinMemory()
              + clear records + reset schema baseline
     ▼
 app returns to clean first-run state (re-onboard)
```

## 7. Screen inventory (net-new)

| Screen / surface | Route | Notes |
|---|---|---|
| Memory Center | `app/memory-center.tsx` | Stack route; tabs per category |
| Event detail / correct | modal within Memory Center | correction-by-append UI |
| Consent sheet | `components/ConsentSheet.tsx` | first-run + policy-bump |
| Privacy settings | section in `app/settings.tsx` | toggles + export + erase |
| Profile completeness | `components/ProfileCompletenessCard.tsx` | on Profile tab |
| Log-confirm card | `__kind: "log-confirm"` renderer in `components/gozlin/renderers/` | in chat |

All reuse `components/ui/*`; no new design-system primitives required.
