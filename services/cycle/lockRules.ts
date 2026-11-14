/**
 * services/cycle/lockRules.ts — "Lock my cycle": every decision, as pure functions.
 *
 * The lock asks for the phone's own unlock (fingerprint, face, or the phone's
 * PIN) before anything about her cycle shows. Lock-screen reminders were
 * already discreet; the open app was not: anyone holding the unlocked phone saw
 * the dial, "late by 3 days" and the pregnancy-test line.
 *
 * Everything that decides WHEN lives here, with the clock and the phone's
 * abilities passed in, so it is tested without a phone. The prompt itself is
 * lib/deviceUnlock; the state is contexts/CycleLockContext.
 *
 * THE RULES
 *  · Offered only when this build can ask (its native module is present) AND
 *    the phone has something to ask for. With nothing to ask for, the switch is
 *    shown disabled with the reason, so she knows it exists.
 *  · NEVER LOCK HER OUT OF HER OWN DATA. If the phone's screen lock is removed
 *    later, the lock can't work: she is let in, it switches itself off, and one
 *    line says so. A build without the module behaves as if it were off. There
 *    is no welliva PIN to forget.
 *  · Locks again after LOCK_GRACE_MS in the background, so the share sheet and
 *    a quick app switch don't. App-state changes the unlock prompt causes (the
 *    PIN screen is its own activity on Android) are the prompt's, not hers.
 *  · Asks on its own ONCE per opening. A cancel leaves a calm locked screen
 *    with an Unlock button; it never asks again by itself.
 *  · Reads nothing about the cycle, so it behaves the same in every mode.
 *  · Never counted in analytics, like every cycle feature.
 */

/**
 * Where the switch is kept: on this phone only (services/sync/syncKeys lists it
 * as device-local), because it asks for THIS phone's own screen lock. Outside
 * the cycle documents on purpose: the backup move never touches it, and
 * "Delete all cycle data" leaves it as it is (a setting about the phone, not
 * part of the log).
 */
export const CYCLE_LOCK_KEY = "@welliva_cycle_lock";

/** Long enough that the share sheet and a quick app switch don't lock it again. */
export const LOCK_GRACE_MS = 60_000;
/**
 * A trip to the background that began this soon after a prompt closed is the
 * prompt's own (its events can arrive a beat late), not her leaving the app.
 */
export const PROMPT_SETTLE_MS = 1_500;

/**
 * How this build can ask:
 *   device    — fingerprint or face, with the phone's PIN, pattern or password
 *               as the fallback (expo-local-authentication, in builds from
 *               2026-11-13 on)
 *   biometric — fingerprint or face only (expo-secure-store, which every build
 *               already has); no PIN fallback, so it needs one enrolled
 */
export type UnlockMethod = "device" | "biometric";

export interface UnlockCapability {
  /** null: this build can't ask at all. */
  method: UnlockMethod | null;
  /** The phone has something to ask for: a screen lock (device), an enrolled fingerprint (biometric). */
  secured: boolean;
}

export const NO_UNLOCK: UnlockCapability = { method: null, secured: false };

export type LockOffer = "offered" | "needs-screen-lock" | "needs-fingerprint" | "unavailable";

/** Whether the switch can be turned on here, and if not, why. "unavailable" = not shown. */
export function lockOffer(cap: UnlockCapability | null): LockOffer {
  if (!cap || !cap.method) return "unavailable";
  if (cap.secured) return "offered";
  return cap.method === "device" ? "needs-screen-lock" : "needs-fingerprint";
}

/**
 * What a cycle screen does right now:
 *   pending — the lock is on and the phone hasn't said yet what it can ask
 *             for (a beat at start-up): show nothing, ask nothing
 *   open    — show everything (lock off, unlocked, or a build that can't ask)
 *   locked  — show the locked state
 *   release — the lock is on but the phone has nothing to ask for any more:
 *             let her in and switch it off (never lock her out)
 */
export type LockGate = "pending" | "open" | "locked" | "release";

export function lockGate(enabled: boolean, cap: UnlockCapability | null, unlocked: boolean): LockGate {
  if (!enabled) return "open";
  if (!cap) return "pending";
  if (!cap.method) return "open";
  if (!cap.secured) return "release";
  return unlocked ? "open" : "locked";
}

/* ───────────────────────────── the session ───────────────────────────── */

export interface LockSession {
  /** When she last unlocked; null = locked. Never stored: every cold start is locked. */
  unlockedAt: number | null;
  /** When the app last left the foreground; null while it's in front. */
  backgroundAt: number | null;
  /** When the prompt on screen opened; null when none is. */
  promptOpenAt: number | null;
  /** The last prompt, from open to close — app-state changes inside it are its own. */
  lastPrompt: { from: number; to: number } | null;
  /** Counts the times it has locked again, so "once per opening" can tell openings apart. */
  epoch: number;
}

