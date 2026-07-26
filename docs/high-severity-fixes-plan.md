# Welliva — High-Severity Fixes Implementation Plan

Execution plan for the four **High-severity** audit findings. Same house rules as
`critical-fixes-plan.md`: **offline-first, fail-soft, device is the source of truth,
avoid new native modules where possible, `tsc` clean, all 328 tests stay green + add new
ones.** Where a native module is genuinely required, it's called out explicitly (it means
an EAS rebuild).

Findings addressed:
5. `expo-secure-store` can't reliably hold a Supabase session on Android (~2 KB cap).
6. Sign-up shows a false "verify your email" dead-end (email confirmation is **off**).
7. Google/Facebook buttons are primary UI but every social provider throws "coming soon."
8. ~1.5 MB of hardcoded data is statically imported into the JS bundle.

---

## Phase A — Fix session persistence (finding #5) — do this first

**Why first:** `lib/supabase.ts` stores the whole Supabase session in SecureStore, which
warns/fails above ~2 KB on Android. Supabase sessions (access + refresh JWT + user
metadata) routinely exceed that → the session silently fails to persist → the user is
logged out on next launch → `user` is null → **the entire sync engine from the critical
plan never runs.** This is load-bearing for everything.

**Approach (no new native deps): a chunking storage adapter.** Split any value over a safe
threshold across multiple SecureStore entries; reassemble on read. Keep AsyncStorage on web.

New file `lib/secureSessionStore.ts`:
```ts
import * as SecureStore from 'expo-secure-store';
const LIMIT = 2000;                          // SecureStore's safe per-value ceiling
const meta = (k: string) => `${k}__chunks`;  // stores the chunk count

export const ChunkedSecureStore = {
  getItem: async (key: string) => {
    const count = Number(await SecureStore.getItemAsync(meta(key)));
    if (!count) return SecureStore.getItemAsync(key);          // small/legacy single value
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.some(p => p == null) ? null : parts.join('');  // torn write → treat as miss
  },
  setItem: async (key: string, value: string) => {
    // clear any prior representation first (single OR chunked) to avoid stale tails
    await ChunkedSecureStore.removeItem(key);
    if (value.length <= LIMIT) return SecureStore.setItemAsync(key, value);
    const chunks = value.match(new RegExp(`.{1,${LIMIT}}`, 'gs')) ?? [];
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}.${i}`, c)));
    await SecureStore.setItemAsync(meta(key), String(chunks.length));
  },
  removeItem: async (key: string) => {
    const count = Number(await SecureStore.getItemAsync(meta(key)));
    await SecureStore.deleteItemAsync(key).catch(() => {});
    if (count) {
      await Promise.all(Array.from({ length: count },
        (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => {})));
      await SecureStore.deleteItemAsync(meta(key)).catch(() => {});
    }
  },
};
```
Wire it in `lib/supabase.ts`: keep the existing web branch (AsyncStorage), route the
native branch through `ChunkedSecureStore`. Preserve the current try/catch fail-soft.

**Migration concern:** an existing install may already hold a truncated/failed single-key
session — `getItem` returns it fine when small; when it was silently dropped, the user
re-authenticates once (acceptable). No data migration needed.

> **Alternative (if you prefer encryption over chunking):** Supabase's `LargeSecureStore`
> pattern — an AES key in SecureStore, the ciphertext in AsyncStorage (`aes-js` +
> `expo-crypto`). Stronger, but adds `expo-crypto` (native → EAS rebuild). Chunking has no
> new deps, so it's the default here.

**Tests** (`lib/__tests__/secureSessionStore.test.ts`, mock SecureStore with an in-memory
map): value < limit round-trips as a single key; value > limit splits and reassembles
byte-identical; overwriting a chunked value with a small one leaves no stale `.N` tails;
remove clears every chunk + meta; a torn read (missing chunk) returns null.

**Done when:** sign in on a physical Android device, force-quit, relaunch → still signed
in. (Verify with a deliberately large session, e.g. a Google-metadata user once #7 lands.)

---

## Phase B — Repair the sign-up flow (finding #6)

**Current reality:** `supabase/config.toml` has `enable_confirmations = false`, so
`supabase.auth.signUp` **returns a live session immediately** and `onAuthStateChange`
fires `SIGNED_IN`. But `app/sign-up.tsx` shows *"check your email to verify"* and
`router.replace('/sign-in')` — a false instruction that also races `AuthWrapper` (which
is already redirecting the now-signed-in user to onboarding). Two ways forward:

### Option B1 — Keep confirmations OFF (fastest, unblocks now)
Make the UI tell the truth: after `signUpWithEmail`, the user is signed in — **do not**
show the verify message and **do not** route to sign-in. Let `AuthWrapper` route them to
`/onboarding` (it already does), or `router.replace('/onboarding')` explicitly.
- Edit `app/sign-up.tsx` `onEmailSignUp`: on success, drop the Alert + `replace('/sign-in')`.
- Add real inline error handling for the common `signUp` errors (email already registered,
  weak password) instead of a generic Alert.
- Keep client-side validation (already present: match + min length).

**Trade-off to surface to the product owner:** with confirmations off, anyone can register
a typo'd or fake email → password reset becomes impossible and spam signups are trivial.
Fine for a beta, **not** ideal for a public launch. Hence B2.

### Option B2 — Turn confirmations ON (recommended for public launch)
1. **Supabase:** set `enable_confirmations = true`; configure a real SMTP sender
   (the built-in Supabase mailer is rate-limited and not for production); add the app's
   redirect URL to `additional_redirect_urls` — use the `welliva://` scheme
   (`app.json` already declares `"scheme": "welliva"`), e.g. `welliva://auth-callback`.
