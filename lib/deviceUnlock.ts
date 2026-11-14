/**
 * lib/deviceUnlock.ts — "is it really her?", asked the phone's own way.
 *
 * The cycle lock (services/cycle/lockRules) needs two things from the phone:
 * whether it has anything to ask for, and to ask. There are two ways, and this
 * file uses whichever the installed build of the app contains:
 *
 *   device    — expo-local-authentication: fingerprint or face, with the
 *               phone's own PIN, pattern or password as the fallback, so a
 *               phone with no fingerprint reader works too. In builds made
 *               after 2026-11-13; NOT in the build that was on the owner's phone.
 *   biometric — expo-secure-store, which every build already has (it holds the
 *               sign-in session). A small secret is saved so that reading it
 *               back needs the phone's fingerprint; reading it IS the unlock.
 *               It offers no PIN fallback, so it is offered only on a phone
 *               with a fingerprint enrolled.
 *
 * NEITHER IS IMPORTED THE NORMAL WAY. A package whose native half is missing
 * from the build throws at import and blanks the whole app. Both are reached
 * through `requireOptionalNativeModule`, which returns null instead — the
 * pattern in services/notifications/exactAlarms. Every call is wrapped too: a
 * native error here must never take a screen down, only keep the lock shut.
 *
 * Nothing here is counted or logged with a value, and nothing leaves the phone.
 */
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import {
  NO_UNLOCK,
  outcomeFromBiometricError,
  outcomeFromLocalAuth,
  type UnlockCapability,
  type UnlockOutcome,
} from "@/services/cycle/lockRules";

/** expo-local-authentication's native module (17.x), called directly. */
interface LocalAuthNative {
  getEnrolledLevelAsync(): Promise<number>;
  authenticateAsync(options: {
    promptMessage: string;
    cancelLabel: string;
    disableDeviceFallback: boolean;
    requireConfirmation: boolean;
  }): Promise<{ success: boolean; error?: string }>;
}

/** expo-secure-store's native module (15.x), called directly. */
interface SecureStoreNative {
  getValueWithKeyAsync(key: string, options: SecureOptions): Promise<string | null>;
  setValueWithKeyAsync(value: string, key: string, options: SecureOptions): Promise<void>;
  deleteValueWithKeyAsync(key: string, options: SecureOptions): Promise<void>;
  canUseBiometricAuthentication(): boolean;
}

interface SecureOptions {
  keychainService: string;
  requireAuthentication: boolean;
  authenticationPrompt: string;
}

/** expo-local-authentication's SecurityLevel.NONE: no PIN, pattern, password or biometric. */
const LEVEL_NONE = 0;

/** Its own keychain service, so it can never touch the sign-in session's keys. */
const PROOF_SERVICE = "welliva_cycle_lock";
const PROOF_KEY = "welliva_cycle_lock_proof";

let localAuth: LocalAuthNative | null | undefined;
let secureStore: SecureStoreNative | null | undefined;
/** One prompt at a time: both modules refuse a second, and two would be two asks. */
let inFlight: Promise<UnlockOutcome> | null = null;

function loadLocalAuth(): LocalAuthNative | null {
  if (localAuth === undefined) {
    try {
      localAuth = requireOptionalNativeModule<LocalAuthNative>("ExpoLocalAuthentication");
    } catch {
      localAuth = null;
    }
  }
  return localAuth ?? null;
}

function loadSecureStore(): SecureStoreNative | null {
  if (secureStore === undefined) {
    try {
      const m = requireOptionalNativeModule<SecureStoreNative>("ExpoSecureStore");
      // An older build's module without the biometric check can't be used for this.
      secureStore = m && typeof m.canUseBiometricAuthentication === "function" ? m : null;
    } catch {
      secureStore = null;
    }
  }
  return secureStore ?? null;
}

function options(prompt: string): SecureOptions {
  return { keychainService: PROOF_SERVICE, requireAuthentication: true, authenticationPrompt: prompt };
}

/** Logged once per kind, with console.log: a background failure must not raise the dev warning bar. */
const logged = new Set<string>();
function logOnce(kind: string, e: unknown): void {
  if (logged.has(kind)) return;
  logged.add(kind);
  console.log(`deviceUnlock: ${kind} failed`, e instanceof Error ? e.message : String(e));
}

/** What this build can ask for, and whether the phone has it set up. Never throws. */
export async function unlockCapability(): Promise<UnlockCapability> {
  if (Platform.OS === "web") return NO_UNLOCK;
  const la = loadLocalAuth();
  if (la) {
    try {
      return { method: "device", secured: (await la.getEnrolledLevelAsync()) > LEVEL_NONE };
    } catch (e) {
      logOnce("capability (device)", e);
    }
  }
  const ss = loadSecureStore();
  if (ss) {
    try {
      return { method: "biometric", secured: ss.canUseBiometricAuthentication() === true };
    } catch (e) {
      logOnce("capability (biometric)", e);
      return { method: "biometric", secured: false };
    }
  }
  return NO_UNLOCK;
}

/**
 * Ask. Resolves with what happened; never rejects. A second call while a
 * prompt is up joins the first rather than opening another.
 */
export function askToUnlock(prompt: string): Promise<UnlockOutcome> {
  if (!inFlight) {
    inFlight = ask(prompt).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function ask(prompt: string): Promise<UnlockOutcome> {
  const la = loadLocalAuth();
  if (la) {
    try {
      const result = await la.authenticateAsync({
        promptMessage: prompt,
        cancelLabel: "Cancel",
        // The phone's PIN, pattern or password when there is no fingerprint or
        // it fails: a phone without a reader still works, and there is no
        // welliva PIN to forget.
        disableDeviceFallback: false,
        requireConfirmation: false,
      });
      return outcomeFromLocalAuth(result);
    } catch (e) {
      logOnce("prompt (device)", e);
      return "failed";
    }
  }
  const ss = loadSecureStore();
  if (!ss) return "unavailable";
  try {
    if (!ss.canUseBiometricAuthentication()) return "unavailable";
  } catch {
    return "unavailable";
  }
  try {
    // Reading the proof back needs her fingerprint: that read is the unlock.
    const proof = await ss.getValueWithKeyAsync(PROOF_KEY, options(prompt));
    if (proof !== null) return "ok";
    // None yet (the first time), or the phone voided it when a fingerprint was
    // added. Writing a fresh one asks for the same fingerprint.
    await ss.setValueWithKeyAsync(freshProof(), PROOF_KEY, options(prompt));
    return "ok";
  } catch (e) {
    const outcome = outcomeFromBiometricError(e instanceof Error ? e.message : String(e));
    if (outcome === "failed") logOnce("prompt (biometric)", e);
    return outcome;
  }
}

/** The lock was switched off: drop the fingerprint-bound proof. Never throws. */
export async function forgetUnlockProof(): Promise<void> {
  const ss = loadSecureStore();
  if (!ss) return;
  try {
    await ss.deleteValueWithKeyAsync(PROOF_KEY, options(" "));
  } catch {
    // nothing to forget, or nothing we can do: the next switch-on writes a fresh one
  }
}

function freshProof(): string {
  return `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 12)}`;
}
