# Measurement — the four numbers

Before this existed, welliva had 225,000 lines of code and no way to answer
whether a single person had ever used it. This is the pipeline that answers four
questions, and deliberately not a fifth.

| Question | Where to read it |
| --- | --- |
| Did a new install actually get going? | `analytics_activation` |
| Where does setup bleed? | `analytics_onboarding_funnel` |
| Do people come back? | `analytics_retention` |
| Does anyone pay? | `analytics_paywall`, `analytics_paywall_by_source` |
| (and) can we afford the coach? | `analytics_coach_load` |
| (and) what is breaking? | `analytics_crash_rate` |

All of them are plain SQL views. Open Supabase → SQL Editor and
`select * from analytics_retention;`.

## Why it is first-party

The privacy policy says welliva contains **no third-party analytics**, the Trust
screen is built on that promise, and this app tracks menstrual cycles. A PostHog
or Sentry SDK would have made a live legal document false and handed a stream of
behavioural health signals to a vendor. So the whole pipeline is two append-only
tables in our own Supabase, written with the anon key the app already ships.

The policy was rewritten to disclose it honestly and `LEGAL_VERSION` went to 4,
so every user re-accepts once. That was free to do now and expensive later —
which is the only reason it happened in the same change.

## What is collected, exactly

Event **names** and a tiny allowlisted props bag. The complete list lives in
[services/telemetry/events.ts](../../services/telemetry/events.ts) and is a
closed TypeScript map: `track("weight_logged", { kg })` does not compile.

Never collected: weight, calories, macros, meal or food names, moods, cycle
dates or symptoms, medications, coach messages, search text, photos, email, the
advertising identifier. Two locks enforce it — the types, and `sanitize()` at
runtime for anything arriving through a cast or off a queue written by an older
build. [The tests](../../services/telemetry/__tests__/analytics.test.ts) encode
the rule, including a tripwire on body-shaped prop names.

Identity is `install_id`: a random v4 UUID minted on the device at first launch.
Not the device id, not the ad id. Reinstalling, deleting the account or
Settings → Reset mints a new one and the old events become unattributable.
`user_id` is attached only after sign-in, so the pre-signup funnel — where
activation actually bleeds — stays visible.

## Architecture, and the one rule that matters

```
services/telemetry/
  events.ts        the closed taxonomy. The privacy boundary.
  Analytics.ts     PURE. sanitize, queue, consent, activation latch.
  sink.ts          the port: "somewhere to send rows".
  supabaseSink.ts  the real one. Supabase + Platform + expo-constants.
  boot.ts          installAnalytics() — AppState hooks. From _layout only.
  installId.ts     the anonymous id.
  CrashLog.ts      the device-local black box; also ships a copy.
```

**`Analytics.ts` must never import `react-native` or `lib/supabase`.** `track()`
is called from the middle of the domain layer (the intake ledger, the water
store, the billing gate), and `services/*` runs under plain Node in vitest. The
first version of this module imported `react-native` and broke three nutrition
test files with `Flow is not supported` while parsing `react-native/index.js`.
The port in `sink.ts` is the fix. With no sink installed, `track()` still
sanitizes and still queues and nothing leaves — which is also what a unit test
wants, and why the default is a no-op rather than a throw.

Domain code imports `track` from the barrel. App code imports
`installAnalytics` from `./boot`.

## Guarantees

- **Never throws.** Called from render paths and from inside the crash handler.
- **Never blocks.** `track()` returns void and does no I/O on the caller's turn.
- **Consent at send time, not boot time.** Switching Trust → Measurement off
  stops the next event *and discards the pending queue*.
- **Survives the crash.** The queue is persisted, so the events leading up to a
  fatal error are still there after the restart.

## Reading the numbers honestly

- `analytics_retention.d1` is the strict definition (came back the *next* day).
  At 100 installs that is a handful of people and moves on noise — read
  `returned_in_week_1` alongside it, and always read `installs` first. 40% D1 on
  5 installs is two people.
- `activated` fires once per install, latched. It is a count of installs that
  started using the product, not of logging actions.
- Day-bucketing uses the **server** clock (`received_at`). A wrong phone clock
  would otherwise land someone in the wrong cohort.
- Deleting an account de-identifies its events (`on delete set null`) rather
  than punching holes in historical cohorts.

## Still to do by hand

1. **Apply the migration.**
   `npx supabase db push`, or paste
   `supabase/migrations/20261030120000_analytics.sql` into the SQL editor.
   Nothing is recorded until this runs — `track()` queues and the flush fails
   soft, so the app behaves identically and silently in the meantime.
2. **Regenerate DB types**, then delete the documented cast in
   `supabaseSink.ts` and use the generated table types:
   `npx supabase gen types typescript --project-id $PROJECT_ID > lib/database.types.ts`
   (CI's `schema` job diffs this and will be red until you do.)
3. **Publish the policy**: `npm run legal:publish` — `LEGAL_VERSION` is now 4
   and the hosted copy must match what the app asks people to accept.
4. **Paste the iOS RevenueCat key** into the two empty slots in `eas.json`.
   See the warning in `npm run billing:doctor`; it is a money leak, not a dead
   button, and the reasoning is spelled out there.
5. **Move the backend off Render's free tier** — see the comment on `plan:` in
   `../backend-welliva/render.yaml`. Editing the file is not enough; Render
   needs a Blueprint sync or a dashboard change.

## What this deliberately does not do

No session stitching, no user properties, no funnels computed on the device, no
retries with backoff, no sampling, no dashboards in-app. The reporting is SQL so
it can be read and corrected. This module's whole job is to get a small, honest
row to the table and get out of the way.
