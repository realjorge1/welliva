# Welliva — Medium / Store-Submission Fixes Implementation Plan

Execution plan for the **Medium** audit findings — a mix of hard store-submission blockers,
quick hygiene wins, a dark-but-built feature, and one maintainability refactor. Same house
rules: **offline-first, fail-soft, `tsc` clean, tests green.** Native-dep additions (→ EAS
rebuild) are called out explicitly.

Findings addressed:
- M1. `app.json` has no iOS `bundleIdentifier` — EAS iOS build/submit fails.
- M2. Notifications aren't configured for production — no plugin, no Android 13+ permission.
- M3. Dead dependency `@google/generative-ai` — bundled, imported nowhere.
- M4. `AppContext.tsx` is 2,265 lines — a maintainability liability.
- M5. Avatar / progress-photo upload is built but unreachable (no picker).

Ordered by effort-vs-value: quick wins → launch config → dark feature → refactor.

---

## M1 — Add the iOS bundle identifier (hard blocker, 2 minutes)

EAS iOS builds and App Store submission fail without `ios.bundleIdentifier`. Android
already has `com.welliva.app`; mirror it. In `app.json` under `expo.ios`:
```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.welliva.app"
}
```
While here, add explicit version counters so store builds are deterministic (EAS can
auto-increment, but being explicit avoids surprises):
```json
"ios":     { "buildNumber": "1" },
"android": { "versionCode": 1 }
```
**Done when:** `npx expo prebuild` / an EAS iOS build no longer errors on a missing bundle id.

---

## M3 — Remove the dead Gemini dependency (quick win)

`@google/generative-ai` is in `package.json` but imported nowhere (verified: zero
references across `app/ components/ contexts/ services/`). The live AI path is the Anthropic
Haiku `/server`.
```
npm uninstall @google/generative-ai
```
Confirm `npm run test` + `npx tsc --noEmit` still pass, and commit the updated
`package.json` + `package-lock.json`. (Grep once more for `generative-ai` before removing,
in case a branch added a usage.)

**Done when:** dependency gone, lockfile updated, build green.

---

## M2 — Configure notifications for production

The code is already wired — `HabitService.ts` calls `requestPermissionsAsync` and schedules
`DAILY`/`WEEKLY` triggers, and `components/notifications/ProactiveDeliveryRunner` runs at
root — but `app.json` has **no `expo-notifications` plugin, no notification icon/channel,
and no Android 13+ `POST_NOTIFICATIONS` handling**. In a release build the native module is
unconfigured and reminders silently never fire.

**M2.1 — Add the plugin** in `app.json` `plugins`:
```json
["expo-notifications", {
  "icon": "./assets/images/welliva512.png",
  "color": "#FFF1E6"
}]
```
(The plugin auto-adds `POST_NOTIFICATIONS` on Android 13+. A monochrome/transparent icon
renders best in the status bar — consider a dedicated small asset later.)

**M2.2 — Set a foreground handler once** at startup (e.g. top of `app/_layout.tsx` module
scope, or a small `services/notifications/init.ts` imported there):
```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true,
    shouldPlaySound: false, shouldSetBadge: false,
  }),
});
```

**M2.3 — Create the Android channel before scheduling** (Android requires a channel or
notifications are dropped). In `HabitService` where permission is requested:
```ts
if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT,
  });
}
// then pass channelId: 'reminders' in the scheduled content
```

