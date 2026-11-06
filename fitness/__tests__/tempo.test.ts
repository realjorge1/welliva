/**
 * TEMPO (animation/tempo.ts) is what keeps the figure in ONE rhythm: every rep a
 * step of the beat grid, one human curve per feel, every joint on it together,
 * and a speed budget that only ever slows a movement to the next step. The
 * things that can quietly go wrong are all about TIME: a rep off the grid, a
 * curve with a jump or an overshoot in it, a frozen frame that isn't the
 * authored pose, a movement that strobes.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CYCLE_MS,
  FEEL_CODE,
  FX,
  LUT_N,
  REP_GRID_MS,
  arcAt,
  buildCurve,
  feelFor,
  lifeAt,
  lutAt,
  peakSlope,
  resolveTempo,
  speedBudget,
  type FeelName,
  type LifeKit,
  type MotionMetrics,
} from "../animation/tempo";

const FEELS: FeelName[] = ["lift", "steady", "bounce", "flow", "hold"];

const metrics = (authoredMs: number, swingDeg: number, rootTravel = 0): MotionMetrics => ({
  authoredMs,
  swingDeg,
  rootTravel,
});

/** A movement that resolves to each feel, with metrics typical of it. */
const SAMPLE: Record<FeelName, [string, MotionMetrics]> = {
  lift: ["squat", { authoredMs: 2400, swingDeg: 60, rootTravel: 10 }],
  steady: ["highKnee", { authoredMs: 1000, swingDeg: 60, rootTravel: 0 }],
  bounce: ["jumpingJack", { authoredMs: 1300, swingDeg: 100, rootTravel: 0 }],
  flow: ["downDog", { authoredMs: 3200, swingDeg: 60, rootTravel: 0 }],
  hold: ["plank", { authoredMs: 4200, swingDeg: 2, rootTravel: 0.9 }],
};

function kitFor(feel: FeelName): LifeKit {
  const [motion, m] = SAMPLE[feel];
  const t = resolveTempo(motion as never, m);
  expect(t.feel).toBe(feel);
  return {
    feel: FEEL_CODE[t.feel],
    reps: t.reps,
    macroMs: t.macroMs,
    loopMs: t.loopMs,
    base: t.curve.base,
    hop: t.hop,
  };
}

/**
 * The per-frame functions run as worklets on the UI thread, where a mistake is
 * invisible to every other test here. Reanimated captures a worklet's callees
 * when the caller is created, so a callee declared LATER is captured as undefined
 * — and a callee that is not itself a worklet cannot be called there at all.
 * This reads the source and holds both rules, so breaking one is a red build
 * rather than a figure that dies on the phone.
 */
describe("worklet discipline", () => {
  const files = ["../animation/tempo.ts", "../animation/motion.ts"];

  for (const rel of files) {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), rel), "utf8");
    // Every top-level `function` and whether it carries the directive.
    const fns: { name: string; at: number; worklet: boolean }[] = [];
    const re = /^(?:export\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)[^{]*\{\s*("worklet";)?/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) fns.push({ name: m[1], at: m.index, worklet: !!m[2] });
    const bodyOf = (i: number) => src.slice(fns[i].at, i + 1 < fns.length ? fns[i + 1].at : src.length);
    const calls = (body: string, name: string) => new RegExp(`\\b${name}\\s*\\(`).test(body);

    it(`${rel}: has worklets to check`, () => {
      expect(fns.filter((f) => f.worklet).length).toBeGreaterThanOrEqual(4);
    });

    it(`${rel}: every worklet is declared before the worklets that call it`, () => {
      const late: string[] = [];
      fns.forEach((f, i) => {
        if (!f.worklet) return;
        for (const other of fns) {
          if (other.worklet && other.name !== f.name && other.at > f.at && calls(bodyOf(i), other.name)) {
            late.push(`${f.name} calls ${other.name}, declared later`);
          }
        }
      });
      expect(late).toEqual([]);
    });

    it(`${rel}: no worklet calls a plain function of the same file`, () => {
      const plain: string[] = [];
      fns.forEach((f, i) => {
        if (!f.worklet) return;
        for (const other of fns) {
          if (!other.worklet && calls(bodyOf(i), other.name)) plain.push(`${f.name} calls ${other.name}`);
        }
      });
      expect(plain).toEqual([]);
    });
  }
});

