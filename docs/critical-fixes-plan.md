# Welliva — Critical Fixes Implementation Plan

Execution plan for an engineering agent to close the four **Critical** audit findings.
Each phase is independently shippable, ordered so nothing unsafe goes out first.
Keep the house rules: **offline-first, fail-soft, device is the source of truth, no
new native modules, `tsc` clean, all 328 tests stay green + add new ones.**

Findings addressed:
1. Cloud sync is profile-only — all logged data is device-local.
2. Gozlin "learning" memory is device-local — resets on device change.
3. The AI backend isn't reachable by real users (LAN IP over HTTP).
4. One device shared by two accounts leaks data + contaminates cloud rows.

---

## The one architectural decision (read first)

The local state is **~46 heterogeneous AsyncStorage keys** (`@welliva_*`, `@gozlin_*`),
and **most have no matching normalized table**. The 10 sync-ready tables in the schema
store per-row records (e.g. `nutrition_logs` = one row per meal), but the app stores
**day-aggregates and app-specific blobs** (`@welliva_nutrition_history`,
`@welliva_plan_state`, `@welliva_meal_plan_periods`, `@welliva_body_logs`, habits,
Gozlin's 4 memory tiers, …). Building ~46 shape adapters onto those tables is large,
brittle, and pointless when the device is the source of truth.

**Decision: sync via a generic per-user document mirror — one KV table,
`sync_documents(user_id, doc_key, doc jsonb, updated_at, deleted_at)`.**
This is exactly how `ProfileSync` already mirrors `bio`/`goals`, so it's consistent
with the codebase. It covers 100% of local state with one code path and delivers the
"continue on any device" promise fastest.

- **Keep** writing the typed `users` columns (`ProfileSync.bioToColumns`) for
  SQL/analytics — that need is already met.
- The 10 normalized tables stay in the schema; migrate the few that genuinely need
  server-side querying later. They are **not** required to solve findings 1/2/4.

Findings **1 and 2 are the same engine** — Gozlin's `@gozlin_*` keys are just entries
in the synced-key allowlist.

---

## Phase 0 — Schema + types (prereq for Phases 1–2)

**New migration** `supabase/migrations/20260724120000_sync_documents.sql`:

```sql
-- Per-user document mirror: the durable cloud copy of each AsyncStorage namespace.
-- Same owner-scoped RLS + server-stamped updated_at discipline as every other table.
CREATE TABLE IF NOT EXISTS public.sync_documents (
    user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doc_key    TEXT        NOT NULL,                 -- e.g. '@welliva_nutrition_history'
    doc        JSONB,                                -- the value; NULL when tombstoned
    device_id  TEXT,                                 -- last writer (debugging only)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- server-stamped by trigger
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, doc_key)
);

ALTER TABLE public.sync_documents ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='sync_documents'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.sync_documents;', r.policyname); END LOOP;
END $$;
CREATE POLICY own_select ON public.sync_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_insert ON public.sync_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_update ON public.sync_documents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_delete ON public.sync_documents FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.sync_documents;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sync_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();  -- reuse existing fn

CREATE INDEX IF NOT EXISTS idx_sync_documents_pull
  ON public.sync_documents(user_id, updated_at);            -- the delta-pull query
```

**Steps**
1. Add the migration file above.
2. `supabase db push` (see `supabase/README.md` runbook).
3. Regenerate types: `supabase gen types typescript --linked > lib/database.types.ts`
   (adds `sync_documents` to `Database`). Confirm `tsc --noEmit` passes.

**Done when:** migration applied, `Tables<'sync_documents'>` exists in types.

---

## Phase 1 — Per-user isolation (do this BEFORE sync) — fixes #4

Ship first: it's a privacy fix, and it must land before the sync engine so we never
upload one account's leftover data into another's cloud row.

**1.1 — Declare which keys are synced vs device-local.**
New file `services/sync/syncKeys.ts`:

```ts
// Keys whose value is USER data that must follow the account across devices.
export const SYNCED_KEYS = [
  '@welliva_user_bio', '@welliva_user_goals', '@welliva_plan_state',
  '@welliva_today_nutrition', '@welliva_nutrition_history', '@welliva_water_history',
  '@welliva_water_today', '@welliva_workout_plan', '@welliva_workout_logs',
  '@welliva_workout_log', '@welliva_exercise_history', '@welliva_session_history',
  '@welliva_body_logs', '@welliva_diet_history', '@welliva_scheduled_diets',
  '@welliva_week_schedules', '@welliva_meal_plan_periods', '@welliva_custom_menus',
  '@welliva_saved_meals', '@welliva_period_reports', '@welliva_food_log',
  '@welliva_tracking_mode', '@welliva_custom_targets', '@welliva_achievements',
  '@welliva_streak_data', '@welliva_challenges', '@welliva_journey',
  '@welliva_tournament', '@welliva_recap_seen', '@welliva_habits',
  '@welliva_habits_seeded', '@welliva_habit_logs', '@welliva_onboarding_done',
  // Gozlin memory (finding #2):
  '@gozlin_identity', '@gozlin_episodic', '@gozlin_behavioral',
  '@gozlin_conversation', '@gozlin_checkins',
  '@gozlin_last_briefing', '@gozlin_last_weekly_review',
] as const;

// Device-scoped state that must NOT sync (clocks, caches, in-flight session, prefs).
export const DEVICE_LOCAL_KEYS = [
  '@welliva_last_active_date', '@welliva_last_checked_date', '@welliva_active_session',
  '@welliva_profile_synced_at', '@welliva_sync_telemetry', '@gozlin_forecast_cache',
  'themeMode',
] as const;

// Everything app-owned — the set to purge on a user switch (Phase 1.2).
export const ALL_APP_KEYS = [...SYNCED_KEYS, ...DEVICE_LOCAL_KEYS,
  '@welliva_sync_watermarks', '@welliva_sync_outbox', '@welliva_active_user_id'] as const;
```
> Verify this list against `KEYS`/`G_KEYS` before coding — grep `@welliva_` / `@gozlin_`.

**1.2 — Purge on user switch.** New `services/sync/UserScope.ts`:
```ts
// Returns true if it purged (i.e. a different or first user for this device).
export async function ensureDeviceOwnedBy(userId: string): Promise<boolean>
```
Reads `@welliva_active_user_id`. If it differs from `userId`, `AsyncStorage.multiRemove(ALL_APP_KEYS)`,
then write the new id and return `true`. If equal, return `false` (same user, keep local).

**1.3 — Call it in the login reconcile.** In `contexts/AppContext.tsx` (the effect at
`~L1167`, keyed on `user`), **before** `pullProfile`:
```ts
const purged = await ensureDeviceOwnedBy(user.id);
if (purged) { /* clear in-memory state so a signed-out user's data isn't shown */ }
```
When `purged`, reset the React state slices (bio/goals/logs/etc.) to defaults so the
previous user's data doesn't linger in memory until restart. Extract the existing
initial-state defaults into reusable consts to reuse here.

**1.4 — Kill the cross-account push bug directly.** In the same effect, the current
`else if (localBio) pushProfile(...)` path can upload user A's bio into user B's row.
Guard it: only push local when `!purged` (we didn't just wipe for a new user). After a
purge, `localBio` is null anyway, but assert it.

**1.5 — Purge on explicit sign-out (privacy on shared devices).** In
`components/SupabaseAuthProvider.tsx` `signOut`, after `supabase.auth.signOut()`, call a
best-effort `multiRemove(ALL_APP_KEYS)`. Safe because the data is (after Phase 2) in the
cloud. Keep it in the existing `try/catch` so cleanup failure can't wedge sign-out.

**Tests** (`services/sync/__tests__/UserScope.test.ts`): same user → no purge;
different user → purge + new id written; first-ever user → purge no-op-safe.

**Done when:** signing in as B on A's device shows a clean slate, and B's cloud `users`
row never receives A's bio. (Full re-download of B's own data arrives in Phase 2.)

---

## Phase 2 — The sync engine — fixes #1 and #2

Built on `sync_documents`. Two directions, both fail-soft, both wrapped in the existing
`withSyncTelemetry` (see `services/sync/SyncTelemetry.ts`).

**2.1 — Transport.** New `services/sync/DocumentSync.ts`:
```ts
export interface RemoteDoc { key: string; doc: unknown | null; updatedAt: string; }

// Upsert one key's current local value. Returns server updated_at or null (fail-soft).
export async function pushDoc(userId: string, key: string, value: unknown | null): Promise<string | null>
// Delta pull: every doc changed since `sinceIso` (null = full pull). Ordered by updated_at.
export async function pullDocsSince(userId: string, sinceIso: string | null): Promise<RemoteDoc[]>
```
`pushDoc` upserts `{ user_id, doc_key: key, doc: value, deleted_at: value===null?now:null }`
on conflict `(user_id, doc_key)`, `.select('updated_at').single()`. Mirror ProfileSync's
error handling exactly.

**2.2 — Watermarks + outbox (both are just AsyncStorage).**
- `@welliva_sync_watermarks`: `Record<key, serverUpdatedAt>` — the last remote stamp we
  adopted per key. Drives LWW and the next delta pull's `since` (= max watermark).
- `@welliva_sync_outbox`: `string[]` of dirty keys awaiting push (survives restarts).

**2.3 — Auto-capture local writes (the elegant hook).** `OfflineStorage` is already the
single write path. Add an optional listener so it stays React-free:
```ts
// services/OfflineStorage.ts
let onWrite: ((key: string) => void) | null = null;
export function setWriteObserver(fn: ((key: string) => void) | null) { onWrite = fn; }
// inside writeJSON / writeString / remove, after a successful write:
onWrite?.(key);
```
`SyncEngine` registers an observer that, for a `SYNCED_KEYS` key, appends to the outbox
and schedules a debounced flush (~1.2s, matching the profile-push debounce). This means
**no call sites change** — every existing `writeJSON(KEYS.…)` becomes sync-aware for free.

**2.4 — SyncEngine orchestration.** New `services/sync/SyncEngine.ts`:
```ts
export async function reconcileOnLogin(userId: string): Promise<void>  // pull → merge → then drain
export async function flushOutbox(userId: string): Promise<void>       // push each dirty key, fail-soft
export function startAutoSync(userId: string): () => void              // observer + AppState listener; returns cleanup
```
- **reconcileOnLogin:** `pullDocsSince(userId, maxWatermark)`. For each `RemoteDoc`:
  adopt (write to AsyncStorage + set watermark) when it's a fresh device (no local value)
  **or** `doc.updatedAt > watermark[key]` and the key isn't currently dirty in the outbox.
  Otherwise keep local and enqueue a push. Then `flushOutbox`. **Adopted keys must
  refresh AppContext state** — after reconcile, re-run the same local-load path AppContext
  uses on boot (extract it into a `hydrateFromStorage()` you can call again), so the UI
  reflects downloaded data without a restart.
- **flushOutbox:** for each key, read current local value, `pushDoc`; on success remove
  from outbox + update watermark to the returned stamp. Leave failures in the outbox.
- **startAutoSync:** registers the write observer (2.3) and an `AppState` 'active'
  listener that calls `flushOutbox` on foreground (no netinfo dependency — offline pushes
  simply fail-soft and stay queued). Return a cleanup that unregisters both.

**2.5 — Wire into AppContext.**
- In the login effect (Phase 1.3), after `ensureDeviceOwnedBy` + `pullProfile`, call
  `await reconcileOnLogin(user.id)` and only then flip `isProfileReconciled` /
  `hydrateFromStorage()`. `AuthWrapper` already waits on `isProfileReconciled`, so the
  new-device download blocks routing to tabs until data lands — exactly the intended UX.
- Call `startAutoSync(user.id)` when signed in; return its cleanup when `user` clears.
- **Fold the existing `ProfileSync` into this path** (or leave it — bio/goals also flow
  through DocumentSync now). Recommended: keep `ProfileSync.pushProfile` ONLY for the
  typed analytics columns, and let DocumentSync own the round-trip blob, to avoid two
  writers racing on the same data. Pick one owner per key and document it.

**2.6 — Conflict policy (v1).** Per-key last-write-wins on server `updated_at`. Good
enough because the device is SSOT and one human rarely edits two phones in the same
second. Note the limitation in code. (Realtime live-propagation between two open devices
is a **follow-up**, not required here — add a Supabase Realtime subscription on
`sync_documents` later.)

**Tests** (`services/sync/__tests__/SyncEngine.test.ts`, mock `supabase` like the existing
sync tests):
- fresh device (empty watermarks) adopts all remote docs;
- local newer than remote → keeps local + enqueues push;
- remote newer → adopts + updates watermark;
- outbox survives a failed push and drains on retry;
- a `SYNCED_KEYS` write enqueues; a `DEVICE_LOCAL_KEYS` write does not.

**Done when:** log meals/workouts/water + chat with Gozlin on Phone A → sign in on Phone B
→ all history, streaks, achievements, habits, and Gozlin's memory are present.

---

## Phase 3 — Deploy the AI backend — fixes #3

The `/server` is production-quality (Haiku-locked, JWT-gated, rate-limited); it's just
pointed at `http://172.20.10.3` (a laptop on a hotspot). Make it a real HTTPS service.

**3.1 — Containerize.** Add `server/Dockerfile`:
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "dist/index.js"]
```
Build step runs `npm run build` (tsc → `dist/`) before packaging, or add a build stage.

**3.2 — Deploy** to a managed Node host (Fly.io / Render / Railway — any works). Set env
from `server/.env.example`: `ANTHROPIC_API_KEY` (real key, as a host secret — never
committed), `SUPABASE_URL` (must equal the app's `EXPO_PUBLIC_SUPABASE_URL` so the JWT
issuer check passes), `CLAUDE_MODEL=claude-haiku-4-5`, sensible `RATE_LIMIT_*`,
`CORS_ORIGIN=*` (native app sends no Origin; JWT is the real guard). Confirm boot with
`npm run verify:auth`. Note the resulting URL, e.g. `https://api.welliva.app`.

