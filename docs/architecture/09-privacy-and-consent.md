# 09 — Privacy & Consent

Privacy is an architectural property here, not a settings screen. The local-first
choice already gives the strongest default: **the raw data never leaves the device.**
This document defines the consent model, the AI data boundary, at-rest encryption, and
export/erase — the controls that make that default explicit and user-governed.

## 1. Data classes

| Class | Examples | Default location | Leaves device? |
|---|---|---|---|
| **Sensitive health** | conditions, injuries, meds, pregnancy, weight, mood/stress | device, encrypted at rest (§4) | only as *minimized* context, only with consent |
| **Activity** | meals, workouts, water, check-in counts | device | only summarized, with consent |
| **Identity/Prefs** | motivation, cuisine, region | device | minimized, with consent |
| **Derived** | summaries, scores, insights | device | the summarized context the AI reads |
| **Raw Timeline (L1)** | every event | device | **never** |

The hard rule: **L1 never crosses the network.** Only the bounded, minimized
**Context** does ([05 §B](./05-api-and-contracts.md)).

## 2. Consent model

```ts
// health-os/privacy/consent.ts
export type ConsentCategory =
  | "local_processing"   // on-device compute (always required to use the app)
  | "ai_cloud"           // send MINIMIZED context to the Claude-Haiku backend
  | "cloud_backup"       // FUTURE: encrypted backup/sync (not built)
  | "crash_diagnostics"; // FUTURE: none collected today

export interface ConsentRecord {
  version: number;                    // bumped when the policy text changes → re-consent
  decisions: Record<ConsentCategory, { granted: boolean; at: string }>;
  updatedAt: string;
}
```

- **`local_processing`** is the baseline (the app is useless without on-device
  compute); it is explained, not optional.
- **`ai_cloud`** is **opt-in**. With it off — or `EXPO_PUBLIC_API_URL` unset — every
  AI feature falls back to the deterministic local engines (the discipline `PlanSync`
  already enforces). The app is fully functional with zero network.
- **`cloud_backup`** and **`crash_diagnostics`** are declared but **not implemented**
  (no backup, no telemetry exists). They are in the model so the consent UI is
  honest and future-proof.
- **Versioned:** if the privacy policy materially changes, bump `version` → the user
  re-confirms. `decisions` are timestamped for an auditable trail.

### Consent flow

- **First run / post-onboarding:** a calm, plain-language consent sheet — *"Welliva
  works entirely on your phone. Want Gozlin to also use AI in the cloud for richer
  chat? It only ever sees a short summary, never your full history."* — with a clear
  default-off toggle for `ai_cloud`. Not a wall of legalese; one screen, real choices.
- **Anytime:** Settings → Privacy mirrors the same toggles + links to the Memory
  Center ([08](./08-memory-center.md)) and export/erase.

## 3. The AI data boundary (enforced in code)

Every outbound call passes through one gate — there is no other path to the network:

```ts
// health-os/privacy/boundary.ts
export async function withAiConsent<T>(fn: (ctx: MinimizedContext) => Promise<T>,
                                       ctx: HealthContext): Promise<T | null> {
  if (!(await isGranted("ai_cloud"))) return null;     // → caller uses local engine
  return fn(minimize(ctx));                            // only minimized context crosses
}
```

`minimize(ctx)` is the **data-minimization** step:
- drops direct identifiers and free-text the feature doesn't need,
- coarsens sensitive specifics not required for the task (e.g. send "training 4×/week,
  fat-loss goal", not a medication list, unless the feature is specifically a safety
  check),
- caps `recent.days` (already bounded by the Context contract).

`WellivaApi` methods are only ever called from inside `withAiConsent`. A lint rule
(`no-restricted-imports` on `services/api` outside `health-os/insights/provider` +
`privacy/boundary`) keeps it that way. Result: **it is structurally impossible to send
raw events or to send anything without consent.**

> The server already never persists user data and is model-locked to Haiku
> (`server/src/config.ts`). The boundary closes the loop on the client side.

## 4. At-rest encryption (secure local caching)

AsyncStorage is plaintext on disk. For **sensitive health** data we add an encrypted
adapter behind the storage port ([02 §1](./02-data-and-schema.md)):

```
EncryptedAdapter
  ├─ a random data key is generated once, stored in expo-secure-store
  │   (Keychain / Keystore — hardware-backed where available)
  ├─ values are AES-encrypted with that key before AsyncStorage.set
  └─ transparent decrypt on get
```

- **Why not put everything in secure-store directly?** Keychain/Keystore have small
  size limits and are slow for large blobs. The standard pattern — *key in secure
  store, encrypted blob in normal storage* — gives device-bound encryption at scale.
- **Scope:** applied to the sensitive-health keys (profile health fields, L3 identity,
  check-ins, body/weight events). Activity events can stay plaintext for performance,
  or the whole store can be encrypted if the user enables a "lock my data" option —
  the adapter makes it a per-key policy, not an all-or-nothing rewrite.
- **Drop-in:** because it's an adapter behind the port, enabling it changes no domain
  code.

## 5. Export & erase (the user's exit rights)

| Right | Mechanism | Where |
|---|---|---|
| **Export** | `buildExportBundle()` → JSON + Markdown → OS share sheet | [08 §5](./08-memory-center.md) |
| **Erase a single item** | redact / `eraseHard` one event or fact | Memory Center |
| **Erase a category** | `eraseHard(byType)` + clear the relevant L3 store | Privacy settings |
| **Erase a date range** | `eraseHard(byDateRange)` + recompact | Memory Center timeline |
| **Erase everything** | `eraseAll()` = Timeline + summaries + L3 (`clearGozlinMemory`) + records + reset `schema_version` baseline | Privacy → "Delete all my data" (double-confirm) |

`eraseAll` leaves the app in a clean first-run state (re-onboard), proving the
"forget me" promise is total, not cosmetic.

## 6. Privacy invariants (testable — see [11](./11-testing-strategy.md))

1. With `ai_cloud` denied, **no `fetch` to the backend occurs** for any AI feature
   (network spy asserts zero calls; features still produce output via local engines).
2. The outbound request body for any AI call contains **no raw `HealthEvent`** and no
   field outside `MinimizedContext`'s allowlist (snapshot test on the serialized body).
3. `redacted`/erased data appears in **no** read, summary, export, or AI context.
4. Erasing everything returns `schema_version`/records to a clean baseline and leaves
   zero `@welliva_*` / `@gozlin_*` keys with user data.
5. Sensitive-health keys are unreadable as plaintext on disk when encryption is on
   (the value at the AsyncStorage key is ciphertext).

## 7. What we deliberately do NOT do

- No third-party analytics/ad SDKs; none exist in the app and none are added.
- No server-side storage of user health data (the server is stateless).
- No background upload. The only network egress is a user-initiated AI feature, gated
  by consent, carrying minimized context.