describe("the rep curves", () => {
  for (const feel of FEELS) {
    describe(feel, () => {
      const c = buildCurve(feel);

      it("starts at pose A and has pose B at the middle of the rep, exactly", () => {
        expect(c.base).toHaveLength(LUT_N + 1);
        expect(c.base[0]).toBe(0);
        expect(c.base[LUT_N / 2]).toBe(1);
        expect(c.base[LUT_N]).toBe(0);
      });

      it("never overshoots: the body goes from one pose to the other and no further", () => {
        for (const t of c.base) {
          expect(t).toBeGreaterThanOrEqual(-1e-9);
          expect(t).toBeLessThanOrEqual(1 + 1e-9);
        }
      });

      it("only ever travels one way between the two ends — no dip, no rebound", () => {
        for (let i = 1; i <= LUT_N / 2; i++) expect(c.base[i]).toBeGreaterThanOrEqual(c.base[i - 1] - 1e-12);
        for (let i = LUT_N / 2 + 1; i <= LUT_N; i++) expect(c.base[i]).toBeLessThanOrEqual(c.base[i - 1] + 1e-12);
      });

      it("is smooth: it never jumps, and it eases out of and into each end", () => {
        let worst = 0;
        for (let i = 1; i <= LUT_N; i++) worst = Math.max(worst, Math.abs(c.base[i] - c.base[i - 1]));
        // The steepest feel moves under 3% of the way per 1/240 of a rep.
        expect(worst).toBeLessThan(0.03);
        // Zero speed at both poses: the first and the middle step barely move.
        expect(c.base[1] - c.base[0]).toBeLessThan(0.002);
        expect(c.base[LUT_N / 2] - c.base[LUT_N / 2 - 1]).toBeLessThan(0.002);
      });

      it("is symmetric: the way back is the way down, reversed", () => {
        for (let i = 0; i <= LUT_N / 2; i++) expect(c.base[LUT_N - i]).toBeCloseTo(c.base[i], 9);
      });
    });
  }

  it("a lift rests at both ends, a little longer standing tall than at the bottom", () => {
    const c = buildCurve("lift");
    // Still at the top through the turn of one rep into the next…
    for (const p of [0.97, 0.99, 0.01, 0.03]) expect(lutAt(c.base, p)).toBe(0);
    // …and still at the bottom across the middle.
    for (const p of [0.48, 0.5, 0.52]) expect(lutAt(c.base, p)).toBe(1);
    expect(lutAt(c.base, 0.07)).toBeGreaterThan(0);
    expect(lutAt(c.base, 0.45)).toBeLessThan(1);
  });

  it("a lift moves on the minimum-jerk path: halfway there at the middle of its travel", () => {
    const c = buildCurve("lift");
    // Rest 0.06 at the start, travel 0.40, rest 0.04 before B.
    expect(lutAt(c.base, 0.06 + 0.2)).toBeCloseTo(0.5, 3);
    // The quintic is faster through its middle than a sine would be.
    expect(peakSlope(c)).toBeCloseTo(1.875 / 0.4, 1);
  });

  it("continuous work is a plain harmonic swing — it never stops", () => {
    const c = buildCurve("steady");
    expect(peakSlope(c)).toBeCloseTo(Math.PI, 1);
    for (const p of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
      expect(lutAt(c.base, p)).toBeCloseTo(0.5 - 0.5 * Math.cos(2 * Math.PI * p), 3);
    }
  });

  it("samples between table entries", () => {
    const c = buildCurve("steady");
    const a = lutAt(c.base, 1 / LUT_N);
    const b = lutAt(c.base, 2 / LUT_N);
    const mid = lutAt(c.base, 1.5 / LUT_N);
    expect(mid).toBeCloseTo((a + b) / 2, 9);
  });
});