2. **Sign-up call:** pass `emailRedirectTo` so the verification link opens the app:
   ```ts
   await supabase.auth.signUp({ email, password,
     options: { emailRedirectTo: makeRedirectUri({ scheme: 'welliva', path: 'auth-callback' }) } });
   ```
   (`makeRedirectUri` from `expo-auth-session`, already a dep.)
3. **Pending state:** after signUp with confirmations on, there's a `user` but **no
   session**. Add a "Verify your email" screen (`app/verify-email.tsx`) with the email
   shown, a **Resend** button (`supabase.auth.resend({ type: 'signup', email })`), and
   copy explaining the link. `AuthWrapper` must treat "user exists, no session" as → this
   screen (add the branch).
4. **Deep-link handler:** in `app/_layout.tsx`, handle the incoming `welliva://auth-callback`
   URL (via `expo-linking`, already a dep) → `supabase.auth.exchangeCodeForSession` (or
   `setSession` from the URL fragment) → `onAuthStateChange` then routes onward.

**Recommendation:** ship **B1 immediately** (it's a genuine bug fix), and schedule **B2**
before public launch. Both are small; B2's only real cost is SMTP setup + the callback screen.

**Tests:** `AuthWrapper` routing matrix — signed-in→tabs/onboarding, signed-out→sign-in,
and (B2) user-without-session→verify-email. Keep them pure by mocking `useAuth`.

**Done when (B1):** completing sign-up drops the user straight into onboarding with no
false "check your email" and no bounce to sign-in.

---

## Phase C — Resolve the social-login buttons (finding #7)

Prominent Google/Facebook buttons that throw *"Social sign-in is coming soon"*
(`components/SupabaseAuthProvider.tsx` `NOT_CONFIGURED`) read as broken to a store
reviewer. Two paths:

### Option C1 — Hide for launch (fastest, removes the red flag)
Email-only is a valid launch. Remove the social buttons + `AuthDivider` from
`app/sign-in.tsx` and `app/sign-up.tsx` (or gate them behind a `SOCIAL_ENABLED = false`
flag in one place). Leave the provider stubs in place for later. Zero risk, unblocks review.

### Option C2 — Actually implement OAuth (follow-up feature)
Deps are already installed (`expo-auth-session`, `expo-web-browser`) — **Google needs no
new dependency:**
```ts
// in SupabaseAuthProvider
const redirectTo = makeRedirectUri({ scheme: 'welliva', path: 'auth-callback' });
const { data } = await supabase.auth.signInWithOAuth({
  provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
const res = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
if (res.type === 'success') await supabase.auth.exchangeCodeForSession(/* code from res.url */);
```
Plus: enable Google in the Supabase dashboard (client id/secret), register the redirect URL
(same `welliva://auth-callback` as Phase B), and reuse the deep-link handler.

**App Store gotcha — plan for it:** Apple Guideline 4.8 **requires Sign in with Apple**
if you offer any third-party social login (Google/Facebook) on iOS. So C2-on-iOS means
also adding Apple sign-in, which needs `expo-apple-authentication` (**native dep → EAS
rebuild**) + `supabase.auth.signInWithIdToken({ provider: 'apple', token })`. Facebook is
extra surface for little gain — consider dropping it.

**Recommendation:** **C1 for the first submission.** Do C2 (Google + Apple parity) as a
deliberate follow-up once the OAuth redirect + Apple config are set up — don't let it hold
the release.

**Done when (C1):** no auth button on any screen errors on tap.

---

## Phase D — Trim the bundle (finding #8)

`constants/DietLibraryGenerated.ts` (**988 KB**) + `DietDatabase.ts` (265 KB) +
`ExerciseDatabase.ts` (189 KB) + `RecommendedDiets.ts` (104 KB) are **statically imported**
→ eagerly bundled, shipped, and resident in memory. (Hermes bytecode-compiles them so
parse cost is lower than it looks, but download size and memory residency remain.)

**D.1 — Measure first (don't guess).**
```
npx expo export --platform android
npx source-map-explorer dist/_expo/static/js/**/*.js   # or npx react-native-bundle-visualizer
```
Confirm the real contribution of each constant to the JS bundle before refactoring.

**D.2 — Lazy-load the 988 KB generated library (biggest win, smallest blast radius).**
It has only **two importers** — `constants/DietDatabase.ts` and `constants/FoodDictionary.ts`.
Convert those to memoized async accessors so the heavy module parses on first use, off the
cold-start path:
```ts
// DietLibraryGenerated stays as-is; add accessors that dynamic-import it.
let _diets: typeof import('./DietLibraryGenerated')['GENERATED_DIETS'] | null = null;
export async function getGeneratedDiets() {
  return (_diets ??= (await import('./DietLibraryGenerated')).GENERATED_DIETS);
}
```
Then make `DIET_DATABASE` / `FOOD_DICTIONARY` async getters and route their consumers
(`DietMatchService`, `ScheduleService`, `app/foods.tsx`, `FoodDictionary` readers — 9 + 4
files) through an `await`. These already run inside async service methods, so the change is
localized. Add a tiny warm-up (`void getGeneratedDiets()`) after first paint on the diet
tab so the first interaction isn't slow.

**D.3 — Defer `ExerciseDatabase` (189 KB) to the fitness feature.** Its 6 consumers are all
fitness routes (`exercise/[id]`, `fitness/library`, `guided-session`, `session-summary`).
Dynamic-import it there so users who never open fitness never pay for it.

**D.4 — Follow-up (larger): move catalogs server-side.** The cleanest long-term answer is
to serve these catalogs from Supabase (a `diet_library` / `exercise_library` table or a
Storage JSON asset) with an on-device cache — this is also where the critical plan's sync
infra can help. Not required for the size win; note it and defer.

**Tests:** the accessor memoizes (imports once across repeated calls — assert with a spied
dynamic import); existing DietMatch/Schedule suites still pass through the async path.

**Done when:** the measured JS bundle drops materially (target: the 988 KB library out of
the initial chunk) and cold start on a low-end Android device improves; diet/fitness
features still work through the async accessors.

---

## Sequencing & cross-cutting

| Phase | Fixes | New native dep? | Ship as |
|------|-------|-----------------|---------|
| A Session persistence | **#5** | no (chunking) | 1 PR — **first** |
| B Sign-up flow | **#6** | no (B1) / no (B2) | 1 PR (B1 now, B2 pre-launch) |
| C Social buttons | **#7** | no (C1) / yes-iOS (C2 Apple) | 1 PR (C1 now) |
| D Bundle trim | **#8** | no | 1 PR + measurement |

- **Order:** A first (it unblocks the critical-plan sync and reliable login), then B and C
  in parallel (both touch the auth screens — coordinate the edits), then D independently.
- **House rules hold:** fail-soft on every auth/storage path; keep `OfflineStorage` and
  `lib/supabase.ts` as the single storage seams; `tsc` clean; 328 tests green + the new
  suites above.
- **Launch-blocking subset** (do before the first store submission): **A**, **B1**, **C1**.
  **B2**, **C2**, and **D** are strongly recommended but schedulable as fast follow-ups.
