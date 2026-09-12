# Auth Setup Guide for Welliva

Everything needed to connect this app to Supabase and get all three ways in
working: email/password, Google, and Facebook.

## Check before you read

```bash
npm run auth:doctor
```

Read-only — it creates no users and sends no email. It asks the live project
which providers are on, whether the app's redirect URL is allowlisted, and what
the Site URL is, then prints what to fix and where. Run it after every dashboard
change; a change that didn't take shows up here rather than on a device.

**Every auth problem this app has had was a project setting, not code.** The
symptom is always the same — a button that appears to do nothing — because
Supabase's failure mode for a misconfiguration is a silent redirect somewhere
else. Start with the doctor.

---

## 0. Connecting the app to Supabase

### Step 1 — Create the project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Pick a region close to your users (this one is `eu-central-1`) and set a
   database password. Save that password somewhere; it is not shown again and
   you need it for direct database access.
3. Wait for provisioning to finish (~2 minutes).

### Step 2 — Copy the two keys into `.env`

**Project Settings → API** has both values:

```bash
# .env  (never committed — see .gitignore)
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the anon / public key>
```

Use the **anon** key, never the **service_role** key. The anon key is designed
to ship inside a client; every table is protected by Row Level Security behind
it (`supabase/migrations/*_rls.sql`). The service_role key bypasses RLS
entirely, and anything in `EXPO_PUBLIC_*` is readable in the shipped bundle.

`EXPO_PUBLIC_` is not decoration: Expo only exposes variables with that prefix
to app code. Renaming them breaks `lib/supabase.ts`.

Restart Metro after editing `.env` — env vars are read at bundle time:

```bash
npm run start:clean
```

### Step 3 — Apply the schema

The tables, RLS policies, storage buckets and the account-deletion RPC all live
in `supabase/migrations/` and are idempotent, so re-running them is safe.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Step 4 — Configure auth URLs

**Authentication → URL Configuration.** Both fields matter, and neither
announces itself when wrong.

| Field | Value | Why |
|---|---|---|
| **Site URL** | `welliva://auth-callback` | The fallback for any redirect Supabase refuses, and what `{{ .SiteURL }}` renders as in the email templates. The default is `http://localhost:3000`, which on a phone is a broken page. |
| **Redirect URLs** | `welliva://auth-callback` | The allowlist. Without this entry every OAuth sign-in and every confirmation link is silently redirected to the Site URL instead of into the app. |

Add these too if you use them:

```
exp://127.0.0.1:8081/--/auth-callback     # Expo Go / dev client on localhost
exp://192.168.x.x:8081/--/auth-callback   # Expo Go over LAN — the IP Metro prints
http://localhost:8081                      # expo start --web
```

The app asks for `welliva://auth-callback` (`authRedirectUri()` in
`components/SupabaseAuthProvider.tsx`), and `app.json` already declares
`"scheme": "welliva"`, which is what makes that URL open the app.

### Step 5 — Verify

```bash
npm run auth:doctor
```

---

## 1. Email/Password

Enabled by default. **Authentication → Providers → Email.**

- **Confirm email** ON (the default) means sign-up creates an account with no
  session until the emailed link is tapped. The app handles this: it routes to
  `/verify-email`, and the link deep-links back to complete the sign-in.
- **Confirm email** OFF means sign-up returns a live session immediately and the
  app goes straight to onboarding. No email is sent at all.

### The one that bites: SMTP

> **Supabase's built-in email sender is capped at a couple of messages per hour
> for the entire project, and it is not intended for real users.**

Past that cap `signUp` fails with `over_email_send_rate_limit`, and — this is
the part that makes it look like an app bug — **no account is created**. So the
user sees no email, and when they then try to sign in with the details they just
typed they are told the credentials are invalid. They are: there is no account.

Two sign-ups while testing is enough to hit it.

**Fix: configure custom SMTP.** *Authentication → **Emails** (under NOTIFICATIONS
in the sidebar) → **SMTP Settings** tab → **Enable Custom SMTP**.*

Direct link: `https://supabase.com/dashboard/project/<your-project-ref>/auth/smtp`

It is not under Project Settings, and there is no sidebar entry called "SMTP" —
it lives inside the Emails page alongside the templates.

