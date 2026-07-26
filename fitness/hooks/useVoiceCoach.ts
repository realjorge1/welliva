/**
 * useVoiceCoach — optional spoken guidance for the guided session.
 *
 * Layers text-to-speech (expo-speech) over the existing visual CoachEngine:
 * short, purposeful announcements on phase changes only — never chatter over
 * an active set. Fully additive: when disabled the hook does nothing, so the
 * player behaves exactly as before.
 */

import { useEffect, useRef } from "react";
import * as Speech from "expo-speech";
import type { SessionState } from "@/models/session";

function speak(text: string): void {
  try {
    Speech.stop();
    Speech.speak(text, { rate: 1.0, pitch: 1.0 });
  } catch {
    // TTS is best-effort; a workout must never fail because of it
  }
}

/** What to announce for a given state, or null for silence. */
export function voiceLineFor(
  prev: SessionState | null,
  state: SessionState,
): string | null {
  const ex = state.exercises[state.currentExerciseIndex];
  switch (state.phase) {
    case "COUNTDOWN":
      if (prev?.phase === "COUNTDOWN") return null;
      return ex ? `Get ready. First up: ${ex.name}.` : "Get ready.";
    case "ACTIVE_SET": {
      if (prev?.phase === "ACTIVE_SET" &&
          prev.currentExerciseIndex === state.currentExerciseIndex &&
          prev.currentSet === state.currentSet)
        return null;
      if (!ex) return null;
      return state.currentSet === 1
        ? `${ex.name}. ${ex.sets} sets of ${ex.reps}. Go.`
        : `Set ${state.currentSet} of ${ex.sets}. Go.`;
    }
    case "REST":
      if (prev?.phase === "REST") return null;
      return `Rest. ${state.timerValue} seconds.`;
    case "TRANSITION": {
      if (prev?.phase === "TRANSITION") return null;
      const next = state.exercises[state.currentExerciseIndex + 1];
      return next ? `Nice work. Next up: ${next.name}.` : "Nice work.";
    }
    case "COMPLETE":
      if (prev?.phase === "COMPLETE") return null;
      return "Session complete. Great work.";
    default:
      return null;
  }
}

export function useVoiceCoach(state: SessionState | null, enabled: boolean): void {
  const prevRef = useRef<SessionState | null>(null);

  useEffect(() => {
    if (!enabled || !state) {
      prevRef.current = state;
      return;
    }
    const line = voiceLineFor(prevRef.current, state);
    prevRef.current = state;
    if (line) speak(line);
  }, [state, enabled]);

  // Silence immediately when leaving the screen or toggling off.
  useEffect(() => {
    if (!enabled) {
      try {
        Speech.stop();
      } catch {}
    }
    return () => {
      try {
        Speech.stop();
      } catch {}
    };
  }, [enabled]);
}
