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
