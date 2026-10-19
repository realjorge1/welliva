/**
 * TEMPO (animation/tempo.ts) is what makes the figure move like a character
 * rather than a ping-pong: a feel per movement, a speed budget, and a life layer
 * that runs on top. The things that can quietly go wrong are all about TIME:
 * a frozen frame that isn't the authored pose, a rep timeline with a jump in it,
 * a movement that comes out faster than it was authored, a face that shows two
 * mouths at once or is caught mid-blink on the first frame.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FEEL_CODE,
  FX,
  LUT_N,
  boneFeel,
  buildCurve,
  feelFor,
  hashOf,
  lifeAt,
  lutAt,
  peakSlope,
  resolveTempo,
  speedBudget,
  strainOf,
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
    strain: strainOf(t.feel),
    drag: 3.5,
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
      expect(fns.filter((f) => f.worklet).length).toBeGreaterThanOrEqual(5);
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

describe("the rep timelines", () => {
  for (const feel of FEELS) {
    describe(feel, () => {
      const c = buildCurve(feel);

      it("starts at pose A and has pose B at the middle of the rep", () => {
        expect(c.base).toHaveLength(LUT_N + 1);
        expect(c.extra).toHaveLength(LUT_N + 1);
        expect(c.base[0]).toBe(0);
        expect(c.base[LUT_N / 2]).toBe(1);
        expect(c.base[LUT_N]).toBe(0);
        // A frozen frame at 0 or 0.5 is the authored pose, not a pose mid-overshoot.
        expect(c.extra[0]).toBeCloseTo(0, 9);
        expect(c.extra[LUT_N / 2]).toBeCloseTo(0, 9);
        expect(c.extra[LUT_N]).toBeCloseTo(0, 9);
      });

      it("never jumps: the whole curve is continuous", () => {
        let worst = 0;
        for (let i = 1; i <= LUT_N; i++) {
          worst = Math.max(
            worst,
            Math.abs(c.base[i] + c.extra[i] - c.base[i - 1] - c.extra[i - 1]),
          );
        }
        // The steepest feel (a bounce's airborne swing) still moves < 7% of the
        // way per 1/240 of a rep.
        expect(worst).toBeLessThan(0.07);
      });

      it("stays near the two poses — overshoot is a nudge, not a lunge", () => {
        for (let i = 0; i <= LUT_N; i++) {
          const t = c.base[i] + c.extra[i];
          expect(t).toBeGreaterThan(-0.12);
          expect(t).toBeLessThan(1.12);
        }
      });
    });
  }

  it("lifts hold the top and the bottom instead of reversing on the spot", () => {
    const c = buildCurve("lift");
    // The bottom is held across the middle of the rep…
    for (const p of [0.43, 0.5, 0.57]) expect(lutAt(c.base, p)).toBe(1);
    // …and the top is held through the end of one rep and the start of the next.
    for (const p of [0.92, 0.98, 0.02, 0.06]) expect(lutAt(c.base, p)).toBe(0);
  });

  it("a lift settles past the top after the drive, then comes back", () => {
    const c = buildCurve("lift");
    let past = 0;
    for (let i = Math.floor(0.9 * LUT_N); i <= LUT_N; i++) past = Math.min(past, c.extra[i]);
    expect(past).toBeLessThan(-0.04);
    expect(c.extra[LUT_N]).toBeCloseTo(0, 9);
  });

  it("a lift dips the wrong way before it drives down (anticipation)", () => {
    const c = buildCurve("lift");
    let dip = 0;
    for (let i = 0; i <= Math.floor(0.1 * LUT_N); i++) dip = Math.min(dip, c.extra[i]);
    expect(dip).toBeLessThan(-0.04);
  });

  it("samples between table entries", () => {
    const c = buildCurve("steady");
    const a = lutAt(c.base, 1 / LUT_N);
    const b = lutAt(c.base, 2 / LUT_N);
    const mid = lutAt(c.base, 1.5 / LUT_N);
    expect(mid).toBeCloseTo((a + b) / 2, 9);
  });

  it("no feel is a plain ping-pong: the others pack their movement into part of the rep", () => {
    // The steadiest feel is a sine: its peak slope is pi. A lift and a bounce hold
    // part of the rep still, so the rest of it has to move faster.
    expect(peakSlope(buildCurve("steady"))).toBeCloseTo(Math.PI, 1);
    expect(peakSlope(buildCurve("lift"))).toBeGreaterThan(Math.PI * 1.3);
    expect(peakSlope(buildCurve("bounce"))).toBeGreaterThan(Math.PI * 1.3);
    // Flow and hold are the gentle ones.
    expect(peakSlope(buildCurve("hold"))).toBeCloseTo(Math.PI, 1);
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

describe("the speed budget", () => {
  it("slows a movement whose joints would turn too fast, and never speeds one up", () => {
    // A jumping jack was authored at 700 ms: its forearm turned 900°/s.
    const jack = resolveTempo("jumpingJack", metrics(700, 171));
    expect(jack.loopMs).toBeGreaterThanOrEqual(1200);
    // A rep authored slower than the budget needs is left exactly as it was.
    expect(resolveTempo("squat", metrics(5000, 82, 10)).loopMs).toBe(5000);
    // Even a sluggish rep is never shortened.
    for (const [m, ms, sw] of [
      ["squat", 2400, 82],
      ["curl", 2000, 165],
      ["highKnee", 620, 100],
      ["plank", 4200, 2],
    ] as const) {
      expect(resolveTempo(m, metrics(ms, sw)).loopMs).toBeGreaterThanOrEqual(ms);
    }
  });

  it("holds every feel to its angular speed at the curve's steepest", () => {
    for (const [motion, ms, sw] of [
      ["squat", 1500, 120],
      ["highKnee", 400, 120],
      ["jumpingJack", 500, 175],
      ["downDog", 1500, 120],
    ] as const) {
      const t = resolveTempo(motion, metrics(ms, sw));
      const peak = (sw * t.slope) / (t.loopMs / 1000);
      // Rounded to 50 ms, so allow a hair over.
      expect(peak, motion).toBeLessThanOrEqual(speedBudget(t.feel) * 1.04);
    }
  });

  it("keeps a short loop from strobing: every feel has a floor", () => {
    expect(resolveTempo("fastFeet", metrics(420, 98)).loopMs).toBeGreaterThanOrEqual(800);
    expect(resolveTempo("highKnee", metrics(620, 100)).loopMs).toBeGreaterThanOrEqual(1000);
    expect(resolveTempo("squat", metrics(900, 10)).loopMs).toBeGreaterThanOrEqual(1800);
  });

  it("rounds to 50 ms and runs the clock over several reps", () => {
    for (const [m, ms, sw] of [
      ["squat", 2400, 82],
      ["jumpingJack", 700, 171],
      ["plank", 4200, 2],
      ["downDog", 3200, 23],
    ] as const) {
      const t = resolveTempo(m, metrics(ms, sw));
      expect(t.loopMs % 50).toBe(0);
      expect(t.reps).toBeGreaterThanOrEqual(2);
      expect(t.reps).toBeLessThanOrEqual(6);
      expect(t.macroMs).toBe(t.loopMs * t.reps);
    }
  });
});

describe("how loose each bone is", () => {
  it("an elbow or a knee overshoots less than a shoulder or a hip", () => {
    expect(boneFeel("foreArmR").gain).toBeLessThan(boneFeel("upArmR").gain);
    expect(boneFeel("shin").gain).toBeLessThan(boneFeel("thigh").gain);
    expect(boneFeel("farForeArm").gain).toBe(boneFeel("foreArm").gain);
  });

  it("each level of the chain trails the one above it, by a believable amount", () => {
    expect(boneFeel("upperSpine").lagMs).toBeGreaterThan(boneFeel("lowerSpine").lagMs);
    expect(boneFeel("foreArm").lagMs).toBeGreaterThan(boneFeel("upArm").lagMs);
    expect(boneFeel("shin").lagMs).toBeGreaterThan(boneFeel("thigh").lagMs);
    for (const n of ["lowerSpine", "upperSpine", "neck", "upArm", "foreArm", "thigh", "shin", "foot", "clavR"]) {
      const { lagMs } = boneFeel(n);
      expect(lagMs).toBeGreaterThanOrEqual(0);
      expect(lagMs).toBeLessThanOrEqual(100);
    }
  });

  it("positioning bones never overshoot", () => {
    expect(boneFeel("pelvisR").gain).toBe(0);
  });
});

describe("the life layer", () => {
  for (const feel of FEELS) {
    describe(feel, () => {
      const k = kitFor(feel);
      const frames: number[][] = [];
      const N = 600;
      for (let i = 0; i <= N; i++) {
        const p = i / N;
        const q = (p * k.reps) % 1;
        frames.push(lifeAt(k, p, q, 0.02, 0.5));
      }

      it("is finite everywhere", () => {
        for (const f of frames) {
          expect(f).toHaveLength(FX.LENGTH);
          for (const v of f) expect(Number.isFinite(v)).toBe(true);
        }
      });

      it("rests on the first frame: a frozen figure is not mid-anything", () => {
        expect(Math.abs(frames[0][FX.SWAY])).toBeLessThan(0.1);
        expect(frames[0][FX.EFFORT]).toBeLessThan(0.15);
      });

      it("ends the macro cycle as it began, so the loop has no seam", () => {
        const a = frames[0];
        const z = lifeAt(k, 0.999999, ((0.999999 * k.reps) % 1), 0.02, 0.5);
        for (const s of [FX.BREATH, FX.SQUASH, FX.SHADOW, FX.EFFORT]) {
          expect(Math.abs(a[s] - z[s]), `channel ${s}`).toBeLessThan(0.08);
        }
      });
    });
  }

  it("works the body on the drive of a lift, not on the way down", () => {
    const k = kitFor("lift");
    const at = (q: number) => lifeAt(k, q / k.reps, q, 0, 0)[FX.EFFORT];
    expect(at(0)).toBe(0);
    expect(at(0.2)).toBe(0);
    expect(at(0.66)).toBeGreaterThan(0.8);
    expect(at(0.95)).toBe(0);
  });

  it("the hair trails a head that turns and hangs when the body drops", () => {
    const k = kitFor("lift");
    const turning = lifeAt(k, 0, 0.3, 0.1, 0);
    const still = lifeAt(k, 0, 0.3, 0, 0);
    expect(turning[FX.SWAY]).toBeLessThan(0);
    expect(still[FX.SWAY]).toBeCloseTo(0, 9);
    // Up is −y in the head's frame: falling hangs the hair up.
    expect(lifeAt(k, 0, 0.3, 0, 3)[FX.BOB]).toBeLessThan(0);
    // Clamped, so a hard turn cannot fling it.
    expect(Math.abs(lifeAt(k, 0, 0.3, 5, 99)[FX.SWAY])).toBeLessThanOrEqual(0.24);
  });

  it("only hops squash and stretch, and the shadow shrinks as the body rises", () => {
    const lift = kitFor("lift");
    const jump = kitFor("bounce");
    let liftSquash = 0;
    let squashLo = 0;
    let squashHi = 0;
    let shadowLo = 1;
    for (let i = 0; i <= 300; i++) {
      const q = i / 300;
      liftSquash = Math.max(liftSquash, Math.abs(lifeAt(lift, q / lift.reps, q, 0, 0)[FX.SQUASH]));
      const f = lifeAt(jump, q / jump.reps, q, 0, 0);
      squashLo = Math.min(squashLo, f[FX.SQUASH]);
      squashHi = Math.max(squashHi, f[FX.SQUASH]);
      shadowLo = Math.min(shadowLo, f[FX.SHADOW]);
    }
    expect(liftSquash).toBe(0);
    expect(squashLo).toBeLessThan(-0.04);
    expect(squashHi).toBeGreaterThan(0.02);
    expect(shadowLo).toBeLessThan(0.8);
  });
});
