# Welliva Backend API — contract & operations

The backend holds the Anthropic key and runs **all** AI work (diet generation,
workout generation, the Gozlin coach, food parsing). The app never calls
Anthropic directly and never embeds a provider key.

> **Status: the backend source lives outside this repository** (`/backend-welliva`,
> deployed to Render). That is a diligence finding in its own right — the plan to
> resolve it is **[backend-in-repo.md](./backend-in-repo.md)**, a step-by-step
> runbook with a blocking secret-scan pre-flight and a sequenced deploy cutover.
>
> This document is the contract as consumed by
> [`services/api/WellivaApi.ts`](../../services/api/WellivaApi.ts); it is
> authoritative for the **client** side and should be reconciled against the
> server on the first commit that brings it in.

---

## Auth model

Every `/v1/*` endpoint requires the signed-in user's **Supabase access token**:

```
Authorization: Bearer <supabase access_token>
```

- The token is fetched via `supabase.auth.getSession()`, which auto-refreshes
  when near expiry.
- On `401`, the client forces one `refreshSession()` and retries **once**. A
  second `401` surfaces as an error.
- There is no anonymous access. Calls made while signed out throw before any
  network request. This is intentional: it means rate limits and cost are always
  attributable to an account.

Callers (`PlanSync`, `RemoteGozlinProvider`) catch every failure and fall back to
the on-device deterministic engines, so a backend outage degrades the product
rather than breaking it.

---

## Endpoints

Base URL comes from `EXPO_PUBLIC_API_URL`. See
[`services/api/config.ts`](../../services/api/config.ts) for the fail-closed
rules (a non-HTTPS or private-host URL is treated as "not configured" in release
builds, so a stray LAN IP can never ship).

| Method | Path | Purpose | Client timeout |
| --- | --- | --- | --- |
| `GET`  | `/health` | Liveness + version. Used by the warm-up ping. | 45s |
| `POST` | `/v1/diet/generate` | Generate a day's meal schedule | 30s |
| `POST` | `/v1/workout/generate` | Generate a workout plan | 30s |
| `POST` | `/v1/coach/chat` | Single-shot coach reply | 20s |
| `POST` | `/v1/coach/turn` | **Streaming** agent turn (NDJSON) | 60s |
| `POST` | `/v1/nutrition/parse` | Parse free text → `{quantity, unit, food}` | 12s |

Default timeout for any unspecified call is **60s** (`DEFAULT_TIMEOUT_MS`).

### `GET /health`

Returns `200` with a small JSON body. Must be **unauthenticated** and must not
touch Anthropic — it exists to wake the instance and to back an uptime monitor.

```json
{ "ok": true, "version": "2026.07.1", "model": "claude-haiku-4-5-20251001" }
```

### `POST /v1/diet/generate` → `DietGenerateResponse`

```jsonc
// response
{
  "schedule": { /* DaySchedule — models/diet.ts */ },
  "dailyNutritionEstimate": { "calories": 0, "proteinG": 0, "carbsG": 0, "fatG": 0 },
  "dietName": "string",
  "rationale": "string",
  "coachNote": "string",
  "model": "claude-haiku-…",
  "source": "ai"
}
```

### `POST /v1/workout/generate` → `WorkoutGenerateResponse`

```jsonc
{
  "plan": { /* GeneratedWorkoutPlan — models/workout.ts */ },
  "rationale": "string",
  "coachNote": "string",
  "model": "claude-haiku-…",
  "source": "ai"
}
```

### `POST /v1/coach/chat` → `CoachChatResponse`

```jsonc
{ "reply": "string", "model": "claude-haiku-…" }
```

### `POST /v1/coach/turn` → NDJSON stream

One JSON object per line. The terminal `done` frame carries the **full** content
array (text + thinking + `tool_use` blocks), because the agent loop must echo
those back verbatim on its next iteration. Requires `expo/fetch` on the client —
React Native's global `fetch` polyfill exposes no `response.body`.

### `POST /v1/nutrition/parse` → `ParseFoodResponse`

```jsonc
{ "items": [{ "quantity": 1, "unit": "cup", "food": "rice" }], "model": "…" }
```

Deliberately carries **no nutrition fields**. The model is used as a parser only;
all numbers are resolved on-device from the cited reference table. See
[`services/gozlin/GozlinFoodAnalyst.ts`](../../services/gozlin/GozlinFoodAnalyst.ts)
for why this boundary matters — it is what keeps calorie figures attributable to
a reference rather than to a model's guess.

### Errors

Non-2xx responses should carry:

```jsonc
{ "error": { "message": "human-readable" } }
```

The client surfaces `error.message` when present and falls back to
`API error <status>` otherwise.

---

## Operations

### Cold start — the one that bites

The current Render tier spins down after inactivity; waking takes **30–50s**.
The client timeout was 30s, so the first AI call of a session raced the wake-up
and usually lost.

Two mitigations are implemented on the client:

1. **Warm on foreground** — [`services/api/warmup.ts`](../../services/api/warmup.ts)
   pings `/health` when the app becomes active, deduped by an in-flight promise
   and a 10-minute TTL. Also primes the connection on a paid tier, improving p50.
2. **Timeout raised to 60s** with fallback intact.

**Neither closes the window.** A user who opens the app and taps straight into
the coach can still beat the wake. The durable fix is an **always-on tier
(~$7/mo)**. Do not engineer around $7 — especially once the coach becomes the
product's differentiator, at which point a cold start is a first-use failure
every session.

### Minimum operational surface

Before the Gozlin rework ships, the backend needs:

- [ ] `GET /health` returning 200 + version, wired to an uptime monitor
      (UptimeRobot's free tier is sufficient).
- [ ] **Structured request logging**: user id, endpoint, model, input/output
      tokens, latency, outcome.
- [ ] **A cost dashboard**: token spend per day and per active user. This becomes
      a real line item; it needs to be visible from day one, not after the first
      surprise bill.
- [ ] **A key-rotation runbook**: one page on rotating the Anthropic key without
      downtime.

### Rate limits

Per-user limits are enforced server-side on `/v1`, keyed by the Supabase user id
from the JWT. Document the exact numbers here once confirmed against the server.

---

## Bringing the backend in-repo

`/backend-welliva` is not in this repository and holds both the Anthropic key and
the Supabase `service_role` key. In diligence this reads as an unreviewed
dependency on the critical path — the AI *is* the product's differentiator.

**The full plan lives in [backend-in-repo.md](./backend-in-repo.md).** In short:
land it as `server/` (the name `docs/architecture/05-api-and-contracts.md`
already uses), as a plain subdirectory rather than an npm workspace — the Expo
app is the root package, so hoisting server deps into the tree Metro resolves
from buys a new class of EAS-only bug for very little gain. Then add a `server`
job to [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) and require
it on `main`.

Two things in that runbook are easy to get wrong and expensive to get wrong:
scan the backend's git history for committed secrets **before** importing it, and
create a *new* Render service pointed at `server/` rather than repointing the
existing one, so rollback stays a one-line `eas.json` revert.