**3.3 — Point the build at HTTPS via EAS (not local `.env`).** `EXPO_PUBLIC_*` is inlined
at build time. Create `eas.json` with per-profile env, or use EAS env vars:
```json
{ "build": {
    "preview":    { "env": { "EXPO_PUBLIC_API_URL": "https://api.welliva.app" } },
    "production": { "env": { "EXPO_PUBLIC_API_URL": "https://api.welliva.app" } } } }
```
(Supabase URL + anon key likewise belong in EAS env for release builds.)

**3.4 — Fail-closed guard against shipping a bad URL.** In `services/api/config.ts`,
reject non-HTTPS / private hosts in production so a stray LAN IP can never go out:
```ts
const isHttps = /^https:\/\//i.test(raw ?? '');
const isPrivate = /(^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/i.test(raw ?? '');
export const isApiConfigured = Boolean(raw) && (__DEV__ || (isHttps && !isPrivate));
```
Now a misconfigured release quietly uses on-device engines instead of trying blocked
cleartext — and a correct release actually reaches Claude. (HTTPS also satisfies iOS ATS
/ Android cleartext policy with no extra config.)

**Done when:** a release/preview build reaches the deployed server (Gozlin replies come
from Haiku; diet/workout generation is AI-first), and killing the server degrades cleanly
to the deterministic engines.

