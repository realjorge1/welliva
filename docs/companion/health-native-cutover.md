# Apple Health / Health Connect — the native cutover

**Status:** adapter written, tested and registered. Native packages **not installed**.
**Audit reference:** F-04 (30 Aug 2026), "Apple Health / Health Connect is a seam with a
null provider."

---

## What changed, and what didn't

`WearableSource` used to default to `nullWearableProvider` — a hard-coded
`unavailable`, forever. It now defaults to `lazyPlatformProvider`, which resolves
to `AppleHealthProvider` on iOS and `HealthConnectProvider` on Android.

**Behaviour today is unchanged.** Neither `react-native-health` nor
`react-native-health-connect` is a dependency of this repo, so both providers
fail their own guarded `require` and report `unavailable` — byte-for-byte the
same outcome as the null provider. No new permission is requested, no new
store-review surface exists, and the app builds exactly as before.

What moved is where the remaining work is. It used to be *"write a HealthKit
adapter"*. It is now *"install two packages and take a build"*.

| Piece | State |
|---|---|
| Sleep / HRV / resting-HR / steps / energy mapping | Written, 28 tests |
| Sleep-sample overlap merging | Written, tested |
| HRV + resting-HR rolling baselines | Written, tested — **new capability** |
| Plausibility ranges (dropped straps, artefacts) | Written, tested |
| Platform selection + registration | Written |
| "Connect" row in the Life screen's Signals panel | Written, shows "not in this build yet" |
| `react-native-health` installed | **No** |
| `react-native-health-connect` installed | **No** |
| iOS HealthKit entitlement + usage strings | **No** |
| Android Health Connect manifest declarations | **No** |

## Why the packages weren't installed here

Three reasons, all of them about not breaking a working build:

1. **Neither can be verified from this machine.** Both are native modules; a
   config-plugin mistake surfaces at `expo prebuild` or on EAS, not in `tsc`.
   Adding an unverified plugin entry to `app.json` risks turning a repo that
   builds into one that doesn't.
2. **The iOS side has a store-review dimension.** The HealthKit entitlement
   changes what App Review asks about, and an app that requests heart-rate access
   must justify it. That is a submission decision, not a refactor.
3. **The Android side needs a Play declaration.** Health Connect permissions
   require a completed Health Apps declaration form; declaring the permissions in
   the manifest *before* that form is filed is a review risk with no upside.

Landing the adapter without the dependency gets the mapping — the part with the
real bugs in it — written, reviewed and under test now, so the cutover is
mechanical rather than a rewrite under deadline.

## The cutover

### 1. iOS

```bash
npx expo install react-native-health
```

Then in `app.json`, inside `expo.plugins`:

```json
[
  "react-native-health",
  {
    "isClinicalDataEnabled": false,
    "healthSharePermission": "Welliva reads your sleep, heart-rate variability and resting heart rate to work out how recovered you are. This data is read on your device and never leaves it — only the recovery score is used.",
    "healthUpdatePermission": "Welliva does not write to Apple Health."
  }
]
```

Welliva is **read-only**. `permissionSet()` in `providers/appleHealth.ts` requests
an empty `write` array, and nothing in the codebase calls a HealthKit save method.
Keep it that way — a write permission is a much harder review conversation, and
buys nothing.

### 2. Android

```bash
npx expo install react-native-health-connect
```

Health Connect permissions go in the manifest, and Play requires the **Health
Apps declaration form** to be filed for the app before a build using them is
accepted. The five read permissions the provider asks for are exactly:

```
android.permission.health.READ_SLEEP
android.permission.health.READ_HEART_RATE_VARIABILITY
android.permission.health.READ_RESTING_HEART_RATE
android.permission.health.READ_STEPS
android.permission.health.READ_ACTIVE_CALORIES_BURNED
```

Health Connect also requires an intent filter for the rationale activity
(`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`), which the package's config
plugin adds. Point it at the Trust screen (`/privacy`) — the existing per-category
consent copy is already the rationale.

### 3. Build and verify

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

Then, on a device with a paired watch or a Health Connect writer installed:

1. Open **Life → Signals**. The row should read "Connect Apple Health" /
   "Connect Health Connect" rather than "Not in this build yet".
2. Tap Connect. Grant everything.
3. Confirm the alert reports last night's sleep, and that the number is
   **plausible** — 6–9 hours, not 20. A 20-hour figure means the asleep-sample
   filter missed a value this platform emits; add it to `ASLEEP_VALUES` in
   `appleHealth.ts` (or `ASLEEP_STAGE_NAMES` in `healthConnect.ts`) and re-check.
4. Confirm recovery on the Fitness dashboard now cites sleep/HRV rather than
   "training-load proxy (no wearable metrics yet)" — that string comes from
   `wearableBasis()` and is the tell that the fold is still running dry.

### 4. Baselines take a week

`rollingBaseline` needs **7 readings inside 30 days** before it returns anything,
and `recoveryAdjustment`'s HRV term does nothing without one. So on day one a
connected user sees sleep folded into recovery but not HRV. That is correct, not a
bug: comparing a single HRV reading to nothing is how other apps produce confident
nonsense. Don't "fix" it by lowering `minSamples`.

## Things that will look like bugs and aren't

**"It says granted but reads nothing."**
HealthKit does not report READ permission — by design, since knowing you declined
is itself information about you. A refusal and an empty health store are
indistinguishable to any app. `readToday` returns `null` rather than a zero-filled
snapshot precisely so this case doesn't turn into "you took 0 steps and slept 0
hours"; see the header of `providers/appleHealth.ts`.

**"Android granted three of five permissions."**
Normal. The Health Connect sheet is per record type and people routinely allow
steps while declining heart data. `grantedCount() > 0` is treated as ready, and
`WearableSnapshot` is sparse by design.

**"iOS and Android HRV numbers differ for the same person."**
They measure different things: HealthKit publishes SDNN (in *seconds*, rescued to
ms by the provider), Health Connect publishes RMSSD (already ms). This is why
`recoveryAdjustment` only ever compares HRV against *that device's own* rolling
baseline and never against an absolute threshold.

**"Sleep is missing on a day I napped in the afternoon."**
`lastNightWindow` runs 18:00 the previous day → 14:00 today. A 3 p.m. nap is
outside it on purpose — the recovery fold asks "how did you sleep last night",
and folding a nap in would make a tired day read as rested.

## Files

| Path | What it holds |
|---|---|
| `health-os/signals/wearable/normalize.ts` | Pure: interval merging, baselines, plausibility |
| `health-os/signals/wearable/providers/appleHealth.ts` | HealthKit shim + mapping |
| `health-os/signals/wearable/providers/healthConnect.ts` | Health Connect shim + mapping |
| `health-os/signals/wearable/providers/index.ts` | `resolveWearableProvider()` |
| `health-os/signals/wearable/WearableSource.ts` | Consent gate, cache, manual ingest |
| `health-os/__tests__/wearableProviders.test.ts` | 28 tests over the mapping |
| `components/lifecontext/useSignals.ts` | The Connect action |
