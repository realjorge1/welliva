import { describe, expect, it } from "vitest";

import {
  CYCLE_LOCK_KEY,
  FRESH_SESSION,
  isUnlocked,
  LOCK_GRACE_MS,
  lockCopy,
  lockFailureLine,
  lockGate,
  lockOffer,
  lockOfferReason,
  NO_UNLOCK,
  openingKey,
  outcomeFromBiometricError,
  outcomeFromLocalAuth,
  PROMPT_SETTLE_MS,
  sessionLocked,
  sessionPromptClosed,
  sessionPromptOpened,
  sessionToBackground,
  sessionToForeground,
  type LockSession,
  type UnlockCapability,
} from "../lockRules";

const DEVICE: UnlockCapability = { method: "device", secured: true };
const BIOMETRIC: UnlockCapability = { method: "biometric", secured: true };
const T0 = 1_000_000;

/** Unlocked through a prompt that opened at `at` and closed a second later. */
function unlockedAt(at: number): LockSession {
  return sessionPromptClosed(sessionPromptOpened(FRESH_SESSION, at), at + 1_000, true);
}

describe("lockOffer — who can turn it on", () => {
  it("is offered when the build can ask and the phone has something to ask for", () => {
    expect(lockOffer(DEVICE)).toBe("offered");
    expect(lockOffer(BIOMETRIC)).toBe("offered");
  });

  it("is not shown at all on a build without the module, or before the phone has answered", () => {
    expect(lockOffer(NO_UNLOCK)).toBe("unavailable");
    expect(lockOffer(null)).toBe("unavailable");
    expect(lockOfferReason("unavailable")).toBeNull();
  });

  it("says why it can't be turned on yet, by what this build asks for", () => {
    expect(lockOffer({ method: "device", secured: false })).toBe("needs-screen-lock");
    expect(lockOfferReason("needs-screen-lock")).toBe("Set a screen lock on your phone first.");
    expect(lockOffer({ method: "biometric", secured: false })).toBe("needs-fingerprint");
    expect(lockOfferReason("needs-fingerprint")).toBe("Set up a fingerprint on your phone first.");
  });
});

describe("lockGate — never lock her out", () => {
  it("is open with the lock off, whatever the phone can do", () => {
    expect(lockGate(false, DEVICE, false)).toBe("open");
    expect(lockGate(false, null, false)).toBe("open");
  });

  it("waits, showing nothing, until the phone has said what it can ask for", () => {
    expect(lockGate(true, null, false)).toBe("pending");
  });

  it("behaves as if the lock were off when the build has no module", () => {
    expect(lockGate(true, NO_UNLOCK, false)).toBe("open");
  });

  it("lets her in, and switches off, when the phone's screen lock is gone", () => {
    expect(lockGate(true, { method: "device", secured: false }, false)).toBe("release");
    expect(lockGate(true, { method: "biometric", secured: false }, false)).toBe("release");
  });

  it("is locked until she unlocks, then open", () => {
    expect(lockGate(true, DEVICE, false)).toBe("locked");
    expect(lockGate(true, DEVICE, true)).toBe("open");
  });
});

describe("the session — when it locks again", () => {
  it("starts locked: every cold start asks", () => {
    expect(isUnlocked(FRESH_SESSION)).toBe(false);
  });

  it("stays unlocked through a quick app switch or the share sheet", () => {
    let s = unlockedAt(T0);
    s = sessionToBackground(s, T0 + 10_000);
    s = sessionToForeground(s, T0 + 10_000 + LOCK_GRACE_MS);
    expect(isUnlocked(s)).toBe(true);
    expect(s.backgroundAt).toBeNull();
  });

  it("locks again after longer than the grace in the background, and counts a new opening", () => {
    let s = unlockedAt(T0);
    s = sessionToBackground(s, T0 + 10_000);
    s = sessionToForeground(s, T0 + 10_000 + LOCK_GRACE_MS + 1);
    expect(isUnlocked(s)).toBe(false);
    expect(s.epoch).toBe(1);
  });

  it("keeps the FIRST moment it left: a second background event doesn't restart the clock", () => {
    let s = unlockedAt(T0);
    s = sessionToBackground(s, T0 + 10_000);
    s = sessionToBackground(s, T0 + 70_000);
    s = sessionToForeground(s, T0 + 75_000);
    expect(isUnlocked(s)).toBe(false);
  });

  it("ignores the trip to the background the prompt itself causes, however long the PIN took", () => {
    let s = sessionPromptOpened(FRESH_SESSION, T0);
    s = sessionToBackground(s, T0 + 200); // the PIN screen is its own activity
    s = sessionPromptClosed(s, T0 + 90_000, true); // a slow PIN: longer than the grace
    s = sessionToForeground(s, T0 + 90_100);
    expect(isUnlocked(s)).toBe(true);
  });

  it("ignores a background event that arrives a beat after the prompt closed", () => {
    let s = sessionPromptOpened(FRESH_SESSION, T0);
    s = sessionPromptClosed(s, T0 + 2_000, true);
    s = sessionToBackground(s, T0 + 2_000 + PROMPT_SETTLE_MS - 1);
    s = sessionToForeground(s, T0 + 2_000 + LOCK_GRACE_MS * 2);
    expect(isUnlocked(s)).toBe(true);
  });

  it("but a real trip away after the prompt settled is hers", () => {
    let s = sessionPromptOpened(FRESH_SESSION, T0);
    s = sessionPromptClosed(s, T0 + 2_000, true);
    s = sessionToBackground(s, T0 + 2_000 + PROMPT_SETTLE_MS + 1);
    s = sessionToForeground(s, T0 + 2_000 + PROMPT_SETTLE_MS + 1 + LOCK_GRACE_MS + 1);
    expect(isUnlocked(s)).toBe(false);
  });

  it("a cancelled prompt leaves it locked", () => {
    let s = sessionPromptOpened(FRESH_SESSION, T0);
    s = sessionPromptClosed(s, T0 + 500, false);
    expect(isUnlocked(s)).toBe(false);
    expect(s.promptOpenAt).toBeNull();
  });

  it("locking by hand counts a new opening, and does nothing when already locked", () => {
    const s = sessionLocked(unlockedAt(T0));
    expect(isUnlocked(s)).toBe(false);
    expect(s.epoch).toBe(1);
    expect(sessionLocked(s)).toBe(s);
  });

  it("one opening per focus and per fresh lock", () => {
    expect(openingKey(1, 0)).not.toBe(openingKey(2, 0));
    expect(openingKey(1, 0)).not.toBe(openingKey(1, 1));
  });
});