---

## Phase 4 — Verify & roll out

1. `npm run test` (all green incl. new suites) and `npx tsc --noEmit` clean; same for `server/`.
2. **Device-swap matrix (manual):** (a) log data on A → fresh install on B, same account →
   everything downloads; (b) A signs out, B signs in on the same device → B sees a clean
   slate, then B's own cloud data downloads, and A's data never appears; (c) airplane mode →
   keep logging → back online → outbox drains, cloud matches.
3. Watch `SyncTelemetry` failure counters after rollout; they surface silent sync failures.

---

## Sequencing, ownership, cross-cutting

| Phase | Fixes | Depends on | Ship as |
|------|-------|-----------|---------|
| 0 Schema + types | prereq | — | 1 PR |
| 1 Per-user isolation | **#4** | 0 (types only) | 1 PR (ship first) |
| 2 Sync engine | **#1, #2** | 0, 1 | 1–2 PRs |
| 3 Backend deploy | **#3** | independent | 1 PR + infra |

**Hold the line:** every network call fail-soft and `withSyncTelemetry`-wrapped; no new
native modules (AppState + outbox instead of netinfo); `OfflineStorage` stays the single
write path; keep 328 tests green and add the suites above.

**Dependency / risk to flag before Phase 2 is trusted:** the Supabase session is stored in
`expo-secure-store`, which is unreliable above ~2KB on Android (audit finding #5). If
sessions don't persist, `user` is null and sync never runs. Fix the session storage
adapter (chunk, or use an encrypted-AsyncStorage adapter) as a **Phase 2 prerequisite** —
it's small and it's load-bearing for everything here.

**Explicitly out of scope (follow-ups):** Realtime live multi-device propagation;
migrating specific domains onto the normalized tables for server-side analytics; avatar /
progress-photo upload wiring (needs `expo-image-picker` + an EAS rebuild).
