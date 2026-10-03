/**
 * useBacklogNudge — whether the Diet screen shows its "did you have these and
 * forget to log?" card right now, and the control that ends it.
 *
 * The rules live in services/nutrition/backlogNudge: one visit, at most five
 * minutes, and leaving the screen ends it until there is a new day to ask
 * about. This hook only wires them to the screen's focus, a timer, and the app
 * coming back from the background (timers sleep there, so the clock is
 * re-read rather than trusted).
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  closeNudge,
  markNudgeShown,
  nudgeOpen,
  nudgeRemaining,
  nudgeUnseen,
  readNudge,
  type NudgeRecord,
} from "@/services/nutrition/backlogNudge";

/** @param date the unlogged day the card would ask about, or null when there is none. */
export function useBacklogNudge(date: string | null): { visible: boolean; close: () => void } {
  // undefined until read — the card waits for the record rather than flashing.
  const [record, setRecord] = useState<NudgeRecord | null | undefined>(undefined);
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** The day THIS visit put on screen — the one leaving the screen ends. */
  const [shownHere, setShownHere] = useState<string | null>(null);
  const shownHereRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void readNudge().then((r) => {
      if (alive) setRecord(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const end = useCallback((day: string) => {
    void closeNudge(day).then(setRecord);
  }, []);

  // A visit begins on focus. Leaving ends a nudge this visit showed.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setNow(Date.now());
      return () => {
        setFocused(false);
        const day = shownHereRef.current;
        shownHereRef.current = null;
        setShownHere(null);
        if (day) end(day);
      };
    }, [end]),
  );

  // Never shown: start its clock. Already on the clock from an EARLIER visit
  // (the app was closed while it showed): the user left and came back — end it.
  useEffect(() => {
    if (!focused || !date || record === undefined || shownHereRef.current === date) return;
    if (nudgeUnseen(record, date)) {
      shownHereRef.current = date;
      setShownHere(date);
      void markNudgeShown(date).then(setRecord);
    } else if (!record!.closed) {
      end(date);
    }
  }, [focused, date, record, end]);

  // The five minutes.
  useEffect(() => {
    if (!focused || !date || record === undefined || shownHere !== date) return;
    const left = nudgeRemaining(record, date, Date.now());
    if (left <= 0) {
      if (record && !record.closed) end(date);
      return;
    }
    const timer = setTimeout(() => end(date), left);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [focused, date, record, shownHere, now, end]);

  const close = useCallback(() => {
    if (!date) return;
    shownHereRef.current = null;
    setShownHere(null);
    end(date);
  }, [date, end]);

  const visible =
    focused &&
    !!date &&
    record !== undefined &&
    (nudgeUnseen(record, date) || (shownHere === date && nudgeOpen(record, date, now)));

  return { visible, close };
}
