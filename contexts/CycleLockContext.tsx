/**
 * CycleLockContext — "Lock my cycle", for every surface that shows the cycle.
 *
 * The rules are services/cycle/lockRules (pure, tested); the prompt is
 * lib/deviceUnlock. This file holds the two pieces of state between them:
 *
 *   the switch   — on or off, kept on THIS PHONE ONLY (`@welliva_cycle_lock`,
 *                  listed in syncKeys' DEVICE_LOCAL_KEYS). It depends on this
 *                  phone's own screen lock, so it means nothing on another one.
 *                  "Delete all cycle data" leaves it as it is: it's a setting
 *                  about this phone, not part of the log.
 *   the session  — unlocked or not, in memory only, so every cold start is
 *                  locked. It locks again after LOCK_GRACE_MS in the background.
 *
 * Every screen outside the cycle reads `hidden`: while it's true, nothing on
 * screen may name the cycle, a period, a symptom or a phase (Home's card says
 * "Cycle · locked"; Diet's target note, Fitness's eased session, the water note
 * after a weigh-in and the notification receipts all go quiet about why).
 *
 * The lock-screen buttons ("Started today", "Not yet") keep working: they
 * write straight to storage with no screen involved.
 *
 * No analytics, ever, including for the switch: a cycle feature's timestamp is
 * cycle data (docs/cycle/smart-cycle.md).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { askToUnlock, forgetUnlockProof, unlockCapability } from "@/lib/deviceUnlock";
import {
  CYCLE_LOCK_KEY,
  FRESH_SESSION,
  isUnlocked,
  lockCopy,
  lockFailureLine,
  lockGate,
  lockOffer,
  sessionPromptClosed,
  sessionPromptOpened,
  sessionToBackground,
  sessionToForeground,
  type LockCopy,
  type LockGate,
  type LockOffer,
  type LockSession,
  type UnlockCapability,
  type UnlockOutcome,
} from "@/services/cycle/lockRules";

/** What the phone's own prompt says. Never a period, a symptom or a phase. */
const UNLOCK_PROMPT = "Unlock your cycle";
const TURN_ON_PROMPT = "Turn on the cycle lock";

export interface CycleLockValue {
  /** The switch has been read and the phone has said what it can ask for. */
  ready: boolean;
  /** The switch. */
  enabled: boolean;
  capability: UnlockCapability | null;
  /** Whether the switch can be turned on here, and if not, why. */
  offer: LockOffer;
  /** What a cycle screen does right now. */
  gate: LockGate;
  /**
   * Everything OUTSIDE the cycle screens: say nothing about the cycle. True
   * while locked, and for the beat at start-up before the switch is read.
   */
  hidden: boolean;
  /** A prompt is on screen. */
  prompting: boolean;
  /** Counts each fresh lock, so a cycle screen can ask by itself once per opening. */
  epoch: number;
  /** One line after a prompt that didn't let her in (not for a plain cancel). */
  failure: string | null;
  /** One line after the lock switched itself off because the phone had nothing left to ask for. */
  released: string | null;
  copy: LockCopy;
  /** Ask the phone. Resolves with what happened; never rejects. */
  unlock: () => Promise<UnlockOutcome>;
  /** On asks for one successful unlock first, proving she can get back in. Resolves true when it changed. */
  setEnabled: (on: boolean) => Promise<boolean>;
  /** She read the "switched itself off" line. */
  clearReleased: () => void;
}

const CycleLockContext = createContext<CycleLockValue | null>(null);

