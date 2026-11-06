/**
 * useSmartMoment — the one way a screen asks to show a smart moment.
 *
 * A screen hands over every moment that is true for it right now; this hands
 * back the ONE it may show, or null — after the quiet layer
 * (services/smart/arbiter) has had its say: nothing in the first days, nothing
 * on a rough day, one new moment per screen per day, two across the app,
 * and nothing still inside its cool-down.
 *
 * The slot is claimed after the moment renders its first frame, and the moment
 * only appears once the claim succeeded, so two screens mounted side by side
 * (the tabs keep each other alive) can never both take the last slot.
 *
 * Several hooks can ask for one screen, and each reads its own records. So a new
 * moment waits {@link CLAIM_SETTLE_MS} before claiming and steps aside for a
 * stronger rival, or the day's slot would go to whichever record loaded first:
 * a daily "your usual?" would beat the rare moment that matters every time.
 */
import { useGamification, useProfile } from "@/contexts/AppContext";
import { todayDate } from "@/services/OfflineStorage";
import {
  claimSmartSlot,
  ensureSmartLedger,
  isOutranked,
  pickMoment,
  refreshSmartLedger,
  smartLedgerSnapshot,
  subscribeSmartLedger,
  type GateState,
  type SmartCandidate,
  type SmartSurface,
} from "@/services/smart";
import { useEffect, useReducer, useRef, useState } from "react";
import { AppState } from "react-native";
import { useRoughToday } from "./useRoughDay";

/** A beat for a screen's records to land. A card arriving this late reads as calm. */
const CLAIM_SETTLE_MS = 800;

/** What each mounted hook wants right now, screen by screen. */
const wanting = new Map<SmartSurface, Map<object, SmartCandidate>>();

/** Re-render whenever the ledger changes (a claim, an answer, a fresh read). */
export function useSmartLedger() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    void ensureSmartLedger();
    const off = subscribeSmartLedger(bump);
    // Another phone's answers arrive through sync; read them on every return.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refreshSmartLedger();
    });
    return () => {
      off();
      sub.remove();
    };
  }, []);
  return smartLedgerSnapshot();
}

/**
 * The first day of the account: the earliest of the day setup finished (the
 * journey stamp) and the first day ever kept. Either alone can be missing or
 * late — a reached goal restarts the journey — so the earlier one wins.
 */
export function useSmartGateState(): GateState {
  const { userGoals } = useProfile();
  const { streakData } = useGamification();
  const firstKept = streakData?.days?.[0];
  const journey = userGoals?.journeyStartedAt;
  const known = [journey, firstKept].filter((d): d is string => typeof d === "string" && d.length === 10);
  const accountSince = known.length ? known.sort()[0] : null;
  // A rough day: nothing smart speaks (the way out lives on the rough-day card).
  const roughDay = useRoughToday() !== null;
  return { today: todayDate(), accountSince, roughDay };
}

export function useSmartMoment<T extends SmartCandidate>(
  surface: SmartSurface,
  candidates: readonly T[],
): T | null {
  const ledger = useSmartLedger();
  const gate = useSmartGateState();
  const pick = ledger.ready
    ? (pickMoment(candidates, surface, ledger.shown, ledger.answers, gate) as T | null)
    : null;
  const pickId = pick?.id ?? null;

  const latest = useRef(pick);
  latest.current = pick;
  const [claimed, setClaimed] = useState<string | null>(null);
  const owner = useRef({}).current;
  useEffect(() => {
    const c = latest.current;
    if (!c) {
      setClaimed(null);
      return;
    }
    const board = wanting.get(surface) ?? new Map<object, SmartCandidate>();
    wanting.set(surface, board);
    board.set(owner, c);

    const claim = () => setClaimed(claimSmartSlot(c, surface, gate.today) ? c.id : null);
    const held = smartLedgerSnapshot().shown.some(
      (s) => s.date === gate.today && s.id === c.id && s.surface === surface,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A stronger rival claims within a beat, and then this pick goes away. If it
    // withdraws instead, the next try goes ahead.
    const settle = () => {
      if (isOutranked(c, board.values())) timer = setTimeout(settle, CLAIM_SETTLE_MS);
      else claim();
    };
    // Already on screen today, an answer to what they just did, or the welcome:
    // nothing to wait for.
    if (held || c.exempt || c.feature === "welcome-back") claim();
    else timer = setTimeout(settle, CLAIM_SETTLE_MS);

    return () => {
      clearTimeout(timer);
      board.delete(owner);
    };
  }, [pickId, surface, gate.today, owner]);

  return pick && claimed === pick.id ? pick : null;
}
