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

## 2. Legal identity — settled

`constants/legal.ts` holds three identity constants. All three are real, and
`constants/__tests__/legal.test.ts` is green.

| Constant | Value | Notes |
|---|---|---|
| `LEGAL_ENTITY` | `"welliva"` | Replace if the registered name differs from the trading name. |
| `LEGAL_CONTACT_EMAIL` | `"mrjorgeobika@gmail.com"` | The **only** contact the documents give, so it must be a **monitored** mailbox — the policy commits to a 30-day response on rights requests. Was `privacy@welliva.app` until the domain lapsed (September 2026). |
| `LEGAL_JURISDICTION` | `"Nigeria"` | Filled 10 September 2026. Renders as "the laws of Nigeria" in the Terms' governing-law section — keep that shape if it ever changes ("Nigerian law" would not read correctly). |

### No postal address — the owner's decision, 14 November 2026

There used to be a fourth constant, `LEGAL_POSTAL_ADDRESS`, holding the bracket
text `"[registered business address — to be completed]"`. It kept two guard
assertions red from 10 September to 14 November 2026, by the owner's instruction
not to publish an invented address. On 14 November the owner chose to **leave
the address out**: the Privacy Policy's "Who we are" line now gives the email as
the way to reach us, and the constant is gone. The change was folded into the
still-unpublished `LEGAL_VERSION` 5, so users re-accept once, not twice.

Store accounts are a separate matter: Google Play may still ask for a physical
address in Play Console for a developer who sells subscriptions. That lives in
the developer account, not in these documents.

**If a real address is ever wanted:** add the constant back with the **real**
value, put it into the "Who we are" sentence, add it to `IDENTITY` in the guard
test, and republish (section 3). The guard rejects square brackets anywhere in a
value (so `"12 High St [Suite 4]"` fails) and `TODO`, `TBD`, `FIXME`, `XXX` or
"to be completed". Adding a contact detail does not change any document's
meaning, so it needs no `LEGAL_VERSION` bump of its own.

**The gate is correct. Do not relax it, skip it, or loosen the `PLACEHOLDER`
regex.** It scans every identity constant and every rendered line of the privacy
policy, terms and disclaimer — the documents a user must accept before the app
asks them about pregnancy, medication or kidney disease. Invented details in a
live privacy policy are materially worse than a red test, which is why the test
fails loudly rather than warning.

## 3. Host the same text publicly

Both stores require a **publicly reachable URL** on the listing — in-app text is
not enough. The same content is published (GitHub Pages, `gh-pages` branch) at:

