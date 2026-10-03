/**
 * The weekly plan is a function of the person.
 *
 * The owner's rule, as tests: no session is a dice roll, every session is
 * tailored, and two people only get the same week when their data is the same
 * where it matters — while every difference that matters shows up. Plus the
 * promises the plan makes on screen: the reasons it gives are the inputs that
 * decided it, the minutes it claims are minutes it holds, and the doses climb
 * from what the user actually logged.
 */
import { describe, expect, it, vi } from "vitest";

import { EXERCISE_DATABASE } from "../../../constants/ExerciseDatabase";
import { WORKOUT_BY_ID } from "../../../fitness/data/workouts";
import type { TrainingAdjustment } from "../../../fitness/types";
import type { SessionEffort, SessionSummaryData } from "../../../models/session";
import type { PrimaryGoal, UserBio } from "../../../models/user";
import type { GeneratedWorkoutPlan, PlannedExercise } from "../../../models/workout";
import { resolveTrainingPrefs, type TrainingPrefs } from "../prefs";
import { buildTrainingWeek, trainingInputHash, type BuildWeekInput } from "../week";
import { HIGH_IMPACT, LYING_DOWN } from "../vocabulary";

const DB = new Map(EXERCISE_DATABASE.map((e) => [e.id, e]));
const WEEK = "2026-10-05"; // a Monday
const NOW = new Date("2026-10-05T07:00:00.000Z");

const BASE: UserBio = {
  age: 30,
  sex: "female",
  heightCm: 168,
  weightKg: 64,
  activityLevel: "moderate",
  exerciseLevel: "beginner",
  primaryGoal: "lose_weight",
  goals: ["lose_weight"],
  trainingEnabled: true,
  dietaryRestriction: "none",
  allergies: [],
  medicalConditions: [],
  mealsPerDay: 3,
  equipment: ["none"],
  workoutDaysPerWeek: 3,
} as UserBio;

function bioWith(over: Partial<UserBio>): UserBio {
  return { ...BASE, ...over } as UserBio;
}

function prefsFor(bio: UserBio, over: Partial<TrainingPrefs> = {}): TrainingPrefs {
  return { ...resolveTrainingPrefs(bio, null), ...over };
}

function build(
  bio: UserBio = BASE,
  over: Partial<TrainingPrefs> = {},
  sessions: SessionSummaryData[] = [],
  extra: Partial<BuildWeekInput> = {},
): GeneratedWorkoutPlan {
  return buildTrainingWeek({
    bio,
    prefs: prefsFor(bio, over),
    sessions,
    weekStart: WEEK,
    today: WEEK,
    pool: EXERCISE_DATABASE,
    library: (id) => WORKOUT_BY_ID.get(id),
    now: NOW,
    ...extra,
  });
}

const work = (plan: GeneratedWorkoutPlan): PlannedExercise[] =>
  plan.sessions.flatMap((s) => s.exercises.filter((e) => (e.block ?? "main") === "main"));
const all = (plan: GeneratedWorkoutPlan): PlannedExercise[] => plan.sessions.flatMap((s) => s.exercises);

/** What a user would actually see differ: days, labels, moves and doses. */
function fingerprint(plan: GeneratedWorkoutPlan): string {
  return JSON.stringify(
    plan.sessions.map((s) => [
      s.dayOfWeek,
      s.dayLabel,
      s.exercises.map((e) => [e.exerciseId, e.sets, e.reps, e.restSeconds]),
    ]),
  );
}

/** One logged guided session. `done` = reps logged per set. */
function run(
  date: string,
  items: { id: string; sets?: number; reps?: string; done?: number[]; skipped?: boolean }[],
  opts: { effort?: SessionEffort; sessionId?: string } = {},
): SessionSummaryData {
  const results = items.map((it) => {
    const ex = DB.get(it.id)!;
    const sets = it.sets ?? 3;
    const reps = it.reps ?? ex.defaultReps;
    const done = it.done ?? Array.from({ length: sets }, () => parseInt(reps, 10));
    return {
      exerciseId: ex.id,
      exerciseName: ex.name,
      category: ex.category,
      difficulty: ex.difficulty,
      targetSets: sets,
      targetReps: reps,
      setsCompleted: it.skipped
        ? []
        : done.map((r, i) => ({ setNumber: i + 1, repsCompleted: r, durationSeconds: 40, skipped: false })),
      totalReps: it.skipped ? 0 : done.reduce((a, b) => a + b, 0),
      totalTimeSeconds: 120,
      skipped: !!it.skipped,
    };
  });
  return {
    sessionRunId: `run_${date}_${opts.sessionId ?? "plan"}`,
    workoutSessionId: opts.sessionId ?? `session_0_${date}`,
    sessionLabel: "Full body",
    date,
    exerciseResults: results,
    totalExercises: results.length,
    exercisesCompleted: results.filter((r) => !r.skipped).length,
    totalSets: 9,
    setsCompleted: 9,
    totalReps: 0,
    durationSeconds: 1500,
    caloriesBurned: 120,
    completionPercent: 100,
    effort: opts.effort,
    completedAt: `${date}T18:00:00.000Z`,
  };
}

