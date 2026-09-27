#!/usr/bin/env node
/**
 * BILLING DOCTOR — checks the subscription chain from a laptop.
 *
 *   npm run billing:doctor
 *
 * Billing that is OFF is silent by design: with no RevenueCat key the app fails
 * OPEN (everything unlocked, nothing for sale — services/billing/gating.ts), so
 * a broken link looks exactly like "the app never calls RevenueCat". The first
 * time that happened the key sat in eas.json but not in `.env`, and every build
 * whose JS came from Metro — `npx expo run:android`, the EAS `development` dev
 * client — ran with billing off.
 *
 * So this walks the chain in the order the app does: key in the bundle → SDK
 * installed → RevenueCat serves an offering the storefront can read → every
 * product in it grants `pro`. It is READ-ONLY and needs only the PUBLIC key
 * (the one shipped in the app): it asks RevenueCat the same two questions the
 * SDK asks on a phone. The Play-side settings it cannot see are listed at the end.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Must match services/billing/config.ts. */
const PRO_ENTITLEMENT = "pro";
const LEGACY_PLUS_ENTITLEMENT = "plus";
const NAMED_OFFERING = "pro";
const KEY_VAR = "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY";
/** The package types the storefront's Monthly/Annual switch can find. */
const REQUIRED_PACKAGES = { $rc_monthly: "monthly", $rc_annual: "annual" };

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