describe("outcomes", () => {
  it("reads expo-local-authentication's codes", () => {
    expect(outcomeFromLocalAuth({ success: true })).toBe("ok");
    for (const e of ["user_cancel", "system_cancel", "app_cancel", "user_fallback"]) {
      expect(outcomeFromLocalAuth({ success: false, error: e })).toBe("cancelled");
    }
    for (const e of ["not_enrolled", "not_available", "passcode_not_set"]) {
      expect(outcomeFromLocalAuth({ success: false, error: e })).toBe("unavailable");
    }
    expect(outcomeFromLocalAuth({ success: false, error: "lockout" })).toBe("failed");
    expect(outcomeFromLocalAuth(null)).toBe("failed");
  });

  it("reads expo-secure-store's prompt messages", () => {
    expect(outcomeFromBiometricError("User canceled the authentication. Cancel")).toBe("cancelled");
    expect(outcomeFromBiometricError("No biometrics are currently enrolled")).toBe("unavailable");
    expect(
      outcomeFromBiometricError(
        "No hardware available for biometric authentication. Use expo-local-authentication to check if the device supports it",
      ),
    ).toBe("unavailable");
    expect(outcomeFromBiometricError("Lockout. Too many attempts")).toBe("failed");
  });

  it("a plain cancel says nothing; a failure says to wait", () => {
    expect(lockFailureLine("cancelled")).toBeNull();
    expect(lockFailureLine("failed")).toMatch(/try again/);
  });
});

describe("the words", () => {
  it("a fingerprint-only build never promises the phone's PIN", () => {
    const c = lockCopy("biometric");
    expect(`${c.subtitle} ${c.unlockWith} ${c.released}`).not.toMatch(/PIN/);
  });

  it("the full build says what the owner approved", () => {
    expect(lockCopy("device").subtitle).toBe(
      "Asks for your fingerprint, face or phone PIN before showing anything about your cycle.",
    );
  });

  it("never names a period, a symptom or a phase", () => {
    for (const m of ["device", "biometric", null] as const) {
      const c = lockCopy(m);
      expect(`${c.subtitle} ${c.unlockWith} ${c.released}`).not.toMatch(/period|cramp|phase|ovulat|fertile/i);
    }
  });
});

describe("where the switch lives", () => {
  it("stays on this phone: listed as device-local, so it never syncs", async () => {
    const { DEVICE_LOCAL_KEYS, DEVICE_LOCAL_PREFIXES } = await import("../../sync/syncKeys");
    expect(DEVICE_LOCAL_KEYS).toContain(CYCLE_LOCK_KEY);
    // Not riding the cycle log's own device-local prefix: that one moves with the backup switch.
    expect(DEVICE_LOCAL_PREFIXES.some((p) => CYCLE_LOCK_KEY.startsWith(p))).toBe(false);
  });

  it("is not one of the cycle documents, so the backup move and the erase never touch it", async () => {
    const { CYCLE_KEYS, CYCLE_LOCAL_KEYS } = await import("../store");
    expect(Object.values(CYCLE_KEYS)).not.toContain(CYCLE_LOCK_KEY);
    expect(Object.values(CYCLE_LOCAL_KEYS)).not.toContain(CYCLE_LOCK_KEY);
  });
});
