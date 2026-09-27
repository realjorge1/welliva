#!/usr/bin/env node
/**
 * AUTH DOCTOR — checks the Supabase project's auth configuration from a laptop.
 *
 *   node scripts/auth-doctor.mjs
 *
 * Every auth failure this app has had so far was a project SETTING, not code:
 * a redirect URL missing from an allowlist, a Site URL left on localhost:3000,
 * an email quota nobody knew existed. Those are invisible from the app — the
 * symptom is always "the button does nothing" — and checking them by hand means
 * a device, a rebuild and a guess.
 *
 * So this asks the project directly. It is READ-ONLY: it creates no users,
 * sends no email and needs no service key — just the anon key from `.env`, the
 * same one shipped in the app. Run it after any dashboard change to see the
 * change land.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The app's own redirect target. Must match `authRedirectUri()` in the provider. */
const APP_REDIRECT = "welliva://auth-callback";
/** Nothing may ever allow this; it is the control that proves the check works. */
const CONTROL_REDIRECT = "https://definitely-not-allowed.example.com";
/** Providers answer a phone's Custom Tab, so ask the way a phone would. */
const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

const PASS = "PASS";
const FAIL = "FAIL";
const WARN = "WARN";
let failures = 0;

function report(status, title, detail) {
  if (status === FAIL) failures++;
  const mark = status === PASS ? "✓" : status === WARN ? "!" : "✗";
  console.log(`${mark} ${status.padEnd(4)} ${title}`);
  if (detail) console.log(`         ${detail.split("\n").join("\n         ")}`);
}

