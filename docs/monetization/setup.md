# Monetization setup — Play Console, Google Cloud, RevenueCat

The end-to-end runbook for turning on subscriptions. Follow it in order: each
part depends on IDs produced by the one before it.

Welliva sells **one paid tier, monthly or annual**: Pro — the whole app
unlocked, plus generated plans, insights and uncapped coaching. (There was a
cheaper Plus tier until it was merged into Pro; if you find `plus` in a console
you already configured, see §3.5.) What Pro includes is defined once, in
[services/billing/tiers.ts](../../services/billing/tiers.ts); the storefront is
[app/(tabs)/upgrade.tsx](../../app/%28tabs%29/upgrade.tsx).

**Read Part 0 first.** There is a Google Play policy that can add ~3 weeks to
your timeline, and you want to start that clock today rather than discover it
the week you plan to launch.

Companion docs: [store-submission.md](../legal/store-submission.md) (listing,
data-safety form, legal placeholders), [api/README.md](../api/README.md) (the
backend that the paid features actually cost money to run).

---

## Part 0 — Before you touch a console

### 0.1 The 12-tester rule (start this now)

Google requires **personal** developer accounts created after 13 Nov 2023 to run
a closed test with **at least 12 testers, opted in continuously for 14 days**,
before you may apply for production access.