describe("which feel a movement has", () => {
  it("strength work is a lift", () => {
    expect(feelFor("squat", metrics(2400, 82, 10))).toBe("lift");
    expect(feelFor("pushup", metrics(2200, 103, 10))).toBe("lift");
    expect(feelFor("curl", metrics(2000, 165))).toBe("lift");
    expect(feelFor("hinge", metrics(2600, 76, 2))).toBe("lift");
  });

  it("a plank, a wall sit and a deep-squat hold are holds — they breathe, they do not rep", () => {
    expect(feelFor("plank", metrics(4200, 2, 0.9))).toBe("hold");
    expect(feelFor("wallSit", metrics(4200, 0, 1))).toBe("hold");
    expect(feelFor("deepSquat", metrics(4200, 3, 0.6))).toBe("hold");
    expect(feelFor("idle", metrics(4200, 4, 1))).toBe("hold");
    expect(feelFor("neutral", metrics(3200, 0))).toBe("hold");
  });

  it("long stretches are flows, short mobility is steady", () => {
    expect(feelFor("downDog", metrics(3200, 23))).toBe("flow");
    expect(feelFor("catCow", metrics(3400, 94, 2.5))).toBe("flow");
    expect(feelFor("inchworm", metrics(3000, 76, 6))).toBe("flow");
    expect(feelFor("torsoTwist", metrics(2400, 150))).toBe("steady");
    expect(feelFor("armCircles", metrics(1300, 18))).toBe("steady");
  });

  it("jumps bounce and marches are steady", () => {
    expect(feelFor("jumpingJack", metrics(700, 171))).toBe("bounce");
    expect(feelFor("jumpSquat", metrics(1400, 180, 25))).toBe("bounce");
    expect(feelFor("highKnee", metrics(620, 100))).toBe("steady");
    expect(feelFor("mountainClimber", metrics(700, 138))).toBe("steady");
  });

  it("a static-looking pose that is short is not a hold (a flutter kick is quick)", () => {
    expect(feelFor("flutterKick", metrics(620, 11))).toBe("steady");
  });
});

describe("one rhythm", () => {
  it("every step of the grid is a whole number of 500 ms beats and divides the clock's cycle", () => {
    for (const ms of REP_GRID_MS) {
      expect(ms % 500).toBe(0);
      expect(CYCLE_MS % ms).toBe(0);
    }
  });

  it("gives each feel its own pace: a beat for cardio, three for strength, six for a stretch", () => {
    expect(resolveTempo("highKnee", metrics(620, 60)).loopMs).toBe(1000);
    expect(resolveTempo("squat", metrics(2400, 82, 10)).loopMs).toBe(3000);
    expect(resolveTempo("downDog", metrics(3200, 23)).loopMs).toBe(6000);
    expect(resolveTempo("plank", metrics(4200, 2, 0.9)).loopMs).toBe(6000);
  });

  it("gives controlled core work its own slow pace — a dead bug is not a sprint", () => {
    // A rep is both sides; a second would be half a second a side.
    expect(resolveTempo("deadBug", metrics(2600, 90)).loopMs).toBe(3000);
    expect(resolveTempo("birdDog", metrics(2800, 90)).loopMs).toBe(3000);
    expect(resolveTempo("windshieldWiper", metrics(2600, 90)).loopMs).toBe(3000);
    expect(resolveTempo("broadJump", metrics(1600, 90)).loopMs).toBe(2000);
    // Still on the grid, so still on the beat.
    expect(REP_GRID_MS as readonly number[]).toContain(resolveTempo("russianTwist", metrics(1600, 60)).loopMs);
  });

  it("ignores the authored length: a hand-typed 2350 ms no longer puts one move off the beat", () => {
    for (const authored of [1800, 2200, 2350, 2600, 3000]) {
      expect(resolveTempo("squat", metrics(authored, 82, 10)).loopMs).toBe(3000);
    }
  });

  it("runs every movement's clock on the same 12 s cycle, a whole number of reps", () => {
    for (const [m, ms, sw] of [
      ["squat", 2400, 82],
      ["jumpingJack", 700, 171],
      ["plank", 4200, 2],
      ["downDog", 3200, 23],
      ["torsoTwist", 2400, 150],
    ] as const) {
      const t = resolveTempo(m, metrics(ms, sw));
      expect(t.macroMs).toBe(CYCLE_MS);
      expect(Number.isInteger(t.reps)).toBe(true);
      expect(t.reps * t.loopMs).toBe(CYCLE_MS);
    }
  });
});