/** Read KEY=value lines out of .env without a dotenv dependency. */
function readEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return null;
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function revenueCat(path, key) {
  const res = await fetch(`https://api.revenuecat.com/v1${path}`, {
    headers: { Authorization: `Bearer ${key}`, "X-Platform": "android" },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log("\nwelliva billing doctor — Android / RevenueCat / Google Play\n");

  // ── 1. The key the Metro bundle inlines ──────────────────────────────────
  const env = readEnv();
  const localKey = env?.[KEY_VAR] ?? "";
  report(
    localKey.startsWith("goog_") ? PASS : FAIL,
    `${KEY_VAR} is in .env`,
    localKey.startsWith("goog_")
      ? null
      : `${env ? (localKey ? `It is "${localKey.slice(0, 5)}…", not a goog_ public key.` : "It is missing.") : "There is no .env."}\n` +
          "Metro-served builds (expo run:android, the EAS development client) read .env, NOT\n" +
          "eas.json — without it the app runs with billing OFF and never calls RevenueCat.\n" +
          "Copy the public Android key from RevenueCat -> Project settings -> API keys,\n" +
          "then restart Metro with `npx expo start --clear` (the value is inlined at bundle time).",
  );

  // ── 2. The key EAS builds embed ──────────────────────────────────────────
  const eas = JSON.parse(readFileSync(join(root, "eas.json"), "utf8"));
  const profiles = Object.entries(eas.build ?? {});
  const missing = profiles.filter(([, p]) => !p.env?.[KEY_VAR]?.startsWith("goog_")).map(([n]) => n);
  const mismatched = profiles
    .filter(([, p]) => localKey && p.env?.[KEY_VAR] && p.env[KEY_VAR] !== localKey)
    .map(([n]) => n);
  report(
    missing.length === 0 ? (mismatched.length ? WARN : PASS) : FAIL,
    `Every eas.json profile carries ${KEY_VAR}`,
    missing.length
      ? `Missing or malformed in: ${missing.join(", ")}. That build ships with billing off.`
      : mismatched.length
        ? `Differs from .env in: ${mismatched.join(", ")}. Local and store builds would hit different apps.`
        : null,
  );

  const everything = JSON.stringify(eas) + JSON.stringify(env ?? {});
  report(
    /\bsk_[A-Za-z0-9]/.test(everything) ? FAIL : PASS,
    "No SECRET RevenueCat key (sk_…) in .env or eas.json",
    /\bsk_[A-Za-z0-9]/.test(everything)
      ? "A secret key grants write access to every customer. It belongs on the backend only —\n" +
          "remove it and ROTATE it in RevenueCat, since it has been in a client file."
      : null,
  );

  const iosKey = profiles.some(([, p]) => p.env?.EXPO_PUBLIC_REVENUECAT_IOS_KEY);
  if (!iosKey) {
    report(
      WARN,
      "No iOS key (expected while the app is Android-only)",
      "An iOS build with no key fails OPEN — every iPhone user would get Pro for free.\n" +
        "Add EXPO_PUBLIC_REVENUECAT_IOS_KEY (appl_…) before the first iOS build ships.",
    );
  }

  // ── 3. The native SDK ─────────────────────────────────────────────────────
  const sdkPkg = join(root, "node_modules", "react-native-purchases", "package.json");
  const sdkVersion = existsSync(sdkPkg) ? JSON.parse(readFileSync(sdkPkg, "utf8")).version : null;
  report(
    sdkVersion ? PASS : FAIL,
    "react-native-purchases is installed",
    sdkVersion
      ? `v${sdkVersion}. Native: it runs in a dev/store build, never in Expo Go.`
      : "Run `npx expo install react-native-purchases`, then rebuild the native app.",
  );

  const manifest = join(
    root,
    "android/app/build/intermediates/merged_manifest/debug/processDebugMainManifest/AndroidManifest.xml",
  );
  if (existsSync(manifest)) {
    const hasBilling = readFileSync(manifest, "utf8").includes("com.android.vending.BILLING");
    report(
      hasBilling ? PASS : FAIL,
      "Local Android build declares com.android.vending.BILLING",
      hasBilling ? null : "The SDK was not linked into this build. Re-run `npx expo run:android`.",
    );
  }

  const key = localKey.startsWith("goog_") ? localKey : eas.build?.production?.env?.[KEY_VAR];
  if (!key?.startsWith("goog_")) {
    console.log(`\nNo usable key anywhere — stopping before the RevenueCat checks.\n`);
    process.exit(1);
  }

  // ── 4. What RevenueCat serves the storefront ─────────────────────────────
  const offerings = await revenueCat("/subscribers/welliva-billing-doctor/offerings", key);
  if (!offerings.ok) {
    report(
      FAIL,
      "RevenueCat accepts the public key",
      `HTTP ${offerings.status}: ${offerings.body?.message ?? "no message"}.\n` +
        "The key is wrong, revoked, or belongs to another RevenueCat project.",
    );
    process.exit(1);
  }
  report(PASS, "RevenueCat accepts the public key");

  const all = offerings.body.offerings ?? [];
  const current = offerings.body.current_offering_id;
  // The same order Billing.ts resolves: a named `pro` offering, else current.
  const offering =
    all.find((o) => o.identifier === NAMED_OFFERING) ??
    all.find((o) => o.identifier === current) ??
    all[0];
  report(
    offering ? PASS : FAIL,
    "An offering the storefront can read exists",
    offering
      ? `Using "${offering.identifier}"${offering.identifier === current ? " (current)" : ""}.`
      : 'Create an offering named "pro", or mark one as current, in RevenueCat -> Product catalog.',
  );
  if (!offering) process.exit(1);

  const packages = offering.packages ?? [];
  for (const [id, period] of Object.entries(REQUIRED_PACKAGES)) {
    const pkg = packages.find((p) => p.identifier === id);
    const product = pkg
      ? `${pkg.platform_product_identifier}${pkg.platform_product_plan_identifier ? `:${pkg.platform_product_plan_identifier}` : ""}`
      : null;
    report(
      pkg ? PASS : FAIL,
      `The ${period} package (${id}) is in "${offering.identifier}"`,
      pkg
        ? `-> ${product}`
        : `Add a package of type ${period === "monthly" ? "Monthly" : "Annual"} — a Custom package type\n` +
            "is invisible to the storefront's Monthly/Annual switch.",
    );
  }
  const extras = packages.filter((p) => !(p.identifier in REQUIRED_PACKAGES));
  if (extras.length) {
    report(
      WARN,
      "Offering holds packages the storefront does not show",
      `${extras.map((p) => `${p.identifier} -> ${p.platform_product_identifier}`).join(", ")}\n` +
        "Every package here is sold AS PRO. Remove any leftover Plus package from the offering.",
    );
  }

  // ── 5. Every product grants Pro ──────────────────────────────────────────
  const mapping = await revenueCat("/product_entitlement_mapping", key);
  if (!mapping.ok) {
    report(WARN, "Product -> entitlement mapping could be read", `HTTP ${mapping.status}`);
  } else {
    const table = mapping.body.product_entitlement_mapping ?? {};
    for (const pkg of packages.filter((p) => p.identifier in REQUIRED_PACKAGES)) {
      const id = pkg.platform_product_plan_identifier
        ? `${pkg.platform_product_identifier}:${pkg.platform_product_plan_identifier}`
        : pkg.platform_product_identifier;
      const grants = (table[id] ?? table[pkg.platform_product_identifier])?.entitlements ?? [];
      const ok = grants.includes(PRO_ENTITLEMENT) || grants.includes(LEGACY_PLUS_ENTITLEMENT);
      report(
        ok ? PASS : FAIL,
        `${id} grants the "${PRO_ENTITLEMENT}" entitlement`,
        ok
          ? null
          : `It grants: ${grants.join(", ") || "nothing"}. A purchase would charge and unlock nothing.\n` +
              `Attach it under RevenueCat -> Product catalog -> Entitlements -> ${PRO_ENTITLEMENT}.`,
      );
    }
  }

  // ── 6. What only Google Play can answer ──────────────────────────────────
  console.log(
    "\n  Google Play can't be read from here. On a device, the Upgrade screen's\n" +
      "  'Store status (dev only)' panel shows Play's own error. If plans don't load:\n" +
      "  · Play Console -> Monetize -> Subscriptions: both base plans ACTIVE\n" +
      "    (annual at $25.88 so the '$10.00 saved' band stays true).\n" +
      "  · Play Console -> Settings -> License testing: the Google account signed in to\n" +
      "    the Play Store on the phone is listed. That lets a sideloaded debug build buy\n" +
      "    with test cards; any other account is charged real money or refused.\n" +
      "  · The app has been uploaded to a testing track at least once, and that tester\n" +
      "    has accepted the opt-in link.\n" +
      "  · RevenueCat -> Apps -> Google Play: service-account credentials show VALID\n" +
      "    (new credentials take up to 36h). Invalid = purchases fail after payment.\n",
  );

  console.log(
    failures === 0
      ? "No blocking problems found on the RevenueCat side.\n"
      : `${failures} blocking problem(s). See docs/monetization/setup.md.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("billing-doctor failed:", err);
  process.exit(2);
});
