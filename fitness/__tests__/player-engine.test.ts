/**
 * Player-engine coverage for the guided-session state machine additions the
 * premium player relies on: back navigation (redo current set / return to the
 * previous exercise) with honest result bookkeeping, so the summary and the
 * achievement/streak pipeline never double-count a redone exercise.
 */

import { describe, expect, it } from "vitest";
import type { SessionExerciseInfo, SessionState } from "@/models/session";
import { SessionService } from "@/services/SessionService";

const service = SessionService.getInstance();

function ex(id: string, overrides: Partial<SessionExerciseInfo> = {}): SessionExerciseInfo {
  return {
    exerciseId: id,
    name: id,
    category: "legs",
    difficulty: "beginner",
    exerciseType: "reps",
    sets: 3,
    reps: "10",
    restSeconds: 30,
    transitionSeconds: 30,
    setupPosition: "Stand tall.",
    instructions: ["Do the thing."],
    coachCues: ["Nice"],
    icon: "body",
    ...overrides,
  };
}

function freshSession(): SessionState {
  return service.createSession("lib_test", "Test Session", [
    ex("a"),
    ex("b"),
    ex("c"),
  ]);
}

/** Drive a fresh session past the intro + countdown into the first active set. */
function toActive(state: SessionState): SessionState {
  let s = service.startSession(state); // INTRO → COUNTDOWN
  while (s.phase === "COUNTDOWN") s = service.tick(s);
  return s;
}

describe("SessionService.goBack", () => {
  it("is a no-op during the intro, countdown and after completion", () => {
    const intro = freshSession();
    expect(intro.phase).toBe("INTRO");
    expect(service.goBack(intro)).toBe(intro);

    const counting = service.startSession(intro);
    expect(counting.phase).toBe("COUNTDOWN");
    expect(service.goBack(counting)).toBe(counting);

    const done: SessionState = { ...toActive(intro), phase: "COMPLETE" };
    expect(service.goBack(done)).toBe(done);
  });

  it("restarts the current exercise when mid-set (counted reps)", () => {
    let s = toActive(freshSession());
    s = service.addRep(s);
    s = service.addRep(s);
    const back = service.goBack(s);
    expect(back.phase).toBe("ACTIVE_SET");
    expect(back.currentExerciseIndex).toBe(0);
    expect(back.currentSet).toBe(1);
    expect(back.currentReps).toBe(0);
  });

  it("restarts the current exercise from REST and wipes its partial result", () => {
    let s = toActive(freshSession());
    s = service.addRep(s);
    s = service.completeSet(s); // set 1 done → REST, result recorded
    expect(s.phase).toBe("REST");
    expect(s.results.some((r) => r.exerciseId === "a")).toBe(true);

    const back = service.goBack(s);
    expect(back.phase).toBe("ACTIVE_SET");
    expect(back.currentExerciseIndex).toBe(0);
    expect(back.currentSet).toBe(1);
    expect(back.results.some((r) => r.exerciseId === "a")).toBe(false);
  });

  it("returns to the previous exercise from a fresh set and discards its result", () => {
    let s = toActive(freshSession());
    // Finish all 3 sets of exercise "a".
    for (let set = 0; set < 3; set++) {
      s = { ...s, currentReps: 10 };
      s = service.completeSet(s);
      if (s.phase === "REST") {
        s = { ...s, timerValue: 1 };
        s = service.tick(s);
      }
    }
    expect(s.phase).toBe("TRANSITION");
    // Ride the transition into exercise "b".
    s = { ...s, timerValue: 1 };
    s = service.tick(s);
    expect(s.currentExerciseIndex).toBe(1);
    expect(s.phase).toBe("ACTIVE_SET");

    const back = service.goBack(s); // fresh set 1 of "b" → back to "a"
    expect(back.currentExerciseIndex).toBe(0);
    expect(back.phase).toBe("ACTIVE_SET");
    expect(back.currentSet).toBe(1);
    expect(back.results.some((r) => r.exerciseId === "a")).toBe(false);
  });

  it("un-skips an exercise when going back during its transition", () => {
    let s = toActive(freshSession());
    s = service.skipExercise(s);
    expect(s.phase).toBe("TRANSITION");
    expect(s.results.find((r) => r.exerciseId === "a")?.skipped).toBe(true);

    const back = service.goBack(s);
    expect(back.currentExerciseIndex).toBe(0);
    expect(back.phase).toBe("ACTIVE_SET");
    expect(back.results.some((r) => r.exerciseId === "a")).toBe(false);
  });

  it("only zeroes the clock at the very start of the first exercise", () => {
    let s = toActive(freshSession());
    s = { ...s, timerValue: 2 }; // within the fresh-set grace window
    const back = service.goBack(s);
    expect(back.currentExerciseIndex).toBe(0);
    expect(back.currentSet).toBe(1);
    expect(back.timerValue).toBe(0);
    expect(back.phase).toBe("ACTIVE_SET");
  });
});