- `PRIVACY_POLICY_URL` → https://realjorge1.github.io/welliva/privacy/
- `TERMS_URL` → https://realjorge1.github.io/welliva/terms/
- `DATA_DELETION_URL` → https://realjorge1.github.io/welliva/data-deletion/
  (Facebook Login's required data-deletion instructions page)

The pages are rendered from `constants/legal.ts` by `scripts/legal-site.mjs`, so
they cannot be edited out of step with the app — but they can go STALE. After
any change to the legal text, run `npm run legal:publish`; a hosted copy that
differs from the one users accepted is exactly what reviewers look for.

## 4. Google Play — Data safety form

Answers implied by the current code. "Collected" = leaves the device;
"Processed ephemerally" and on-device-only storage are **not** collection.

| Data type | Collected | Shared | Purpose | Optional? |
| --- | --- | --- | --- | --- |
| Email address | Yes | No | Account management | Required |
| Name, profile photo | Yes (Google sign-in / avatar upload) | No | Account management | Optional |
| Health info (conditions, pregnancy, medications, injuries, allergies — and, if cycle tracking is on, period dates, flow, symptoms, mood) | Yes (synced to the user's private row) | No — see "Sharing" below | App functionality | Optional |
| Fitness info (workouts, sessions, body metrics) | Yes | No | App functionality | Optional |
| Photos (progress photos, meal photos) | Yes (private bucket) | No | App functionality | Optional |
| Voice / audio | No — voice logging was removed (2026-11-15) and the microphone permission with it | No | — | — |
| Calendar | No — read on-device only; if switched on, workouts / likely cycle days are written to a local, unsynced "welliva" calendar on the phone (policy v6) | No | App functionality | Optional |
| Approximate location | Not stored; sent to the weather API only | No | App functionality | Optional |
| Messages to the AI coach | Yes | Yes — processed by our AI provider | App functionality | Optional |
| Crash logs / diagnostics | No | No | — | — |
| Advertising ID | No | No | — | — |

Also declare: data is encrypted in transit (yes); users can request deletion
(yes); no data is sold.

**Cycle tracking (added 15 October 2026).** The form has no menstrual-health
data type: Google defines *Health info* as "information about a user's health,
such as medical records or symptoms", and a cycle log is that. So there is no new
row — the existing *Health info* row already says Collected, and the cycle log
rides inside it. What to check when you next open the form:

- *Health info* stays **Optional** — true, because cycle tracking is off until the
  user enables it, and Google only allows "optional" if every user can decline.
- *Purposes* stay **App functionality**; add **Personalization** only if you want
  the lighter-session feature counted separately (not required).
- *Deletion*: the in-app "Delete all cycle data" and account deletion both erase it.
- **Resting temperature and "which pill" (policy v7, 20 November 2026).** The
  cycle log can now hold a temperature on waking (fertile-window users only) and,
  after a "yes" to hormonal contraception, whether it's the combined pill and its
  pack length. Both are still *Health info* (user-entered, optional, synced with
  the log, erased with it): no new row, no new purpose. Neither reaches the coach.
- **Sharing.** The cycle day, predicted next period and today's log leave the
  phone for the AI coach ONLY when the user switches on "Let Gozlin see your
  cycle" (off by default). Anthropic is a service provider processing on our
  behalf, which Google's definition does NOT count as "sharing". The table above
  already declares coach messages as shared (the conservative reading) while
  health info is "No", even though a minimised health summary already reaches the
  coach. **Pick one rule and apply it to both rows** — the owner's decision, not
  something to leave inconsistent.

**Health apps declaration (separate from Data safety).** Play Console → Policy →
App content → Health apps. Tick **Period Tracking** (listed under *Health and
fitness*, described as menstrual cycle tracking, ovulation tracking and
prediction) alongside whatever is already ticked. Do NOT tick *Reproductive and
Sexual Health* (that is under *Medical*) or *Medical Device*: welliva is a
wellness tracker and the fertile window is an opt-in estimate. The store
description needs the line Play requires of non-medical-device health apps:
"not a medical device and does not diagnose, treat, cure, or prevent any medical
condition", plus a reminder to consult a healthcare professional.

On the Play **Data deletion** question, give the in-app route — Settings → Danger zone →
**Delete account** — not only an email address. Play accepts an email-only route
but flags apps that have an account system without an in-app path, and Apple
rejects them outright (5.1.1(v)). Both are satisfied by the flow in
`app/settings.tsx`, which calls the `delete_account` RPC from
`supabase/migrations/20260727130000_account_deletion.sql`. `Settings → Reset data`
sits directly above it and is a DIFFERENT thing — device-local wipe, account
intact — so don't cite it as the deletion route.

Play additionally requires a **Health apps declaration** for apps handling health
data — expect to state that welliva is a general wellness app, not a medical
device, and to point at the medical disclaimer.

## 5. Apple — privacy nutrition labels & review notes

Label mapping (App Store Connect → App Privacy):

- **Data linked to you**: Contact Info (email, name), Health & Fitness (this
  already covers the cycle log — Apple's *Health* type is any user-provided health
  data, with no separate reproductive entry), User Content (photos, audio,
  messages), Identifiers (user ID)
- **Data not collected**: Advertising data, browsing history, search history,
  purchases, contacts, precise location
- **Tracking**: none — no ATT prompt, no advertising SDKs

Review notes worth pasting into the submission:

> welliva is a general wellness and fitness app. It is not a medical device and
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

- [ ] Settings → Danger zone → **Delete account** exists and is reachable without
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
      `LEGAL_ENTITY` / `LEGAL_CONTACT_EMAIL` / `LEGAL_JURISDICTION`, or any
      line of the three documents, holds placeholder text
- [ ] `PRIVACY_POLICY_URL` and `TERMS_URL` load publicly in a browser, signed
      out — both stores fetch them from the listing, not from the app