Any provider works. [Resend](https://resend.com) is the least work
(free tier, DNS-verified sender):

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender email | an address at a domain you verified with the provider |
| Sender name | `Welliva` |

Then raise **Authentication → Rate Limits → "Rate limit for sending emails"** from the default
to something usable (100+).

The sender domain must be verified with the provider (SPF/DKIM records). Sending
from an unverified domain gets the mail delivered to spam or refused outright,
which looks exactly like the quota problem.

### Email templates

**Authentication → Email Templates.** The defaults work with this app; if you
customise **Confirm signup**, keep `{{ .ConfirmationURL }}` as the link target —
it is what carries the PKCE code back to `welliva://auth-callback`.

---

## 2. Google

### Step 1 — Google Cloud credentials

1. [Google Cloud Console](https://console.cloud.google.com/) → create or pick a
   project.
2. **APIs & Services → OAuth consent screen**: External, app name `Welliva`,
   support + developer contact email, and a privacy policy URL.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   application type **Web application**.
4. Authorised redirect URI — exactly one, and it is Supabase's, not the app's:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

   Do **not** add `welliva://auth-callback` here. Google never redirects to the
   app; it redirects to Supabase, and Supabase redirects to the app. That second
   hop is governed by the allowlist in §0 Step 4, and it is the one people miss.
5. Copy the **Client ID** and **Client Secret**.

### Step 2 — Supabase

**Authentication → Providers → Google** → enable, paste both values, save.

### Step 3 — Publish the consent screen

While the consent screen is in **Testing**, only accounts listed under
**Test users** can sign in; everyone else gets *"Access blocked: Welliva has not
completed the Google verification process"*. **Publish app** when you are ready
for real users.

---

## 3. Facebook

The app's Facebook button is wired and ready. It **only appears once the
provider is enabled on the Supabase project** — `components/auth/socialProviders.ts`
asks `/auth/v1/settings` at launch which providers are actually on, so a
provider that would fail with *"provider is not enabled"* is never drawn. That
also means enabling it below makes the button appear on the next app launch,
with no rebuild and no release.

### Step 1 — Create the Facebook app

1. [developers.facebook.com](https://developers.facebook.com/) → **My Apps →
   Create App**.
2. Use case: **Authenticate and request data from users with Facebook Login**.
3. App name `Welliva`, plus a contact email.

### Step 2 — Add Facebook Login

1. **Add Product → Facebook Login → Set Up**, platform **Web**.
2. Site URL: `https://<your-project-ref>.supabase.co`
3. **Facebook Login → Settings** → Valid OAuth Redirect URIs:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

   Same rule as Google: Supabase's callback, never the app's scheme.
4. Keep **Client OAuth Login** and **Web OAuth Login** on.

### Step 3 — Credentials

**Settings → Basic**: copy the **App ID**, reveal and copy the **App Secret**,
and set **App Domains** to `<your-project-ref>.supabase.co`.

### Step 4 — Supabase

**Authentication → Providers → Facebook** → enable, App ID as *Client ID*, App
Secret as *Client Secret*, save. Confirm with `npm run auth:doctor` — the
Facebook line turns from WARN to PASS.

### Step 5 — Go live

A new Facebook app is in **Development Mode**: only developers, testers and
admins can sign in. To open it up you need a **Privacy Policy URL**, a
**1024×1024 app icon**, and a completed **Data Deletion** callback or
instructions URL in *Settings → Basic*, then switch to **Live**.

`email` and `public_profile` are granted without App Review, and they are all
this app requests.

---

## 4. Apple

Not implemented. `signInWithApple` throws a "coming soon" message. Sign in with
Apple is a native capability — an entitlement, a paid Apple Developer account
and `expo-apple-authentication` — not a provider toggle, so it cannot ride the
same web flow as Google and Facebook.

Note for the App Store: Apple requires Sign in with Apple **only** if the app
offers other third-party sign-ins. Shipping Google and Facebook makes it
mandatory (App Store Review Guideline 4.8).

---

## 5. How the redirect actually works

Worth understanding once, because every failure mode above is a variation on it.

```
Google/Facebook  ──►  https://<ref>.supabase.co/auth/v1/callback   (fixed, set at the provider)
                          │
                          ▼
                      welliva://auth-callback?code=…                (the allowlist governs this hop)
                          │
                          ▼
    SupabaseAuthProvider exchanges the code for a session
```

Three details that cost real debugging time:

- **A refused redirect is not an error.** If `welliva://auth-callback` is not on
  the allowlist, Supabase substitutes the Site URL and returns 302 as though
  nothing were wrong. The phone then tries to open `localhost:3000` on itself.
- **Errors arrive in two different places.** OAuth failures come back as
  `?error=…` in the query string; expired email links come back as `#error=…` in
  the *fragment*. `components/auth/authRedirect.ts` reads both — an earlier
  version used `Linking.parse`, which drops fragments, so expired links produced
  a sign-in screen with no message on it.
- **Auth codes are single-use, and on Android two paths see each one** (the
  `Linking` listener and `openAuthSessionAsync`'s resolved value). Unguarded,
  the loser fails with *"code verifier should be non-empty"* — a successful
  sign-in that also reports failure. `exchangeCodeOnce` single-flights it. Do
  not simplify that into a boolean.

---

## 6. Testing

### Email

1. `npm run start:clean`, then Sign Up.
2. The confirmation email should arrive within seconds. If it does not, it is
   almost certainly §1's SMTP quota — check **Authentication → Logs**.
3. Tapping the link opens the app and signs you in.
4. `example.com` and other reserved domains are rejected by Supabase with
   `email_address_invalid`. Test with a real address.

### Google / Facebook

1. Tap the provider button; a browser opens.
2. Approve; the browser closes and the app signs you in.
3. Backing out of the browser cancels quietly — that is deliberate, not a
   swallowed error. A genuine failure now shows a message.

### Verifying a deep link without the whole flow

```bash
adb shell am start -a android.intent.action.VIEW -d "welliva://auth-callback?code=test"
```

The app should foreground. A "no activity found" means the scheme is not
registered — rebuild after any `app.json` scheme change.

---

## Troubleshooting

### "Nothing happens when I sign up"

Overwhelmingly the SMTP quota (§1). Confirm in **Authentication → Logs**: an
`over_email_send_rate_limit` entry means the account was never created, which is
also why signing in with those details then fails.

### Browser opens, I sign in, the app never comes back

`welliva://auth-callback` is missing from **Authentication → URL Configuration →
Redirect URLs**. `npm run auth:doctor` reports this directly.

On a device, the signature is an orphaned code verifier and no session:

```bash
adb shell run-as com.welliva.app cat /data/data/com.welliva.app/shared_prefs/SecureStore.xml
```

### Google

- **`redirect_uri_mismatch`** — the Google Console redirect URI is not exactly
  `https://<ref>.supabase.co/auth/v1/callback`.
- **`invalid_client`** — Client ID or Secret wrong in Supabase.
- **"Access blocked … verification process"** — the consent screen is still in
  Testing (§2 Step 3).

### Facebook

- **Button doesn't appear** — the provider is off in Supabase. That is by
  design; see §3.
- **"URL Blocked"** — add `<ref>.supabase.co` to App Domains.
- **Only admins can sign in** — still in Development Mode (§3 Step 5).

### Email

- **"Email not confirmed"** — the app now routes to `/verify-email` so a new
  link can be sent.
- **Link says it expired** — default lifetime is 24h, and links are single-use.
  The message now names the reason instead of failing silently.
- **`WebCrypto API is not supported`** — a permanent red herring. Hermes has no
  `crypto.subtle`, so supabase-js uses a `plain` PKCE challenge, which works.

---

## Production checklist

- [ ] Custom SMTP configured and the email rate limit raised — **the one that
      breaks sign-ups**
- [ ] Site URL is not `localhost:3000`
- [ ] `welliva://auth-callback` on the Redirect URLs allowlist
- [ ] Google consent screen published
- [ ] Facebook app in Live Mode with a data-deletion URL
- [ ] Privacy Policy and Terms URLs set at both providers
- [ ] `npm run auth:doctor` clean
- [ ] All three flows tested on a real device build

---

## Reference

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login)
- [Expo AuthSession](https://docs.expo.dev/guides/authentication/)