**M2.4 — Handle the permission-denied path gracefully.** `requestPermissionsAsync` can
return `denied` (esp. Android 13+ / iOS first prompt). `HabitService.syncReminders` should
no-op cleanly and surface a one-time, non-blocking hint in the habit UI ("enable
notifications to get reminders") rather than failing silently.

**M2.5 — Note for later:** local scheduled notifications work in a standalone/EAS build with
the above. **Push** notifications (remote, via the proactive companion) additionally need
`getExpoPushToken` + FCM credentials — out of scope here; local reminders are the wired path.

**Tests:** unit-test `syncReminders` with a mocked `expo-notifications` — schedules when
granted, no-ops when denied, cancels stale ids. (Follows the existing service-test style.)

**Done when:** on a physical Android 13+ device from an EAS build, creating a habit prompts
for permission and the daily reminder actually fires.

---

## M5 — Wire avatar & progress-photo upload (dark feature)

`services/sync/StorageSync.ts` is complete — `uploadAvatar`, `uploadObject`, `getSignedUrl`,
and the private `avatars` / `progress-photos` buckets all exist — but nothing can produce
the bytes, because there's no image picker and RN `fetch` can't read `file://`. The file's
own footer documents the missing wiring.

**M5.1 — Add the native deps (→ EAS rebuild):**
```
npx expo install expo-image-picker expo-file-system
```
(`expo-file-system` because RN `fetch` can't reliably read a local `file://` URI; base64 →
bytes is the reliable bridge, exactly as StorageSync's footer notes.)

**M5.2 — A small bridge** `services/sync/pickAndUpload.ts`:
```ts
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';       // tiny, pure-JS; or hand-roll
import { uploadAvatar, uploadObject } from './StorageSync';

export async function pickAvatar(userId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images', quality: 0.8, allowsEditing: true, aspect: [1, 1],
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
  return uploadAvatar({ userId, data: decode(b64), contentType: 'image/jpeg' });
}
```
Add a sibling `pickProgressPhoto` that calls `uploadObject({ bucket: 'progress-photos', … })`
with a timestamped filename.

**M5.3 — Wire the UI.** In the profile/`more` avatar area: on tap → `pickAvatar(user.id)` →
on success `getAvatarUrl(path)` → render, with a `LoadingOverlay` during upload. `more.tsx`
already reads `avatar_url`; make sure it resolves storage **paths** through `getAvatarUrl`
(handles both signed paths and legacy full URLs). Progress photos → a gallery on the
body-log / progress screen backed by `listObjects('progress-photos', userId)` + `getSignedUrl`.

**M5.4 — Sync note:** `uploadAvatar` already writes `users.avatar_url`, so it round-trips via
the existing profile sync — no extra work. Confirm the pointer survives the critical-plan's
per-user purge (avatar path lives in the cloud `users` row, so it re-downloads — good).

**Trade-off:** this is the one Medium item that needs a native rebuild. If you're not cutting
a new binary soon, defer it; it's a feature completion, not a blocker.

**Done when:** a user can set a profile photo and it reappears after reinstall / on another
device.

---

## M4 — Decompose `AppContext.tsx` (maintainability, not perf)

**Correction to the audit's framing:** the re-render worry is largely already handled —
`AppContext` **already exposes five separate memoized slice-contexts** (`ProfileContext`,
`NutritionContext`, `WorkoutContext`, `GamificationContext`, `SystemContext`) with selector
hooks (`useProfile`, `useNutrition`, …), so a consumer only re-renders on its own slice.
The real problem is **one 2,265-line file** holding all state, effects, and business logic —
a review/merge-conflict/onboarding hazard as the team grows. Treat this as **incremental
decomposition, low urgency, do it as you touch the file** — not a big-bang rewrite.

**Approach — extract per-domain state hooks; keep the Provider a thin composition root.**
The slice contexts already draw the seams. For each domain, move its `useState` + effects +
handlers into a dedicated hook module, and have the Provider call them and feed the existing
`*Context.Provider`s:
```
contexts/
  AppContext.tsx            // thin: calls the hooks, composes the 5 providers (~200 lines)
  domain/
    useProfileState.ts      // bio/goals/plan-state + the profile reconcile effect
    useNutritionState.ts    // today nutrition, water, history, targets
    useWorkoutState.ts      // plan, logs, session history
    useGamificationState.ts // achievements, streaks, challenges, journey
    useSystemState.ts       // clock/day-change sweep, loading, reconcile flags
```
**Rules to keep it safe and boring:**
- Pure move, no behavior change — one domain per PR, tests green after each.
- Preserve the existing patterns exactly: refs-not-deps in effects, the day-change sweep,
  the login reconcile (which the critical plan also edits — **coordinate ordering:** land
  the critical-plan reconcile changes first, or do this extraction first and rebase; don't
  interleave in the same PR).
- The public API (`useProfile`/`useNutrition`/… slice hooks) stays identical, so no consumer
  changes — this is the payoff of the existing slice split.

**Done when:** `AppContext.tsx` is a thin composition root, each domain lives in its own
tested module, and `useApp`/slice hooks behave identically (all 328 tests still green).

---

## Sequencing & cross-cutting

| Item | Type | New native dep? | Effort | Priority |
|------|------|-----------------|--------|----------|
| M1 iOS bundle id | store blocker | no | trivial | **do now** (blocks iOS submit) |
| M3 remove dead dep | hygiene | no | trivial | do now |
| M2 notifications config | dark feature | no (config only) | small | before relying on reminders |
| M5 photo upload | dark feature | **yes** (picker + fs) | medium | with the next EAS rebuild |
| M4 AppContext split | maintainability | no | medium/large | incremental, low urgency |

- **First submission set:** M1 + M3 (both trivial) and M2 (so a wired feature actually
  works). M5 rides the next native rebuild; M4 is ongoing hygiene.
- **Coordinate with the other plans:** M2's startup handler and M5's avatar pointer touch
  `app/_layout.tsx` and the profile screen that Phases B/C of the high-severity plan and the
  critical plan also edit — sequence PRs to avoid churn, and land M4's reconcile-adjacent
  extraction either before or after (never during) the critical-plan sync work.
- **Hold the line:** `tsc` clean, 328 tests green + new suites, fail-soft on the
  permission/upload paths.