export const FRESH_SESSION: LockSession = {
  unlockedAt: null,
  backgroundAt: null,
  promptOpenAt: null,
  lastPrompt: null,
  epoch: 0,
};

export const isUnlocked = (s: LockSession): boolean => s.unlockedAt !== null;

/** The app left the foreground. iOS's "inactive" is not this (a pulled-down shade, a call banner). */
export function sessionToBackground(s: LockSession, now: number): LockSession {
  return s.backgroundAt === null ? { ...s, backgroundAt: now } : s;
}

/**
 * Back in front: locks again if she was away longer than the grace, unless
 * the time away was the unlock prompt's own.
 */
export function sessionToForeground(s: LockSession, now: number): LockSession {
  const left = s.backgroundAt;
  if (left === null) return s;
  const back: LockSession = { ...s, backgroundAt: null };
  if (s.unlockedAt === null) return back;
  if (s.promptOpenAt !== null && left >= s.promptOpenAt) return back;
  const p = s.lastPrompt;
  if (p && left >= p.from && left <= p.to + PROMPT_SETTLE_MS) return back;
  if (now - left <= LOCK_GRACE_MS) return back;
  return { ...back, unlockedAt: null, epoch: s.epoch + 1 };
}

export function sessionPromptOpened(s: LockSession, now: number): LockSession {
  return { ...s, promptOpenAt: now };
}

export function sessionPromptClosed(s: LockSession, now: number, unlocked: boolean): LockSession {
  return {
    ...s,
    promptOpenAt: null,
    lastPrompt: { from: s.promptOpenAt ?? now, to: now },
    unlockedAt: unlocked ? now : s.unlockedAt,
  };
}

/** Lock now (switching the lock on from another phone's settings, say). */
export function sessionLocked(s: LockSession): LockSession {
  return s.unlockedAt === null ? s : { ...s, unlockedAt: null, epoch: s.epoch + 1 };
}

/**
 * The key of one "opening" of a locked cycle screen: a new focus, or a fresh
 * lock while it stays on screen. The gate asks by itself once per key.
 */
export function openingKey(focus: number, epoch: number): string {
  return `${focus}:${epoch}`;
}

/* ───────────────────────────── outcomes ───────────────────────────── */

/**
 * What one prompt came to:
 *   ok          — it's her
 *   cancelled   — she closed it (or the phone did): the calm locked state
 *   unavailable — the phone has nothing to ask for any more (release)
 *   failed      — too many tries, or something went wrong: try again later
 */
export type UnlockOutcome = "ok" | "cancelled" | "unavailable" | "failed";

/** expo-local-authentication's `error` codes. */
export function outcomeFromLocalAuth(result: { success?: boolean; error?: string } | null | undefined): UnlockOutcome {
  if (result?.success) return "ok";
  switch (result?.error) {
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
    case "user_fallback":
      return "cancelled";
    case "not_enrolled":
    case "not_available":
    case "passcode_not_set":
      return "unavailable";
    default:
      return "failed";
  }
}

/** expo-secure-store raises its prompt's errors as messages, not codes. */
export function outcomeFromBiometricError(message: string): UnlockOutcome {
  if (/cancel/i.test(message)) return "cancelled";
  if (/no biometrics|not enrolled|no hardware|hardware not present|unsupported|requires android api/i.test(message)) {
    return "unavailable";
  }
  return "failed";
}

/* ───────────────────────────── the words ───────────────────────────── */

export const LOCK_TITLE = "Lock my cycle";

export interface LockCopy {
  /** The line under the switch. */
  subtitle: string;
  /** The locked screen's line under "Your cycle is locked". */
  unlockWith: string;
  /** The one line after the lock switched itself off. */
  released: string;
}

/**
 * The words, by how this build asks. A build that can only ask for a
 * fingerprint must not promise the phone's PIN.
 */
export function lockCopy(method: UnlockMethod | null): LockCopy {
  if (method === "biometric") {
    return {
      subtitle: "Asks for your fingerprint before showing anything about your cycle.",
      unlockWith: "Unlock with your fingerprint.",
      released: "Your phone no longer has a fingerprint set up, so the cycle lock is off.",
    };
  }
  return {
    subtitle: "Asks for your fingerprint, face or phone PIN before showing anything about your cycle.",
    unlockWith: "Unlock with your fingerprint, face or phone PIN.",
    released: "Your phone no longer has a screen lock, so the cycle lock is off.",
  };
}

/** Why the switch can't be turned on here. Null when it can (or isn't shown at all). */
export function lockOfferReason(offer: LockOffer): string | null {
  if (offer === "needs-screen-lock") return "Set a screen lock on your phone first.";
  if (offer === "needs-fingerprint") return "Set up a fingerprint on your phone first.";
  return null;
}

/** After a prompt that didn't let her in, the locked screen's one line. Null for a plain cancel. */
export function lockFailureLine(outcome: UnlockOutcome): string | null {
  return outcome === "failed" ? "That didn't work. Wait a moment, then try again." : null;
}