/** Read EXPO_PUBLIC_* out of .env without pulling in a dotenv dependency. */
function readEnv() {
  let raw;
  try {
    raw = readFileSync(join(root, ".env"), "utf8");
  } catch {
    console.error("No .env at the project root. Copy .env.example and fill it in.");
    process.exit(2);
  }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

/**
 * Where does Supabase send a redirect it was given?
 *
 * A `redirect_to` that is NOT on the allowlist is not rejected — Supabase
 * silently substitutes the Site URL instead. That silence is what made this so
 * hard to find the first time, and it is exactly what this probe exposes: send
 * a deliberately expired token and read the `Location` header. If it echoes the
 * URL we asked for, the URL is allowed. If it shows something else, that
 * something else is the Site URL, and the redirect was refused.
 */
async function resolveRedirect(url, key, redirectTo) {
  const probe =
    `${url}/auth/v1/verify?token=doctor-probe&type=signup` +
    `&redirect_to=${encodeURIComponent(redirectTo)}`;
  const res = await fetch(probe, { headers: { apikey: key }, redirect: "manual" });
  return res.headers.get("location") || "";
}

/**
 * Where does Supabase send someone who taps a provider button?
 *
 * Deliberately WITHOUT a code_challenge. The app sends one (PKCE), and GoTrue
 * then stores a flow_state row per attempt; with none it runs the implicit
 * flow, whose state is a signed token — so asking stays read-only. The URL it
 * hands back is otherwise the same one the app opens.
 */
async function providerAuthorizeUrl(url, key, provider) {
  const res = await fetch(
    `${url}/auth/v1/authorize?provider=${provider}` +
      `&redirect_to=${encodeURIComponent(APP_REDIRECT)}`,
    { headers: { apikey: key }, redirect: "manual" },
  );
  return res.headers.get("location") || "";
}

/**
 * Does Google itself accept the sign-in request Supabase builds?
 *
 * "Google provider enabled" only proves a toggle. The two settings that
 * actually break Google sign-in live at Google: the Client ID pasted into
 * Supabase must exist, and Supabase's callback must be one of its Authorised
 * redirect URIs. Google checks both BEFORE showing the account picker, so no
 * account is needed to ask. A refusal is a redirect to /signin/oauth/error whose
 * `authError` parameter is a small protobuf: field 1 (tag 0x0a, one length
 * byte) is the OAuth error code as plain text — `invalid_client`,
 * `redirect_uri_mismatch`.
 */
async function probeGoogle(authorizeUrl) {
  const res = await fetch(authorizeUrl, {
    redirect: "manual",
    headers: { "user-agent": BROWSER_UA },
  });
  const next = res.headers.get("location") || "";
  if (/\/signin\/oauth\/error/.test(next)) {
    const raw = decodeURIComponent(/[?&]authError=([^&]+)/.exec(next)?.[1] ?? "");
    const bytes = Buffer.from(raw, "base64");
    const code =
      bytes[0] === 0x0a ? bytes.subarray(2, 2 + bytes[1]).toString("utf8") : "unknown";
    return { status: FAIL, code };
  }
  if (/accounts\.google\.com\/.*signin/.test(next)) return { status: PASS };
  return { status: WARN, code: `HTTP ${res.status} -> ${next || "(no redirect)"}` };
}

async function main() {
  const env = readEnv();
  const url = (env.EXPO_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!url || !key) {
    console.error(
      "EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are missing from .env.",
    );
    process.exit(2);
  }

  // Dashboard pages are keyed by project ref, which is the URL's first label.
  // Printing real links beats naming menu items: the dashboard moves things
  // (SMTP used to live under Project Settings and is now inside Emails).
  const projectRef = /^https:\/\/([a-z0-9]+)\.supabase\./.exec(url)?.[1] ?? "<project-ref>";
  const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}`;

  console.log(`\nSupabase project: ${url}`);
  console.log(`Dashboard:        ${dashboardUrl}\n`);

  // ── Providers ─────────────────────────────────────────────────────────────
  const settingsRes = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
  });
  if (!settingsRes.ok) {
    report(FAIL, "Reach the project", `GET /auth/v1/settings returned ${settingsRes.status}`);
    process.exit(1);
  }
  const settings = await settingsRes.json();
  const external = settings.external || {};

  report(PASS, "Project reachable with the anon key");
  report(
    external.email ? PASS : FAIL,
    "Email/password provider enabled",
    external.email ? null : "Authentication -> Providers -> Email",
  );
  report(
    external.google ? PASS : FAIL,
    "Google provider enabled",
    external.google ? null : "Authentication -> Providers -> Google (needs a Client ID + Secret)",
  );
  report(
    external.facebook ? PASS : WARN,
    "Facebook provider enabled",
    external.facebook
      ? null
      : "Authentication -> Providers -> Facebook. The app hides the button until this is on,\n" +
        "so this is a WARN, not a failure — see docs/OAUTH_SETUP.md section 3.",
  );

  // ── Provider handshakes ───────────────────────────────────────────────────
  // A toggle being on says nothing about the credentials behind it. Follow the
  // button's first hops and see whether the provider takes the request.
  if (external.google) {
    const authorizeUrl = await providerAuthorizeUrl(url, key, "google");
    const callback = authorizeUrl ? new URL(authorizeUrl).searchParams.get("redirect_uri") : null;
    const google = authorizeUrl.startsWith("https://accounts.google.com")
      ? await probeGoogle(authorizeUrl)
      : { status: FAIL, code: `Supabase did not redirect to Google (got ${authorizeUrl || "nothing"})` };
    const fixes = {
      invalid_client:
        "The Client ID saved in Supabase does not exist at Google (typo, or the OAuth client\n" +
        "was deleted). Re-copy it from Google Cloud -> APIs & Services -> Credentials.",
      redirect_uri_mismatch:
        `Add ${callback} to the OAuth client's\n` +
        "Authorised redirect URIs in Google Cloud -> APIs & Services -> Credentials.",
    };
    report(
      google.status,
      "Google accepts the Client ID and the Supabase callback",
      google.status === PASS
        ? "Reaches Google's account picker. Not visible from here: the Client Secret (only used\n" +
            "after sign-in), and whether the consent screen is published — while it is in\n" +
            "Testing, only listed test users get past the picker. See docs/OAUTH_SETUP.md §2."
        : `${google.code}${fixes[google.code] ? `\n${fixes[google.code]}` : ""}`,
    );
  }

  if (external.facebook) {
    // Facebook validates its settings only AFTER someone logs in (a logged-out
    // request just gets an encrypted redirect to the login page), so the most
    // that can be proven from here is what Supabase sends: an all-digits App ID.
    // The usual paste mistake is the App Secret or the Client Token instead.
    const authorizeUrl = await providerAuthorizeUrl(url, key, "facebook");
    const params = authorizeUrl ? new URL(authorizeUrl).searchParams : new URLSearchParams();
    const appId = params.get("client_id") || "";
    const callback = params.get("redirect_uri") || `${url}/auth/v1/callback`;
    const looksRight = /^\d{10,20}$/.test(appId);
    report(
      looksRight ? PASS : FAIL,
      "Facebook App ID looks like an App ID",
      looksRight
        ? `App ID ${appId}. Facebook checks the rest only after a login, so on a device:\n` +
            `· Valid OAuth Redirect URIs must include ${callback}\n` +
            "· the Login use case must have the `email` permission added ('Invalid Scopes: email')\n" +
            "· in Development mode only people with a role on the app can sign in\n" +
            "See docs/OAUTH_SETUP.md §3."
        : `Supabase sends client_id=${appId || "(none)"}. Facebook App IDs are all digits —\n` +
            "paste the App ID from App settings -> Basic, not the App Secret or Client Token.",
    );
  }

  // ── Redirect allowlist ────────────────────────────────────────────────────
  const control = await resolveRedirect(url, key, CONTROL_REDIRECT);
  const siteUrl = control.split(/[#?]/)[0];
  const allowed = await resolveRedirect(url, key, APP_REDIRECT);
  const isAllowed = allowed.startsWith(APP_REDIRECT);

  report(
    isAllowed ? PASS : FAIL,
    `Redirect allowlist contains ${APP_REDIRECT}`,
    isAllowed
      ? null
      : `Supabase redirected to ${siteUrl} instead of the app.\n` +
        "Authentication -> URL Configuration -> Redirect URLs. Without this every OAuth\n" +
        "sign-in and every confirmation link dead-ends outside the app, with no error.",
  );

  // ── Site URL ──────────────────────────────────────────────────────────────
  const siteIsLocal = /localhost|127\.0\.0\.1/.test(siteUrl);
  report(
    siteIsLocal ? WARN : PASS,
    "Site URL is not the localhost default",
    siteIsLocal
      ? `Site URL is ${siteUrl}. It is the fallback for any redirect that is refused, and it is\n` +
        "what {{ .SiteURL }} renders as in the email templates. Point it at welliva://auth-callback\n" +
        "(or a real https page) under Authentication -> URL Configuration."
      : `Site URL: ${siteUrl}`,
  );

  // ── Email confirmation ────────────────────────────────────────────────────
  report(
    PASS,
    `Email confirmation is ${settings.mailer_autoconfirm ? "OFF (auto-confirm)" : "ON"}`,
    settings.mailer_autoconfirm
      ? "Accounts are usable immediately and no confirmation email is sent. The app handles\n" +
        "this: sign-up gets a live session and routes straight into onboarding."
      : "Every sign-up needs a delivered email. Check the SMTP section below — Supabase's\n" +
        "built-in sender is capped at a couple of messages an hour for the WHOLE project.",
  );

  if (!settings.mailer_autoconfirm) {
    console.log(
      "\n  Custom SMTP cannot be read from here — the settings endpoint does not expose it.\n" +
        `  Confirm it by hand:  ${dashboardUrl}/auth/smtp\n` +
        "  (Authentication -> Emails, under NOTIFICATIONS -> SMTP Settings tab. It is NOT\n" +
        "  under Project Settings, and there is no sidebar entry called 'SMTP'.)\n" +
        "  If 'Enable Custom SMTP' is off, sign-ups WILL fail with\n" +
        "  over_email_send_rate_limit after the first couple, and no account is created.\n",
    );
  }

  report(
    settings.disable_signup ? FAIL : PASS,
    "Sign-ups are open",
    settings.disable_signup ? "Authentication -> Providers -> Email -> Allow new users" : null,
  );

  console.log(
    failures === 0
      ? "\nNo blocking problems found.\n"
      : `\n${failures} blocking problem(s). See docs/OAUTH_SETUP.md.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("auth-doctor failed:", err);
  process.exit(2);
});
