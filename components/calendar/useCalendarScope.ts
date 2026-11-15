/**
 * useCalendarScope — one "… in my calendar" switch (services/calendar).
 *
 * Turning it on asks Android for calendar access, saves the switch and writes
 * straight away; if anything fails, the switch goes back off and says why — a
 * switch claiming entries that aren't there is worse than none (the reminder
 * rule, fitness/settings). Turning it off removes everything it wrote.
 */
import { requestCalendarWriteAccess, type ApplyResult } from "@/services/calendar/device";
import type { CalendarScope } from "@/services/calendar/events";
import { calendarScopeOn, onCalendarPrefsChange, setCalendarScopeOn } from "@/services/calendar/sync";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

export interface CalendarScopeSwitch {
  on: boolean;
  busy: boolean;
  /** How many entries the last switch-on wrote, for a one-line receipt. */
  written: number | null;
  toggle: (next: boolean) => Promise<void>;
}

export function useCalendarScope(
  scope: CalendarScope,
  sync: () => Promise<ApplyResult>,
): CalendarScopeSwitch {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [written, setWritten] = useState<number | null>(null);
  const busyRef = useRef(false);
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    let alive = true;
    const read = () => {
      void calendarScopeOn(scope).then((v) => {
        if (alive) setOn(v);
      });
    };
    read();
    const off = onCalendarPrefsChange(read);
    return () => {
      alive = false;
      off();
    };
  }, [scope]);

  const toggle = useCallback(
    async (next: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        if (next) {
          const access = await requestCalendarWriteAccess();
          if (access === "unavailable") {
            Alert.alert("Not available here", "Adding to your calendar works in the Android app.");
            return;
          }
          if (access !== "granted") {
            Alert.alert(
              "Calendar access is off",
              "Allow welliva to use your calendar in your phone's settings, then switch this on again.",
            );
            return;
          }
        }
        await setCalendarScopeOn(scope, next);
        const result = await syncRef.current();
        if (next && result.status !== "ok") {
          await setCalendarScopeOn(scope, false);
          await syncRef.current();
          setWritten(null);
          Alert.alert("Couldn't add to your calendar", "Nothing was written. Try again in a moment.");
          return;
        }
        setOn(next);
        setWritten(next ? result.created + result.updated : null);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [scope],
  );

  return { on, busy, written, toggle };
}