- It is 12 *distinct Google accounts* that have actually opted into the test.
- The 14 days are continuous. Dropping below 12 restarts the clock.
- **Organization accounts are exempt** — but they require a
  [D-U-N-S number](https://www.dnb.com/duns-number.html), which itself takes
  ~5–10 business days to obtain if you don't have one.

Decide now which account type you are registering. If personal, recruit the 12
testers while you do everything else in this document — this is the long pole.

### 0.2 What each account costs

| Account | Cost | Notes |
| --- | --- | --- |
| Google Play Developer | **$25 one-time** | Per account, not per app |
| Google Cloud Console | Free for this use | Play Developer API calls are free at our volume |
| RevenueCat | Free below their revenue threshold, then a % of tracked revenue | Verify the current threshold at [revenuecat.com/pricing](https://www.revenuecat.com/pricing) — it has changed before |

### 0.3 Identifiers we will use

Fixed by [app.json](../../app.json) — do not improvise these:

```
Android package    com.welliva.app
iOS bundle id      com.welliva.app
```

Product structure to create — **one tier, billed monthly or annually**, which is
exactly what `services/billing/tiers.ts` and the `/upgrade` screen expect:

| Thing | ID | Notes |
| --- | --- | --- |
| Play subscription | `welliva_pro` | One subscription, two base plans |
| Base plan (monthly) | `p1m` | $2.99/mo |
| Base plan (annual) | `p1y` | $25.88/yr — saves exactly $10.00 (28%) |
| Offer (trial) | `trial-7d` | 7-day free trial, attached to `p1y` |
| RevenueCat entitlement | `pro` | Granted by both `welliva_pro` base plans |
| RevenueCat offering | `pro` | The two Pro packages |

These exact amounts must be entered in the console: the app displays the store's
localized `priceString`, never a hardcoded number. The same figures are mirrored
in [services/billing/pricing.ts](../../services/billing/pricing.ts) **only** as
list prices for builds where no offering can load (Expo Go, web, no key) — where
every buy button is disabled anyway — and `services/__tests__/pricing.test.ts`
pins the savings arithmetic the plan cards show. Changing a price means changing
it in the console AND there.

> **An entitlement, not a product-id table.** The client asks the store one
> yes/no question (`pro` active?) — see `tierOf()` in
> services/billing/Billing.ts. That means a promo SKU, a regional plan or a
> lifetime product can be added in the console with no app change: just attach it
> to the `pro` entitlement.
>
> It also still reads a legacy `plus` entitlement and grants Pro for it, so
> anyone mid-period on the retired tier keeps their access instead of being
> downgraded to free on their next launch (`LEGACY_PLUS_ENTITLEMENT` in
> services/billing/config.ts). Do not delete that entitlement in RevenueCat while
> subscriptions are still attached to it.

> **The `id:basePlanId` gotcha.** Play's newer subscription model nests base
> plans under a subscription. RevenueCat therefore identifies these products as
> **`welliva_pro:p1m`** and **`welliva_pro:p1y`**, not `welliva_pro`. Getting
> this wrong is the single most common cause of "products not found" at runtime.

### 0.4 Do you already have a Google Cloud project?

Probably yes — Google sign-in is already working, which means an OAuth client
exists somewhere. Check [docs/OAUTH_SETUP.md](../OAUTH_SETUP.md) and
[console.cloud.google.com](https://console.cloud.google.com) for an existing
"Welliva" project. **Reuse it in Part 2** rather than creating a second one;
two projects for one app is a lasting source of confusion.

---

## Part 1 — Google Play Console

### 1.1 Register the developer account

1. Go to [play.google.com/console/signup](https://play.google.com/console/signup).
2. Sign in with the Google account that should **own** this permanently. Migrating
   ownership later is possible but tedious — use a role account you control
   (e.g. `dev@welliva.app`), not a personal address you might lose.
3. Choose account type — **Personal** or **Organization** (see §0.1).
4. Pay the $25 fee.
5. Complete identity verification: legal name, address, phone. Google verifies
   against a government ID. Expect **1–3 days**, occasionally longer.
6. Organization only: supply the D-U-N-S number and verify the org's website and
   email domain.

You cannot proceed past §1.3 until verification clears.

### 1.2 Create the app

Play Console → **All apps** → **Create app**.

| Field | Value |
| --- | --- |
| App name | Welliva |
| Default language | English (United States) |
| App or game | App |
| Free or paid | **Free** |
| Declarations | Accept both |

> **"Free" is correct even though you are charging.** Play's free/paid toggle
> refers to the *download* price and is **irreversible**. A paid app cannot
> contain subscriptions. Every freemium app on Play is registered as Free.

### 1.3 Set the package name by uploading a build

The package name is bound to the app the first time you upload an AAB — it
cannot be typed in, and **you cannot create subscription products until a build
exists on some track.** So upload one now, before touching Monetize.

```bash
# From the repo root
npx eas build --platform android --profile production
```

This produces an `.aab`. Then in Play Console → **Testing → Internal testing** →
**Create new release** → upload it → **Save** (you do not need to roll it out
yet).

Confirm the package reads `com.welliva.app` on the release page. If it doesn't,
stop and fix [app.json](../../app.json) before continuing — a wrong package name
here is unrecoverable without creating a new app entry.

> Requires an Expo account and `eas-cli`. If `npx eas` is unrecognised:
> `npm install -g eas-cli && eas login`, then `eas build:configure`.
> [eas.json](../../eas.json) is already configured with a `production` profile.

### 1.4 Complete the mandatory declarations

Play blocks subscription setup until the **Dashboard → Set up your app** section
is green. Work through it — most of the answers are already prepared in
[store-submission.md](../legal/store-submission.md):

- Privacy policy URL (must be publicly reachable — in-app text is not enough)
- App access (give reviewers a test account with credentials; the app is behind
  sign-in, and reviewers will reject what they cannot open)
- Ads → declare whether the app shows ads
- Content rating questionnaire
- Target audience and content
- **Data safety** → the table in [store-submission.md §4](../legal/store-submission.md)
- Health apps declaration → Welliva handles health data, so expect this section
- Government apps → No
- Financial features → No

### 1.5 Create the subscription

One subscription, with a monthly and an annual base plan.

Play Console → **Monetize → Products → Subscriptions** → **Create subscription**.

**Subscription level**

| Field | Value |
| --- | --- |
| Product ID | `welliva_pro` — **permanent, cannot be changed or reused after deletion** |
| Name | Welliva Pro |

> If you already created `welliva_plus` before the tiers were merged: leave it
> alone. A Play subscription cannot be deleted and its ID cannot be reused, so
> the move is to **deactivate its base plans** so nobody new can buy it, and let
> existing subscribers run out their period — the app still honours them (§0.3).
> Keep both subscriptions in the same subscription group.

**Base plan 1 — monthly**

Add base plan → ID `p1m`:
- Type: **Auto-renewing**
- Billing period: **Monthly**
- Grace period: 7 days *(keeps a failed-payment user active while the card is retried — meaningfully reduces involuntary churn)*
- Set price: **$2.99** USD, then use **Set prices for other countries** to let
  Google auto-convert

**Base plan 2 — annual**

Add base plan → ID `p1y`:
- Type: **Auto-renewing**
- Billing period: **Yearly**
- Grace period: 7 days
- Price: **$25.88** USD + auto-convert

**Offer — the 7-day free trial**

On the `p1y` base plan → **Add offer** → ID `trial-7d`:
- Eligibility: **New customers only**
- Phase: **Free trial**, 7 days
- Then activate the offer

Finally **activate both base plans**. An inactive base plan is invisible to the
SDK and will read as "product not found."

### 1.6 Add license testers

Play Console → **Setup → License testing** → add the Google accounts that should
be able to purchase without being charged. These accounts see real purchase
dialogs with test payment methods, and subscription periods are compressed
(a monthly sub renews every few minutes) so you can exercise renewal and
cancellation quickly.

Add your own account and anyone testing. **Do this before Part 5** — without it
you will be charged real money during testing.

---

## Part 2 — Google Cloud Console

RevenueCat needs a service account to validate purchases and receive subscription
status from Google's servers. This part produces one JSON key file.

### 2.1 Link a Cloud project to Play

Play Console → **Setup → API access**.

- If a project is already linked, note its name and skip to §2.2.
- Otherwise choose **Link existing project** (pick your existing Welliva project
  from §0.4) or **Create new project**.

### 2.2 Enable the Google Play Android Developer API

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and make
   sure the project selector at the top shows the project you just linked.
2. **APIs & Services → Library**.
3. Search **"Google Play Android Developer API"** → **Enable**.

Skipping this produces authentication errors in RevenueCat that give no hint
about the cause.

### 2.3 Create the service account

1. **IAM & Admin → Service Accounts → Create service account**.
2. Name: `revenuecat-play` (ID autofills as
   `revenuecat-play@<project>.iam.gserviceaccount.com`).
3. **Grant this service account access to project** — leave empty and click
   **Continue**. Project-level IAM roles are not what grants Play access;
   that happens in Play Console in §2.5.
4. Skip user access. **Done**.

### 2.4 Download the JSON key

1. Click the new service account → **Keys** tab.
2. **Add key → Create new key → JSON → Create**.
3. A `.json` file downloads. **This is a credential with billing authority over
   your subscriptions.**
   - Do not commit it. `.gitignore` it if it must live in the repo directory.
   - Store it in a password manager.
   - It cannot be re-downloaded — only replaced.

### 2.5 Grant the service account Play permissions

Back in Play Console → **Setup → API access**. The service account now appears
under **Service accounts** (hit refresh if not). Click **Manage Play Console
permissions** → **Account permissions** tab, and grant:

- ☑ **View app information and download bulk reports (read-only)**
- ☑ **View financial data, orders, and cancellation survey responses**
- ☑ **Manage orders and subscriptions**

Then **Invite user** / **Apply**.

> ⏱ **Propagation takes up to 36 hours.** RevenueCat may report the credentials
> as invalid for the first several hours. This is expected and is not something
> you can fix by re-uploading. Continue with Part 3 and re-check the next day.

---

## Part 3 — RevenueCat

### 3.1 Create the account and project

1. Sign up at [app.revenuecat.com](https://app.revenuecat.com).
2. **Create new project** → name it `Welliva`.

### 3.2 Add the Play Store app

Project → **Apps → + New** → **Google Play Store**.

| Field | Value |
| --- | --- |
| App name | Welliva (Android) |
| Google Play package | `com.welliva.app` |
| Service account credentials JSON | paste the **entire contents** of the file from §2.4 |

Save. RevenueCat validates immediately — a failure here is almost always the
36-hour propagation from §2.5, not a bad key.

### 3.3 Get the SDK key

**Project settings → API keys** → copy the **Public app-specific API key** for
the Android app (starts with `goog_`).

Two keys exist and they are not interchangeable:
- **Public SDK key** (`goog_…`) — ships in the app, safe to expose, same trust
  model as your Supabase anon key.
- **Secret key** (`sk_…`) — server-only, never in the bundle. You will need it in
  Part 6.

### 3.4 Import the products

**Products → + New** → import from Play, or add manually. Add both, using the
compound identifiers:

```
welliva_pro:p1m
welliva_pro:p1y
```

If Play returns nothing, the base plans are not active (§1.5) or the credentials
have not propagated (§2.5).

### 3.5 Create the entitlement

**Entitlements → + New**:

| Identifier | Description | Attach |
| --- | --- | --- |
| `pro` | Full Welliva Pro access | `welliva_pro:p1m`, `welliva_pro:p1y` |

`pro` is the string the app checks (`PRO_ENTITLEMENT` in
services/billing/config.ts).

> **If a `plus` entitlement already exists, keep it.** The app still reads it and
> grants Pro for it (`LEGACY_PLUS_ENTITLEMENT`), which is what stops anyone
> mid-period on the retired tier from being downgraded to free. Do not attach any
> NEW product to it — just leave the existing ones in place until their periods
> expire, then delete it.

### 3.6 Create the offering

**Offerings → + New**. It does not need to be "current"; the app looks it up by
identifier and falls back to the current offering if it isn't found.

| Offering | Package type | Product |
| --- | --- | --- |
| `pro` | `$rc_monthly` | `welliva_pro:p1m` |
| `pro` | `$rc_annual` | `welliva_pro:p1y` |

Using RevenueCat's standard package identifiers means their prebuilt paywall
templates work without configuration.

> **Every package in that offering sells Pro.** With one paid tier there is
> nothing to classify a package into, so `getPlanOptions()` no longer inspects
> identifiers. A leftover `welliva_plus` package left in the offering would be
> sold as Pro at the Plus price — remove it from the offering rather than relying
> on the app to ignore it.

---

## Part 4 — Wire the app

### 4.1 Install the SDK

```bash
npx expo install react-native-purchases react-native-purchases-ui
```

`expo install` picks the version matching Expo SDK 54 — do not `npm install` a
pinned version. `react-native-purchases-ui` is optional but gives you
RevenueCat's remotely-configurable paywall templates, which is worth it to avoid
shipping an app update every time you tune paywall copy.

> **This is a native module.** It does not run in Expo Go. You need a
> development build:
> `npx eas build --platform android --profile development`

### 4.2 Environment variables

Add to [.env.example](../../.env.example) and your local `.env`:

```bash
# ── RevenueCat ──
# Public SDK key from RevenueCat → Project settings → API keys.
# Safe to expose (like the Supabase anon key); entitlements are validated
# server-side against Google, not in the client.
# Leave UNSET to disable billing entirely — the app runs fully free-tier.
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
```

Then add the same keys to each `env` block in [eas.json](../../eas.json), so
builds carry them.

**Mirror the fail-closed pattern from [services/api/config.ts](../../services/api/config.ts):**
an unset key should mean "billing off, everyone is free tier," never a crash.
That keeps web builds and Expo Go working.

### 4.3 Initialize, and tie identity to Supabase

The critical detail: **RevenueCat's app user ID must equal the Supabase user
ID.** Your backend authenticates `/v1` with a Supabase JWT, so matching IDs is
what lets the server ask "is this caller paid?" without a second identity
mapping.

```ts
// services/billing/Billing.ts  (sketch)
import Purchases, { LOG_LEVEL } from "react-native-purchases";

export async function configureBilling(supabaseUserId: string | null) {
  if (!REVENUECAT_KEY) return;              // fail-closed: billing simply off
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);

  await Purchases.configure({
    apiKey: REVENUECAT_KEY,
    appUserID: supabaseUserId ?? undefined, // null → anonymous id
  });
}

// On sign-in / sign-out — keeps purchases attached to the account, not the device
export const onSignIn  = (id: string) => Purchases.logIn(id);
export const onSignOut = () => Purchases.logOut();
```

Call `configureBilling` once at startup ([app/_layout.tsx](../../app/_layout.tsx))
and hook `logIn`/`logOut` into
[components/SupabaseAuthProvider.tsx](../../components/SupabaseAuthProvider.tsx).

> Getting identity wrong is the classic subscription bug: a user pays on their
> phone, signs in on a tablet, and has nothing. Anonymous IDs are device-bound.

### 4.4 Read the tier

This is already built — `services/billing/Billing.ts` reads both entitlements and
keeps the higher one:

```ts
const info = await Purchases.getCustomerInfo();
const active = info.entitlements.active;
const tier = active["pro"] || active["plus"] ? "pro" : "free";
```

The result is persisted by `services/billing/entitlement.ts` and hydrated before
first paint, so a paying user opening the app offline is not downgraded — a
frequent and very annoying bug. `contexts/BillingContext.tsx` is the React face
of it.

### 4.5 The one-line lock that matters

Feature code never compares tiers itself. It asks:

```ts
import { allows } from "@/services/billing";

if (WellivaApi.isConfigured && allows("ai-plans")) { … }
```

`allows()` resolves the feature → tier map in `services/billing/tiers.ts`
(`FEATURE_MIN_TIER`) and applies the fail-open rule for builds with no
RevenueCat key. Everything below Pro silently falls through to
[DietPlanGenerator](../../services/DietPlanGenerator.ts) — a real plan, no dead
end, no error state.

To move a feature between tiers, edit `FEATURE_MIN_TIER` and nothing else: the
locks, the copy on the lock cards and the comparison table on `/upgrade` all read
from it.

---

## Part 5 — Test before you ship

1. Build a dev client: `npx eas build --platform android --profile development`.
2. Install it on a device signed in with a **license tester** account (§1.6).
3. The app must be **downloaded from a Play track at least once** by that
   account, or Play returns "item unavailable." Add the tester to the internal
   testing track and have them accept the opt-in link.
4. Verify, in order, on `/upgrade`:
   - The Pro card loads, and the Monthly/Annual switch shows correct localized prices
   - Buying Pro activates `pro`; the screen flips to the current-plan card
   - Switching monthly → annual reprices without a second concurrent subscription
   - The trial applies on annual, not monthly
   - **Restore purchases** works after reinstalling, and names the tier it found
   - Signing in on a second device carries the entitlement across (proves §4.3)
   - Cancelling in Play flips the card to "Ends …", and access stops at period end
5. Watch RevenueCat → **Customer history** — every event should appear there
   within seconds.

Common failures:

| Symptom | Cause |
| --- | --- |
| "Product not found" / empty offerings | Base plan inactive, or you used `welliva_pro` instead of `welliva_pro:p1m` |
| RevenueCat says credentials invalid | §2.5 propagation — wait up to 36h |
| "Item unavailable for purchase" | Tester account never installed from a Play track |
| Purchase works, entitlement never activates | Product not attached to the `pro` entitlement (§3.5) |
| Entitlement lost on reinstall | Identity not tied to Supabase ID (§4.3) |
| Only one period shows on `/upgrade` | One of the two base plans is inactive, or missing from the `pro` offering (§3.6) |
| A retired Plus subscriber shows as free | The `plus` entitlement was deleted in RevenueCat before its subscriptions expired (§3.5) |

---

## Part 6 — Enforce it server-side

Client-side gating is enough for cosmetic features. It is **not** enough for the
AI endpoints, because those cost you real money per call and a modified client
can call them directly.

1. **RevenueCat → Integrations → Webhooks** → point at your Render backend
   (`https://back-for-welliva.onrender.com/v1/billing/webhook`), with the
   Authorization header value RevenueCat generates.
2. The handler verifies that header, reads `app_user_id` (= the Supabase user
   ID, thanks to §4.3), and writes `tier` (`free` / `pro`) +
   `tier_expires_at` onto that user's profile row in Supabase.
3. The existing `/v1` JWT middleware then checks that column: free users are 402'd
   past their daily cap on `/v1/coach/*`, and `/v1/diet/generate` +
   `/v1/workout/generate` require `pro` (they are the `ai-plans` feature).

This also gives you the per-tier daily message caps (3 / 25 / 100 — mirror
`TIER_LIMITS` from services/billing/tiers.ts) in the one place a user cannot edit.

Two safeguards worth adding at the same time:
- **Fail open on webhook lag.** If the webhook is delayed, prefer briefly
  granting access over locking out a paying customer.
- **Fair-use ceiling** on "unlimited" chat — ~100 turns/day, so a scripted
  abuser cannot run up unbounded Haiku spend.

---

## Part 7 — Go-live checklist

- [ ] Developer account verified; 12-tester / 14-day requirement satisfied (§0.1)
- [ ] Four legal placeholders filled and policy hosted publicly
      ([store-submission.md §2–3](../legal/store-submission.md))
- [ ] Data safety form submitted, including subscription/purchase data
- [ ] Both base plans **active**; trial offer active on the annual plan
- [ ] Service account permissions granted and propagated
- [ ] The `pro` entitlement contains both products, and the `pro` offering exists
      with one package per period
- [ ] RevenueCat keys in all three [eas.json](../../eas.json) profiles
- [ ] Purchase → upgrade → restore → cross-device → cancel all verified on a
      real device
- [ ] Webhook live; `/v1` rejects free users server-side and holds `ai-plans` to Pro
- [ ] `/upgrade` discloses price, period, auto-renewal, and how to cancel with
      the buy button — Play rejects paywalls that hide renewal terms
- [ ] Manage-subscription link on `/upgrade`
      (`https://play.google.com/store/account/subscriptions`) — required by policy
- [ ] Promoted to Production and reviewed

---

## iOS

Deliberately out of scope here — you asked for the Google side. The App Store
track is a separate account ($99/**year**), separate product creation in App
Store Connect, an App-Specific Shared Secret instead of a service-account JSON,
and Apple's own sandbox tester flow. RevenueCat then serves both platforms from
the same `pro` entitlement, so **nothing in Part 4 changes** — you add a second
app in §3.2 and a second API key in §4.2. Put both base plans in one App Store
Connect subscription group so Apple treats a monthly → annual move as a change of
plan rather than a second purchase.

Ask when you want that written up.