describe("the speed budget", () => {
  it("moves a movement whose joints would turn too fast to the next step of the grid", () => {
    // A jumping jack's forearm sweeps 171°: a 1 s rep would turn it 537°/s.
    const jack = resolveTempo("jumpingJack", metrics(700, 171));
    expect(jack.loopMs).toBe(1500);
    // A torso twist swings 150° — too much for a 1 s swing (471°/s), fine over
    // the next step, 1.5 s (314°/s).
    expect(resolveTempo("torsoTwist", metrics(2400, 150)).loopMs).toBe(1500);
    // Never below the feel's own pace, however small the swing.
    expect(resolveTempo("squat", metrics(900, 10)).loopMs).toBe(3000);
  });

  it("holds every feel to its angular speed at the curve's steepest", () => {
    for (const [motion, ms, sw] of [
      ["squat", 1500, 120],
      ["squat", 1500, 200],
      ["highKnee", 400, 120],
      ["jumpingJack", 500, 175],
      ["downDog", 1500, 120],
    ] as const) {
      const t = resolveTempo(motion, metrics(ms, sw));
      const peak = (sw * t.slope) / (t.loopMs / 1000);
      expect(peak, motion).toBeLessThanOrEqual(speedBudget(t.feel) * 1.001);
      expect(REP_GRID_MS as readonly number[]).toContain(t.loopMs);
    }
  });

  it("never strobes: nothing repeats faster than once a second", () => {
    expect(Math.min(...REP_GRID_MS)).toBe(1000);
    expect(resolveTempo("fastFeet", metrics(420, 98)).loopMs).toBeGreaterThanOrEqual(1000);
  });
});

describe("the life layer is the breath, and nothing else", () => {
  for (const feel of FEELS) {
    it(`${feel}: breathes with the rep — out at the top, in at the bottom — and is finite`, () => {
      const k = kitFor(feel);
      expect(FX.LENGTH).toBe(1);
      for (let i = 0; i <= 240; i++) {
        const q = i / 240;
        const f = lifeAt(k, q);
        expect(f).toHaveLength(FX.LENGTH);
        expect(Number.isFinite(f[FX.BREATH])).toBe(true);
        expect(f[FX.BREATH]).toBeCloseTo(lutAt(k.base, q), 12);
      }
      expect(lifeAt(k, 0)[FX.BREATH]).toBe(0);
    });
  }
});

describe("the hop", () => {
  it("lifts a bounce and bobs a step between the poses, and lands on each", () => {
    for (const feel of [FEEL_CODE.bounce, FEEL_CODE.steady]) {
      expect(arcAt(feel, 0)).toBe(0);
      expect(arcAt(feel, 0.5)).toBeCloseTo(0, 12);
      expect(arcAt(feel, 0.25)).toBeCloseTo(1, 12);
      expect(arcAt(feel, 0.75)).toBeCloseTo(1, 12);
    }
  });

  it("keeps everything else on the floor", () => {
    for (const feel of [FEEL_CODE.lift, FEEL_CODE.flow, FEEL_CODE.hold]) {
      for (const q of [0, 0.25, 0.5, 0.75]) expect(arcAt(feel, q)).toBe(0);
    }
  });
});