export function CycleLockProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [switchRead, setSwitchRead] = useState(false);
  const [capability, setCapability] = useState<UnlockCapability | null>(null);
  const [session, setSession] = useState<LockSession>(FRESH_SESSION);
  const [failure, setFailure] = useState<string | null>(null);
  const [released, setReleased] = useState<string | null>(null);
  const sessionRef = useRef<LockSession>(FRESH_SESSION);

  const apply = useCallback((next: LockSession) => {
    if (next === sessionRef.current) return;
    sessionRef.current = next;
    setSession(next);
  }, []);

  const refreshCapability = useCallback(async () => {
    const cap = await unlockCapability();
    setCapability((prev) => (prev && prev.method === cap.method && prev.secured === cap.secured ? prev : cap));
  }, []);

  /* ── load ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CYCLE_LOCK_KEY);
        if (alive) setEnabledState(raw === "1");
      } catch (e) {
        console.log("CycleLock: couldn't read the switch", e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setSwitchRead(true);
      }
    })();
    void refreshCapability();
    return () => {
      alive = false;
    };
  }, [refreshCapability]);

  /* ── the app coming and going ── */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const now = Date.now();
      // iOS "inactive" (the shade pulled down, a call banner) is not a trip away.
      if (state === "background") apply(sessionToBackground(sessionRef.current, now));
      else if (state === "active") {
        apply(sessionToForeground(sessionRef.current, now));
        // Her screen lock may have been removed while she was away.
        void refreshCapability();
      }
    });
    return () => sub.remove();
  }, [apply, refreshCapability]);

  const persist = useCallback(async (on: boolean) => {
    try {
      if (on) await AsyncStorage.setItem(CYCLE_LOCK_KEY, "1");
      else await AsyncStorage.removeItem(CYCLE_LOCK_KEY);
    } catch (e) {
      console.log("CycleLock: couldn't save the switch", e instanceof Error ? e.message : String(e));
    }
  }, []);

  const unlocked = isUnlocked(session);
  const gate = lockGate(enabled, capability, unlocked);
  const method = capability?.method ?? null;
  const copy = useMemo(() => lockCopy(method), [method]);

  /* ── never lock her out ── */
  // The lock is on, but the phone has nothing left to ask for: let her in,
  // switch it off, and say so once.
  const releasedLine = copy.released;
  useEffect(() => {
    if (gate !== "release") return;
    setEnabledState(false);
    setReleased(releasedLine);
    void persist(false);
    void forgetUnlockProof();
  }, [gate, releasedLine, persist]);

  const unlock = useCallback(async (): Promise<UnlockOutcome> => {
    apply(sessionPromptOpened(sessionRef.current, Date.now()));
    const outcome = await askToUnlock(UNLOCK_PROMPT);
    apply(sessionPromptClosed(sessionRef.current, Date.now(), outcome === "ok"));
    setFailure(lockFailureLine(outcome));
    // "unavailable": the phone has nothing to ask for now; re-reading it turns
    // the gate to "release", which lets her in.
    if (outcome === "unavailable") await refreshCapability();
    return outcome;
  }, [apply, refreshCapability]);

  const setEnabled = useCallback(
    async (on: boolean): Promise<boolean> => {
      if (!on) {
        setEnabledState(false);
        setFailure(null);
        await persist(false);
        await forgetUnlockProof();
        return true;
      }
      // One successful unlock first: it proves she can get back in.
      apply(sessionPromptOpened(sessionRef.current, Date.now()));
      const outcome = await askToUnlock(TURN_ON_PROMPT);
      apply(sessionPromptClosed(sessionRef.current, Date.now(), outcome === "ok"));
      if (outcome !== "ok") {
        setFailure(lockFailureLine(outcome));
        if (outcome === "unavailable") await refreshCapability();
        return false;
      }
      setFailure(null);
      setReleased(null);
      setEnabledState(true);
      await persist(true);
      return true;
    },
    [apply, persist, refreshCapability],
  );

  const clearReleased = useCallback(() => setReleased(null), []);

  const ready = switchRead && (!enabled || capability !== null);
  const hidden = !switchRead || gate === "locked" || gate === "pending";

  const value = useMemo<CycleLockValue>(
    () => ({
      ready,
      enabled,
      capability,
      offer: lockOffer(capability),
      gate,
      hidden,
      prompting: session.promptOpenAt !== null,
      epoch: session.epoch,
      failure,
      released,
      copy,
      unlock,
      setEnabled,
      clearReleased,
    }),
    [ready, enabled, capability, gate, hidden, session.promptOpenAt, session.epoch, failure, released, copy, unlock, setEnabled, clearReleased],
  );

  return <CycleLockContext.Provider value={value}>{children}</CycleLockContext.Provider>;
}

/** Null outside the provider: a surface with no lock around it has nothing to hide. */
export function useCycleLockOptional(): CycleLockValue | null {
  return useContext(CycleLockContext);
}

/** Whether a surface outside the cycle screens must say nothing about the cycle right now. */
export function useCycleHidden(): boolean {
  return useContext(CycleLockContext)?.hidden ?? false;
}
