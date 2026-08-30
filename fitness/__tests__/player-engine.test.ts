/**
 * Player-engine coverage for the guided-session state machine additions the
 * premium player relies on:
 *
 *  – back navigation (redo current set / return to the previous exercise) with
 *    honest result bookkeeping, so the summary and the achievement/streak
 *    pipeline never double-count a redone exercise;
 *  – the TIME-BOXED set model: every set carries a work duration, a hold ends
 *    itself on the clock, a rep set runs on into overtime instead, and its reps
 *    are banked from the prescription and corrected on the rest screen.
 */

import { describe, expect, it } from "vitest";
import {
  estimateWorkSeconds,
  resolveWorkSeconds,
  type SessionExerciseInfo,
  type SessionState,
} from "@/models/session";
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

function sessionOf(...list: SessionExerciseInfo[]): SessionState {
  return service.createSession("lib_test", "Test Session", list);
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


describe("work boxes", () => {
  it("derives a set's length from its prescription and tempo", () => {
    // 10 reps of a leg movement at a three-second tempo, plus a beat to settle,
    // rounded to something a coach would actually say.
    expect(estimateWorkSeconds(ex("a"))).toBe(35);
    // Cardio reps are quicker, so the same count buys a shorter box.
    expect(estimateWorkSeconds(ex("c", { category: "cardio", reps: "20" }))).toBe(35);
    // A hold already carries its answer.
    expect(
      estimateWorkSeconds(ex("t", { exerciseType: "timed", reps: "45 sec" })),
    ).toBe(45);
  });

  it("keeps every box inside a sane band", () => {
    expect(estimateWorkSeconds(ex("a", { reps: "2" }))).toBe(20);
    expect(estimateWorkSeconds(ex("a", { reps: "100" }))).toBe(120);
  });

  it("prefers a duration the athlete set over the estimate", () => {
    expect(resolveWorkSeconds(ex("a"))).toBe(35);
    expect(resolveWorkSeconds(ex("a", { workSeconds: 60 }))).toBe(60);
    // A zero or missing override falls back rather than boxing a set at nothing.
    expect(resolveWorkSeconds(ex("a", { workSeconds: 0 }))).toBe(35);
  });

  it("ends a HOLD on the clock, honouring an adjusted duration", () => {
    const hold = ex("t", {
      exerciseType: "timed",
      reps: "30 sec",
      workSeconds: 10,
      sets: 1,
    });
    let s = toActive(sessionOf(hold));
    for (let i = 0; i < 9; i++) s = service.tick(s);
    expect(s.phase).toBe("ACTIVE_SET");
    s = service.tick(s); // the tenth second closes it
    expect(s.phase).toBe("COMPLETE");
    expect(s.results[0].setsCompleted[0].durationSeconds).toBe(10);
  });

  it("runs a REP set past its box into overtime instead of auto-completing", () => {
    let s = toActive(sessionOf(ex("a"))); // 35s box
    for (let i = 0; i < 50; i++) s = service.tick(s);
    expect(s.phase).toBe("ACTIVE_SET");
    expect(s.timerValue).toBe(50);
    expect(s.results).toHaveLength(0);
  });
});

describe("banking and correcting reps", () => {
  it("banks the prescribed target when nothing counted reps", () => {
    let s = toActive(sessionOf(ex("a", { reps: "10-15" })));
    s = service.completeSet(s);
    expect(s.phase).toBe("REST");
    expect(service.lastSetReps(s)).toBe(10);
  });

  it("corrects the last set from the rest screen and keeps the total honest", () => {
    let s = toActive(sessionOf(ex("a")));
    s = service.completeSet(s);
    s = service.adjustLastSetReps(s, 12);
    expect(service.lastSetReps(s)).toBe(12);
    expect(s.results[0].totalReps).toBe(12);

    // A second set banks on top of the corrected first.
    s = { ...s, timerValue: 1 };
    s = service.tick(s); // rest over → set 2
    expect(s.phase).toBe("ACTIVE_SET");
    s = service.completeSet(s);
    expect(s.results[0].totalReps).toBe(22);
    expect(service.lastSetReps(s)).toBe(10);
  });

  it("refuses to edit reps anywhere but rest, and never below zero", () => {
    const active = toActive(sessionOf(ex("a")));
    expect(service.adjustLastSetReps(active, 5)).toBe(active);

    let s = service.completeSet(active);
    s = service.adjustLastSetReps(s, -4);
    expect(service.lastSetReps(s)).toBe(0);
  });

  it("has no reps to confirm for a hold", () => {
    const hold = ex("t", { exerciseType: "timed", reps: "30 sec", sets: 2 });
    let s = toActive(sessionOf(hold));
    s = service.completeSet(s);
    expect(s.phase).toBe("REST");
    expect(service.lastSetReps(s)).toBeNull();
  });
});

describe("SessionService.updateExercise", () => {
  it("re-prescribes an exercise before the session starts", () => {
    const intro = sessionOf(ex("a"));
    const bumped = service.updateExercise(intro, 0, { sets: 5, workSeconds: 60 });
    expect(bumped.exercises[0].sets).toBe(5);
    expect(resolveWorkSeconds(bumped.exercises[0])).toBe(60);
  });

  it("is a no-op once the clock is running, or on an index that isn't there", () => {
    const intro = sessionOf(ex("a"));
    expect(service.updateExercise(intro, 4, { sets: 5 })).toBe(intro);
    const live = toActive(intro);
    expect(service.updateExercise(live, 0, { sets: 5 })).toBe(live);
  });
});