describe("no dice", () => {
  it("builds the same plan from the same data", () => {
    expect(build()).toEqual(build());
  });

  it("never draws a random number", () => {
    const spy = vi.spyOn(Math, "random");
    build(bioWith({ goals: ["build_muscle", "lose_weight"], primaryGoal: "build_muscle" }), {
      days: [0, 1, 2, 4, 5],
      daysSource: "you",
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("tailored: different data, different week", () => {
  const goals: PrimaryGoal[] = [
    "lose_weight",
    "build_muscle",
    "improve_fitness",
    "increase_energy",
    "better_health",
    "athletic_performance",
  ];
  const levels = ["beginner", "intermediate", "advanced"] as const;

  it("gives every goal × level combination its own week", () => {
    const prints = new Map<string, string>();
    for (const g of goals) {
      for (const level of levels) {
        const plan = build(bioWith({ primaryGoal: g, goals: [g], exerciseLevel: level }));
        const fp = fingerprint(plan);
        const clash = [...prints.entries()].find(([, p]) => p === fp);
        expect(clash?.[0], `${g}/${level} built the same week as ${clash?.[0]}`).toBeUndefined();
        prints.set(`${g}/${level}`, fp);
      }
    }
  });

  it("changes the week when the kit, the days, the length or an injury changes", () => {
    const base = fingerprint(build());
    expect(fingerprint(build(bioWith({ equipment: ["dumbbells"] })))).not.toBe(base);
    expect(fingerprint(build(BASE, { days: [1, 3, 5], daysSource: "you" }))).not.toBe(base);
    expect(fingerprint(build(BASE, { sessionMinutes: 15 }))).not.toBe(base);
    expect(fingerprint(build(bioWith({ injuries: ["shoulder"] })))).not.toBe(base);
  });

  it("gives the same week when only data the plan doesn't use differs", () => {
    const a = build(bioWith({ sex: "female", weightKg: 64, age: 30 }));
    const b = build(bioWith({ sex: "male", weightKg: 72, age: 34 }));
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("doses each goal its own way", () => {
    const rest = (g: PrimaryGoal) =>
      work(build(bioWith({ primaryGoal: g, goals: [g], exerciseLevel: "intermediate" })))
        .filter((e) => e.role === "main")
        .map((e) => e.restSeconds);
    expect(Math.max(...rest("lose_weight"))).toBeLessThan(Math.min(...rest("build_muscle")));
  });
});

describe("every choice says why", () => {
  it("explains the week, each day and each move", () => {
    for (const bio of [
      BASE,
      bioWith({ primaryGoal: "build_muscle", goals: ["build_muscle"], exerciseLevel: "advanced", equipment: ["dumbbells", "bench"] }),
      bioWith({ age: 70, injuries: ["knee"] }),
    ]) {
      const plan = build(bio);
      expect(plan.reasons!.length).toBeGreaterThanOrEqual(5);
      for (const s of plan.sessions) {
        expect(s.reason, s.dayLabel).toBeTruthy();
        for (const e of s.exercises.filter((x) => (x.block ?? "main") === "main")) {
          expect(e.reason, `${s.dayLabel}: ${e.name}`).toBeTruthy();
        }
      }
    }
  });

  it("prefers a specific reason to a generic one", () => {
    for (const bio of [BASE, bioWith({ primaryGoal: "build_muscle", goals: ["build_muscle"], equipment: ["dumbbells"] })]) {
      const reasons = work(build(bio)).map((e) => e.reason ?? "");
      const generic = reasons.filter((r) => r.startsWith("Right for your"));
      expect(generic.length / reasons.length).toBeLessThan(0.25);
    }
  });

  it("never names a substitution twice in one session", () => {
    const plan = build(bioWith({ medicalConditions: ["pregnancy"], pregnancyTrimester: 2 }));
    for (const s of plan.sessions) {
      const named = s.exercises
        .map((e) => /instead of (.+?) —/.exec(e.reason ?? "")?.[1])
        .filter((x): x is string => !!x);
      expect(new Set(named).size, s.dayLabel).toBe(named.length);
    }
  });

  it("names the input behind the week", () => {
    const plan = build(bioWith({ equipment: ["dumbbells"] }), { days: [1, 3, 5], daysSource: "you" });
    const text = plan.reasons!.join("\n");
    expect(text).toContain("Built for fat loss");
    expect(text).toContain("Tue, Thu, Sat — the days you picked");
    expect(text).toContain("Uses your dumbbells");
    expect(text).toContain("Up to 30 minutes a session — a starting length for your beginner level");
  });
});

describe("the user's own week", () => {
  it("puts sessions on the user's days", () => {
    expect(build(BASE, { days: [1, 3, 5], daysSource: "you" }).sessions.map((s) => s.dayOfWeek)).toEqual([1, 3, 5]);
    expect(build(BASE, { days: [6], daysSource: "you" }).sessions.map((s) => s.dayOfWeek)).toEqual([6]);
  });

  it("splits back-to-back full-body days upper and lower, and says so", () => {
    const plan = build(bioWith({ primaryGoal: "build_muscle", goals: ["build_muscle"] }), {
      days: [0, 1, 2],
      daysSource: "you",
    });
    expect(plan.sessions.map((s) => s.dayLabel)).toEqual(["Upper body A", "Lower body", "Upper body B"]);
    expect(plan.sessions[1].reason).toContain("back to back");
  });

  it("holds sessions to the minutes given, and uses them", () => {
    for (const s of build(BASE, { sessionMinutes: 20 }).sessions) {
      expect(s.totalDurationMinutes).toBeLessThanOrEqual(24);
    }
    const long = build(bioWith({ primaryGoal: "build_muscle", goals: ["build_muscle"], exerciseLevel: "intermediate" }), {
      sessionMinutes: 45,
    });
    for (const s of long.sessions) expect(s.totalDurationMinutes).toBeGreaterThanOrEqual(30);
  });

  it("runs real warm-ups and cool-downs, counted in the minutes", () => {
    for (const s of build().sessions) {
      const warm = s.exercises.filter((e) => e.block === "warmup");
      const cool = s.exercises.filter((e) => e.block === "cooldown");
      expect(warm.length).toBeGreaterThanOrEqual(1);
      expect(cool.length).toBeGreaterThanOrEqual(1);
      expect(s.exercises[0].block).toBe("warmup");
      expect(s.exercises[s.exercises.length - 1].block).toBe("cooldown");
      expect(s.warmupMinutes).toBeGreaterThan(0);
    }
  });
});

describe("safety", () => {
  it("keeps a knee injury out of every session", () => {
    const plan = build(bioWith({ injuries: ["knee"] }));
    expect(work(plan).filter((e) => e.movementPattern === "squat")).toEqual([]);
    expect(all(plan).filter((e) => HIGH_IMPACT.has(e.exerciseId))).toEqual([]);
    expect(plan.reasons!.join("\n")).toContain("Protects your knee");
  });

  it("plans the third trimester at beginner level, with no core work and no jumping", () => {
    const plan = build(
      bioWith({ exerciseLevel: "intermediate", medicalConditions: ["pregnancy"], pregnancyTrimester: 3 }),
    );
    for (const e of all(plan)) {
      expect(e.difficulty, e.name).toBe("beginner");
      expect(HIGH_IMPACT.has(e.exerciseId), e.name).toBe(false);
    }
    expect(work(plan).filter((e) => e.movementPattern === "core" || e.movementPattern === "cardio")).toEqual([]);
    const text = plan.reasons!.join("\n");
    expect(text).toContain("Pregnancy-safe moves for trimester 3");
    expect(text).toContain("Beginner moves at most — for pregnancy, trimester 3");
  });

  it("keeps everything done lying flat out of a second-trimester plan, and says so", () => {
    const plan = build(bioWith({ medicalConditions: ["pregnancy"], pregnancyTrimester: 2 }));
    expect(all(plan).filter((e) => LYING_DOWN.has(e.exerciseId)).map((e) => e.name)).toEqual([]);
    expect(plan.reasons).toContain(
      "Nothing done lying flat on your back or front — advised from the second trimester",
    );
    // First trimester: lying down is still fine.
    const t1 = build(bioWith({ medicalConditions: ["pregnancy"], pregnancyTrimester: 1 }));
    expect(t1.reasons!.some((r) => r.startsWith("Nothing done lying flat"))).toBe(false);
  });

  it("goes low-impact for a heavier beginner, and says why without naming weight", () => {
    const plan = build(bioWith({ weightKg: 98, heightCm: 165 }));
    expect(all(plan).filter((e) => HIGH_IMPACT.has(e.exerciseId))).toEqual([]);
    expect(plan.reasons).toContain("No jumping — kinder to your joints");
  });

  it("past 65: balance work every session, no jumping, longer warm-ups", () => {
    const plan = build(bioWith({ age: 70 }));
    for (const s of plan.sessions) {
      expect(s.exercises.some((e) => e.role === "balance"), s.dayLabel).toBe(true);
      expect(s.exercises.filter((e) => e.block === "warmup").length).toBe(3);
    }
    expect(all(plan).filter((e) => HIGH_IMPACT.has(e.exerciseId))).toEqual([]);
  });

  it("replaces a day the body rules out, and names the reason", () => {
    const plan = build(bioWith({ primaryGoal: "build_muscle", goals: ["build_muscle"], injuries: ["shoulder"] }), {
      days: [0, 1, 3, 4],
      daysSource: "you",
    });
    expect(work(plan).filter((e) => e.movementPattern === "push" || e.movementPattern === "pull")).toEqual([]);
    expect(plan.sessions.some((s) => /instead of upper body — protects your shoulder/.test(s.reason ?? ""))).toBe(true);
  });
});

describe("kit and place", () => {
  it("never hands a bodyweight user kit", () => {
    for (const e of all(build())) expect(DB.get(e.exerciseId)!.equipment, e.name).toEqual([]);
  });

  it("uses the kit the user owns", () => {
    const plan = build(bioWith({ primaryGoal: "build_muscle", goals: ["build_muscle"], equipment: ["dumbbells"] }));
    expect(work(plan).some((e) => DB.get(e.exerciseId)!.equipment.includes("dumbbells"))).toBe(true);
  });

  it("brings the gym's kit to a gym-goer", () => {
    const plan = build(bioWith({ primaryGoal: "build_muscle", goals: ["build_muscle"] }), { location: "gym" });
    expect(work(plan).some((e) => DB.get(e.exerciseId)!.equipment.length > 0)).toBe(true);
    expect(plan.reasons).toContain("Gym kit in play — you train at the gym");
  });
});

describe("progression from what was logged", () => {
  const twoDone = [
    run("2026-09-28", [{ id: "push_01", sets: 3, reps: "10-15" }]),
    run("2026-09-30", [{ id: "push_01", sets: 3, reps: "10-15" }]),
  ];
  const find = (plan: GeneratedWorkoutPlan, id: string) => work(plan).find((e) => e.exerciseId === id);
  /** A dose reason that came from the log, rather than from the session's time budget. */
  const PROGRESSION = /^(Up from|Held at|Eased from|Same as last time|An extra set|Maxed out)/;

  it("steps a move up after two completed sessions — the bottom of the range first", () => {
    const ex = find(build(BASE, {}, twoDone), "push_01")!;
    expect(ex).toBeDefined();
    expect(ex.sets).toBe(3);
    expect(ex.reps).toBe("12-15");
    expect(ex.doseReason).toBe("Up from 3×10–15 — you completed it the last two times");
  });

  it("moves the whole range when the athlete logs the top of it", () => {
    const top = [run("2026-09-30", [{ id: "push_01", sets: 3, reps: "8-12", done: [12, 12, 12] }])];
    const ex = find(build(BASE, {}, top), "push_01")!;
    expect(ex.reps).toBe("10-14");
    expect(ex.doseReason).toBe("Up from 3×8–12 — you logged the top of the range on every set");
  });

  it("holds when recent sessions felt hard", () => {
    const hard = twoDone.map((s) => ({ ...s, effort: "hard" as const }));
    const ex = find(build(BASE, {}, hard), "push_01")!;
    expect(ex.reps).toBe("10-15");
    expect(ex.doseReason).toBe("Held at 3×10–15 — you rated your recent sessions hard");
  });

  it("eases back after two short sessions", () => {
    const short = [
      run("2026-09-28", [{ id: "push_01", sets: 3, reps: "10-15", done: [6, 5, 5] }]),
      run("2026-09-30", [{ id: "push_01", sets: 3, reps: "10-15", done: [6, 6, 4] }]),
    ];
    const ex = find(build(BASE, {}, short), "push_01")!;
    expect(ex.reps).toBe("8-13");
    expect(ex.doseReason).toBe("Eased from 3×10–15 — the last two sessions came up short");
  });

  it("moves on to the harder variant once a move is maxed out", () => {
    const maxed = [run("2026-09-30", [{ id: "push_01", sets: 3, reps: "16-20", done: [20, 20, 20] }])];
    const next = find(build(BASE, {}, maxed), "push_03");
    expect(next?.reason).toBe("You've outgrown Push-ups — this is the next step");
  });

  it("swaps out a move the user keeps skipping", () => {
    const skipped = [
      run("2026-09-28", [{ id: "push_01", skipped: true }]),
      run("2026-09-30", [{ id: "push_01", skipped: true }]),
    ];
    const plan = build(BASE, {}, skipped);
    expect(find(plan, "push_01")).toBeUndefined();
    expect(work(plan).some((e) => e.reason === "In for Push-ups — you skipped it 2 of 2 times")).toBe(true);
  });

  it("does not move a dose for a library workout done on a whim", () => {
    const library = [
      run("2026-09-28", [{ id: "push_01", sets: 3, reps: "10-15" }], { sessionId: "lib_morning-ignition" }),
      run("2026-09-30", [{ id: "push_01", sets: 3, reps: "10-15" }], { sessionId: "lib_morning-ignition" }),
    ];
    for (const e of work(build(BASE, {}, library))) expect(e.doseReason ?? "").not.toMatch(PROGRESSION);
  });

  it("starts doses fresh when the goal changes, and says so", () => {
    const last = build(BASE, {}, twoDone, { weekStart: "2026-09-28", today: "2026-09-28" });
    const muscle = bioWith({ primaryGoal: "build_muscle", goals: ["build_muscle"] });
    const plan = build(muscle, {}, twoDone, { previous: last });
    expect(find(plan, "push_01")?.doseReason ?? "").not.toMatch(PROGRESSION);
    expect(plan.reasons!.join("\n")).toContain("New goal, new starting doses");
  });

  it("rebuilds mid-week without reshuffling: history moves doses, not the hash", () => {
    const bio = BASE;
    const p = prefsFor(bio);
    expect(trainingInputHash(bio, p, WEEK)).toBe(trainingInputHash(bio, { ...p }, WEEK));
    expect(build(bio, {}, twoDone).inputHash).toBe(build(bio).inputHash);
    expect(trainingInputHash(bio, { ...p, days: [1, 3, 5] }, WEEK)).not.toBe(trainingInputHash(bio, p, WEEK));
  });
});

describe("milestones", () => {
  it("puts the user's rung of the ladder into the week", () => {
    const plan = build(BASE, { milestone: "first full push-up" });
    const days = plan.sessions.filter((s) => s.exercises.some((e) => e.exerciseId === "push_13"));
    expect(days.length).toBeGreaterThanOrEqual(2);
    expect(plan.reasons!.some((r) => r.includes("“first full push-up”"))).toBe(true);
  });

  it("keeps the milestone itself out of the week until the user reaches it", () => {
    const plan = build(BASE, { milestone: "first full push-up" });
    expect(all(plan).some((e) => e.exerciseId === "push_01")).toBe(false);
  });

  it("ignores a milestone it cannot plan for, rather than inventing one", () => {
    const plan = build(BASE, { milestone: "learn to juggle" });
    expect(plan.reasons!.some((r) => r.includes("juggle"))).toBe(false);
  });
});

describe("Let me choose", () => {
  it("runs the user's library workout on its day, reps set for their level", () => {
    const plan = build(BASE, {
      mode: "chosen",
      chosen: [{ day: 0, workoutId: "morning-ignition" }],
    });
    const mon = plan.sessions.find((s) => s.dayOfWeek === 0)!;
    expect(mon.source).toBe("chosen");
    expect(mon.libraryWorkoutId).toBe("morning-ignition");
    expect(mon.dayLabel).toBe("Morning Ignition");
    const def = WORKOUT_BY_ID.get("morning-ignition")!;
    expect(mon.exercises.filter((e) => e.block === "main").map((e) => e.exerciseId)).toEqual(
      def.main.map((i) => i.exerciseId),
    );
    expect(plan.sessions.filter((s) => s.dayOfWeek !== 0).every((s) => s.source === "planned")).toBe(true);
    expect(plan.reasons).toContain("1 day is your pick from Explore; Gozlin plans the other 2");
    expect(mon.exercises.filter((e) => e.block === "main").every((e) => e.reason === "Part of Morning Ignition, your pick")).toBe(true);
  });

  it("swaps a picked workout's unsafe moves, and says which and why", () => {
    const plan = build(bioWith({ injuries: ["knee"] }), {
      mode: "chosen",
      chosen: [{ day: 0, workoutId: "morning-ignition" }],
    });
    const mon = plan.sessions.find((s) => s.dayOfWeek === 0)!;
    expect(mon.exercises.filter((e) => HIGH_IMPACT.has(e.exerciseId))).toEqual([]);
    expect(mon.exercises.filter((e) => e.block === "main" && e.movementPattern === "squat")).toEqual([]);
    expect(mon.exercises.some((e) => /in place of .+ — (protects your knee|no jumping)/.test(e.reason ?? ""))).toBe(true);
  });

  it("says when a picked workout's move is left out and nothing safe can stand in", () => {
    const plan = build(bioWith({ medicalConditions: ["pregnancy"], pregnancyTrimester: 2 }), {
      mode: "chosen",
      chosen: [{ day: 0, workoutId: "morning-ignition" }],
    });
    const mon = plan.sessions.find((s) => s.dayOfWeek === 0)!;
    expect(mon.exercises.some((e) => e.exerciseId === "core_07")).toBe(false);
    expect(mon.reason).toContain("Mountain Climbers left out — pregnancy-safe");
  });

  it("ignores picks while the plan is in Gozlin's hands", () => {
    const plan = build(BASE, { mode: "planned", chosen: [{ day: 0, workoutId: "morning-ignition" }] });
    expect(plan.sessions.every((s) => s.source === "planned")).toBe(true);
  });
});

describe("Gozlin's adjustments survive the rebuild", () => {
  const swap: TrainingAdjustment = {
    id: `${WEEK}:replace:push_01`,
    appliedAt: "2026-10-06T09:00:00.000Z",
    weekStart: WEEK,
    title: "Swap Push-ups → Incline Push-ups",
    exerciseId: "push_01",
    exerciseName: "Push-ups",
    change: { replacementId: "push_02", replacementName: "Incline Push-ups" },
  };

  it("holds a swap for four weeks, then lets it go", () => {
    for (const weekStart of [WEEK, "2026-10-26"]) {
      const plan = build(BASE, { adjustments: [swap] }, [], { weekStart, today: weekStart });
      expect(work(plan).some((e) => e.exerciseId === "push_01"), weekStart).toBe(false);
      expect(work(plan).some((e) => e.reason === "Gozlin swapped this in for Push-ups"), weekStart).toBe(true);
    }
    const later = build(BASE, { adjustments: [swap] }, [], { weekStart: "2026-11-09", today: "2026-11-09" });
    expect(work(later).some((e) => e.reason === "Gozlin swapped this in for Push-ups")).toBe(false);
  });

  it("applies a dose change in its own week only", () => {
    const target = work(build()).find((e) => e.sets >= 2)!;
    const ease: TrainingAdjustment = {
      id: `${WEEK}:decrease_volume:${target.exerciseId}`,
      appliedAt: "2026-10-06T09:00:00.000Z",
      weekStart: WEEK,
      title: `Ease ${target.name} back a set`,
      exerciseId: target.exerciseId,
      exerciseName: target.name,
      change: { setsDelta: -1 },
    };
    const eased = work(build(BASE, { adjustments: [ease] })).find((e) => e.exerciseId === target.exerciseId)!;
    expect(eased.sets).toBe(target.sets - 1);
    expect(eased.doseReason).toBe(`Gozlin's change this week — Ease ${target.name} back a set`);

    const next = build(BASE, { adjustments: [ease] }, [], { weekStart: "2026-10-12", today: "2026-10-12" });
    expect(work(next).some((e) => e.doseReason?.startsWith("Gozlin's change"))).toBe(false);
  });
});
