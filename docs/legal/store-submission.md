# Legal & store-submission checklist

Everything the app itself needs is now in the codebase. What remains is the part
that lives outside the bundle — the hosted policy, the store forms, and four
placeholder strings.

## 1. What shipped in-app

| Piece | Where |
| --- | --- |
| Privacy Policy, Terms of Use, Medical Disclaimer (content) | [constants/legal.ts](../../constants/legal.ts) |
| Document renderer | [components/legal/LegalDocumentView.tsx](../../components/legal/LegalDocumentView.tsx) |
| Document routes (`/legal/privacy`, `/legal/terms`, `/legal/disclaimer`) | [app/legal/\[doc\].tsx](../../app/legal/[doc].tsx) |
| Consent gate — after sign-in, before onboarding | [app/legal/consent.tsx](../../app/legal/consent.tsx) |
| Acceptance record (version + account + timestamp) | [services/legal/LegalAcceptance.ts](../../services/legal/LegalAcceptance.ts) |
| Gate state shared with the router | [components/legal/LegalGate.tsx](../../components/legal/LegalGate.tsx) |
| Routing enforcement | [components/AuthWrapper.tsx](../../components/AuthWrapper.tsx) |
| Inline medical disclaimer | [components/legal/DisclaimerNote.tsx](../../components/legal/DisclaimerNote.tsx) — onboarding health step + plan reveal, Diet targets, Gozlin composer |
| Re-readable any time | Settings → Legal, More → Privacy |
| Sign-up microcopy | [components/AuthKit.tsx](../../components/AuthKit.tsx) (`AuthLegalNote`) |

The gate is version-pinned: bump `LEGAL_VERSION` in `constants/legal.ts` on any
material wording change and every user re-accepts on next launch.

## 2. Before submitting — four placeholders

In `constants/legal.ts`:

- `LEGAL_ENTITY` — the registered name of the operating entity
- `LEGAL_POSTAL_ADDRESS` — required by GDPR-style transparency rules
- `LEGAL_JURISDICTION` — governing law for the Terms
- `LEGAL_CONTACT_EMAIL` — must be a monitored mailbox (rights requests carry a
  30-day deadline in the policy)

Then bump `LEGAL_LAST_UPDATED`.

## 3. Host the same text publicly

Both stores require a **publicly reachable URL** on the listing — in-app text is
not enough. Publish the same content at:

- `PRIVACY_POLICY_URL` → https://welliva.app/legal/privacy
- `TERMS_URL` → https://welliva.app/legal/terms

Keep the hosted copy and `constants/legal.ts` in sync; a mismatch is exactly what
reviewers look for. The document data is plain structured objects, so a small
script can render the same sections to HTML.

## 4. Google Play — Data safety form

Answers implied by the current code. "Collected" = leaves the device;
"Processed ephemerally" and on-device-only storage are **not** collection.

| Data type | Collected | Shared | Purpose | Optional? |
| --- | --- | --- | --- | --- |
| Email address | Yes | No | Account management | Required |
| Name, profile photo | Yes (Google sign-in / avatar upload) | No | Account management | Optional |
| Health info (conditions, pregnancy, medications, injuries, allergies) | Yes (synced to the user's private row) | No | App functionality | Optional |
| Fitness info (workouts, sessions, body metrics) | Yes | No | App functionality | Optional |
| Photos (progress photos, meal photos) | Yes (private bucket) | No | App functionality | Optional |
| Voice / audio | Yes, only if voice is enabled | No | App functionality | Optional |
| Calendar | No — read on-device only | No | App functionality | Optional |
| Approximate location | Not stored; sent to the weather API only | No | App functionality | Optional |
| Messages to the AI coach | Yes | Yes — processed by our AI provider | App functionality | Optional |
| Crash logs / diagnostics | No | No | — | — |
| Advertising ID | No | No | — | — |

Also declare: data is encrypted in transit (yes); users can request deletion
(yes); no data is sold.

On the Play **Data deletion** question, give the in-app route — Settings → Data →
**Delete account** — not only an email address. Play accepts an email-only route
but flags apps that have an account system without an in-app path, and Apple
rejects them outright (5.1.1(v)). Both are satisfied by the flow in
`app/settings.tsx`, which calls the `delete_account` RPC from
`supabase/migrations/20260727130000_account_deletion.sql`. `Settings → Reset data`
sits directly above it and is a DIFFERENT thing — device-local wipe, account
intact — so don't cite it as the deletion route.

Play additionally requires a **Health apps declaration** for apps handling health
data — expect to state that Welliva is a general wellness app, not a medical
device, and to point at the medical disclaimer.

## 5. Apple — privacy nutrition labels & review notes

Label mapping (App Store Connect → App Privacy):

- **Data linked to you**: Contact Info (email, name), Health & Fitness, User
  Content (photos, audio, messages), Identifiers (user ID)
- **Data not collected**: Advertising data, browsing history, search history,
  purchases, contacts, precise location
- **Tracking**: none — no ATT prompt, no advertising SDKs

Review notes worth pasting into the submission:

> Welliva is a general wellness and fitness app. It is not a medical device and
> does not diagnose or treat any condition. A medical disclaimer is presented
> before onboarding (users must accept it to proceed) and is repeated wherever
> the app displays calorie or macronutrient targets, on the nutrition screen and
> on the AI coach screen. Health-related questions to the AI coach — symptoms,
> diagnosis, medication, crisis topics — are refused deterministically and
> referred to a qualified professional.

Guidelines this addresses: **1.4.1** (medical disclaimer / no medical claims),
**5.1.1** (privacy policy, purpose strings, consent before collecting health
data), **5.1.2** (health data not used for advertising).

## 6. Sanity checks before you ship

- [ ] Fresh install → sign up → the gate appears before any onboarding question
- [ ] "Accept & continue" stays disabled until the box is ticked
- [ ] Android hardware back does not escape the gate
- [ ] All three documents open from the gate, and back returns to it
- [ ] "Decline and sign out" returns to sign-in
- [ ] Second launch → no gate; Settings → Legal shows the accepted version/date
- [ ] Bump `LEGAL_VERSION` locally → the gate reappears once, then stops
- [ ] Settings → Reset data → the gate reappears on the next launch (the purge
      clears the stored acceptance; the in-memory gate state lives until restart)

### Account deletion (App Store 5.1.1(v) — a hard rejection if missing)

- [ ] Settings → Data → **Delete account** exists and is reachable without
      contacting support
- [ ] The confirm button stays disabled until `DELETE` is typed **and** the
      password field is non-empty
- [ ] Wrong password → inline "That password isn't right", the sheet stays open,
      and the account is still there afterwards
- [ ] Cancel, and the scrim tap, both leave the account untouched
- [ ] Confirm → returns to sign-in, and the SAME credentials no longer work
- [ ] Sign up again with that email → onboarding from scratch, no old data
      (proves the cascade ran, not just a sign-out)
- [ ] Check the dashboard: no rows for that uid in `users`, `nutrition_logs`,
      `sync_documents`; no objects under `<uid>/` in any of the three buckets
- [ ] Airplane mode → confirm → the error says the account was NOT deleted, and
      the app still works afterwards
- [ ] If/when Google sign-in is switched on: a Google account sees **no**
      password field and can still delete (asking one for a password they never
      set would lock them out of the very right this section is about)

### Legal identity (guarded by `constants/__tests__/legal.test.ts`)

- [ ] `npm test` is green — the guard fails the build while any of
      `LEGAL_ENTITY` / `LEGAL_CONTACT_EMAIL` / `LEGAL_POSTAL_ADDRESS` /
      `LEGAL_JURISDICTION` still holds placeholder text
- [ ] `PRIVACY_POLICY_URL` and `TERMS_URL` load publicly in a browser, signed
      out — both stores fetch them from the listing, not from the app
